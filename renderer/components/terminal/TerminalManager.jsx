import React, { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "primereact/button"
import { ConfirmDialog } from "primereact/confirmdialog"
import { ContextMenu } from "primereact/contextmenu"
import { InputText } from "primereact/inputtext"
import { Splitter, SplitterPanel } from "primereact/splitter"
import { Tooltip } from "primereact/tooltip"
import TerminalInstance from "./TerminalInstance"
import uuid from "react-native-uuid"
import { ipcRenderer } from "electron"

// Delay (in ms) for resizing terminals after unsplit
const TERMINAL_UNSPLIT_RESIZE_DELAY = 150

/**
 * Terminal Manager Component
 * Features vertical tab manager on the right side with drag & drop, rename, and split functionality
 * @param {Object} props - Component props
 * @param {boolean} props.useIPython - Whether to create IPython sessions instead of regular terminals
 */
const TerminalManager = ({ useIPython = false }) => {
  const [terminals, setTerminals] = useState([])
  const [activeTerminalId, setActiveTerminalId] = useState(null)
  const [editingTerminal, setEditingTerminal] = useState(null)
  const [draggedTerminal, setDraggedTerminal] = useState(null)
  const [dragOverIndex, setDragOverIndex] = useState(null)
  const [splitTerminals, setSplitTerminals] = useState({}) // Maps parent terminal ID to split info
  const [currentContextMenuItems, setCurrentContextMenuItems] = useState([])
  const terminalRefs = useRef({})
  const contextMenuRef = useRef(null)
  const editInputRef = useRef(null)

  // Create a new terminal instance
  const createNewTerminal = useCallback(
    (parentTerminal = null) => {
      const terminalId = uuid.v4()
      const sessionType = useIPython ? "IPython" : "Terminal"
      const newTerminal = {
        id: terminalId,
        title: `${sessionType} ${terminals.length + 1}`,
        isActive: false,
        parentId: parentTerminal?.id || null,
        cwd: parentTerminal?.cwd || null, // Inherit CWD from parent
        isSplit: false,
        splitPane: null,
        isManuallyRenamed: false, // Initialize as not manually renamed
        useIPython: useIPython // Store the IPython flag for this terminal
      }

      setTerminals((prev) => [...prev, newTerminal])
      setActiveTerminalId(terminalId)
      return newTerminal
    },
    [terminals.length, useIPython]
  )

  // Split terminal - create side-by-side terminal panes
  const splitTerminal = useCallback(
    async (terminalId) => {
      const terminal = terminals.find((t) => t.id === terminalId)
      if (!terminal || terminal.isSplit) {
        return // Can't split an already split terminal
      }

      try {
        // Store session information for the source terminal
        // This will prevent recreation of the terminal on state changes
        sessionStorage.setItem(`terminal-split-source-${terminalId}`, "true")

        // Get the current working directory from the original terminal
        const terminalCwd = await ipcRenderer.invoke("terminal-get-cwd", terminalId)
        console.log(`Splitting terminal ${terminalId} with CWD: ${terminalCwd}`)

        // Generate a new ID for the right split terminal
        const splitTerminalId = uuid.v4()

        // Mark the split terminal in session storage
        sessionStorage.setItem(`terminal-split-${splitTerminalId}`, "true")

        // Clone the terminal using the backend method to ensure same directory
        const cloneResult = await ipcRenderer.invoke("terminal-clone", terminalId, splitTerminalId, {
          cols: 80,
          rows: 24
        })

        console.log("Clone result:", cloneResult)

        // Create the split terminal object for the right side only
        const splitTerminal = {
          id: splitTerminalId,
          title: `${terminal.title} (Split)`,
          isActive: false,
          parentId: terminalId,
          cwd: cloneResult.cwd || terminalCwd, // Use the CWD from the backend
          isSplit: true,
          splitPane: "right",
          isManuallyRenamed: false, // Initialize as not manually renamed
          sourceTerminalId: terminalId // Track the source terminal
        }

        // For the left terminal, we only update metadata without recreating the instance
        const updatedTerminals = [...terminals]
        const leftTerminalIndex = updatedTerminals.findIndex((t) => t.id === terminalId)

        if (leftTerminalIndex !== -1) {
          // Update the original terminal's metadata - DO NOT replace the instance
          updatedTerminals[leftTerminalIndex] = {
            ...updatedTerminals[leftTerminalIndex],
            isSplit: true,
            splitPane: "left",
            linkedTerminalId: splitTerminalId // Reference to the right terminal
          }
        }

        // Add the new right terminal
        updatedTerminals.push(splitTerminal)

        // Update state with both terminals
        setTerminals(updatedTerminals)

        // Store split information
        setSplitTerminals((prev) => ({
          ...prev,
          [terminalId]: {
            leftTerminalId: terminalId,
            rightTerminalId: splitTerminalId,
            sharedDirectory: cloneResult.cwd || terminalCwd
          }
        }))

        // Set the new split terminal as active
        setActiveTerminalId(splitTerminalId)
      } catch (error) {
        console.error("Failed to split terminal:", error)
      }
    },
    [terminals]
  )

  // Close a specific terminal
  const closeTerminal = useCallback(
    (terminalId) => {
      // Track if this is the last terminal and user explicitly closed it
      const isLastTerminal = terminals.length === 1

      // If we're closing the last terminal, mark it in session storage
      if (isLastTerminal) {
        sessionStorage.setItem("lastTerminalExplicitlyClosed", "true")
      }

      // Clean up all session storage flags for this terminal
      sessionStorage.removeItem(`terminal-split-${terminalId}`)
      sessionStorage.removeItem(`terminal-split-source-${terminalId}`)
      sessionStorage.removeItem(`terminal-unsplit-preserve-${terminalId}`)

      // Clean up the terminal reference
      if (terminalRefs.current[terminalId]) {
        terminalRefs.current[terminalId].dispose()
        delete terminalRefs.current[terminalId]
      }

      setTerminals((prev) => {
        const filteredTerminals = prev.filter((terminal) => terminal.id !== terminalId)

        // If we're closing the active terminal, switch to another one
        if (terminalId === activeTerminalId) {
          const currentIndex = prev.findIndex((t) => t.id === terminalId)
          if (filteredTerminals.length > 0) {
            // Try to activate the next terminal, or the previous one if this was the last
            const nextIndex = currentIndex < filteredTerminals.length ? currentIndex : currentIndex - 1
            setActiveTerminalId(filteredTerminals[Math.max(0, nextIndex)]?.id || null)
          } else {
            setActiveTerminalId(null)
          }
        }

        return filteredTerminals
      })
    },
    [activeTerminalId, terminals.length]
  )

  // Unsplit terminal - keep both terminals (left remains as primary, right becomes standalone)
  const unsplitTerminal = useCallback(
    (terminalId) => {
      const terminal = terminals.find((t) => t.id === terminalId)
      if (terminal && terminal.isSplit) {
        // Find the split group
        let splitInfo = null
        let parentId = null

        // Check if this terminal is the parent of a split
        if (splitTerminals[terminalId]) {
          splitInfo = splitTerminals[terminalId]
          parentId = terminalId
        } else {
          // Check if this terminal is the child of a split
          Object.entries(splitTerminals).forEach(([pId, info]) => {
            if (info.rightTerminalId === terminalId) {
              splitInfo = info
              parentId = pId
            }
          })
        }

        if (splitInfo && parentId) {
          const { leftTerminalId, rightTerminalId } = splitInfo

          // Store references to both terminal instances
          const leftTerminal = terminals.find((t) => t.id === leftTerminalId)
          const rightTerminal = terminals.find((t) => t.id === rightTerminalId)

          if (!leftTerminal || !rightTerminal) {
            console.error("Missing terminal references for unsplit operation")
            return
          }

          // Set flags to preserve both terminal instances during unsplit
          sessionStorage.setItem(`terminal-unsplit-preserve-${leftTerminalId}`, "true")
          sessionStorage.setItem(`terminal-unsplit-preserve-${rightTerminalId}`, "true")

          // Make the left terminal (original) active
          setActiveTerminalId(leftTerminalId)

          // Clean up split session markers
          sessionStorage.removeItem(`terminal-split-${leftTerminalId}`)
          sessionStorage.removeItem(`terminal-split-${rightTerminalId}`)
          sessionStorage.removeItem(`terminal-split-source-${leftTerminalId}`)

          // Create a standalone instance for the right terminal if needed
          // We don't actually need to re-create the process, just update UI state
          console.log("Unsplitting terminals - keeping both instances active")

          // Update terminals state - unsplit both terminals
          setTerminals((prev) => {
            // Create a copy of the terminals array to avoid mutation
            const updatedTerminals = [...prev]

            // Find indices of both terminals
            const leftIndex = updatedTerminals.findIndex((t) => t.id === leftTerminalId)
            const rightIndex = updatedTerminals.findIndex((t) => t.id === rightTerminalId)

            // Update the left terminal (originally the parent)
            if (leftIndex !== -1) {
              updatedTerminals[leftIndex] = {
                ...updatedTerminals[leftIndex],
                isSplit: false,
                splitPane: null,
                linkedTerminalId: undefined
              }
            }

            // Update the right terminal (move to standalone)
            if (rightIndex !== -1) {
              // Update terminal state without creating a new process
              const rightTerminalTitle = updatedTerminals[rightIndex].title.replace(" (Split)", "") || "Terminal"

              updatedTerminals[rightIndex] = {
                ...updatedTerminals[rightIndex],
                isSplit: false,
                splitPane: null,
                parentId: null, // No longer a child terminal
                title: rightTerminalTitle
              }
            }

            return updatedTerminals
          })

          // Remove split info
          setSplitTerminals((prev) => {
            const newSplit = { ...prev }
            delete newSplit[parentId]
            return newSplit
          })

          // Ensure both terminals get properly sized
          setTimeout(() => {
            if (terminalRefs.current[leftTerminalId]) {
              terminalRefs.current[leftTerminalId].fit()
            }

            if (terminalRefs.current[rightTerminalId]) {
              terminalRefs.current[rightTerminalId].fit()
            }
          }, TERMINAL_UNSPLIT_RESIZE_DELAY)
        }
      }
    },
    [terminals, splitTerminals]
  )

  // Rename terminal
  const startRename = useCallback((terminalId) => {
    // Store original title for potential cancellation
    setTerminals((prev) => prev.map((terminal) => (terminal.id === terminalId ? { ...terminal, originalTitle: terminal.title } : terminal)))
    setEditingTerminal(terminalId)
    setTimeout(() => {
      if (editInputRef.current) {
        editInputRef.current.focus()
        editInputRef.current.select()
      }
    }, 100)
  }, [])

  const finishRename = useCallback((terminalId, newTitle) => {
    if (newTitle && newTitle.trim()) {
      setTerminals((prev) =>
        prev.map((terminal) =>
          terminal.id === terminalId
            ? {
                ...terminal,
                title: newTitle.trim(),
                isManuallyRenamed: true, // Mark as manually renamed
                originalTitle: undefined // Clean up temporary storage
              }
            : terminal
        )
      )
    } else {
      // If empty title, restore original
      setTerminals((prev) =>
        prev.map((terminal) =>
          terminal.id === terminalId
            ? {
                ...terminal,
                title: terminal.originalTitle || terminal.title,
                isManuallyRenamed: false, // Reset manual rename flag
                originalTitle: undefined // Clean up temporary storage
              }
            : terminal
        )
      )
    }
    setEditingTerminal(null)
  }, [])

  // Reset terminal to automatic title updates
  const resetToAutomaticTitle = useCallback((terminalId) => {
    setTerminals((prev) =>
      prev.map((terminal) =>
        terminal.id === terminalId
          ? {
              ...terminal,
              isManuallyRenamed: false,
              title: `Terminal ${prev.findIndex((t) => t.id === terminalId) + 1}` // Reset to default naming
            }
          : terminal
      )
    )
  }, [])

  // Update terminal title when working directory changes
  const updateTerminalTitle = useCallback(
    (terminalId, newTitle) => {
      // Don't update title if terminal is being edited or has been manually renamed
      if (!editingTerminal) {
        setTerminals((prev) => prev.map((terminal) => (terminal.id === terminalId && !terminal.isManuallyRenamed ? { ...terminal, title: newTitle } : terminal)))
      }
    },
    [editingTerminal]
  )

  // Drag and drop handlers
  const handleDragStart = useCallback((e, terminal) => {
    setDraggedTerminal(terminal)
    e.dataTransfer.effectAllowed = "move"
  }, [])

  const handleDragOver = useCallback((e, index) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setDragOverIndex(index)
  }, [])

  const handleDrop = useCallback(
    (e, dropIndex) => {
      e.preventDefault()
      if (draggedTerminal) {
        setTerminals((prev) => {
          const dragIndex = prev.findIndex((t) => t.id === draggedTerminal.id)
          if (dragIndex !== dropIndex) {
            const newTerminals = [...prev]
            const [removed] = newTerminals.splice(dragIndex, 1)
            newTerminals.splice(dropIndex, 0, removed)
            return newTerminals
          }
          return prev
        })
      }
      setDraggedTerminal(null)
      setDragOverIndex(null)
    },
    [draggedTerminal]
  )

  // Context menu items - dynamic based on terminal state
  const getContextMenuItems = useCallback(
    (terminalId) => {
      const terminal = terminals.find((t) => t.id === terminalId)
      const isSplit = terminal?.isSplit || false
      const isManuallyRenamed = terminal?.isManuallyRenamed || false
      const sessionType = useIPython ? "IPython Session" : "Terminal"

      const baseItems = [
        {
          label: `New ${sessionType}`,
          icon: "pi pi-plus",
          command: () => createNewTerminal()
        }
      ]

      if (!isSplit) {
        baseItems.push({
          label: `Split ${sessionType}`,
          icon: "pi pi-clone",
          command: () => splitTerminal(terminalId)
        })
      } else {
        baseItems.push({
          label: `Unsplit ${sessionType}`,
          icon: "pi pi-minus",
          command: () => unsplitTerminal(terminalId)
        })
      }

      baseItems.push({
        label: "Rename",
        icon: "pi pi-pencil",
        command: () => startRename(terminalId)
      })

      // Add "Reset to automatic title" option for manually renamed terminals
      if (isManuallyRenamed) {
        baseItems.push({
          label: "Reset to automatic title",
          icon: "pi pi-refresh",
          command: () => resetToAutomaticTitle(terminalId)
        })
      }

      baseItems.push(
        { separator: true },
        {
          label: "Close",
          icon: "pi pi-times",
          command: () => closeTerminal(terminalId)
        }
      )

      return baseItems
    },
    [terminals, createNewTerminal, splitTerminal, unsplitTerminal, startRename, closeTerminal, resetToAutomaticTitle, useIPython]
  )

  // Context menu items (fallback for backward compatibility)
  const contextMenuItems = [
    {
      label: `New ${useIPython ? 'IPython Session' : 'Terminal'}`,
      icon: "pi pi-plus",
      command: () => createNewTerminal()
    },
    {
      label: `Split ${useIPython ? 'Session' : 'Terminal'}`,
      icon: "pi pi-clone",
      command: () => {
        const terminalId = contextMenuRef.current?.activeTerminalId
        if (terminalId) splitTerminal(terminalId)
      }
    },
    {
      label: "Rename",
      icon: "pi pi-pencil",
      command: () => {
        const terminalId = contextMenuRef.current?.activeTerminalId
        if (terminalId) startRename(terminalId)
      }
    },
    { separator: true },
    {
      label: "Close",
      icon: "pi pi-times",
      command: () => {
        const terminalId = contextMenuRef.current?.activeTerminalId
        if (terminalId) closeTerminal(terminalId)
      }
    }
  ]

  // Initialize with one terminal if none exist
  useEffect(() => {
    if (terminals.length === 0) {
      // Check if user explicitly closed the last terminal
      const userClosedLastTerminal = sessionStorage.getItem("lastTerminalExplicitlyClosed") === "true"

      if (!userClosedLastTerminal) {
        // Only auto-create a terminal if the user didn't explicitly close the last one
        createNewTerminal()
      } else {
        // Reset the flag after we've honored the user's choice once
        sessionStorage.removeItem("lastTerminalExplicitlyClosed")
      }
    }
  }, [createNewTerminal, terminals.length])

  const activeTerminal = terminals.find((t) => t.id === activeTerminalId)

  // Keyboard shortcuts for terminal actions
  useEffect(() => {
    const handleKeyDown = (e) => {
      // New Terminal (Ctrl+Shift+`)
      if (e.ctrlKey && e.shiftKey && e.key === "`") {
        e.preventDefault()
        createNewTerminal()
        return
      }

      // Split Terminal (Ctrl+Shift+5)
      if (e.ctrlKey && e.shiftKey && e.key === "%") {
        e.preventDefault()
        if (activeTerminalId && activeTerminal && !activeTerminal.isSplit) {
          splitTerminal(activeTerminalId)
        }
        return
      }

      // Unsplit Terminal (Ctrl+Shift+U)
      if (e.ctrlKey && e.shiftKey && e.key === "U") {
        e.preventDefault()
        if (activeTerminalId && activeTerminal && activeTerminal.isSplit) {
          unsplitTerminal(activeTerminalId)
        }
        return
      }

      // Kill Terminal (Ctrl+Shift+K)
      if (e.ctrlKey && e.shiftKey && e.key === "K") {
        e.preventDefault()
        if (activeTerminalId && terminals.length > 1) {
          closeTerminal(activeTerminalId)
        }
        return
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [activeTerminalId, activeTerminal, terminals.length, createNewTerminal, splitTerminal, unsplitTerminal, closeTerminal])

  return (
    <div className="terminal-container" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Tooltips for buttons - Enhanced with keyboard shortcuts */}
      <Tooltip target=".terminal-kill-btn" content="Kill Terminal (Ctrl+Shift+K)" position="bottom" showDelay={500} hideDelay={0} />
      <Tooltip target=".terminal-new-btn-header" content="New Terminal (Ctrl+Shift+`)" position="bottom" showDelay={500} hideDelay={0} />
      <Tooltip target=".terminal-split-tab-btn" content="Split Terminal (Ctrl+Shift+5)" position="bottom" showDelay={500} hideDelay={0} />
      <Tooltip target=".terminal-unsplit-tab-btn" content="Unsplit Terminal (Ctrl+Shift+U)" position="bottom" showDelay={500} hideDelay={0} />


      {/* Main Terminal Area with Vertical Tab Manager */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        <Splitter style={{ height: "100%" }} resizerStyle={{ backgroundColor: "var(--border-color)" }}>
          {/* Terminal Content Area */}
          <SplitterPanel size={75} minSize={50}>
            <div style={{ height: "100%", position: "relative" }}>
              {/* Check if we have any split terminals */}
              {(() => {
                const activeSplitInfo = Object.entries(splitTerminals).find(([, info]) => info.leftTerminalId === activeTerminalId || info.rightTerminalId === activeTerminalId)

                if (activeSplitInfo) {
                  // Render split view
                  const [, { leftTerminalId, rightTerminalId }] = activeSplitInfo
                  const leftTerminal = terminals.find((t) => t.id === leftTerminalId)
                  const rightTerminal = terminals.find((t) => t.id === rightTerminalId)

                  if (leftTerminal && rightTerminal) {
                    return (
                      <Splitter style={{ height: "100%" }} layout="horizontal" resizerStyle={{ backgroundColor: "var(--border-color)" }}>
                        <SplitterPanel size={50} minSize={20}>
                          <div style={{ height: "100%", position: "relative" }}>
                            <TerminalInstance
                              terminalId={leftTerminal.id}
                              isActive={leftTerminal.id === activeTerminalId}
                              onTitleChange={(newTitle) => updateTerminalTitle(leftTerminal.id, newTitle)}
                              onSplit={splitTerminal}
                              onUnsplit={unsplitTerminal}
                              isSplit={leftTerminal.isSplit}
                              useIPython={useIPython}
                              ref={(ref) => {
                                if (ref) {
                                  terminalRefs.current[leftTerminal.id] = ref
                                }
                              }}
                            />
                          </div>
                        </SplitterPanel>
                        <SplitterPanel size={50} minSize={20}>
                          <div style={{ height: "100%", position: "relative" }}>
                            <TerminalInstance
                              terminalId={rightTerminal.id}
                              isActive={rightTerminal.id === activeTerminalId}
                              onTitleChange={(newTitle) => updateTerminalTitle(rightTerminal.id, newTitle)}
                              onSplit={splitTerminal}
                              onUnsplit={unsplitTerminal}
                              isSplit={rightTerminal.isSplit}
                              useIPython={useIPython}
                              ref={(ref) => {
                                if (ref) {
                                  terminalRefs.current[rightTerminal.id] = ref
                                }
                              }}
                            />
                          </div>
                        </SplitterPanel>
                      </Splitter>
                    )
                  }
                }

                // Render normal single terminal view
                return terminals.map((terminal) => (
                  <div
                    key={terminal.id}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      display: terminal.id === activeTerminalId && !terminal.isSplit ? "block" : "none"
                    }}
                  >
                    <TerminalInstance
                      terminalId={terminal.id}
                      isActive={terminal.id === activeTerminalId}
                      onTitleChange={(newTitle) => updateTerminalTitle(terminal.id, newTitle)}
                      onSplit={splitTerminal}
                      onUnsplit={unsplitTerminal}
                      isSplit={terminal.isSplit}
                      useIPython={useIPython}
                      ref={(ref) => {
                        if (ref) {
                          terminalRefs.current[terminal.id] = ref
                        }
                      }}
                    />
                  </div>
                ))
              })()}
            </div>
          </SplitterPanel>

          {/* Vertical Tab Manager */}
          <SplitterPanel size={25} minSize={5} maxSize={35} style={{ minWidth: "20px", maxWidth: "300px" }}>
            <div
              className="terminal-tab-list"
              style={{
                height: "100%",
                backgroundColor: "var(--card-bg)",
                borderLeft: "1px solid var(--border-color)",
                display: "flex",
                flexDirection: "column"
              }}
            >
              <div
                style={{
                  padding: "8px",
                  borderBottom: "1px solid var(--border-color)",
                  fontSize: "11px",
                  fontWeight: "bold",
                  color: "var(--text-secondary)",
                  textTransform: "uppercase",
                  flexShrink: 0,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}
              >
                <span>{useIPython ? 'IPython Sessions' : 'Terminals'}</span>
                <Button
                  icon="pi pi-plus"
                  size="small"
                  text
                  onClick={createNewTerminal}
                  className="terminal-new-btn-header"
                  style={{
                    width: "18px",
                    height: "18px",
                    padding: "0",
                    minWidth: "unset",
                    opacity: 0.7,
                    color: "var(--text-secondary)"
                  }}
                />
              </div>

              <div style={{ flex: 1, overflow: "auto" }}>
                {terminals.map((terminal, index) => (
                  <div
                    key={terminal.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, terminal)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={(e) => handleDrop(e, index)}
                    onDragLeave={() => setDragOverIndex(null)}
                    onClick={() => {
                      // When clicking on a split terminal, activate it and ensure it shows in split view
                      setActiveTerminalId(terminal.id)
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      const dynamicMenuItems = getContextMenuItems(terminal.id)
                      contextMenuRef.current.activeTerminalId = terminal.id
                      // Store the menu items and show context menu
                      if (contextMenuRef.current) {
                        // Update the menu model temporarily (PrimeReact ContextMenu doesn't have setModel)
                        // We'll use a different approach - set model in state and re-render
                        setCurrentContextMenuItems(dynamicMenuItems)
                        setTimeout(() => {
                          contextMenuRef.current.show(e)
                        }, 0)
                      }
                    }}
                    className={`terminal-tab-item ${terminal.id === activeTerminalId ? "active" : ""}`}
                    style={{
                      padding: "8px 12px",
                      cursor: "pointer",
                      backgroundColor: terminal.id === activeTerminalId ? "var(--primary-color)" : dragOverIndex === index ? "var(--surface-hover)" : "transparent",
                      color: terminal.id === activeTerminalId ? "white" : "var(--text-primary)",
                      borderBottom: "1px solid var(--border-color)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      fontSize: "12px",
                      transition: "background-color 0.2s",
                      opacity: draggedTerminal?.id === terminal.id ? 0.5 : 1,
                      minHeight: "32px", // Ensure consistent height
                      position: "relative"
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {editingTerminal === terminal.id ? (
                        <InputText
                          ref={editInputRef}
                          value={terminal.title}
                          onChange={(e) => {
                            const newTitle = e.target.value
                            setTerminals((prev) => prev.map((t) => (t.id === terminal.id ? { ...t, title: newTitle } : t)))
                          }}
                          onBlur={() => {
                            const currentTerminal = terminals.find((t) => t.id === terminal.id)
                            finishRename(terminal.id, currentTerminal?.title || terminal.title)
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              const currentTerminal = terminals.find((t) => t.id === terminal.id)
                              finishRename(terminal.id, currentTerminal?.title || terminal.title)
                              e.preventDefault()
                            } else if (e.key === "Escape") {
                              // Reset to original title
                              setTerminals((prev) => prev.map((t) => (t.id === terminal.id ? { ...t, title: t.originalTitle || terminal.title } : t)))
                              setEditingTerminal(null)
                              e.preventDefault()
                            }
                          }}
                          style={{
                            width: "100%",
                            fontSize: "12px",
                            padding: "2px 4px",
                            border: "1px solid var(--primary-color)",
                            backgroundColor: "var(--surface-ground)",
                            color: "var(--text-primary)",
                            borderRadius: "2px"
                          }}
                        />
                      ) : (
                        <span
                          style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px"
                          }}
                          title={terminal.title}
                        >
                          {terminal.isSplit && (
                            <i
                              className="pi pi-clone"
                              style={{
                                fontSize: "10px",
                                opacity: 0.7,
                                color: terminal.id === activeTerminalId ? "white" : "var(--blue-400)"
                              }}
                            />
                          )}
                          {terminal.title}
                        </span>
                      )}
                    </div>

                    {/* Control buttons container - shows on hover */}
                    <div
                      className="terminal-tab-controls"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "2px",
                        marginLeft: "4px",
                        opacity: 0,
                        transition: "opacity 0.2s ease"
                      }}
                    >
                      {/* Split/Unsplit button */}
                      {!terminal.isSplit ? (
                        <Button
                          icon="pi pi-clone"
                          size="small"
                          text
                          onClick={(e) => {
                            e.stopPropagation()
                            splitTerminal(terminal.id)
                          }}
                          className="terminal-split-tab-btn"
                          style={{
                            width: "16px",
                            height: "16px",
                            padding: "0",
                            minWidth: "unset",
                            opacity: 0.7,
                            fontSize: "10px"
                          }}
                        />
                      ) : (
                        <Button
                          icon="pi pi-minus"
                          size="small"
                          text
                          onClick={(e) => {
                            e.stopPropagation()
                            unsplitTerminal(terminal.id)
                          }}
                          className="terminal-unsplit-tab-btn"
                          style={{
                            width: "16px",
                            height: "16px",
                            padding: "0",
                            minWidth: "unset",
                            opacity: 0.7,
                            fontSize: "10px"
                          }}
                        />
                      )}

                      {/* Close button - allow closing the last terminal */}
                      <Button
                        icon="pi pi-times"
                        size="small"
                        text
                        onClick={(e) => {
                          e.stopPropagation()
                          closeTerminal(terminal.id)
                        }}
                        style={{
                          width: "16px",
                          height: "16px",
                          padding: "0",
                          minWidth: "unset",
                          opacity: 0.7,
                          fontSize: "10px"
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </SplitterPanel>
        </Splitter>
      </div>

      <ContextMenu ref={contextMenuRef} model={currentContextMenuItems.length > 0 ? currentContextMenuItems : contextMenuItems} />
      <ConfirmDialog />
    </div>
  )
}

export default TerminalManager
