import React, { useState, useRef, useCallback } from 'react'
import { Button } from 'primereact/button'
import { TabView, TabPanel } from 'primereact/tabview'
import { ConfirmDialog } from 'primereact/confirmdialog'
import TerminalInstance from './TerminalInstance'
import uuid from 'react-native-uuid'

/**
 * Terminal Manager Component
 * Handles multiple terminal instances with tabs
 */
const TerminalManager = () => {
  const [terminals, setTerminals] = useState([])
  const [activeIndex, setActiveIndex] = useState(0)
  const terminalRefs = useRef({})

  // Create a new terminal instance
  const createNewTerminal = useCallback(() => {
    const terminalId = uuid.v4()
    const newTerminal = {
      id: terminalId,
      title: `Terminal ${terminals.length + 1}`,
      isActive: false
    }
    
    setTerminals(prev => [...prev, newTerminal])
    setActiveIndex(terminals.length)
  }, [terminals.length])

  // Close a specific terminal
  const closeTerminal = useCallback((terminalId, index) => {
    // Clean up the terminal reference
    if (terminalRefs.current[terminalId]) {
      terminalRefs.current[terminalId].dispose()
      delete terminalRefs.current[terminalId]
    }

    setTerminals(prev => prev.filter(terminal => terminal.id !== terminalId))
    
    // Adjust active index if necessary
    if (index < activeIndex) {
      setActiveIndex(prev => prev - 1)
    } else if (index === activeIndex && terminals.length > 1) {
      setActiveIndex(prev => prev === 0 ? 0 : prev - 1)
    }
  }, [activeIndex, terminals.length])

  // Update terminal title when working directory changes
  const updateTerminalTitle = useCallback((terminalId, newTitle) => {
    setTerminals(prev => 
      prev.map(terminal => 
        terminal.id === terminalId 
          ? { ...terminal, title: newTitle }
          : terminal
      )
    )
  }, [])

  // Initialize with one terminal if none exist
  React.useEffect(() => {
    if (terminals.length === 0) {
      createNewTerminal()
    }
  }, [createNewTerminal, terminals.length])

  const tabHeaderTemplate = (options, terminal, index) => {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>{terminal.title}</span>
        {terminals.length > 1 && (
          <Button
            icon="pi pi-times"
            size="small"
            text
            severity="secondary"
            onClick={(e) => {
              e.stopPropagation()
              closeTerminal(terminal.id, index)
            }}
            style={{ 
              width: '16px', 
              height: '16px', 
              padding: '2px',
              minWidth: 'unset'
            }}
          />
        )}
      </div>
    )
  }

  return (
    <div className="terminal-container">
      {/* Terminal Controls */}
      <div style={{ 
        padding: '8px', 
        borderBottom: '1px solid var(--border-color)',
        backgroundColor: 'var(--card-bg)'
      }}>
        <Button
          icon="pi pi-plus"
          label="New Terminal"
          size="small"
          onClick={createNewTerminal}
          style={{ fontSize: '12px' }}
        />
      </div>

      {/* Terminal Tabs */}
      {terminals.length > 0 && (
        <TabView
          className="terminal-tab"
          activeIndex={activeIndex}
          onTabChange={(e) => setActiveIndex(e.index)}
          style={{ height: 'calc(100% - 50px)', overflow: 'hidden' }}
          panelContainerStyle={{ 
            height: 'calc(100% - 40px)',
            padding: 0,
            overflow: 'hidden'
          }}
        >
          {terminals.map((terminal, index) => (
            <TabPanel
              key={terminal.id}
              header={tabHeaderTemplate(null, terminal, index)}
              contentStyle={{ 
                height: '100%', 
                padding: 0,
                overflow: 'hidden'
              }}
            >
              <TerminalInstance
                terminalId={terminal.id}
                isActive={activeIndex === index}
                onTitleChange={(newTitle) => updateTerminalTitle(terminal.id, newTitle)}
                ref={(ref) => {
                  if (ref) {
                    terminalRefs.current[terminal.id] = ref
                  }
                }}
              />
            </TabPanel>
          ))}
        </TabView>
      )}

      <ConfirmDialog />
    </div>
  )
}

export default TerminalManager
