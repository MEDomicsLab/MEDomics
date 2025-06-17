import { spawn } from "node-pty"
import os from "os"
import path from "path"

class TerminalManager {
  constructor() {
    this.terminals = new Map()
    this.terminalCwd = new Map() // Track current working directory for each terminal
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
      const { cwd = os.homedir(), cols = 80, rows = 24, useIPython = false } = options

      let finalShell = shell
      let finalArgs = args

      // If IPython is requested, use the Python environment from .medomics
      if (useIPython) {
        const pythonPath = this.getPythonEnvironmentPath()
        if (pythonPath) {
          console.log(`Creating IPython session ${terminalId} with Python: ${pythonPath}`)
          finalShell = pythonPath
          finalArgs = ["-m", "IPython"]
        } else {
          console.warn(`Python environment not found for IPython session ${terminalId}, falling back to system IPython`)
          // Try to use system IPython
          if (os.platform() === "win32") {
            finalShell = "cmd.exe"
            finalArgs = ["/c", "ipython"]
          } else {
            finalShell = "ipython"
            finalArgs = []
          }
        }
      } else {
        console.log(`Creating terminal ${terminalId} with shell: ${shell}`)
      }

      const ptyProcess = spawn(finalShell, finalArgs, {
        name: "xterm-color",
        cols,
        rows,
        cwd,
        env: {
          ...process.env,
          // Ensure colored output
          TERM: "xterm-256color",
          COLORTERM: "truecolor",
          // Add Python environment to PATH if using IPython
          ...(useIPython &&
            this.getPythonEnvironmentPath() && {
              PATH: `${this.getPythonBinPath()}${os.platform() === "win32" ? ";" : ":"}${process.env.PATH}`
            }),
          // Set PS1 for colored prompt (bash/zsh)
          ...(os.platform() !== "win32" &&
            !useIPython && {
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

      // Store the terminal process and initial directory
      this.terminals.set(terminalId, ptyProcess)
      this.terminalCwd.set(terminalId, cwd)

      const sessionType = useIPython ? "IPython session" : "Terminal"
      console.log(`${sessionType} ${terminalId} created successfully`)
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

  // Create a clone of an existing terminal (used for splitting)
  cloneTerminal(sourceTerminalId, newTerminalId, options = {}) {
    try {
      // First check if source terminal exists
      if (!this.terminals.has(sourceTerminalId)) {
        throw new Error(`Source terminal ${sourceTerminalId} not found for cloning`)
      }

      // Get current working directory from source terminal
      const cwd = this.terminalCwd.get(sourceTerminalId) || os.homedir()
      console.log(`Source terminal cwd: ${cwd}`)

      // Create a new terminal with the same directory
      const cloneOptions = {
        ...options,
        cwd
      }

      console.log(`Cloning terminal ${sourceTerminalId} to ${newTerminalId} with CWD: ${cwd}`)

      // Create a new terminal process at the same directory as the source
      const result = this.createTerminal(newTerminalId, cloneOptions)

      // Execute clear and show the path for better user experience
      // Use a slight delay to ensure the terminal is ready
      setTimeout(() => {
        this.writeToTerminal(newTerminalId, "clear\n")

        // Using echo and pwd to show terminal is in the same directory
        this.writeToTerminal(newTerminalId, 'echo "Terminal split in directory:"\n')
        this.writeToTerminal(newTerminalId, "pwd\n")
      }, 200)

      // Copy working directory from source terminal
      this.terminalCwd.set(newTerminalId, cwd)

      // Keep a reference to the parent terminal
      const relationshipInfo = {
        parentId: sourceTerminalId,
        childId: newTerminalId
      }

      return {
        ...result,
        cwd,
        sourceTerminalId, // Keep track of parent terminal for better split management
        relationshipInfo // Additional relationship information
      }
    } catch (error) {
      console.error(`Failed to clone terminal ${sourceTerminalId}:`, error)
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
        this.terminalCwd.delete(terminalId) // Clean up stored CWD
        console.log(`Terminal ${terminalId} killed successfully`)
      } catch (error) {
        console.error(`Error killing terminal ${terminalId}:`, error)
      }
    } else {
      console.warn(`Terminal ${terminalId} not found for kill operation`)
    }
  }

  getCurrentWorkingDirectory(terminalId) {
    return this.terminalCwd.get(terminalId) || os.homedir()
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
      this.terminalCwd.delete(terminalId) // Clean up stored CWD
    })

    // Track working directory changes based on output
    let currentDir = this.terminalCwd.get(terminalId) || os.homedir()

    terminal.onData((data) => {
      // Try to detect directory changes using various patterns
      const dirPatterns = [
        // Linux/macOS pwd command result
        /^(\/[^\r\n]+)[\r\n]/,
        // Common prompt patterns with paths
        /\w+:([\/\\][^\s\$]+)[$#>]/,
        // Windows directory change (cd output)
        /^(?:.*?)?([A-Z]:\\(?:[^\\]+\\)*[^\\]+)>/i
      ]

      for (const pattern of dirPatterns) {
        const match = data.match(pattern)
        if (match && match[1]) {
          const potentialDir = match[1].trim()
          if (potentialDir && potentialDir !== currentDir) {
            currentDir = potentialDir
            this.terminalCwd.set(terminalId, currentDir)
            console.log(`Terminal ${terminalId} directory updated: ${currentDir}`)
            break
          }
        }
      }

      // Send title update with directory info
      const title = `Terminal - ${path.basename(currentDir)}`
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(`terminal-title-${terminalId}`, title)
        // Also send current directory for UI to use
        mainWindow.webContents.send(`terminal-cwd-${terminalId}`, currentDir)
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
    this.terminalCwd.clear()
  }

  getTerminalCount() {
    return this.terminals.size
  }

  getAllTerminals() {
    return Array.from(this.terminals.keys())
  }

  // Get the Python environment path from .medomics directory
  getPythonEnvironmentPath() {
    const { app } = require("electron")
    const path = require("path")
    const fs = require("fs")

    try {
      // Check for bundled Python in .medomics directory
      const homePath = app.getPath("home")
      const medomicsPath = path.join(homePath, ".medomics", "python")

      let pythonExecutable
      if (process.platform === "win32") {
        pythonExecutable = path.join(medomicsPath, "python.exe")
      } else {
        pythonExecutable = path.join(medomicsPath, "bin", "python")
      }

      if (fs.existsSync(pythonExecutable)) {
        return pythonExecutable
      }

      // Fallback to conda environment if available
      const condaPath = this.getCondaEnvironmentPath()
      if (condaPath) {
        return condaPath
      }

      return null
    } catch (error) {
      console.error("Error getting Python environment path:", error)
      return null
    }
  }

  // Get conda environment path for med_conda_env
  getCondaEnvironmentPath() {
    try {
      // This should integrate with the existing Python environment detection
      // For now, return null and let the system handle IPython discovery
      return null
    } catch (error) {
      console.error("Error getting conda environment path:", error)
      return null
    }
  }

  // Get the Python bin directory path
  getPythonBinPath() {
    const pythonPath = this.getPythonEnvironmentPath()
    if (!pythonPath) return null

    const path = require("path")
    if (process.platform === "win32") {
      return path.dirname(pythonPath)
    } else {
      return path.dirname(pythonPath) // This will be the bin directory
    }
  }
}

export default TerminalManager
