import React, { useState, useRef, useCallback, useEffect } from "react"
import { ContextMenu } from "primereact/contextmenu"
import { Button } from "primereact/button"
import { InputText } from "primereact/inputtext"
import IPythonInstance from "./IPythonInstance"

/**
 * IPython Manager Component
 * Features vertical tab manager on the right side with drag & drop, rename, and split functionality
 * Similar to TerminalManager but specifically for IPython sessions
 */
const IPythonManager = () => {
  const [ipythonSessions, setIPythonSessions] = useState([])
  const [activeSessionId, setActiveSessionId] = useState(null)
  const [editingSession, setEditingSession] = useState(null)
  const [draggedSession, setDraggedSession] = useState(null)
  const [dragOverIndex, setDragOverIndex] = useState(null)
  const [splitSessions, setSplitSessions] = useState({})
  const [currentContextMenuItems, setCurrentContextMenuItems] = useState([])
  const sessionRefs = useRef({})
  const contextMenuRef = useRef(null)
  const editInputRef = useRef(null)

  // Create a new IPython session
  const createNewSession = useCallback(
    (parentSession = null) => {
      const sessionId = `ipython-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      const newSession = {
        id: sessionId,
        title: `IPython ${ipythonSessions.length + 1}`,
        isCustomTitle: false,
        parentId: parentSession?.id || null
      }

      console.log("Creating new IPython session:", sessionId)

      setIPythonSessions(prev => [...prev, newSession])
      setActiveSessionId(sessionId)

      // Initialize session reference
      sessionRefs.current[sessionId] = null

      return newSession
    },
    [ipythonSessions.length]
  )

  // Split session - create side-by-side session panes
  const splitSession = useCallback(
    async (sessionId) => {
      const session = ipythonSessions.find(t => t.id === sessionId)
      if (!session) return

      console.log(`Splitting IPython session: ${sessionId}`)

      // Create a new session to be the split partner
      const newSession = createNewSession(session)
      
      // Create split relationship
      setSplitSessions(prev => ({
        ...prev,
        [sessionId]: {
          leftSessionId: sessionId,
          rightSessionId: newSession.id,
          splitRatio: 0.5
        }
      }))

      console.log(`IPython session split created: ${sessionId} <-> ${newSession.id}`)
    },
    [ipythonSessions, createNewSession]
  )

  // Close a specific session
  const closeSession = useCallback(
    (sessionId) => {
      console.log(`Closing IPython session: ${sessionId}`)

      // Dispose the session
      if (sessionRefs.current[sessionId]) {
        sessionRefs.current[sessionId].dispose()
        delete sessionRefs.current[sessionId]
      }

      // Remove from split relationships
      setSplitSessions(prev => {
        const newSplitSessions = { ...prev }
        
        // Remove splits where this session is involved
        Object.keys(newSplitSessions).forEach(splitId => {
          const split = newSplitSessions[splitId]
          if (split.leftSessionId === sessionId || split.rightSessionId === sessionId) {
            delete newSplitSessions[splitId]
          }
        })
        
        return newSplitSessions
      })

      // Remove from sessions list
      setIPythonSessions(prev => prev.filter(s => s.id !== sessionId))

      // Update active session
      if (activeSessionId === sessionId) {
        const remainingSessions = ipythonSessions.filter(s => s.id !== sessionId)
        setActiveSessionId(remainingSessions.length > 0 ? remainingSessions[0].id : null)
      }
    },
    [activeSessionId, ipythonSessions]
  )

  // Unsplit session - keep both sessions (left remains as primary, right becomes standalone)
  const unsplitSession = useCallback(
    (sessionId) => {
      console.log(`Unsplitting IPython session: ${sessionId}`)
      
      setSplitSessions(prev => {
        const newSplitSessions = { ...prev }
        delete newSplitSessions[sessionId]
        return newSplitSessions
      })
    },
    [ipythonSessions, splitSessions]
  )

  // Rename session
  const startRename = useCallback((sessionId) => {
    setEditingSession(sessionId)
    setTimeout(() => {
      if (editInputRef.current) {
        editInputRef.current.focus()
        editInputRef.current.select()
      }
    }, 0)
  }, [])

  const finishRename = useCallback((sessionId, newTitle) => {
    if (newTitle.trim()) {
      setIPythonSessions(prev => prev.map(session => 
        session.id === sessionId 
          ? { ...session, title: newTitle.trim(), isCustomTitle: true }
          : session
      ))
    }
    setEditingSession(null)
  }, [])

  // Reset session to automatic title updates
  const resetToAutomaticTitle = useCallback((sessionId) => {
    setIPythonSessions(prev => prev.map(session => 
      session.id === sessionId 
        ? { ...session, isCustomTitle: false }
        : session
    ))
  }, [])

  // Update session title when working directory changes
  const updateSessionTitle = useCallback(
    (sessionId, newTitle) => {
      if (editingSession === sessionId) return // Don't update while editing

      setIPythonSessions(prev => prev.map(session => {
        if (session.id === sessionId && !session.isCustomTitle) {
          return { ...session, title: newTitle }
        }
        return session
      }))
    },
    [editingSession]
  )

  // Drag and drop handlers
  const handleDragStart = useCallback((e, session) => {
    setDraggedSession(session)
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
      setDragOverIndex(null)
      
      if (!draggedSession) return

      const dragIndex = ipythonSessions.findIndex(s => s.id === draggedSession.id)
      if (dragIndex === dropIndex) return

      const newSessions = [...ipythonSessions]
      const draggedItem = newSessions.splice(dragIndex, 1)[0]
      newSessions.splice(dropIndex, 0, draggedItem)
      
      setIPythonSessions(newSessions)
      setDraggedSession(null)
    },
    [draggedSession, ipythonSessions]
  )

  // Context menu items - dynamic based on session state
  const getContextMenuItems = useCallback(
    (sessionId) => {
      const session = ipythonSessions.find(s => s.id === sessionId)
      const isSplit = !!splitSessions[sessionId]
      
      return [
        {
          label: "New IPython Session",
          icon: "pi pi-plus",
          command: () => createNewSession()
        },
        {
          label: "Split Session",
          icon: "pi pi-clone",
          command: () => splitSession(sessionId),
          disabled: isSplit
        },
        ...(isSplit ? [{
          label: "Unsplit Session",
          icon: "pi pi-minus",
          command: () => unsplitSession(sessionId)
        }] : []),
        { separator: true },
        {
          label: "Rename",
          icon: "pi pi-pencil",
          command: () => startRename(sessionId)
        },
        ...(session?.isCustomTitle ? [{
          label: "Reset to Auto Title",
          icon: "pi pi-refresh",
          command: () => resetToAutomaticTitle(sessionId)
        }] : []),
        { separator: true },
        {
          label: "Close",
          icon: "pi pi-times",
          command: () => closeSession(sessionId),
          disabled: ipythonSessions.length === 1
        }
      ]
    },
    [ipythonSessions, createNewSession, splitSession, unsplitSession, startRename, closeSession, resetToAutomaticTitle, splitSessions]
  )

  // Context menu items (fallback for backward compatibility)
  const contextMenuItems = [
    {
      label: "New IPython Session",
      icon: "pi pi-plus",
      command: () => createNewSession()
    },
    {
      label: "Split Session",
      icon: "pi pi-clone",
      command: () => {
        if (activeSessionId) splitSession(activeSessionId)
      }
    },
    {
      label: "Rename",
      icon: "pi pi-pencil",
      command: () => {
        if (activeSessionId) startRename(activeSessionId)
      }
    },
    { separator: true },
    {
      label: "Close",
      icon: "pi pi-times",
      command: () => {
        if (activeSessionId) closeSession(activeSessionId)
      }
    }
  ]

  // Initialize with one session if none exist
  useEffect(() => {
    if (ipythonSessions.length === 0) {
      createNewSession()
    }
  }, [createNewSession, ipythonSessions.length])

  const activeSession = ipythonSessions.find((s) => s.id === activeSessionId)

  // Keyboard shortcuts for session actions
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!activeSessionId || !activeSession) return

      // Cmd/Ctrl + T: New session
      if ((e.metaKey || e.ctrlKey) && e.key === 't' && e.shiftKey) {
        e.preventDefault()
        createNewSession()
      }
      // Cmd/Ctrl + Shift + \: Split session
      else if ((e.metaKey || e.ctrlKey) && e.key === '\\' && e.shiftKey) {
        e.preventDefault()
        if (!splitSessions[activeSessionId]) {
          splitSession(activeSessionId)
        } else {
          unsplitSession(activeSessionId)
        }
      }
      // Cmd/Ctrl + W: Close session (only if more than one)
      else if ((e.metaKey || e.ctrlKey) && e.key === 'w' && e.shiftKey && ipythonSessions.length > 1) {
        e.preventDefault()
        closeSession(activeSessionId)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [activeSessionId, activeSession, ipythonSessions.length, createNewSession, splitSession, unsplitSession, closeSession, splitSessions])

  const renderSessionTab = (session, index) => {
    const isActive = session.id === activeSessionId
    const isSplit = !!splitSessions[session.id]
    const isDragOver = dragOverIndex === index

    return (
      <div
        key={session.id}
        className={`ipython-tab ${isActive ? 'active' : ''} ${isDragOver ? 'drag-over' : ''}`}
        draggable
        onDragStart={(e) => handleDragStart(e, session)}
        onDragOver={(e) => handleDragOver(e, index)}
        onDrop={(e) => handleDrop(e, index)}
        onClick={() => setActiveSessionId(session.id)}
        onContextMenu={(e) => {
          e.preventDefault()
          const items = getContextMenuItems(session.id)
          setCurrentContextMenuItems(items)
          contextMenuRef.current?.show(e)
        }}
        style={{
          padding: '8px 12px',
          cursor: 'pointer',
          borderBottom: '1px solid var(--surface-border)',
          backgroundColor: isActive ? 'var(--highlight-bg)' : 'transparent',
          color: isActive ? 'var(--highlight-text-color)' : 'var(--text-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: '40px',
          ...(isDragOver && {
            borderTop: '2px solid var(--primary-color)'
          })
        }}
      >
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <i className="pi pi-code" style={{ fontSize: '14px' }} />
          {editingSession === session.id ? (
            <InputText
              ref={editInputRef}
              value={session.title}
              onChange={(e) => {
                const newTitle = e.target.value
                setIPythonSessions(prev => prev.map(s => 
                  s.id === session.id ? { ...s, title: newTitle } : s
                ))
              }}
              onBlur={() => finishRename(session.id, session.title)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  finishRename(session.id, session.title)
                } else if (e.key === 'Escape') {
                  setEditingSession(null)
                }
              }}
              style={{
                fontSize: '12px',
                padding: '2px 4px',
                border: '1px solid var(--primary-color)',
                background: 'var(--surface-ground)',
                color: 'var(--text-color)',
                width: '100px'
              }}
            />
          ) : (
            <span style={{ fontSize: '12px', fontWeight: isActive ? 'bold' : 'normal' }}>
              {session.title}
              {isSplit && <i className="pi pi-clone" style={{ marginLeft: '4px', fontSize: '10px' }} />}
            </span>
          )}
        </div>
        
        {ipythonSessions.length > 1 && (
          <Button
            icon="pi pi-times"
            className="p-button-text p-button-sm"
            onClick={(e) => {
              e.stopPropagation()
              closeSession(session.id)
            }}
            style={{
              padding: '2px',
              minWidth: '20px',
              height: '20px',
              color: 'var(--text-color-secondary)'
            }}
          />
        )}
      </div>
    )
  }

  const renderSessionContent = () => {
    if (!activeSession) return null

    const splitConfig = splitSessions[activeSession.id]
    
    if (splitConfig) {
      return (
        <div style={{ display: 'flex', height: '100%' }}>
          <div style={{ flex: splitConfig.splitRatio, borderRight: '1px solid var(--surface-border)' }}>
            <IPythonInstance
              ref={(ref) => sessionRefs.current[splitConfig.leftSessionId] = ref}
              sessionId={splitConfig.leftSessionId}
              isActive={activeSessionId === splitConfig.leftSessionId}
              onTitleChange={updateSessionTitle}
              onSplit={splitSession}
              onUnsplit={unsplitSession}
              isSplit={true}
            />
          </div>
          <div style={{ flex: 1 - splitConfig.splitRatio }}>
            <IPythonInstance
              ref={(ref) => sessionRefs.current[splitConfig.rightSessionId] = ref}
              sessionId={splitConfig.rightSessionId}
              isActive={activeSessionId === splitConfig.rightSessionId}
              onTitleChange={updateSessionTitle}
              onSplit={splitSession}
              onUnsplit={unsplitSession}
              isSplit={true}
            />
          </div>
        </div>
      )
    }

    return (
      <IPythonInstance
        ref={(ref) => sessionRefs.current[activeSession.id] = ref}
        sessionId={activeSession.id}
        isActive={true}
        onTitleChange={updateSessionTitle}
        onSplit={splitSession}
        onUnsplit={unsplitSession}
        isSplit={false}
      />
    )
  }

  return (
    <div style={{ 
      display: 'flex', 
      height: '100%', 
      backgroundColor: 'var(--surface-ground)',
      fontFamily: 'var(--font-family)'
    }}>
      {/* Main IPython content area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {renderSessionContent()}
      </div>

      {/* Right sidebar with session tabs */}
      <div style={{
        width: '200px',
        backgroundColor: 'var(--surface-section)',
        borderLeft: '1px solid var(--surface-border)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          padding: '12px',
          borderBottom: '1px solid var(--surface-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <span style={{ fontWeight: 'bold', fontSize: '14px' }}>IPython Sessions</span>
          <Button
            icon="pi pi-plus"
            className="p-button-text p-button-sm"
            onClick={() => createNewSession()}
            tooltip="New IPython Session"
            tooltipOptions={{ position: 'left' }}
            style={{ padding: '4px' }}
          />
        </div>

        {/* Session tabs */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {ipythonSessions.map((session, index) => renderSessionTab(session, index))}
        </div>

        {/* Footer with shortcuts */}
        <div style={{
          padding: '8px',
          borderTop: '1px solid var(--surface-border)',
          fontSize: '10px',
          color: 'var(--text-color-secondary)'
        }}>
          <div>Cmd+Shift+T: New</div>
          <div>Cmd+Shift+\: Split</div>
          <div>Cmd+Shift+W: Close</div>
        </div>
      </div>

      <ContextMenu 
        ref={contextMenuRef} 
        model={currentContextMenuItems.length > 0 ? currentContextMenuItems : contextMenuItems}
        breakpoint="767px"
      />

      <style jsx>{`
        .ipython-tab {
          transition: all 0.2s ease;
        }
        
        .ipython-tab:hover {
          background-color: var(--surface-hover) !important;
        }
        
        .ipython-tab.drag-over {
          transform: translateY(-2px);
        }
        
        .ipython-tab.active {
          border-left: 3px solid var(--primary-color);
        }
      `}</style>
    </div>
  )
}

export default IPythonManager
