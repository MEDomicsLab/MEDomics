import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Button } from 'primereact/button'
import { ConfirmDialog } from 'primereact/confirmdialog'
import { ContextMenu } from 'primereact/contextmenu'
import { InputText } from 'primereact/inputtext'
import { Splitter, SplitterPanel } from 'primereact/splitter'
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
  const terminalRefs = useRef({})
  const contextMenuRef = useRef(null)
  const editInputRef = useRef(null)

  // Create a new terminal instance
  const createNewTerminal = useCallback(() => {
    const terminalId = uuid.v4()
    const newTerminal = {
      id: terminalId,
      title: `Terminal ${terminals.length + 1}`,
      isActive: false
    }
    
    setTerminals(prev => [...prev, newTerminal])
    setActiveTerminalId(terminalId)
  }, [terminals.length])

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

  // Split terminal horizontally
  const splitTerminal = useCallback((terminalId) => {
    const terminal = terminals.find(t => t.id === terminalId)
    if (terminal) {
      const newTerminalId = uuid.v4()
      const newTerminal = {
        id: newTerminalId,
        title: `${terminal.title} (Split)`,
        isActive: false
      }
      
      setTerminals(prev => {
        const index = prev.findIndex(t => t.id === terminalId)
        const newTerminals = [...prev]
        newTerminals.splice(index + 1, 0, newTerminal)
        return newTerminals
      })
      setActiveTerminalId(newTerminalId)
    }
  }, [terminals])

  // Rename terminal
  const startRename = useCallback((terminalId) => {
    setEditingTerminal(terminalId)
    setTimeout(() => {
      if (editInputRef.current) {
        editInputRef.current.focus()
        editInputRef.current.select()
      }
    }, 100)
  }, [])

  const finishRename = useCallback((terminalId, newTitle) => {
    if (newTitle.trim()) {
      setTerminals(prev => 
        prev.map(terminal => 
          terminal.id === terminalId 
            ? { ...terminal, title: newTitle.trim() }
            : terminal
        )
      )
    }
    setEditingTerminal(null)
  }, [])

  // Update terminal title when working directory changes
  const updateTerminalTitle = useCallback((terminalId, newTitle) => {
    if (!editingTerminal) {
      setTerminals(prev => 
        prev.map(terminal => 
          terminal.id === terminalId 
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

  // Context menu items
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

  return (
    <div className="terminal-container" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Terminal Controls */}
      <div style={{ 
        padding: '8px', 
        borderBottom: '1px solid var(--border-color)',
        backgroundColor: 'var(--card-bg)',
        display: 'flex',
        gap: '8px',
        alignItems: 'center'
      }}>
        <Button
          icon="pi pi-plus"
          label="New Terminal"
          size="small"
          onClick={createNewTerminal}
          style={{ fontSize: '12px' }}
        />
        {activeTerminal && (
          <>
            <Button
              icon="pi pi-clone"
              label="Split"
              size="small"
              onClick={() => splitTerminal(activeTerminalId)}
              style={{ fontSize: '12px' }}
            />
            <span style={{ marginLeft: '16px', color: 'var(--text-secondary)', fontSize: '12px' }}>
              Active: {activeTerminal.title}
            </span>
          </>
        )}
      </div>

      {/* Main Terminal Area with Vertical Tab Manager */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <Splitter style={{ height: '100%' }}>
          {/* Terminal Content Area */}
          <SplitterPanel size={80} minSize={60}>
            <div style={{ height: '100%', position: 'relative' }}>
              {terminals.map((terminal) => (
                <div
                  key={terminal.id}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    display: terminal.id === activeTerminalId ? 'block' : 'none'
                  }}
                >
                  <TerminalInstance
                    terminalId={terminal.id}
                    isActive={terminal.id === activeTerminalId}
                    onTitleChange={(newTitle) => updateTerminalTitle(terminal.id, newTitle)}
                    ref={(ref) => {
                      if (ref) {
                        terminalRefs.current[terminal.id] = ref
                      }
                    }}
                  />
                </div>
              ))}
            </div>
          </SplitterPanel>

          {/* Vertical Tab Manager */}
          <SplitterPanel size={20} minSize={15}>
            <div style={{ 
              height: '100%', 
              backgroundColor: 'var(--card-bg)',
              borderLeft: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <div style={{ 
                padding: '8px',
                borderBottom: '1px solid var(--border-color)',
                fontSize: '11px',
                fontWeight: 'bold',
                color: 'var(--text-secondary)',
                textTransform: 'uppercase'
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
                    onClick={() => setActiveTerminalId(terminal.id)}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      contextMenuRef.current.activeTerminalId = terminal.id
                      contextMenuRef.current.show(e)
                    }}
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
                      opacity: draggedTerminal?.id === terminal.id ? 0.5 : 1
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {editingTerminal === terminal.id ? (
                        <InputText
                          ref={editInputRef}
                          value={terminal.title}
                          onChange={(e) => {
                            setTerminals(prev => 
                              prev.map(t => 
                                t.id === terminal.id 
                                  ? { ...t, title: e.target.value }
                                  : t
                              )
                            )
                          }}
                          onBlur={() => finishRename(terminal.id, terminal.title)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              finishRename(terminal.id, terminal.title)
                            } else if (e.key === 'Escape') {
                              setEditingTerminal(null)
                            }
                          }}
                          style={{
                            width: '100%',
                            fontSize: '12px',
                            padding: '2px 4px',
                            border: '1px solid var(--primary-color)',
                            backgroundColor: 'var(--surface-ground)'
                          }}
                        />
                      ) : (
                        <span 
                          style={{ 
                            overflow: 'hidden', 
                            textOverflow: 'ellipsis', 
                            whiteSpace: 'nowrap' 
                          }}
                          title={terminal.title}
                        >
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

      <ContextMenu ref={contextMenuRef} model={contextMenuItems} />
      <ConfirmDialog />
    </div>
  )
}

export default TerminalManager
