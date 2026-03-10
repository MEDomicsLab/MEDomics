import { spawn } from "node-pty"
import os from "os"
import path from "path"
import fs from "fs"

// Delay (in ms) for terminal to be ready after cloning (for clear/pwd commands)
// This can be overridden via options or environment variable for dynamic adjustment
const TERMINAL_CLONE_READY_DELAY = process.env.TERMINAL_CLONE_READY_DELAY ? parseInt(process.env.TERMINAL_CLONE_READY_DELAY, 10) : 200

class TerminalManager {
  constructor() {
    this.terminals = new Map()
    this.terminalCwd = new Map() // Track current working directory for each terminal
    this.terminalShells = new Map() // Track shell executable for each terminal
  }

  getDefaultPathForPlatform() {
    const platform = os.platform()

    if (platform === "win32") {
      return "C:\\Windows\\System32;C:\\Windows;C:\\Windows\\System32\\WindowsPowerShell\\v1.0"
    }

    if (platform === "darwin") {
      return "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
    }

    return "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
  }

  buildPathEnv(extraEntries = []) {
    const delimiter = os.platform() === "win32" ? ";" : ":"
    const currentPath = process.env.PATH || ""

    // Essential system directories that must always be available
    // In production Electron (launched from Dock/Finder), PATH can be minimal
    const essentialDirs = os.platform() === "win32"
      ? ["C:\\Windows\\System32", "C:\\Windows", "C:\\Windows\\System32\\WindowsPowerShell\\v1.0"]
      : ["/usr/local/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin"]

    if (os.platform() === "darwin") {
      essentialDirs.push("/opt/homebrew/bin", "/opt/homebrew/sbin")
    }

    const allEntries = [
      ...extraEntries.filter(Boolean),
      ...currentPath.split(delimiter).filter(Boolean),
      ...essentialDirs
    ]

    return [...new Set(allEntries)].join(delimiter)
  }

  resolveWorkingDirectory(cwd) {
    if (typeof cwd === "string" && cwd.trim().length > 0 && fs.existsSync(cwd)) {
      try {
        if (fs.statSync(cwd).isDirectory()) {
          return cwd
        }
      } catch (error) {
        console.warn(`Invalid cwd provided (${cwd}), falling back to home directory`)
      }
    }

    return os.homedir()
  }

  resolveShellExecutable(preferredShell) {
    const platform = os.platform()
    const shellCandidates = []

    const pushCandidate = (candidate) => {
      if (typeof candidate === "string" && candidate.trim().length > 0) {
        shellCandidates.push(candidate)
      }
    }

    pushCandidate(preferredShell)
    pushCandidate(process.env.SHELL)

    if (platform === "darwin") {
      pushCandidate("/bin/zsh")
      pushCandidate("/bin/bash")
      pushCandidate("/bin/sh")
      pushCandidate("/opt/homebrew/bin/zsh")
      pushCandidate("/usr/local/bin/zsh")
      pushCandidate("/opt/homebrew/bin/bash")
      pushCandidate("/usr/local/bin/bash")
    } else if (platform === "linux") {
      pushCandidate("/bin/bash")
      pushCandidate("/bin/sh")
      pushCandidate("/usr/bin/bash")
      pushCandidate("/usr/bin/zsh")
    } else if (platform === "win32") {
      pushCandidate("powershell.exe")
      pushCandidate("cmd.exe")
    }

    for (const candidate of shellCandidates) {
      const trimmedCandidate = candidate.trim()

      if (path.isAbsolute(trimmedCandidate) && fs.existsSync(trimmedCandidate)) {
        return trimmedCandidate
      }

      if (!trimmedCandidate.includes(path.sep) && platform === "win32") {
        return trimmedCandidate
      }
    }

    if (platform === "win32") {
      return "cmd.exe"
    }

    return "/bin/sh"
  }

  getShellForPlatform(preferredShell = null) {
    const platform = os.platform()
    let shell,
      args = []

    if (platform === "win32") {
      shell = preferredShell || "powershell.exe"
      if (shell.toLowerCase().includes("powershell")) {
        args = ["-NoLogo"]
      } else if (shell.toLowerCase().includes("bash")) {
        args = ["--login"]
      }
    } else {
      // macOS, Linux, and others
      if (platform === "darwin") {
        shell = preferredShell || process.env.SHELL || "/bin/zsh"
      } else if (platform === "linux") {
        shell = preferredShell || process.env.SHELL || "/bin/bash"
      } else {
        shell = preferredShell || process.env.SHELL || "/bin/sh"
      }
      // Start as login shell so that /etc/zprofile (path_helper) and
      // user profile files (.zshrc, .bash_profile, etc.) are sourced.
      // This is what VS Code, iTerm2, and Terminal.app do on macOS.
      args = ["-l"]
    }

    const resolvedShell = this.resolveShellExecutable(shell)
    return { shell: resolvedShell, args }
  }

  createTerminal(terminalId, options = {}) {
    try {
      const { cwd = os.homedir(), cols = 80, rows = 24, useIPython = false, shellPath = null } = options
      const { shell, args } = this.getShellForPlatform(shellPath)
      const finalCwd = this.resolveWorkingDirectory(cwd)
      const extraPathEntries = []

      let finalShell = shell
      let finalArgs = args

      // If IPython is requested, use the Python environment from .medomics
      if (useIPython) {
        const pythonPath = this.getPythonEnvironmentPath()
        if (pythonPath) {
          console.log(`Creating IPython session ${terminalId} with Python: ${pythonPath}`)
          finalShell = pythonPath
          finalArgs = ["-m", "IPython"]
          const pythonBinPath = this.getPythonBinPath()
          if (pythonBinPath) {
            extraPathEntries.push(pythonBinPath)
          }
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
        console.log(`Creating terminal ${terminalId} with shell: ${finalShell}`)
      }

      const terminalPath = this.buildPathEnv(extraPathEntries)
      const localeValue = process.env.LANG || "en_US.UTF-8"

      console.log(`Spawning terminal ${terminalId}: shell=${finalShell}, args=${JSON.stringify(finalArgs)}, cwd=${finalCwd}`)

      const ptyProcess = spawn(finalShell, finalArgs, {
        name: "xterm-256color",
        cols,
        rows,
        cwd: finalCwd,
        env: {
          ...process.env,
          PATH: terminalPath,
          // Ensure colored output
          TERM: "xterm-256color",
          COLORTERM: "truecolor",
          // Locale settings — prevents "command not found: locale" errors
          LANG: localeValue,
          LC_ALL: process.env.LC_ALL || localeValue,
          // Do NOT set PS1 — login shell profiles handle the prompt
          // (P10k, Oh My Zsh, Starship, etc. set their own prompts)
          // Windows-specific environment
          ...(os.platform() === "win32" && {
            TERM_PROGRAM: "MEDomicsLab",
            TERM_PROGRAM_VERSION: "1.0.0",
            FORCE_COLOR: "1"
          })
        }
      })

      // Store the terminal process, directory, and shell info
      this.terminals.set(terminalId, ptyProcess)
      this.terminalCwd.set(terminalId, finalCwd)
      this.terminalShells.set(terminalId, finalShell)

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

      // Get current working directory and shell from source terminal
      const cwd = this.terminalCwd.get(sourceTerminalId) || os.homedir()
      const sourceShell = this.terminalShells.get(sourceTerminalId) || null
      console.log(`Source terminal cwd: ${cwd}, shell: ${sourceShell}`)

      // Create a new terminal with the same directory and shell
      const cloneOptions = {
        ...options,
        cwd,
        shellPath: sourceShell
      }

      // Allow dynamic delay override via options or fallback to constant
      const cloneReadyDelay = typeof options.cloneReadyDelay === "number" ? options.cloneReadyDelay : TERMINAL_CLONE_READY_DELAY

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
      }, cloneReadyDelay)

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
        // Send SIGHUP first for graceful shell exit, then kill if needed
        try { terminal.kill('SIGHUP') } catch { terminal.kill() }
        this.terminals.delete(terminalId)
        this.terminalCwd.delete(terminalId) // Clean up stored CWD
        this.terminalShells.delete(terminalId) // Clean up stored shell
        console.log(`Terminal ${terminalId} killed successfully`)
      } catch (error) {
        console.error(`Error killing terminal ${terminalId}:`, error)
        // Force remove from maps even if kill fails
        this.terminals.delete(terminalId)
        this.terminalCwd.delete(terminalId)
        this.terminalShells.delete(terminalId)
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
      this.terminalShells.delete(terminalId) // Clean up stored shell
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

  /**
   * Gracefully clean up all terminals, waiting for each child process to exit.
   * Returns a promise that resolves when all PTY processes have exited (or timed out).
   * This MUST be awaited before app.quit() to prevent the node-pty SIGABRT crash.
   */
  async cleanupAsync(timeoutMs = 3000) {
    if (this.terminals.size === 0) {
      return
    }

    console.log(`Cleaning up ${this.terminals.size} terminal(s)...`)
    const exitPromises = []

    for (const [terminalId, terminal] of this.terminals) {
      const exitPromise = new Promise((resolve) => {
        // Set a timeout so we don't wait forever
        const timer = setTimeout(() => {
          console.warn(`Terminal ${terminalId} exit timed out after ${timeoutMs}ms, force killing`)
          try { terminal.kill('SIGKILL') } catch (e) { /* already dead */ }
          resolve()
        }, timeoutMs)

        // Listen for the exit event
        try {
          terminal.onExit(() => {
            clearTimeout(timer)
            console.log(`Terminal ${terminalId} exited during cleanup`)
            resolve()
          })
        } catch (e) {
          // If we can't attach the listener, just resolve after kill
          clearTimeout(timer)
          resolve()
        }

        // Send graceful kill signal
        try {
          if (os.platform() === 'win32') {
            terminal.kill()
          } else {
            // SIGHUP is the standard signal for "terminal closed"
            terminal.kill('SIGHUP')
          }
        } catch (error) {
          console.warn(`Error sending kill signal to terminal ${terminalId}:`, error)
          clearTimeout(timer)
          resolve()
        }
      })

      exitPromises.push(exitPromise)
    }

    // Wait for all terminals to exit
    await Promise.all(exitPromises)

    // Clear all maps
    this.terminals.clear()
    this.terminalCwd.clear()
    this.terminalShells.clear()
    console.log('All terminals cleaned up successfully')
  }

  /**
   * Synchronous cleanup fallback — kills all terminals without waiting.
   * Only use this if cleanupAsync cannot be called (e.g., synchronous event handler).
   */
  cleanup() {
    // Kill all active terminals
    for (const [terminalId, terminal] of this.terminals) {
      try {
        if (os.platform() === 'win32') {
          terminal.kill()
        } else {
          terminal.kill('SIGHUP')
        }
        console.log(`Cleaned up terminal ${terminalId}`)
      } catch (error) {
        console.error(`Error cleaning up terminal ${terminalId}:`, error)
      }
    }
    this.terminals.clear()
    this.terminalCwd.clear()
    this.terminalShells.clear()
  }

  getTerminalCount() {
    return this.terminals.size
  }

  getAllTerminals() {
    return Array.from(this.terminals.keys())
  }

  getTerminalShell(terminalId) {
    return this.terminalShells.get(terminalId) || null
  }

  /**
   * Returns all available shell executables on the system.
   * Used by the renderer to offer a shell selector (like VS Code).
   */
  getAvailableShells() {
    const platform = os.platform()
    const shells = []
    const defaultShell = platform === "win32"
      ? "powershell.exe"
      : (process.env.SHELL || (platform === "darwin" ? "/bin/zsh" : "/bin/bash"))

    if (platform === "win32") {
      const candidates = [
        { name: "PowerShell", path: "powershell.exe" },
        { name: "Command Prompt", path: "cmd.exe" },
        { name: "Git Bash", path: "C:\\Program Files\\Git\\bin\\bash.exe" },
        { name: "WSL", path: "wsl.exe" }
      ]
      for (const candidate of candidates) {
        // For non-absolute paths on Windows, just include them
        if (!path.isAbsolute(candidate.path) || fs.existsSync(candidate.path)) {
          shells.push({
            ...candidate,
            isDefault: candidate.path === defaultShell
          })
        }
      }
    } else {
      const candidates = [
        { name: "zsh", path: "/bin/zsh" },
        { name: "bash", path: "/bin/bash" },
        { name: "sh", path: "/bin/sh" }
      ]

      if (platform === "darwin") {
        candidates.push(
          { name: "zsh (Homebrew)", path: "/opt/homebrew/bin/zsh" },
          { name: "bash (Homebrew)", path: "/opt/homebrew/bin/bash" },
          { name: "fish (Homebrew)", path: "/opt/homebrew/bin/fish" },
          { name: "fish", path: "/usr/local/bin/fish" }
        )
      }

      if (platform === "linux") {
        candidates.push(
          { name: "zsh", path: "/usr/bin/zsh" },
          { name: "fish", path: "/usr/bin/fish" }
        )
      }

      // Deduplicate by path and only include shells that exist
      const seen = new Set()
      for (const candidate of candidates) {
        if (!seen.has(candidate.path) && fs.existsSync(candidate.path)) {
          seen.add(candidate.path)
          shells.push({
            ...candidate,
            isDefault: candidate.path === defaultShell ||
              candidate.path === this.resolveShellExecutable(defaultShell)
          })
        }
      }
    }

    return shells
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
