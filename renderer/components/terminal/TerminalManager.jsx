import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Button } from 'primereact/button'
import { ConfirmDialog } from 'primereact/confirmdialog'
import { ContextMenu } from 'primereact/contextmenu'
import { InputText } from 'primereact/inputtext'
import { Splitter, SplitterPanel } from 'primereact/splitter'
import { Tooltip } from 'primereact/tooltip'
import TerminalInstance from './TerminalInstance'
import uuid from 'react-native-uuid'

/**
 * Terminal Manager Component
 * Features vertical tab manager on the right side with drag & drop, rename, and split functionality
 */
const TerminalManager = () => {
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
  const createNewTerminal = useCallback((parentTerminal = null) => {
    const terminalId = uuid.v4()
    const newTerminal = {
      id: terminalId,
      title: `Terminal ${terminals.length + 1}`,
      isActive: false,
      parentId: parentTerminal?.id || null,
      cwd: parentTerminal?.cwd || null, // Inherit CWD from parent
      isSplit: false,
      splitPane: null,
      isManuallyRenamed: false // Initialize as not manually renamed
    }
    
    setTerminals(prev => [...prev, newTerminal])
    setActiveTerminalId(terminalId)
    return newTerminal
  }, [terminals.length])

  // Split terminal - create side-by-side terminal panes
  const splitTerminal = useCallback((terminalId) => {
    const terminal = terminals.find(t => t.id === terminalId)
    if (!terminal || terminal.isSplit) {
      return // Can't split an already split terminal
    }

    // Create a new terminal instance for the split
    const splitTerminalId = uuid.v4()
    const splitTerminal = {
      id: splitTerminalId,
      title: `Terminal ${terminals.length + 1} (Split)`,
      isActive: false,
      parentId: terminalId,
      cwd: terminal.cwd, // Inherit current working directory
      isSplit: true,
      splitPane: 'right',
      isManuallyRenamed: false // Initialize as not manually renamed
    }

    // Update the original terminal to be split
    setTerminals(prev => [
      ...prev.map(t => 
        t.id === terminalId 
          ? { ...t, isSplit: true, splitPane: 'left' }
          : t
      ),
      splitTerminal
    ])

    // Store split information
    setSplitTerminals(prev => ({
      ...prev,
      [terminalId]: {
        leftTerminalId: terminalId,
        rightTerminalId: splitTerminalId
      }
    }))

    // Set the new split terminal as active
    setActiveTerminalId(splitTerminalId)
  }, [terminals])

  // Close a specific terminal
  const closeTerminal = useCallback((terminalId) => {
    // Clean up the terminal reference
    if (terminalRefs.current[terminalId]) {
      terminalRefs.current[terminalId].dispose()
      delete terminalRefs.current[terminalId]
    }

    setTerminals(prev => {
      const filteredTerminals = prev.filter(terminal => terminal.id !== terminalId)
      
      // If we're closing the active terminal, switch to another one
      if (terminalId === activeTerminalId) {
        const currentIndex = prev.findIndex(t => t.id === terminalId)
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
  }, [activeTerminalId])

  // Unsplit terminal - remove split terminal and restore single view
  const unsplitTerminal = useCallback((terminalId) => {
    const terminal = terminals.find(t => t.id === terminalId)
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
        
        // Remove the split terminal (keep the original)
        const terminalToRemove = terminalId === leftTerminalId ? rightTerminalId : leftTerminalId
        const terminalToKeep = terminalId === leftTerminalId ? leftTerminalId : rightTerminalId
        
        // Clean up the terminal reference for the removed terminal
        if (terminalRefs.current[terminalToRemove]) {
          terminalRefs.current[terminalToRemove].dispose()
          delete terminalRefs.current[terminalToRemove]
        }
        
        // Update terminals state
        setTerminals(prev => prev
          .filter(t => t.id !== terminalToRemove)
          .map(t => t.id === terminalToKeep 
            ? { ...t, isSplit: false, splitPane: null }
            : t
          )
        )
        
        // Remove split info
        setSplitTerminals(prev => {
          const newSplit = { ...prev }
          delete newSplit[parentId]
          return newSplit
        })
        
        // Set the remaining terminal as active
        setActiveTerminalId(terminalToKeep)
      }
    }
  }, [terminals, splitTerminals])

  // Rename terminal
  const startRename = useCallback((terminalId) => {
    // Store original title for potential cancellation
    setTerminals(prev => 
      prev.map(terminal => 
        terminal.id === terminalId 
          ? { ...terminal, originalTitle: terminal.title }
          : terminal
      )
    )
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
      setTerminals(prev => 
        prev.map(terminal => 
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
      setTerminals(prev => 
        prev.map(terminal => 
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
    setTerminals(prev => 
      prev.map(terminal => 
        terminal.id === terminalId 
          ? { 
              ...terminal, 
              isManuallyRenamed: false,
              title: `Terminal ${prev.findIndex(t => t.id === terminalId) + 1}` // Reset to default naming
            }
          : terminal
      )
    )
  }, [])

  // Update terminal title when working directory changes
  const updateTerminalTitle = useCallback((terminalId, newTitle) => {
    // Don't update title if terminal is being edited or has been manually renamed
    if (!editingTerminal) {
      setTerminals(prev => 
        prev.map(terminal => 
          terminal.id === terminalId && !terminal.isManuallyRenamed
            ? { ...terminal, title: newTitle }
            : terminal
        )
      )
    }
  }, [editingTerminal])

  // Drag and drop handlers
  const handleDragStart = useCallback((e, terminal) => {
    setDraggedTerminal(terminal)
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  const handleDragOver = useCallback((e, index) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIndex(index)
  }, [])

  const handleDrop = useCallback((e, dropIndex) => {
    e.preventDefault()
    if (draggedTerminal) {
      setTerminals(prev => {
        const dragIndex = prev.findIndex(t => t.id === draggedTerminal.id)
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
  }, [draggedTerminal])

  // Context menu items - dynamic based on terminal state
  const getContextMenuItems = useCallback((terminalId) => {
    const terminal = terminals.find(t => t.id === terminalId)
    const isSplit = terminal?.isSplit || false
    const isManuallyRenamed = terminal?.isManuallyRenamed || false
    
    const baseItems = [
      {
        label: 'New Terminal',
        icon: 'pi pi-plus',
        command: () => createNewTerminal()
      }
    ]

    if (!isSplit) {
      baseItems.push({
        label: 'Split Terminal',
        icon: 'pi pi-clone',
        command: () => splitTerminal(terminalId)
      })
    } else {
      baseItems.push({
        label: 'Unsplit Terminal',
        icon: 'pi pi-minus',
        command: () => unsplitTerminal(terminalId)
      })
    }

    baseItems.push(
      {
        label: 'Rename',
        icon: 'pi pi-pencil',
        command: () => startRename(terminalId)
      }
    )

    // Add "Reset to automatic title" option for manually renamed terminals
    if (isManuallyRenamed) {
      baseItems.push({
        label: 'Reset to automatic title',
        icon: 'pi pi-refresh',
        command: () => resetToAutomaticTitle(terminalId)
      })
    }

    baseItems.push(
      { separator: true },
      {
        label: 'Close',
        icon: 'pi pi-times',
        command: () => closeTerminal(terminalId)
      }
    )

    return baseItems
  }, [terminals, createNewTerminal, splitTerminal, unsplitTerminal, startRename, closeTerminal, resetToAutomaticTitle])

  // Context menu items (fallback for backward compatibility)
  const contextMenuItems = [
    {
      label: 'New Terminal',
      icon: 'pi pi-plus',
      command: () => createNewTerminal()
    },
    {
      label: 'Split Terminal',
      icon: 'pi pi-clone',
      command: () => {
        const terminalId = contextMenuRef.current?.activeTerminalId
        if (terminalId) splitTerminal(terminalId)
      }
    },
    {
      label: 'Rename',
      icon: 'pi pi-pencil',
      command: () => {
        const terminalId = contextMenuRef.current?.activeTerminalId
        if (terminalId) startRename(terminalId)
      }
    },
    { separator: true },
    {
      label: 'Close',
      icon: 'pi pi-times',
      command: () => {
        const terminalId = contextMenuRef.current?.activeTerminalId
        if (terminalId) closeTerminal(terminalId)
      }
    }
  ]

  // Initialize with one terminal if none exist
  useEffect(() => {
    if (terminals.length === 0) {
      createNewTerminal()
    }
  }, [createNewTerminal, terminals.length])

  const activeTerminal = terminals.find(t => t.id === activeTerminalId)

  // Keyboard shortcuts for terminal actions
  useEffect(() => {
    const handleKeyDown = (e) => {
      // New Terminal (Ctrl+Shift+`)
      if (e.ctrlKey && e.shiftKey && e.key === '`') {
        e.preventDefault()
        createNewTerminal()
        return
      }
      
      // Split Terminal (Ctrl+Shift+5)
      if (e.ctrlKey && e.shiftKey && e.key === '%') {
        e.preventDefault()
        if (activeTerminalId && activeTerminal && !activeTerminal.isSplit) {
          splitTerminal(activeTerminalId)
        }
        return
      }
      
      // Unsplit Terminal (Ctrl+Shift+U)
      if (e.ctrlKey && e.shiftKey && e.key === 'U') {
        e.preventDefault()
        if (activeTerminalId && activeTerminal && activeTerminal.isSplit) {
          unsplitTerminal(activeTerminalId)
        }
        return
      }
      
      // Kill Terminal (Ctrl+Shift+K)
      if (e.ctrlKey && e.shiftKey && e.key === 'K') {
        e.preventDefault()
        if (activeTerminalId && terminals.length > 1) {
          closeTerminal(activeTerminalId)
        }
        return
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [activeTerminalId, activeTerminal, terminals.length, createNewTerminal, splitTerminal, unsplitTerminal, closeTerminal])

  return (
    <div className="terminal-container" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Tooltips for buttons - Enhanced with keyboard shortcuts */}
      <Tooltip target=".terminal-new-btn" content="New Terminal (Ctrl+Shift+`)" position="bottom" showDelay={500} hideDelay={0} />
      <Tooltip target=".terminal-split-btn" content="Split Terminal (Ctrl+Shift+5)" position="bottom" showDelay={500} hideDelay={0} />
      <Tooltip target=".terminal-unsplit-btn" content="Unsplit Terminal (Ctrl+Shift+U)" position="bottom" showDelay={500} hideDelay={0} />
      <Tooltip target=".terminal-kill-btn" content="Kill Terminal (Ctrl+Shift+K)" position="bottom" showDelay={500} hideDelay={0} />
      
      {/* Terminal Controls */}
      <div className="terminal-controls" style={{ 
        padding: '8px', 
        borderBottom: '1px solid var(--border-color)',
        backgroundColor: 'var(--card-bg)',
        display: 'flex',
        gap: '8px',
        alignItems: 'center'
      }}>
        <Button
          icon="pi pi-plus"
          size="small"
          onClick={createNewTerminal}
          className="terminal-new-btn"
          style={{ 
            fontSize: '11px',
            padding: '6px 8px',
            backgroundColor: 'var(--surface-ground)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-primary)',
            borderRadius: '3px',
            transition: 'all 0.15s ease',
            fontWeight: '500',
            minWidth: '32px'
          }}
        />
        {activeTerminal && (
          <>
            {!activeTerminal.isSplit ? (
              <Button
                icon="pi pi-clone"
                size="small"
                onClick={() => splitTerminal(activeTerminalId)}
                className="terminal-split-btn"
                style={{ 
                  fontSize: '11px',
                  padding: '6px 8px',
                  backgroundColor: 'var(--surface-ground)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  borderRadius: '3px',
                  transition: 'all 0.15s ease',
                  fontWeight: '500',
                  minWidth: '32px'
                }}
              />
            ) : (
              <Button
                icon="pi pi-minus"
                size="small"
                onClick={() => unsplitTerminal(activeTerminalId)}
                className="terminal-unsplit-btn"
                style={{ 
                  fontSize: '11px',
                  padding: '6px 8px',
                  backgroundColor: 'var(--surface-ground)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  borderRadius: '3px',
                  transition: 'all 0.15s ease',
                  fontWeight: '500',
                  minWidth: '32px'
                }}
              />
            )}
            <Button
              icon="pi pi-times"
              size="small"
              onClick={() => closeTerminal(activeTerminalId)}
              className="terminal-kill-btn"
              style={{ 
                fontSize: '11px',
                padding: '6px 8px',
                backgroundColor: 'var(--surface-ground)',
                border: '1px solid var(--red-400)',
                color: 'var(--red-400)',
                borderRadius: '3px',
                transition: 'all 0.15s ease',
                fontWeight: '500',
                marginLeft: '8px',
                minWidth: '32px'
              }}
            />
            <span style={{ marginLeft: '16px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: '500' }}>
              Active: {activeTerminal.title}
            </span>
          </>
        )}
      </div>

      {/* Main Terminal Area with Vertical Tab Manager */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <Splitter style={{ height: '100%' }} resizerStyle={{ backgroundColor: 'var(--border-color)' }}>
          {/* Terminal Content Area */}
          <SplitterPanel size={75} minSize={50}>
            <div style={{ height: '100%', position: 'relative' }}>
              {/* Check if we have any split terminals */}
              {(() => {
                const activeSplitInfo = Object.entries(splitTerminals).find(([, info]) => 
                  info.leftTerminalId === activeTerminalId || info.rightTerminalId === activeTerminalId
                )
                
                if (activeSplitInfo) {
                  // Render split view
                  const [, { leftTerminalId, rightTerminalId }] = activeSplitInfo
                  const leftTerminal = terminals.find(t => t.id === leftTerminalId)
                  const rightTerminal = terminals.find(t => t.id === rightTerminalId)
                  
                  if (leftTerminal && rightTerminal) {
                    return (
                      <Splitter 
                        style={{ height: '100%' }} 
                        layout="horizontal"
                        resizerStyle={{ backgroundColor: 'var(--border-color)' }}
                      >
                        <SplitterPanel size={50} minSize={20}>
                          <div style={{ height: '100%', position: 'relative' }}>
                            <TerminalInstance
                              terminalId={leftTerminal.id}
                              isActive={leftTerminal.id === activeTerminalId}
                              onTitleChange={(newTitle) => updateTerminalTitle(leftTerminal.id, newTitle)}
                              onSplit={splitTerminal}
                              onUnsplit={unsplitTerminal}
                              isSplit={leftTerminal.isSplit}
                              ref={(ref) => {
                                if (ref) {
                                  terminalRefs.current[leftTerminal.id] = ref
                                }
                              }}
                            />
                          </div>
                        </SplitterPanel>
                        <SplitterPanel size={50} minSize={20}>
                          <div style={{ height: '100%', position: 'relative' }}>
                            <TerminalInstance
                              terminalId={rightTerminal.id}
                              isActive={rightTerminal.id === activeTerminalId}
                              onTitleChange={(newTitle) => updateTerminalTitle(rightTerminal.id, newTitle)}
                              onSplit={splitTerminal}
                              onUnsplit={unsplitTerminal}
                              isSplit={rightTerminal.isSplit}
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
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      display: terminal.id === activeTerminalId && !terminal.isSplit ? 'block' : 'none'
                    }}
                  >
                    <TerminalInstance
                      terminalId={terminal.id}
                      isActive={terminal.id === activeTerminalId}
                      onTitleChange={(newTitle) => updateTerminalTitle(terminal.id, newTitle)}
                      onSplit={splitTerminal}
                      onUnsplit={unsplitTerminal}
                      isSplit={terminal.isSplit}
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
          <SplitterPanel size={25} minSize={5} maxSize={35} style={{ minWidth: '20px', maxWidth: '300px' }}>
            <div className="terminal-tab-list" style={{ 
              height: '100%', 
              backgroundColor: 'var(--card-bg)',
              borderLeft: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
            }}>
              <div style={{ 
                padding: '8px',
                borderBottom: '1px solid var(--border-color)',
                fontSize: '11px',
                fontWeight: 'bold',
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                flexShrink: 0
              }}>
                Terminals
              </div>
              
              <div style={{ flex: 1, overflow: 'auto' }}>
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
                    className={`terminal-tab-item ${terminal.id === activeTerminalId ? 'active' : ''}`}
                    style={{
                      padding: '8px 12px',
                      cursor: 'pointer',
                      backgroundColor: terminal.id === activeTerminalId 
                        ? 'var(--primary-color)' 
                        : dragOverIndex === index 
                          ? 'var(--surface-hover)' 
                          : 'transparent',
                      color: terminal.id === activeTerminalId ? 'white' : 'var(--text-primary)',
                      borderBottom: '1px solid var(--border-color)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '12px',
                      transition: 'background-color 0.2s',
                      opacity: draggedTerminal?.id === terminal.id ? 0.5 : 1,
                      minHeight: '32px' // Ensure consistent height
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {editingTerminal === terminal.id ? (
                        <InputText
                          ref={editInputRef}
                          value={terminal.title}
                          onChange={(e) => {
                            const newTitle = e.target.value
                            setTerminals(prev => 
                              prev.map(t => 
                                t.id === terminal.id 
                                  ? { ...t, title: newTitle }
                                  : t
                              )
                            )
                          }}
                          onBlur={() => {
                            const currentTerminal = terminals.find(t => t.id === terminal.id)
                            finishRename(terminal.id, currentTerminal?.title || terminal.title)
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const currentTerminal = terminals.find(t => t.id === terminal.id)
                              finishRename(terminal.id, currentTerminal?.title || terminal.title)
                              e.preventDefault()
                            } else if (e.key === 'Escape') {
                              // Reset to original title
                              setTerminals(prev => 
                                prev.map(t => 
                                  t.id === terminal.id 
                                    ? { ...t, title: t.originalTitle || terminal.title }
                                    : t
                                )
                              )
                              setEditingTerminal(null)
                              e.preventDefault()
                            }
                          }}
                          style={{
                            width: '100%',
                            fontSize: '12px',
                            padding: '2px 4px',
                            border: '1px solid var(--primary-color)',
                            backgroundColor: 'var(--surface-ground)',
                            color: 'var(--text-primary)',
                            borderRadius: '2px'
                          }}
                        />
                      ) : (
                        <span 
                          style={{ 
                            overflow: 'hidden', 
                            textOverflow: 'ellipsis', 
                            whiteSpace: 'nowrap',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                          title={terminal.title}
                        >
                          {terminal.isSplit && (
                            <i 
                              className="pi pi-clone" 
                              style={{ 
                                fontSize: '10px', 
                                opacity: 0.7,
                                color: terminal.id === activeTerminalId ? 'white' : 'var(--blue-400)'
                              }} 
                            />
                          )}
                          {terminal.title}
                        </span>
                      )}
                    </div>
                    
                    {terminals.length > 1 && (
                      <Button
                        icon="pi pi-times"
                        size="small"
                        text
                        onClick={(e) => {
                          e.stopPropagation()
                          closeTerminal(terminal.id)
                        }}
                        style={{ 
                          width: '16px', 
                          height: '16px',
                          padding: '0',
                          minWidth: 'unset',
                          marginLeft: '4px',
                          opacity: 0.7
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </SplitterPanel>
        </Splitter>
      </div>

      <ContextMenu 
        ref={contextMenuRef} 
        model={currentContextMenuItems.length > 0 ? currentContextMenuItems : contextMenuItems} 
      />
      <ConfirmDialog />
    </div>
  )
}

export default TerminalManager
