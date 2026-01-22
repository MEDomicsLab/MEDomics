import React, { forwardRef, useRef, useEffect, useImperativeHandle, useState, useContext } from "react"
import { ContextMenu } from "primereact/contextmenu"
import { Terminal } from "@xterm/xterm"
import { FitAddon } from "@xterm/addon-fit"
import { ipcRenderer } from "electron"
import { WorkspaceContext } from "../../workspace/workspaceContext"

/**
 * Individual IPython Instance Component
 * Handles a single IPython session with xterm.js
 */
const IPythonInstance = forwardRef(({ 
  sessionId, 
  isActive, 
  onTitleChange, 
  onSplit, 
  onUnsplit, 
  isSplit = false 
}, ref) => {
  const terminalRef = useRef(null)
  const xtermRef = useRef(null)
  const fitAddonRef = useRef(null)
  const ptyProcessRef = useRef(null)
  const resizeObserverRef = useRef(null)
  const contextMenuRef = useRef(null)
  const onTitleChangeRef = useRef(onTitleChange)
  const { workspace } = useContext(WorkspaceContext)
  const isInitializingRef = useRef(false)
  const [hasSelection, setHasSelection] = useState(false)
  
  // Update the ref when onTitleChange changes
  React.useEffect(() => {
    onTitleChangeRef.current = onTitleChange
  }, [onTitleChange])

  // Update terminal theme when global theme changes
  useEffect(() => {
    if (xtermRef.current) {
      const computedStyle = getComputedStyle(document.documentElement)
      const terminalBg = computedStyle.getPropertyValue('--terminal-bg').trim()
      const terminalText = computedStyle.getPropertyValue('--terminal-text').trim()
      
      xtermRef.current.options.theme = {
        background: terminalBg || '#1f1f1f',
        foreground: terminalText || '#ffffff',
        cursor: '#ffffff',
        selection: 'rgba(255, 255, 255, 0.3)',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#ffffff'
      }
    }
  }, [sessionId])

  // Context menu items - note that we update the disabled property right before showing the menu
  const contextMenuItems = React.useMemo(() => [
    {
      label: 'Copy',
      icon: 'pi pi-copy',
      command: () => {
        if (xtermRef.current) {
          const selection = xtermRef.current.getSelection()
          if (selection) {
            navigator.clipboard.writeText(selection)
          }
        }
      },
      disabled: !hasSelection // This will be updated right before showing the menu
    },
    {
      label: 'Paste',
      icon: 'pi pi-clipboard',
      command: () => {
        navigator.clipboard.readText().then(text => {
          if (xtermRef.current && ptyProcessRef.current) {
            ipcRenderer.invoke('terminal-write', sessionId, text)
          }
        }).catch(err => {
          console.error('Failed to paste:', err)
        })
      }
    },
    {
      separator: true
    },
    {
      label: 'Select All',
      icon: 'pi pi-check-square',
      command: () => {
        if (xtermRef.current) {
          xtermRef.current.selectAll()
        }
      }
    },
    {
      label: 'Clear',
      icon: 'pi pi-trash',
      command: () => {
        if (xtermRef.current) {
          xtermRef.current.clear()
        }
      }
    },
    {
      label: 'Restart IPython',
      icon: 'pi pi-refresh',
      command: () => {
        if (xtermRef.current && ptyProcessRef.current) {
          // Send exit command and restart
          ipcRenderer.invoke('terminal-write', sessionId, 'exit\n')
          setTimeout(() => {
            initializeIPython()
          }, 1000)
        }
      }
    },
    ...(onSplit || onUnsplit ? [{ separator: true }] : []),
    ...(onSplit && !isSplit ? [{
      label: 'Split IPython Session',
      icon: 'pi pi-clone',
      command: () => onSplit(sessionId)
    }] : []),
    ...(onUnsplit && isSplit ? [{
      label: 'Unsplit IPython Session',
      icon: 'pi pi-minus',
      command: () => onUnsplit(sessionId)
    }] : [])
  ], [hasSelection, sessionId, onSplit, onUnsplit, isSplit])

  // Initialize IPython session
  const initializeIPython = React.useCallback(() => {
    if (ptyProcessRef.current) {
      // Send command to start IPython with the bundled Python environment
      ipcRenderer.invoke('terminal-write', sessionId, 'ipython\n')
    }
  }, [sessionId])

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    dispose: () => {
      console.log(`Disposing IPython instance ${sessionId}`)
      
      // Remove event listeners first
      ipcRenderer.removeAllListeners(`terminal-data-${sessionId}`)
      ipcRenderer.removeAllListeners(`terminal-title-${sessionId}`)
      ipcRenderer.removeAllListeners(`terminal-exit-${sessionId}`)
      
      // Kill PTY process
      if (ptyProcessRef.current) {
        ipcRenderer.invoke('terminal-kill', sessionId)
        ptyProcessRef.current = null
      }
      
      // Dispose terminal
      if (xtermRef.current) {
        xtermRef.current.dispose()
        xtermRef.current = null
      }
      
      // Disconnect resize observer
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect()
        resizeObserverRef.current = null
      }
      
      // Reset initialization flag
      isInitializingRef.current = false
    },
    focus: () => {
      if (xtermRef.current) {
        xtermRef.current.focus()
      }
    },
    fit: () => {
      if (fitAddonRef.current) {
        try {
          fitAddonRef.current.fit()
        } catch (error) {
          console.warn('Failed to fit terminal:', error)
        }
      }
    }
  }), [sessionId])

  useEffect(() => {
    if (!terminalRef.current || isInitializingRef.current) return

    isInitializingRef.current = true

    // Get computed CSS custom properties for theming
    const computedStyle = getComputedStyle(document.documentElement)
    const terminalBg = computedStyle.getPropertyValue('--terminal-bg').trim()
    const terminalText = computedStyle.getPropertyValue('--terminal-text').trim()
    
    // Set font family based on platform
    const fontFamily = process.platform === 'darwin' 
      ? '"MesloLGS NF", "Fira Code", "Cascadia Code", "Consolas", "Monaco", monospace'
      : '"Fira Code", "Cascadia Code", "Consolas", "Monaco", monospace'
    
    // Create terminal instance
    const terminal = new Terminal({
      fontFamily,
      fontSize: 14,
      lineHeight: 1.2,
      theme: {
        background: terminalBg || '#1f1f1f',
        foreground: terminalText || '#ffffff',
        cursor: '#ffffff',
        selection: 'rgba(255, 255, 255, 0.3)',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#ffffff'
      },
      cursorBlink: true,
      allowTransparency: false,
      rightClickSelectsWord: false,
      convertEol: true
    })

    // Create fit addon
    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    
    // Store references
    xtermRef.current = terminal
    fitAddonRef.current = fitAddon

    // Open terminal in DOM
    terminal.open(terminalRef.current)
    
    // Initial fit
    setTimeout(() => {
      try {
        fitAddon.fit()
      } catch (error) {
        console.warn('Initial fit failed:', error)
      }
    }, 100)

    // Setup resize observer
    const resizeObserver = new ResizeObserver(() => {
      if (fitAddon && terminal) {
        try {
          fitAddon.fit()
          // Update terminal size in backend
          const cols = terminal.cols
          const rows = terminal.rows
          if (ptyProcessRef.current) {
            ipcRenderer.invoke('terminal-resize', sessionId, cols, rows)
          }
        } catch (error) {
          console.warn('Resize fit failed:', error)
        }
      }
    })
    
    resizeObserver.observe(terminalRef.current)
    resizeObserverRef.current = resizeObserver

    // Handle terminal input
    terminal.onData((data) => {
      if (ptyProcessRef.current) {
        ipcRenderer.invoke('terminal-write', sessionId, data)
      }
    })

    // Create IPython session using custom options for Python environment
    const createSessionOptions = {
      cwd: workspace?.path || undefined,
      cols: terminal.cols,
      rows: terminal.rows,
      useIPython: true  // Flag to indicate we want IPython
    }

    ipcRenderer.invoke('terminal-create', sessionId, createSessionOptions).then((result) => {
      if (result.success) {
        ptyProcessRef.current = result.pid
        console.log(`IPython session ${sessionId} created with PID: ${result.pid}`)
        
        // Set up event listeners
        ipcRenderer.on(`terminal-data-${sessionId}`, (event, data) => {
          if (terminal) {
            terminal.write(data)
          }
        })

        ipcRenderer.on(`terminal-title-${sessionId}`, (event, title) => {
          if (onTitleChangeRef.current) {
            onTitleChangeRef.current(sessionId, title)
          }
        })

        ipcRenderer.on(`terminal-exit-${sessionId}`, (event, exitCode) => {
          console.log(`IPython session ${sessionId} exited with code: ${exitCode}`)
          ptyProcessRef.current = null
        })

        // Initialize IPython after a short delay
        setTimeout(() => {
          initializeIPython()
        }, 500)
        
      } else {
        console.error(`Failed to create IPython session ${sessionId}:`, result.error)
        terminal.write(`\r\n\x1b[31mFailed to create IPython session: ${result.error}\x1b[0m\r\n`)
      }
    }).catch((error) => {
      console.error(`Error creating IPython session ${sessionId}:`, error)
      terminal.write(`\r\n\x1b[31mError creating IPython session: ${error.message}\x1b[0m\r\n`)
    })

    // Cleanup function
    return () => {
      isInitializingRef.current = false
      
      if (resizeObserver) {
        resizeObserver.disconnect()
      }
      
      // Event listeners will be cleaned up in dispose method
    }
  }, [sessionId, workspace, initializeIPython])

  // Focus terminal when it becomes active
  useEffect(() => {
    if (isActive && xtermRef.current) {
      xtermRef.current.focus()
    }
  }, [isActive])

  // Track terminal selection for context menu
  useEffect(() => {
    if (!xtermRef.current) return

    const terminal = xtermRef.current
    
    const handleSelectionChange = () => {
      const selection = terminal.getSelection()
      setHasSelection(!!selection && selection.length > 0)
    }

    terminal.onSelectionChange(handleSelectionChange)
    
    return () => {
      // Selection change listener is automatically cleaned up when terminal is disposed
    }
  }, [])
  
  // Update context menu items dynamically when showing the menu
  const handleContextMenu = (e) => {
    e.preventDefault()
    
    // Update selection state right before showing menu
    if (xtermRef.current) {
      const selection = xtermRef.current.getSelection()
      setHasSelection(!!selection && selection.length > 0)
    }
    
    if (contextMenuRef.current) {
      contextMenuRef.current.show(e)
    }
  }

  return (
    <>
      <div
        ref={terminalRef}
        style={{
          height: '100%',
          width: '100%',
          backgroundColor: 'var(--terminal-bg)',
          padding: '8px'
        }}
        onContextMenu={handleContextMenu}
      />
      <ContextMenu 
        ref={contextMenuRef} 
        model={contextMenuItems}
        breakpoint="767px"
      />
    </>
  )
})

IPythonInstance.displayName = 'IPythonInstance'

export default IPythonInstance
