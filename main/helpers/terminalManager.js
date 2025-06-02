import { spawn } from "node-pty"
import os from "os"
import path from "path"

class TerminalManager {
  constructor() {
    this.terminals = new Map()
  }

  getShellForPlatform() {
    const platform = os.platform()
    let shell,
      args = []

    switch (platform) {
      case "win32":
        // Use PowerShell on Windows
        shell = "powershell.exe"
        args = ["-NoLogo"]
        break
      case "darwin":
        // Use zsh on macOS (default on modern macOS)
        shell = process.env.SHELL || "/bin/zsh"
        break
      case "linux":
        // Use bash on Linux
        shell = process.env.SHELL || "/bin/bash"
        break
      default:
        shell = process.env.SHELL || "/bin/sh"
    }

    return { shell, args }
  }

  createTerminal(terminalId, options = {}) {
    try {
      const { shell, args } = this.getShellForPlatform()
      const { cwd = os.homedir(), cols = 80, rows = 24 } = options

      console.log(`Creating terminal ${terminalId} with shell: ${shell}`)

      const ptyProcess = spawn(shell, args, {
        name: "xterm-color",
        cols,
        rows,
        cwd,
        env: {
          ...process.env,
          // Ensure colored output
          TERM: "xterm-256color",
          COLORTERM: "truecolor",
          // Set PS1 for colored prompt (bash/zsh)
          ...(os.platform() !== "win32" && {
            PS1: "\\[\\033[01;32m\\]\\u@\\h\\[\\033[00m\\]:\\[\\033[01;34m\\]\\w\\[\\033[00m\\]\\$ "
          }),
          // Windows-specific environment
          ...(os.platform() === "win32" && {
            TERM_PROGRAM: "MEDomicsLab",
            TERM_PROGRAM_VERSION: "1.0.0",
            // Enable VT processing for colored output in PowerShell
            FORCE_COLOR: "1",
            NO_COLOR: undefined
          })
        }
      })

      // Store the terminal process
      this.terminals.set(terminalId, ptyProcess)

      console.log(`Terminal ${terminalId} created successfully`)
      return {
        terminalId,
        pid: ptyProcess.pid,
        cols: ptyProcess.cols,
        rows: ptyProcess.rows
      }
    } catch (error) {
      console.error(`Failed to create terminal ${terminalId}:`, error)
      throw error
    }
  }

  writeToTerminal(terminalId, data) {
    const terminal = this.terminals.get(terminalId)
    if (terminal) {
      terminal.write(data)
    } else {
      console.warn(`Terminal ${terminalId} not found for write operation`)
    }
  }

  resizeTerminal(terminalId, cols, rows) {
    const terminal = this.terminals.get(terminalId)
    if (terminal) {
      terminal.resize(cols, rows)
    } else {
      console.warn(`Terminal ${terminalId} not found for resize operation`)
    }
  }

  killTerminal(terminalId) {
    const terminal = this.terminals.get(terminalId)
    if (terminal) {
      try {
        terminal.kill()
        this.terminals.delete(terminalId)
        console.log(`Terminal ${terminalId} killed successfully`)
      } catch (error) {
        console.error(`Error killing terminal ${terminalId}:`, error)
      }
    } else {
      console.warn(`Terminal ${terminalId} not found for kill operation`)
    }
  }

  setupTerminalEventHandlers(terminalId, mainWindow) {
    const terminal = this.terminals.get(terminalId)
    if (!terminal) {
      console.warn(`Terminal ${terminalId} not found for event setup`)
      return
    }

    // Handle data output from terminal
    terminal.onData((data) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(`terminal-data-${terminalId}`, data)
      }
    })

    // Handle terminal exit
    terminal.onExit((exitCode, signal) => {
      console.log(`Terminal ${terminalId} exited with code ${exitCode}, signal ${signal}`)
      if (mainWindow && !mainWindow.isDestroyed()) {
        // Ensure we send proper data - exitCode might be an object
        const exitData = {
          code: exitCode,
          signal: signal
        }
        mainWindow.webContents.send(`terminal-exit-${terminalId}`, exitData)
      }
      this.terminals.delete(terminalId)
    })

    // Simulate title changes based on working directory changes
    // Since node-pty doesn't always properly emit title changes,
    // we'll monitor the output for directory changes
    let currentDir = os.homedir()
    terminal.onData((data) => {
      // Simple heuristic to detect directory changes
      // This is a basic implementation - in a real app you might want more sophisticated detection
      if (data.includes(currentDir) || data.match(/[\w-]+@[\w-]+:/)) {
        const title = `Terminal - ${path.basename(currentDir)}`
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send(`terminal-title-${terminalId}`, title)
        }
      }
    })
  }

  cleanup() {
    // Kill all active terminals
    for (const [terminalId, terminal] of this.terminals) {
      try {
        terminal.kill()
        console.log(`Cleaned up terminal ${terminalId}`)
      } catch (error) {
        console.error(`Error cleaning up terminal ${terminalId}:`, error)
      }
    }
    this.terminals.clear()
  }

  getTerminalCount() {
    return this.terminals.size
  }

  getAllTerminals() {
    return Array.from(this.terminals.keys())
  }
}

export default TerminalManager
