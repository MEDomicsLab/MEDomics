import React, { useEffect, useRef, useImperativeHandle, forwardRef, useContext } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { SearchAddon } from '@xterm/addon-search'
import { ContextMenu } from 'primereact/contextmenu'
import { ipcRenderer } from 'electron'
import { WorkspaceContext } from '../workspace/workspaceContext'
import { useTheme } from '../theme/themeContext'
import '@xterm/xterm/css/xterm.css'

/**
 * Individual Terminal Instance Component
 * Handles a single terminal with xterm.js
 */
const TerminalInstance = forwardRef(({ terminalId, isActive, onTitleChange }, ref) => {
  const terminalRef = useRef(null)
  const xtermRef = useRef(null)
  const fitAddonRef = useRef(null)
  const ptyProcessRef = useRef(null)
  const resizeObserverRef = useRef(null)
  const contextMenuRef = useRef(null)
  const onTitleChangeRef = useRef(onTitleChange)
  const { workspace } = useContext(WorkspaceContext)
  const { isDarkMode } = useTheme()
  const isInitializingRef = useRef(false)

  // Update the ref when onTitleChange changes
  React.useEffect(() => {
    onTitleChangeRef.current = onTitleChange
  }, [onTitleChange])

  // Update terminal theme when global theme changes
  useEffect(() => {
    if (xtermRef.current) {
      console.log(`Updating theme for terminal ${terminalId}`)
      
      // Get current CSS custom properties for theming
      const computedStyle = getComputedStyle(document.documentElement)
      const terminalBg = computedStyle.getPropertyValue('--terminal-bg').trim()
      const terminalText = computedStyle.getPropertyValue('--terminal-text').trim()
      
      // Determine if we're in dark mode based on the terminal text color
      const isDarkModeCheck = terminalText === '#ffffff'
      
      // Update terminal theme
      const newTheme = {
        background: terminalBg,
        foreground: terminalText,
        cursor: terminalText,
        cursorAccent: terminalBg,
        selection: isDarkModeCheck ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)',
        black: isDarkModeCheck ? '#2e3436' : '#000000',
        red: '#e74c3c',
        green: '#2ecc71',
        yellow: '#f39c12',
        blue: '#3498db',
        magenta: '#9b59b6',
        cyan: '#1abc9c',
        white: isDarkModeCheck ? '#ffffff' : '#d3d7cf',
        brightBlack: isDarkModeCheck ? '#555753' : '#7f8c8d',
        brightRed: '#ef2929',
        brightGreen: '#8ae234',
        brightYellow: '#fce94f',
        brightBlue: '#729fcf',
        brightMagenta: '#ad7fa8',
        brightCyan: '#34e2e2',
        brightWhite: '#ffffff'
      }
      
      // Apply the new theme to the existing terminal
      xtermRef.current.options.theme = newTheme
      xtermRef.current.refresh(0, xtermRef.current.rows - 1)
    }
  }, [isDarkMode, terminalId])

  // Context menu items
  const contextMenuItems = [
    {
      label: 'Copy',
      icon: 'pi pi-copy',
      command: () => {
        if (xtermRef.current && xtermRef.current.hasSelection()) {
          const selection = xtermRef.current.getSelection()
          navigator.clipboard.writeText(selection)
        }
      },
      disabled: () => !xtermRef.current?.hasSelection()
    },
    {
      label: 'Paste',
      icon: 'pi pi-clipboard',
      command: () => {
        navigator.clipboard.readText().then(text => {
          if (xtermRef.current) {
            xtermRef.current.paste(text)
          }
        }).catch(err => {
          console.warn('Failed to paste:', err)
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
    }
  ]

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    dispose: () => {
      console.log(`Disposing terminal instance ${terminalId}`)
      
      // Remove event listeners first
      ipcRenderer.removeAllListeners(`terminal-data-${terminalId}`)
      ipcRenderer.removeAllListeners(`terminal-title-${terminalId}`)
      ipcRenderer.removeAllListeners(`terminal-exit-${terminalId}`)
      
      // Kill PTY process
      if (ptyProcessRef.current) {
        ipcRenderer.invoke('terminal-kill', terminalId).catch(err => {
          console.warn(`Error killing terminal ${terminalId}:`, err)
        })
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
        fitAddonRef.current.fit()
      }
    }
  }))

  useEffect(() => {
    if (!terminalRef.current) return

    // Get computed CSS custom properties for theming
    const computedStyle = getComputedStyle(document.documentElement)
    const terminalBg = computedStyle.getPropertyValue('--terminal-bg').trim()
    const terminalText = computedStyle.getPropertyValue('--terminal-text').trim()
    
    // Determine if we're in dark mode based on the terminal text color
    const isDarkMode = terminalText === '#ffffff'
    
    // Create terminal instance
    const terminal = new Terminal({
      fontFamily: '"Fira Code", "Cascadia Code", "Consolas", "Monaco", monospace',
      fontSize: 14,
      fontWeight: 'normal',
      fontWeightBold: 'bold',
      lineHeight: 1.2,
      letterSpacing: 0,
      cursorBlink: true,
      cursorStyle: 'block',
      theme: {
        background: terminalBg,
        foreground: terminalText,
        cursor: terminalText,
        cursorAccent: terminalBg,
        selection: isDarkMode ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)',
        black: isDarkMode ? '#2e3436' : '#000000',
        red: '#e74c3c',
        green: '#2ecc71',
        yellow: '#f39c12',
        blue: '#3498db',
        magenta: '#9b59b6',
        cyan: '#1abc9c',
        white: isDarkMode ? '#ffffff' : '#d3d7cf',
        brightBlack: isDarkMode ? '#555753' : '#7f8c8d',
        brightRed: '#ef2929',
        brightGreen: '#8ae234',
        brightYellow: '#fce94f',
        brightBlue: '#729fcf',
        brightMagenta: '#ad7fa8',
        brightCyan: '#34e2e2',
        brightWhite: '#ffffff'
      },
      allowTransparency: false,
      bellSound: false,
      bellStyle: 'none',
      convertEol: true,
      scrollback: 1000,
      tabStopWidth: 8
    })

    // Add addons
    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()
    const searchAddon = new SearchAddon()

    terminal.loadAddon(fitAddon)
    terminal.loadAddon(webLinksAddon)
    terminal.loadAddon(searchAddon)

    // Open terminal in the DOM
    terminal.open(terminalRef.current)

    // Add right-click context menu handler
    terminalRef.current.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      if (contextMenuRef.current) {
        contextMenuRef.current.show(e)
      }
    })

    // Store references
    xtermRef.current = terminal
    fitAddonRef.current = fitAddon

    // Initial fit
    setTimeout(() => {
      fitAddon.fit()
    }, 100)

    // Set up resize observer
    const resizeObserver = new ResizeObserver(() => {
      if (fitAddon && terminal) {
        setTimeout(() => {
          fitAddon.fit()
        }, 50)
      }
    })
    
    resizeObserver.observe(terminalRef.current)
    resizeObserverRef.current = resizeObserver

    // Create PTY process
    const startTerminal = async () => {
      // Prevent multiple initialization attempts
      if (isInitializingRef.current) {
        console.log(`Terminal ${terminalId} is already initializing, skipping...`)
        return
      }
      
      isInitializingRef.current = true
      
      try {
        // Ensure we pass a proper string for cwd
        let workingDir = workspace.workingDirectory
        if (typeof workingDir === 'object' && workingDir !== null) {
          // If workingDirectory is an object, try to extract path property
          workingDir = workingDir.path || workingDir.workingDirectory || undefined
        }
        
        console.log(`Initializing terminal ${terminalId} with cwd: ${workingDir}`)
        
        const ptyInfo = await ipcRenderer.invoke('terminal-create', {
          terminalId,
          cwd: workingDir || undefined, // Let backend handle fallback to home directory
          cols: terminal.cols,
          rows: terminal.rows
        })

        ptyProcessRef.current = ptyInfo
        console.log(`Terminal ${terminalId} initialized successfully`)

        // Handle incoming data from PTY
        ipcRenderer.on(`terminal-data-${terminalId}`, (event, data) => {
          terminal.write(data)
        })

        // Handle terminal title changes
        ipcRenderer.on(`terminal-title-${terminalId}`, (event, title) => {
          if (onTitleChangeRef.current) {
            onTitleChangeRef.current(title)
          }
        })

        // Handle PTY exit
        ipcRenderer.on(`terminal-exit-${terminalId}`, (event, exitData) => {
          const exitCode = exitData?.code !== undefined ? exitData.code : exitData
          const signal = exitData?.signal
          
          console.log(`Terminal ${terminalId} exited:`, { exitCode, signal })
          
          if (exitCode === 0) {
            // Normal exit
            terminal.write(`\r\n\x1b[32mProcess exited normally\x1b[0m\r\n`)
          } else {
            // Error exit
            terminal.write(`\r\n\x1b[31mProcess exited with code: ${exitCode}\x1b[0m\r\n`)
          }
          
          terminal.write('\x1b[33mTerminal session ended. Close this tab or create a new terminal.\x1b[0m')
        })

        // Handle user input
        terminal.onData((data) => {
          ipcRenderer.send('terminal-input', terminalId, data)
        })

        // Handle terminal resize
        terminal.onResize(({ cols, rows }) => {
          ipcRenderer.send('terminal-resize', terminalId, cols, rows)
        })

        // Add keyboard shortcuts
        terminal.attachCustomKeyEventHandler((event) => {
          // Handle Ctrl+C / Cmd+C for copy
          if ((event.ctrlKey || event.metaKey) && event.key === 'c' && terminal.hasSelection()) {
            const selection = terminal.getSelection()
            if (selection) {
              navigator.clipboard.writeText(selection)
              return false // Prevent default
            }
          }
          
          // Handle Ctrl+V / Cmd+V for paste
          if ((event.ctrlKey || event.metaKey) && event.key === 'v') {
            navigator.clipboard.readText().then(text => {
              terminal.paste(text)
            }).catch(err => {
              console.warn('Failed to paste:', err)
            })
            return false // Prevent default
          }
          
          // Handle Ctrl+A / Cmd+A for select all
          if ((event.ctrlKey || event.metaKey) && event.key === 'a') {
            terminal.selectAll()
            return false // Prevent default
          }
          
          return true // Allow default behavior for other keys
        })

      } catch (error) {
        console.error('Failed to start terminal:', error)
        terminal.write(`\r\n\x1b[31mFailed to start terminal: ${error.message}\x1b[0m\r\n`)
      } finally {
        isInitializingRef.current = false
      }
    }

    startTerminal()

    // Cleanup function
    return () => {
      console.log(`Cleaning up terminal instance ${terminalId}`)
      
      // Remove event listeners
      ipcRenderer.removeAllListeners(`terminal-data-${terminalId}`)
      ipcRenderer.removeAllListeners(`terminal-title-${terminalId}`)
      ipcRenderer.removeAllListeners(`terminal-exit-${terminalId}`)
      
      // Kill PTY process
      if (ptyProcessRef.current) {
        ipcRenderer.invoke('terminal-kill', terminalId).catch(err => {
          console.warn(`Error killing terminal ${terminalId} during cleanup:`, err)
        })
        ptyProcessRef.current = null
      }
      
      // Dispose terminal
      if (terminal) {
        terminal.dispose()
      }
      
      // Disconnect resize observer
      if (resizeObserver) {
        resizeObserver.disconnect()
      }
      
      // Reset initialization flag
      isInitializingRef.current = false
    }
  }, [terminalId]) // Removed workspace.workingDirectory and onTitleChange from dependencies

  // Focus terminal when it becomes active
  useEffect(() => {
    if (isActive && xtermRef.current) {
      setTimeout(() => {
        xtermRef.current.focus()
        if (fitAddonRef.current) {
          fitAddonRef.current.fit()
        }
      }, 100)
    }
  }, [isActive])

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
      />
      <ContextMenu 
        ref={contextMenuRef} 
        model={contextMenuItems}
        breakpoint="767px"
      />
    </>
  )
})

TerminalInstance.displayName = 'TerminalInstance'

export default TerminalInstance
