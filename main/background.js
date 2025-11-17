// Force Electron headless mode if --no-gui is present
if (process.argv.some(arg => arg.includes('--no-gui'))) {
  process.env.ELECTRON_ENABLE_HEADLESS = '1'
  // On some Linux systems, also clear DISPLAY
  process.env.DISPLAY = ''
}
import { app, ipcMain, Menu, dialog, BrowserWindow, protocol, shell, nativeTheme } from "electron"
import axios from "axios"
import os from "os"
import serve from "electron-serve"
import { createWindow, TerminalManager } from "./helpers"
import { installExtension, REACT_DEVELOPER_TOOLS } from "electron-extension-installer"
import MEDconfig from "../medomics.dev"
const crypto = require("crypto")
const decompress = require("decompress")
// Backend access is done over HTTP requests to the backend Express server.
// This avoids importing backend modules into the Electron main process.
// We expose small wrapper functions below that call the backend endpoints.

// Helper to build backend URL (uses expressPort if available, otherwise falls back to serverPort)
function backendUrl(path) {
  const port = expressPort || serverPort || MEDconfig.defaultPort
  return `http://localhost:${port}${path}`
}

async function httpGet(path, params = {}) {
  try {
    const res = await axios.get(backendUrl(path), { params })
    return res.data
  } catch (err) {
    console.warn(`Backend GET ${path} failed:`, err && err.message)
    return null
  }
}

async function httpPost(path, body = {}) {
  try {
    const res = await axios.post(backendUrl(path), body)
    return res.data
  } catch (err) {
    console.warn(`Backend POST ${path} failed:`, err && err.message)
    return null
  }
}

// Wrapper functions that replace previous direct imports
async function runServerViaBackend() {
  return await httpPost("/run-go-server", {})
}

// Find an available port locally (used for dev UI port selection). This is a small
// local implementation so the main process doesn't import backend code for this.
function findAvailablePort(startPort, endPort = 8000) {
  const net = require("net")
  return new Promise((resolve, reject) => {
    let port = startPort
    function tryPort() {
      const server = net.createServer()
      server.once("error", (err) => {
        server.close()
        if (err.code === "EADDRINUSE") {
          port++
          if (port > endPort) return reject(new Error("No available port"))
          tryPort()
        } else {
          reject(err)
        }
      })
      server.once("listening", () => {
        server.close(() => resolve(port))
      })
      server.listen(port)
    }
    tryPort()
  })
}

async function getBundledPythonEnvironment() {
  const data = await httpGet("/get-bundled-python-environment")
  return data && data.pythonEnv ? data.pythonEnv : null
}

async function getInstalledPythonPackages(pythonPath) {
  const data = await httpGet("/get-installed-python-packages", { pythonPath })
  return data && data.packages ? data.packages : null
}

async function startMongoDB(workspacePath) {
  return await httpPost("/start-mongo", { workspacePath })
}

async function stopMongoDB() {
  // Backend doesn't currently expose a stop-mongo endpoint; call a generic endpoint if available.
  return await httpPost("/stop-mongo", {})
}

async function getMongoDBPath() {
  const data = await httpGet("/get-mongo-path")
  return data && data.path ? data.path : null
}

async function checkJupyterIsRunning() {
  const data = await httpGet("/check-jupyter-status")
  return data || { running: false, error: "no-response" }
}

async function startJupyterServer(workspacePath, port) {
  return await httpPost("/start-jupyter-server", { workspacePath, port })
}

async function stopJupyterServer() {
  return await httpPost("/stop-jupyter-server", {})
}

async function installMongoDB() {
  return await httpPost("/install-mongo", {})
}

async function checkRequirements() {
  const data = await httpGet("/check-requirements")
  return data
}
import {
  setWorkingDirectory,
  getRecentWorkspacesOptions,
  loadWorkspaces,
  createMedomicsDirectory,
  createRemoteMedomicsDirectory,
  updateWorkspace,
  createWorkingDirectory,
  createRemoteWorkingDirectory
} from "./utils/workspace"
// Backend python & installation utilities are accessed via HTTP wrappers defined above.
import {
  getTunnelState,
  getActiveTunnel,
  detectRemoteOS,
  getRemoteWorkspacePath,
  checkRemotePortOpen
} from './utils/remoteFunctions.js'
// MongoDB and Jupyter functions are accessed via HTTP wrappers (startMongoDB, stopMongoDB, getMongoDBPath, startJupyterServer, stopJupyterServer, checkJupyterIsRunning)


const fs = require("fs")
const terminalManager = new TerminalManager()
var path = require("path")
const dirTree = require("directory-tree")
const { exec, spawn, execSync, fork } = require("child_process")
let serverProcess = null
const serverState = { serverIsRunning: false }
var serverPort = MEDconfig.defaultPort
var hasBeenSet = false
const isProd = process.env.NODE_ENV === "production"
let splashScreen // The splash screen is the window that is displayed while the application is loading
export var mainWindow // The main window is the window of the application
// Robust headless mode detection
const isHeadless = process.argv.some(arg => arg.includes('--no-gui'))

//**** AUTO UPDATER ****//
const { autoUpdater } = require("electron-updater")
const log = require("electron-log")

autoUpdater.logger = log
autoUpdater.logger.transports.file.level = "info"
autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = true

//*********** LOG **************// This is used to send the console.log messages to the main window
//**** ELECTRON-LOG ****//
// Electron log path
// By default, it writes logs to the following locations:
// on Linux: ~/.config/{app name}/logs/main.log
// on macOS: ~/Library/Logs/{app name}/main.log
// on Windows: %USERPROFILE%\AppData\Roaming\{app name}\logs\main.log
const APP_NAME = isProd ? "medomicslab-application" : "medomicslab-application (development)"

const originalConsoleLog = console.log
/**
 * @description Sends the console.log messages to the main window
 * @param {*} message The message to send
 * @summary We redefine the console.log function to send the messages to the main window
 */
console.log = function () {
  try {
    originalConsoleLog(...arguments)
    log.log(...arguments)
    if (mainWindow !== undefined) {
      // Safely serialize all arguments to a string
      const msg = Array.from(arguments)
        .map((arg) => {
          if (typeof arg === "string") return arg
          try {
            return JSON.stringify(arg)
          } catch {
            return util.inspect(arg, { depth: 2 })
          }
        })
        .join(" ")
      mainWindow.webContents.send("log", msg)
    }
  } catch (error) {
    console.error(error)
  }
}

// **** BACKEND EXPRESS SERVER **** //
let expressPort = null

ipcMain.handle("get-express-port", async () => {
  return expressPort
})

function getBackendServerExecutable() {
  const platform = process.platform
  // Prefer user-configured path (CLI) from settings if available and exists
  try {
    const userDataPath = app.getPath("userData")
    const settingsFilePath = path.join(userDataPath, "settings.json")
    if (fs.existsSync(settingsFilePath)) {
      const settings = JSON.parse(fs.readFileSync(settingsFilePath, "utf8"))
      if (settings && settings.localBackendPath && fs.existsSync(settings.localBackendPath)) {
        return settings.localBackendPath // CLI executable path
      }
    }
  } catch {}
  if (app.isPackaged) {
    // In packaged builds, fallback to a bundled CLI if present
    const cliCandidates = [
      path.join(process.resourcesPath, "backend", platform === "win32" ? "medomics-server.exe" : "medomics-server"),
      path.join(process.resourcesPath, "backend", "bin", platform === "win32" ? "medomics-server.exe" : "medomics-server")
    ]
    for (const pth of cliCandidates) {
      try { if (fs.existsSync(pth)) return pth } catch {}
    }
    // Legacy fallback: original server binaries (kept for backward compatibility)
    if (platform === "win32") return path.join(process.resourcesPath, "backend", "server_win.exe")
    if (platform === "darwin") return path.join(process.resourcesPath, "backend", "server_mac")
    if (platform === "linux") return path.join(process.resourcesPath, "backend", "server_linux")
  } else {
    // In development, run the CLI via node
    return ["node", path.join(__dirname, "../backend/cli/medomics-server.mjs")]
  }
}

// ---- Helpers for backend installation ----
function saveLocalBackendPath(exePath) {
  return new Promise((resolve, reject) => {
    try {
      const userDataPath = app.getPath('userData')
      const settingsFilePath = path.join(userDataPath, 'settings.json')
      let settings = {}
      if (fs.existsSync(settingsFilePath)) {
        try { settings = JSON.parse(fs.readFileSync(settingsFilePath, 'utf8')) || {} } catch {}
      }
      settings.localBackendPath = exePath
      fs.writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2))
      resolve(true)
    } catch (e) { reject(e) }
  })
}

function findInstalledExecutable(versionDir) {
  try {
    if (!fs.existsSync(versionDir)) return null
    const binDir = path.join(versionDir, 'bin')
    if (fs.existsSync(binDir)) {
      const entries = fs.readdirSync(binDir)
      const exeCandidates = entries.map(e => path.join(binDir, e)).filter(p => {
        const lower = p.toLowerCase()
        if (process.platform === 'win32') return lower.endsWith('.exe') && lower.includes('medomics')
        return lower.includes('medomics') && fs.statSync(p).isFile()
      })
      return exeCandidates[0] || null
    }
    // Fallback scan entire versionDir
    const walk = (dir) => {
      const items = fs.readdirSync(dir)
      for (const item of items) {
        const full = path.join(dir, item)
        try {
          const st = fs.statSync(full)
          if (st.isDirectory()) {
            const found = walk(full)
            if (found) return found
          } else if (st.isFile()) {
            const lower = full.toLowerCase()
            if (process.platform === 'win32') {
              if (lower.endsWith('.exe') && lower.includes('medomics')) return full
            } else if (lower.includes('medomics')) {
              return full
            }
          }
        } catch {}
      }
      return null
    }
    return walk(versionDir)
  } catch { return null }
}

function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    try {
      const hash = crypto.createHash('sha256')
      const stream = fs.createReadStream(filePath)
      stream.on('data', d => hash.update(d))
      stream.on('end', () => resolve(hash.digest('hex')))
      stream.on('error', reject)
    } catch (e) { reject(e) }
  })
}

function downloadWithProgress(url, destPath, onProgress) {
  return new Promise(async (resolve, reject) => {
    try {
      const writer = fs.createWriteStream(destPath)
      const response = await axios.get(url, { responseType: 'stream' })
      const total = Number(response.headers['content-length']) || 0
      let downloaded = 0
      const start = Date.now()
      response.data.on('data', chunk => {
        downloaded += chunk.length
        const percent = total ? (downloaded / total) * 100 : null
        const elapsed = (Date.now() - start) / 1000
        const speed = elapsed > 0 ? (downloaded / elapsed) : 0
        onProgress && onProgress({ downloaded, total, percent, speed })
      })
      response.data.pipe(writer)
      writer.on('finish', () => resolve(destPath))
      writer.on('error', reject)
    } catch (e) { reject(e) }
  })
}

async function cleanupOldVersions(versionsDir, currentExePath, keep = 3) {
  try {
    if (!fs.existsSync(versionsDir)) return
    const entries = fs.readdirSync(versionsDir).map(v => ({ name: v, path: path.join(versionsDir, v) }))
    // Filter only directories
    const dirs = entries.filter(e => { try { return fs.statSync(e.path).isDirectory() } catch { return false } })
    // Sort by mtime descending (newest first)
    dirs.sort((a,b) => {
      const ma = fs.statSync(a.path).mtimeMs
      const mb = fs.statSync(b.path).mtimeMs
      return mb - ma
    })
    // Determine which to keep: newest keep entries + the one containing currentExePath
    const keepSet = new Set()
    for (let i=0; i<dirs.length && i<keep; i++) keepSet.add(dirs[i].name)
    // Ensure current exe version directory kept
    const currentVersionDir = dirs.find(d => currentExePath.startsWith(d.path))
    if (currentVersionDir) keepSet.add(currentVersionDir.name)
    const removeTargets = dirs.filter(d => !keepSet.has(d.name))
    for (const rem of removeTargets) {
      try {
        fs.rmSync(rem.path, { recursive: true, force: true })
      } catch {}
    }
  } catch (e) {
    console.warn('cleanupOldVersions error:', e.message)
  }
}

function startBackendServer() {
  let child
  const execPath = getBackendServerExecutable()
  const isDev = Array.isArray(execPath)
  let cmd, args

  // Prepare CLI state file under user home for consistent port discovery across Electron and CLI
  const stateDir = path.join(require('os').homedir(), '.medomics', 'medomics-server')
  try { if (!fs.existsSync(stateDir)) fs.mkdirSync(stateDir, { recursive: true }) } catch {}
  const stateFilePath = path.join(stateDir, 'state.json')

  if (isDev) {
    // node backend/cli/medomics-server.mjs start --json
    cmd = execPath[0]
    args = [execPath[1], 'start', '--json', '--state-file', stateFilePath]
  } else {
    // <installed>/medomics-server start --json
    cmd = execPath
    args = ['start', '--json', '--state-file', stateFilePath]
  }

  child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] })

  // Parse JSON lines from stdout to capture expressPort
  let buffer = ''
  child.stdout.on('data', (chunk) => {
    try {
      buffer += chunk.toString()
      let idx
      while ((idx = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, idx).trim()
        buffer = buffer.slice(idx + 1)
        if (!line) continue
        try {
          const obj = JSON.parse(line)
          if (obj && obj.success && (obj.state?.expressPort || obj.expressPort)) {
            const port = obj.state?.expressPort || obj.expressPort
            console.log(`Local Express server started on port: ${port}`)
            expressPort = port
          }
        } catch (_) {
          // Non-JSON line; ignore
        }
      }
    } catch (err) {
      console.warn('Error parsing backend stdout:', err)
    }
  })

  child.stderr.on('data', (chunk) => {
    try { console.warn('[backend]', chunk.toString().trim()) } catch {}
  })

  // Keep legacy IPC handling in case CLI forwards messages in the future
  if (child.on) {
    child.on("message", (message) => {
      try {
        if (message && message.type === "EXPRESS_PORT") {
          const port = message.expressPort || message.port
          console.log(`Local Express server started on port: ${port}`)
          expressPort = port
        }
      } catch (err) {
        console.warn('Error handling message from backend process:', err)
      }
    })
  }

  // Fallback: if we didn't get the port within timeout, probe known range
  const fallbackTimeoutMs = 10000
  setTimeout(async () => {
    if (!expressPort) {
      try {
        const found = await findExpressPortByProbing(3000, 8000, 48, 250)
        if (found) {
          expressPort = found
          console.log(`Discovered Express port via probe: ${found}`)
        } else {
          console.warn('Failed to discover Express port via probe within timeout')
        }
      } catch (e) {
        console.warn('Error probing for Express port:', e.message)
      }
    }
  }, fallbackTimeoutMs)

  child.unref()
  return child
}

async function findExpressPortByProbing(start = 3000, end = 8000, batchSize = 40, timeoutMs = 300) {
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n))
  let p = start
  while (p <= end) {
    const to = clamp(p + batchSize - 1, p, end)
    const ports = []
    for (let i = p; i <= to; i++) ports.push(i)
    const results = await Promise.allSettled(ports.map(port => axios.get(`http://127.0.0.1:${port}/status`, { timeout: timeoutMs })))
    for (let i = 0; i < results.length; i++) {
      const r = results[i]
      if (r.status === 'fulfilled') {
        const data = r.value && r.value.data ? r.value.data : r.value
        if (data && (data.success || data.expressPort || data.go || data.mongo || data.jupyter)) {
          return ports[i]
        }
      }
    }
    p = to + 1
  }
  return null
}

// ---- Unified status and ensure (local via CLI, remote via tunnel) ----
function getCliCommandAndArgs(baseArgs = []) {
  const execPath = getBackendServerExecutable()
  const isDev = Array.isArray(execPath)
  const stateDir = path.join(require('os').homedir(), '.medomics', 'medomics-server')
  try { if (!fs.existsSync(stateDir)) fs.mkdirSync(stateDir, { recursive: true }) } catch {}
  const stateFilePath = path.join(stateDir, 'state.json')
  if (isDev) return { cmd: execPath[0], args: [execPath[1], ...baseArgs, '--state-file', stateFilePath] }
  return { cmd: execPath, args: [...baseArgs, '--state-file', stateFilePath] }
}

function runCliCommand(baseArgs = [], timeoutMs = 15000) {
  return new Promise((resolve) => {
    try {
      const { cmd, args } = getCliCommandAndArgs(baseArgs)
      const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] })
      let buffer = ''
      let timer = setTimeout(() => {
        try { child.kill() } catch {}
        resolve({ success: false, error: 'cli-timeout' })
      }, timeoutMs)
      child.stdout.on('data', (chunk) => {
        buffer += chunk.toString()
      })
      child.stderr.on('data', (chunk) => {
        // keep for debugging; do not reject
      })
      child.on('close', () => {
        clearTimeout(timer)
        // Try parse last JSON line
        const lines = buffer.split(/\r?\n/).filter(Boolean)
        for (let i = lines.length - 1; i >= 0; i--) {
          try { return resolve(JSON.parse(lines[i])) } catch {}
        }
        resolve({ success: false, error: 'no-json-output' })
      })
    } catch (e) {
      resolve({ success: false, error: e.message })
    }
  })
}

ipcMain.handle('backendStatus', async (_event, { target = 'local' } = {}) => {
  try {
    if (target === 'remote') {
      const tunnel = getTunnelState()
      const lp = tunnel && tunnel.localExpressPort
      if (!lp) return { success: false, error: 'no-remote-port' }
      const res = await axios.get(`http://127.0.0.1:${lp}/status`, { timeout: 3000 })
      return res.data
    }
    // local
    if (expressPort) {
      const data = await httpGet('/status')
      if (data) return data
    }
    // Fallback to CLI status
    const out = await runCliCommand(['status'])
    return out
  } catch (e) {
    return { success: false, error: e.message }
  }
})

ipcMain.handle('backendEnsure', async (_event, { target = 'local', go = false, mongo = false, jupyter = false, workspace } = {}) => {
  try {
    if (target === 'remote') {
      const tunnel = getTunnelState()
      const lp = tunnel && tunnel.localExpressPort
      if (!lp) return { success: false, error: 'no-remote-port' }
      const ensured = {}
      if (go) ensured.go = (await axios.post(`http://127.0.0.1:${lp}/ensure-go`, {}, { timeout: 10000 })).data
      if (mongo) ensured.mongo = (await axios.post(`http://127.0.0.1:${lp}/ensure-mongo`, { workspacePath: workspace }, { timeout: 20000 })).data
      if (jupyter) ensured.jupyter = (await axios.post(`http://127.0.0.1:${lp}/ensure-jupyter`, { workspacePath: workspace }, { timeout: 20000 })).data
      return { success: true, ensured }
    }
    // local via CLI
    const args = ['ensure']
    if (go) args.push('--go')
    if (mongo) args.push('--mongo')
    if (jupyter) args.push('--jupyter')
    if (workspace) args.push('--workspace', workspace)
    const out = await runCliCommand(args)
    return out
  } catch (e) {
    return { success: false, error: e.message }
  }
})

// Check if a remote port is open (listening) on the SSH-connected host
ipcMain.handle('remoteCheckPort', async (_event, { port }) => {
  try {
    const tunnel = getTunnelState()
    if (!tunnel || !tunnel.tunnelActive) return { success: false, error: 'no-tunnel' }
    if (!port || isNaN(Number(port))) return { success: false, error: 'invalid-port' }
    const conn = getActiveTunnel && getActiveTunnel()
    if (!conn) return { success: false, error: 'no-active-ssh' }
    const open = await checkRemotePortOpen(conn, Number(port))
    return { success: true, port: Number(port), open: !!open }
  } catch (e) {
    return { success: false, error: e.message }
  }
})

// Stop backend on app quit (best-effort)
app.on('before-quit', async () => {
  try { await runCliCommand(['stop'], 5000) } catch {}
})

// ---- Local backend presence/install stubs ----
function checkLocalBackendPresence() {
  // Development always considered present (runs node script)
  if (!app.isPackaged) {
    return { installed: true, source: 'dev-script', path: path.join(__dirname, "../backend/expressServer.mjs") }
  }
  // Check user settings override
  try {
    const userDataPath = app.getPath("userData")
    const settingsFilePath = path.join(userDataPath, "settings.json")
    if (fs.existsSync(settingsFilePath)) {
      const settings = JSON.parse(fs.readFileSync(settingsFilePath, "utf8"))
      if (settings && settings.localBackendPath && fs.existsSync(settings.localBackendPath)) {
        return { installed: true, source: 'user', path: settings.localBackendPath }
      }
    }
  } catch {}
  // Check packaged locations
  const candidates = [
    path.join(process.resourcesPath, 'backend', process.platform === 'win32' ? 'server_win.exe' : (process.platform === 'darwin' ? 'server_mac' : 'server_linux'))
  ]
  const found = candidates.find(p => {
    try { return fs.existsSync(p) } catch { return false }
  })
  if (found) return { installed: true, source: 'packaged', path: found }
  return { installed: false, source: 'missing' }
}

ipcMain.handle('checkLocalBackend', async () => {
  return checkLocalBackendPresence()
})

ipcMain.handle('setLocalBackendPath', async (_event, exePath) => {
  try {
    if (!exePath) return { success: false, error: 'no-path' }
    if (!fs.existsSync(exePath)) return { success: false, error: 'not-found' }
    const userDataPath = app.getPath('userData')
    const settingsFilePath = path.join(userDataPath, 'settings.json')
    let settings = {}
    if (fs.existsSync(settingsFilePath)) {
      try { settings = JSON.parse(fs.readFileSync(settingsFilePath, 'utf8')) || {} } catch {}
    }
    settings.localBackendPath = exePath
    fs.writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2))
    return { success: true, path: exePath }
  } catch (e) {
    return { success: false, error: e.message }
  }
})

ipcMain.handle('installLocalBackendFromURL', async (_event, { version, manifestUrl } = {}) => {
  // Download and install the backend using a release manifest.
  // Steps: fetch manifest -> pick asset -> download -> verify sha256 -> extract -> set settings.localBackendPath -> cleanup old versions.
  const progress = (payload) => {
    try { _event?.sender?.send('localBackendInstallProgress', payload) } catch {}
  }
  try {
    if (!manifestUrl) return { success: false, error: 'missing-manifest-url' }
    progress({ phase: 'fetch-manifest', manifestUrl })
    const { data: manifest } = await axios.get(manifestUrl, { timeout: 30000 })
    const manifestVersion = version || manifest?.version
    if (!manifestVersion) return { success: false, error: 'no-version-in-manifest' }

    // Pick asset for current platform/arch
    const platform = process.platform // 'win32' | 'linux' | 'darwin'
    const arch = process.arch // 'x64' | 'arm64' | ...
    const osKeys = [platform, platform === 'win32' ? 'windows' : (platform === 'darwin' ? 'darwin' : 'linux')]
    const candidates = (manifest?.assets || []).filter(a => {
      const osMatch = osKeys.includes((a.os||'').toLowerCase())
      if (!osMatch) return false
      if (!a.arch) return true
      return (a.arch||'').toLowerCase() === arch
    })
    if (!candidates.length) return { success: false, error: 'no-asset-for-platform', details: { platform, arch } }
    const asset = candidates[0]
    const url = asset.url
    const expectedSha = (asset.sha256||'').trim().toLowerCase()
    const format = (asset.format||'').toLowerCase() || (url.endsWith('.zip') ? 'zip' : (url.endsWith('.tar.gz') ? 'tar.gz' : ''))
    if (!url) return { success: false, error: 'asset-has-no-url' }

    // Prepare directories
    const userDataPath = app.getPath('userData')
    const baseDir = path.join(userDataPath, 'medomics-server')
    const versionsDir = path.join(baseDir, 'versions')
    const versionDir = path.join(versionsDir, manifestVersion)
    const downloadsDir = path.join(baseDir, 'downloads')
    try { if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir, { recursive: true }) } catch {}
    try { if (!fs.existsSync(versionsDir)) fs.mkdirSync(versionsDir, { recursive: true }) } catch {}
    try { if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir, { recursive: true }) } catch {}

    // If already installed, just point settings and return
    const existingExe = findInstalledExecutable(versionDir)
    if (existingExe) {
      await saveLocalBackendPath(existingExe)
      progress({ phase: 'already-installed', version: manifestVersion, path: existingExe })
      return { success: true, version: manifestVersion, path: existingExe, reused: true }
    }

    // Download asset
    const fileName = path.basename(url).split('?')[0]
    const downloadPath = path.join(downloadsDir, fileName)
    progress({ phase: 'download-start', url, downloadPath })
    await downloadWithProgress(url, downloadPath, (d) => progress({ phase: 'download-progress', ...d }))
    progress({ phase: 'download-complete', downloadPath })

    // Verify SHA256
    if (expectedSha) {
      progress({ phase: 'verify-start' })
      const actualSha = await sha256File(downloadPath)
      const ok = (actualSha||'').toLowerCase() === expectedSha
      if (!ok) return { success: false, error: 'checksum-mismatch', expectedSha, actualSha }
      progress({ phase: 'verify-ok', sha256: actualSha })
    } else {
      progress({ phase: 'verify-skip', reason: 'no-sha256-in-manifest' })
    }

    // Extract
    progress({ phase: 'extract-start', to: versionDir, format })
    await decompress(downloadPath, versionDir)
    progress({ phase: 'extract-complete', to: versionDir })

    // Locate executable inside extracted tree
    const exePath = findInstalledExecutable(versionDir)
    if (!exePath) return { success: false, error: 'executable-not-found-in-extracted', versionDir }
    // Ensure exec perms on posix
    try { if (process.platform !== 'win32') fs.chmodSync(exePath, 0o755) } catch {}

    // Save settings
    await saveLocalBackendPath(exePath)

    // Cleanup old versions (keep latest 3 including this one and currently referenced)
    try { await cleanupOldVersions(versionsDir, exePath, 3) } catch {}

    progress({ phase: 'done', version: manifestVersion, path: exePath })
    return { success: true, version: manifestVersion, path: exePath }
  } catch (e) {
    return { success: false, error: e.message || String(e) }
  }
})

ipcMain.handle('open-dialog-backend-exe', async () => {
  const filters = process.platform === 'win32'
    ? [{ name: 'Executable', extensions: ['exe'] }]
    : [{ name: 'Executable', extensions: ['*'] }]
  const { filePaths, canceled } = await dialog.showOpenDialog({
    title: 'Select the server executable',
    properties: ['openFile'],
    filters
  })
  if (canceled || !filePaths || !filePaths[0]) return { success: false, error: 'canceled' }
  return { success: true, path: filePaths[0] }
})

//**** AUTO-UPDATER ****//

function sendStatusToWindow(text) {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.showMessage(text)
  }
}

autoUpdater.on("checking-for-update", () => {
  console.log("DEBUG: checking for update")
  sendStatusToWindow("Checking for update...")
})

autoUpdater.on("update-available", (info) => {
  log.info("Update available:", info)

  // Show a dialog to ask the user if they want to download the update
  const dialogOpts = {
    type: "info",
    buttons: ["Download", "Later"],
    title: "Application Update",
    message: "A new version is available",
    detail: `MEDomicsLab ${info.version} is available. You have ${app.getVersion()}. Would you like to download it now?`
  }

  dialog.showMessageBox(mainWindow, dialogOpts).then((returnValue) => {
    if (returnValue.response === 0) {
      // If the user clicked "Download"
      sendStatusToWindow("Downloading update...")
      autoUpdater.downloadUpdate()
    }
  })
})

autoUpdater.on("update-not-available", (info) => {
  info = JSON.stringify(info)
  sendStatusToWindow(`Update not available. ${info}`)
  sendStatusToWindow(`Current version: ${app.getVersion()}`)
})

autoUpdater.on("error", (err) => {
  sendStatusToWindow("Error in auto-updater. " + err)
})

autoUpdater.on("download-progress", (progressObj) => {
  let log_message = `Download speed: ${progressObj.bytesPerSecond} - `
  log_message += `Downloaded ${progressObj.percent.toFixed(2)}% `
  log_message += `(${progressObj.transferred}/${progressObj.total})`
  log.info(log_message)
  sendStatusToWindow(log_message)
  mainWindow.webContents.send("update-download-progress", progressObj)
})

autoUpdater.on("update-downloaded", (info) => {
  log.info("Update downloaded:", info)
  let downloadPath, debFilePath
  let dialogOpts = {
    type: "info",
    buttons: ["Restart", "Later"],
    title: "Application Update",
    message: "Update Downloaded",
    detail: `MEDomicsLab ${info.version} has been downloaded. Restart the application to apply the updates.`
  }

  // For Linux, provide additional instructions
  if (process.platform === "linux") {
    downloadPath = path.join(process.env.HOME, ".cache", "medomicslab-application-updater", "pending")
    debFilePath = info.files[0].url.split("/").pop()
    dialogOpts = {
      type: "info",
      buttons: ["Copy Command & Quit", "Copy Command", "Later"],
      title: "Application Update",
      message: "Update Downloaded",
      detail: `MEDomicsLab ${info.version} has been downloaded. On Linux, you may need to run the installer with sudo:\n\nsudo dpkg -i ${path.join(downloadPath, debFilePath)} \n\nClick 'Copy Command & Restart' to copy this command to your clipboard and restart the application, or 'Copy Command' to just copy it.`
    }
  }

  dialog.showMessageBox(mainWindow, dialogOpts).then((returnValue) => {
    if (process.platform === "linux") {
      if (returnValue.response === 0 || returnValue.response === 1) {
        // Construct the command to install the deb file
        const command = `sudo dpkg -i "${path.join(downloadPath, debFilePath)}"`

        // Copy to clipboard
        require("electron").clipboard.writeText(command)

        if (returnValue.response === 0) {
          autoUpdater.quitAndInstall()
        }
      }
    } else if (returnValue.response === 0) {
      autoUpdater.quitAndInstall()
    }
  })
})

if (isProd) {
  serve({ directory: "app" })
} else {
  app.setPath("userData", `${app.getPath("userData")} (development)`)
}


// Main async startup
(async () => {
  await app.whenReady()

  protocol.registerFileProtocol("local", (request, callback) => {
    const url = request.url.replace(/^local:\/\//, "")
    const decodedUrl = decodeURI(url)
    try {
      return callback(decodedUrl)
    } catch (error) {
      console.error("ERROR: registerLocalProtocol: Could not get file path:", error)
    }
  })

  ipcMain.on("get-file-path", (event, configPath) => {
    event.reply("get-file-path-reply", path.resolve(configPath))
  })

  if (!isHeadless) {
    splashScreen = new BrowserWindow({
      icon: path.join(__dirname, "../resources/MEDomicsLabWithShadowNoText100.png"),
      width: 700,
      height: 700,
      transparent: true,
      frame: false,
      alwaysOnTop: true,
      center: true,
      show: true
    })

    mainWindow = createWindow("main", {
      width: 1500,
      height: 1000,
      show: false
    })

    if (isProd) {
      splashScreen.loadFile(path.join(__dirname, "splash.html"))
    } else {
      splashScreen.loadFile(path.join(__dirname, "../main/splash.html"))
    }
    splashScreen.once("ready-to-show", () => {
      splashScreen.show()
      splashScreen.focus()
      splashScreen.setAlwaysOnTop(true)
    })
  } else {
    // Headless/server-only mode
    mainWindow = undefined
    splashScreen = undefined
    console.log("Running in headless/server-only mode: no GUI will be created.")
  }

  // Use mainWindow only if not headless
  const openRecentWorkspacesSubmenuOptions = getRecentWorkspacesOptions(null, !isHeadless ? mainWindow : null, hasBeenSet, serverPort)
  console.log("openRecentWorkspacesSubmenuOptions", JSON.stringify(openRecentWorkspacesSubmenuOptions, null, 2))
  const menuTemplate = [
    {
      label: "File",
      submenu: [{ label: "Open recent", submenu: getRecentWorkspacesOptions(null, mainWindow, hasBeenSet, serverPort) }, { type: "separator" }, { role: "quit" }]
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { type: "separator" },
        {
          role: "preferences",
          label: "Preferences",
          click: () => {
            console.log("👋")
          },
          submenu: [
            {
              label: "Toggle dark mode",
              click: () => app.emit("toggleDarkMode")
            }
          ]
        }
      ]
    },
    {
      label: "Help",
      submenu: [
        {
          label: "Report an issue",
          click() {
            openWindowFromURL("https://forms.office.com/r/8tbTBHL4bv")
          }
        },
        {
          label: "Contact us",
          click() {
            openWindowFromURL("https://forms.office.com/r/Zr8xJbQs64")
          }
        },
        {
          label: "Join Us on Discord !",
          click() {
            openWindowFromURL("https://discord.gg/ZbaGj8E6mP")
          }
        },
        {
          label: "Documentation",
          click() {
            openWindowFromURL("https://medomics-udes.gitbook.io/medomicslab-docs")
          }
        },
        { type: "separator" },
        { role: "reload" },
        { role: "forcereload" },
        { role: "toggledevtools" },
        { type: "separator" },
        { role: "resetzoom" },
        { role: "zoomin" },
        { role: "zoomout" },
        { type: "separator" }
      ]
    }
  ]

  // Start backend server
  startBackendServer()
  console.log("running mode:", isProd ? "production" : "development")
  console.log("process.resourcesPath: ", process.resourcesPath)
  console.log(MEDconfig.runServerAutomatically ? "Server will start automatically here (in background of the application)" : "Server must be started manually")
  let bundledPythonPath = await getBundledPythonEnvironment()
  if (MEDconfig.runServerAutomatically && bundledPythonPath !== null) {
    // Find the bundled python environment
    if (bundledPythonPath !== null) {
        // Request the backend to start its Go server (backend will spawn its own process)
        runServerViaBackend()
          .then((result) => {
            console.log("Backend run-go-server result:", result)
          })
          .catch((err) => console.error("Failed to request backend run-go-server:", err))
    }
  } else {
    //**** NO SERVER ****//
    findAvailablePort(MEDconfig.defaultPort)
      .then((port) => {
        serverPort = port
      })
      .catch((err) => {
        console.error(err)
      })
  }
  const menu = Menu.buildFromTemplate(menuTemplate)
  Menu.setApplicationMenu(menu)

  ipcMain.on("getRecentWorkspaces", (event, data) => {
    // Receives a message from Next.js
    console.log("GetRecentWorkspaces : ", data)
    if (data === "requestRecentWorkspaces") {
      // If the message is "requestRecentWorkspaces", the function getRecentWorkspaces is called
      getRecentWorkspacesOptions(event, mainWindow, hasBeenSet, serverPort)
    }
  })

  ipcMain.handle("updateWorkspace", async (event, data) => {
    // Receives a message from Next.js to update workspace
    console.error("updateWorkspace : ", data)
    console.error("updateWorkspace event : ", event)
    updateWorkspace(data)
  })

  ipcMain.handle("setWorkingDirectory", async (event, data) => {
    const result = await setWorkspaceDirectory(data)
    console.log("setWorkingDirectory result: ", result)
    return result
  })

  const setWorkspaceDirectory = async (data) => {
    app.setPath("sessionData", data)
    console.log(`setWorkspaceDirectory : ${data}`)
    createWorkingDirectory() // Create DATA & EXPERIMENTS directories
    createMedomicsDirectory(data)
    hasBeenSet = true
    try {
      // Stop MongoDB if it's running
      await stopMongoDB()
      if (process.platform === "win32") {
        // Kill the process on the port
        // killProcessOnPort(serverPort)
      } else if (process.platform === "darwin") {
        await new Promise((resolve) => {
          exec("pkill -f mongod", (error, stdout, stderr) => {
            resolve()
          })
        })
      } else {
        try {
          execSync("killall mongod")
        } catch (error) {
          console.warn("Failed to kill mongod: ", error)
        }
      }
      // Start MongoDB with the new configuration
      startMongoDB(data)
      return {
        workingDirectory: dirTree(app.getPath("sessionData")),
        hasBeenSet: hasBeenSet,
        newPort: serverPort
      }
    } catch (error) {
      console.error("Failed to change workspace: ", error)
    }
  }


  /**
   * @description Returns the path of the specified directory of the app
   * @param {String} path The path to get
   * @returns {Promise<String>} The path of the specified directory of the app
   */
  ipcMain.handle("appGetPath", async (_event, path) => {
    return app.getPath(path)
  })

  /**
   * @description Returns the version of the app
   * @returns {Promise<String>} The version of the app
   */
  ipcMain.handle("getAppVersion", async () => {
    return app.getVersion()
  })

  /**
   * @description Copies the source file to the destination file set by the user in the dialog
   * @param {String} source The source file to copy
   * @param {String} defaultPath The default path to set in the dialog - If null, the default path will be the user's home directory
   * @returns {Promise<String>} The destination file
   */
  ipcMain.handle("appCopyFile", async (_event, source) => {
    // Get the filename from the source path
    let filename = path.basename(source)
    let extension = path.extname(source).slice(1)
    console.log("extension", extension)
    const { filePath } = await dialog.showSaveDialog({
      title: "Save file",
      defaultPath: filename.length > 0 ? filename : source,
      filters: [{ name: extension, extensions: [extension] }]
    })
    if (filePath) {
      fs.copyFileSync(source, filePath)
      return filePath
    }
  })

  /**
   * @description select path to folder
   * @returns {String} path to the selected folder
   */
  ipcMain.handle("select-folder-path", async (event) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openDirectory"]
    })
    return result
  })

  /**
   * @description Returns the settings
   * @returns {Object} The settings
   * @summary Returns the settings from the settings file if it exists, otherwise returns an empty object
   */
  ipcMain.handle("get-settings", async () => {
    const userDataPath = app.getPath("userData")
    console.log("userDataPath: ", userDataPath)
    const settingsFilePath = path.join(userDataPath, "settings.json")
    if (fs.existsSync(settingsFilePath)) {
      const settings = JSON.parse(fs.readFileSync(settingsFilePath, "utf8"))
      return settings
    } else {
      return {}
    }
  })

  /**
   * @description Saves the settings
   * @param {*} event The event
   * @param {*} settings The settings to save
   */
  ipcMain.on("save-settings", async (_event, settings) => {
    const userDataPath = app.getPath("userData")
    const settingsFilePath = path.join(userDataPath, "settings.json")
    console.log("settings to save : ", settingsFilePath, settings)
    fs.writeFileSync(settingsFilePath, JSON.stringify(settings))
  })

  /**
   * @description Returns the server status
   * @returns {Boolean} True if the server is running, false otherwise
   */
  ipcMain.handle("server-is-running", async () => {
    return serverState.serverIsRunning
  })

  /**
   * @description Kills the server
   * @returns {Boolean} True if the server was killed successfully, false otherwise
   * @summary Kills the server if it is running
   */
  ipcMain.handle("kill-server", async () => {
    if (serverProcess) {
      let success = await serverProcess.kill()
      serverState.serverIsRunning = false
      return success
    } else {
      return null
    }
  })

  /**
   * @description Starts the server
   * @param {*} event The event
   * @param {*} pythonPath The path to the python executable (optional) - If null, the default python executable will be used (see environment variables MED_ENV)
   * @returns {Boolean} True if the server is running, false otherwise
   */
  ipcMain.handle("start-server", async (_event, pythonPath = null) => {
    if (serverProcess) {
      // kill the server if it is already running
      serverProcess.kill()
    }
    console.log("Received Python path: ", pythonPath)
    if (MEDconfig.runServerAutomatically) {
      await runServerViaBackend()
      return true
    }
    return serverState.serverIsRunning
  })

  /**
   * @description Opens the dialog to select the python executable path and returns the path to Next.js
   * @param {*} event
   * @param {*} data
   * @returns {String} The path to the python executable
   */
  ipcMain.handle("open-dialog-exe", async (event, data) => {
    if (process.platform !== "win32") {
      const { filePaths } = await dialog.showOpenDialog({
        title: "Select the path to the python executable",
        properties: ["openFile"],
        filters: [{ name: "Python Executable", extensions: ["*"] }]
      })
      return filePaths[0]
    } else {
      const { filePaths } = await dialog.showOpenDialog({
        title: "Select the path to the python executable",
        properties: ["openFile"],
        filters: [{ name: "Executable", extensions: ["exe"] }]
      })
      return filePaths[0]
    }
  })

  ipcMain.on("messageFromNext", (event, data, args) => {
    // Receives a message from Next.js
    console.log("messageFromNext : ", data)
    if (data === "requestDialogFolder") {
      // If the message is "requestDialogFolder", the function setWorkingDirectory is called
      setWorkingDirectory(event, mainWindow)
    } else if (data === "getRecentWorkspaces") {
      let recentWorkspaces = loadWorkspaces()
      event.reply("recentWorkspaces", recentWorkspaces)
    } else if (data === "updateWorkingDirectory") {
      const activeTunnel = getActiveTunnel()
      const tunnel = getTunnelState()
      if (activeTunnel && tunnel) {
        // If an SSH tunnel is active, we set the remote workspace path
        const remoteWorkspacePath = getRemoteWorkspacePath()
        axios.get(`http://${tunnel.host}:3000/get-working-dir-tree`, { params: { requestedPath: remoteWorkspacePath } })
          .then((response) => {
            if (response.data.success && response.data.workingDirectory) {
              event.reply("updateDirectory", {
                workingDirectory: response.data.workingDirectory,
                hasBeenSet: true,
                newPort: tunnel.localExpressPort,
                isRemote: true
              }) // Sends the folder structure to Next.js
            } else {
              console.error("Failed to get remote working directory tree: ", response.data.error)
            }
          })
          .catch((error) => {
            console.error("Error getting remote working directory tree: ", error)
          })
      } else {
        event.reply("updateDirectory", {
          workingDirectory: dirTree(app.getPath("sessionData")),
          hasBeenSet: hasBeenSet,
          newPort: serverPort
        }) // Sends the folder structure to Next.js
      }
    } else if (data === "getServerPort") {
      event.reply("getServerPort", {
        newPort: serverPort
      }) // Sends the folder structure to Next.js
    } else if (data === "requestAppExit") {
      app.exit()
    }
  })

  app.on("toggleDarkMode", () => {
    console.log("toggleDarkMode")
    mainWindow.webContents.send("toggleDarkMode")
  })

  if (!isHeadless) {
    if (isProd) {
      await mainWindow.loadURL("app://./index.html")
    } else {
      const port = process.argv[2]
      await mainWindow.loadURL(`http://localhost:${port}/`)
      mainWindow.webContents.openDevTools()
    }
    splashScreen.destroy()
    mainWindow.maximize()
    mainWindow.show()
  }
})()

ipcMain.handle("request", async (_, axios_request) => {
  const result = await axios(axios_request)
  return { data: result.data, status: result.status }
})

// General backend request handler used by the renderer via preload
ipcMain.handle('express-request', async (_event, req) => {
  if (!req || typeof req.path !== 'string' || !req.path.startsWith('/')) {
    throw { code: 'BAD_REQUEST', message: 'Invalid request shape' }
  }

  const host = req.host || '127.0.0.1'
  const port = req.port || expressPort || serverPort || MEDconfig.defaultPort
  const url = `http://${host}:${port}${req.path}`

  try {
    const axiosResp = await axios({
      method: req.method || 'get',
      url,
      params: req.params || undefined,
      data: req.body || undefined,
      headers: req.headers || undefined,
      timeout: req.timeout || 20000
    })
    return { status: axiosResp.status, data: axiosResp.data, headers: axiosResp.headers }
  } catch (err) {
    const message = err.response ? (err.response.data || err.response.statusText) : err.message
    throw { code: 'BACKEND_ERROR', message, details: err.response ? { status: err.response.status } : undefined }
  }
})

// Python environment handling
ipcMain.handle("getInstalledPythonPackages", async (event, pythonPath) => {
  const activeTunnel = getActiveTunnel()
  const tunnel = getTunnelState()
  if (activeTunnel && tunnel) {
    let pythonPackages = null
    await axios.get(`http://${tunnel.host}:${expressPort}/get-installed-python-packages`, { params: { pythonPath: pythonPath } })
          .then((response) => {
            if (response.data.success && response.data.packages) {
              pythonPackages = response.data.packages
            } else {
              console.error("Failed to get remote Python packages: ", response.data.error)
            }
          })
          .catch((error) => {
            console.error("Error getting remote Python packages: ", error)
          })
    return pythonPackages
  }
  return getInstalledPythonPackages(pythonPath)
})

ipcMain.handle("installMongoDB", async (event) => {
  // Check if MongoDB is installed
  let mongoDBInstalled = getMongoDBPath()
  if (mongoDBInstalled === null) {
    // If MongoDB is not installed, install it
    return installMongoDB()
  } else {
    return true
  }
})

ipcMain.handle("getBundledPythonEnvironment", async (event) => {
  const activeTunnel = getActiveTunnel()
  const tunnel = getTunnelState()
  if (activeTunnel && tunnel) {
    let pythonEnv = null
    await axios.get(`http://${tunnel.host}:3000/get-bundled-python-environment`)
          .then((response) => {
            if (response.data.success && response.data.pythonEnv) {
              pythonEnv = response.data.pythonEnv
            } else {
              console.error("Failed to get remote bundled Python environment: ", response.data.error)
            }
          })
          .catch((error) => {
            console.error("Error getting remote bundled Python environment: ", error)
          })
    return pythonEnv
  } else {
    return await getBundledPythonEnvironment()
  }
})

ipcMain.handle("installBundledPythonExecutable", async (event) => {
  // Notification callback for Electron
  const notify = (payload) => {
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send("notification", payload)
    }
  }
  // Check if Python is installed
  let pythonInstalled = await getBundledPythonEnvironment()
  if (pythonInstalled === null) {
    // If Python is not installed, ask backend to install via its endpoint
    return await httpPost("/install-bundled-python", { })
  } else {
    // Check if required packages are installed via backend
    const reqInstalled = await httpGet("/check-python-requirements", { pythonPath: pythonInstalled })
    if (reqInstalled) {
      return true
    } else {
      await httpPost("/install-required-python-packages", { pythonPath: pythonInstalled })
      return true
    }
  }
})

ipcMain.handle("checkRequirements", async (event) => {
  return await checkRequirements()
})

ipcMain.handle("checkPythonRequirements", async (event) => {
  return await httpGet("/check-python-requirements")
})

ipcMain.handle("checkMongoDBisInstalled", async (event) => {
  return await getMongoDBPath()
})

ipcMain.handle("startJupyterServer", async (event, workspacePath, port) => {
  return await startJupyterServer(workspacePath, port)
})

ipcMain.handle("stopJupyterServer", async () => {
  return await stopJupyterServer()
})

ipcMain.handle("checkJupyterIsRunning", async () => {
  return checkJupyterIsRunning()
})


ipcMain.on("restartApp", (event, data, args) => {
  app.relaunch()
  app.quit()
})

ipcMain.handle("checkMongoIsRunning", async (event) => {
  const activeTunnel = getActiveTunnel()
  const tunnel = getTunnelState()
  let isRunning = false
  if (activeTunnel && tunnel) {
    isRunning = await checkRemotePortOpen(activeTunnel, tunnel.remoteDBPort)
  } else {
    // Check if something is running on the port MEDconfig.mongoPort
    let port = MEDconfig.mongoPort
    if (process.platform === "win32") {
      isRunning = exec(`netstat -ano | findstr :${port}`).toString().trim() !== ""
    } else if (process.platform === "darwin") {
      isRunning = exec(`lsof -i :${port}`).toString().trim() !== ""
    } else {
      isRunning = exec(`netstat -tuln | grep ${port}`).toString().trim() !== ""
    }  
  }
  return isRunning
})

app.on("window-all-closed", () => {
  console.log("app quit")
  // Clean up terminals
  terminalManager.cleanup()
  stopMongoDB()
  if (MEDconfig.runServerAutomatically) {
    try {
      // Check if the serverProcess has the kill method
      serverProcess.kill()
      console.log("serverProcess killed")
    } catch (error) {
      console.log("serverProcess already killed")
    }
  }
  app.quit()
})

app.on("ready", async () => {
  if (MEDconfig.useReactDevTools) {
    await installExtension(REACT_DEVELOPER_TOOLS, {
      loadExtensionOptions: {
        allowFileAccess: true
      }
    })
  }
  autoUpdater.checkForUpdatesAndNotify()
})

// Handle theme toggle
ipcMain.handle("toggle-theme", (event, theme) => {
  if (theme === "dark") {
    nativeTheme.themeSource = "dark"
  } else if (theme === "light") {
    nativeTheme.themeSource = "light"
  } else {
    nativeTheme.themeSource = "system"
  }
  return nativeTheme.shouldUseDarkColors
})

ipcMain.handle("get-theme", () => {
  return nativeTheme.themeSource // Return the themeSource instead of shouldUseDarkColors
})

// Forward nativeTheme updated event to renderer
nativeTheme.on("updated", () => {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send("theme-updated")
  }
})

// Terminal IPC Handlers
ipcMain.handle("terminal-create", async (event, options) => {
  try {
    // Ensure cwd is a string, not an object
    let cwd = options.cwd
    if (typeof cwd === "object" && cwd !== null) {
      // If cwd is an object, try to extract a path property or use a default
      cwd = cwd.path || cwd.workingDirectory || os.homedir()
    } else if (!cwd || typeof cwd !== "string") {
      // If cwd is null, undefined, or not a string, use home directory
      cwd = os.homedir()
    }

    const terminalInfo = terminalManager.createTerminal(options.terminalId, {
      cwd: cwd,
      cols: options.cols,
      rows: options.rows,
      useIPython: options.useIPython || false
    })

    // Set up event handlers for this terminal
    terminalManager.setupTerminalEventHandlers(options.terminalId, mainWindow)

    return terminalInfo
  } catch (error) {
    console.error("Failed to create terminal:", error)
    throw error
  }
})

// Clone an existing terminal - used for split terminal functionality
ipcMain.handle("terminal-clone", async (event, sourceTerminalId, newTerminalId, options) => {
  try {
    const terminalInfo = terminalManager.cloneTerminal(sourceTerminalId, newTerminalId, {
      cols: options.cols,
      rows: options.rows
    })

    // Set up event handlers for the cloned terminal
    terminalManager.setupTerminalEventHandlers(newTerminalId, mainWindow)

    return terminalInfo
  } catch (error) {
    console.error("Failed to clone terminal:", error)
    throw error
  }
})

ipcMain.on("terminal-input", (event, terminalId, data) => {
  terminalManager.writeToTerminal(terminalId, data)
})

ipcMain.on("terminal-resize", (event, terminalId, cols, rows) => {
  terminalManager.resizeTerminal(terminalId, cols, rows)
})

ipcMain.handle("terminal-kill", async (event, terminalId) => {
  terminalManager.killTerminal(terminalId)
})

ipcMain.handle("terminal-list", async () => {
  return terminalManager.getAllTerminals()
})

// Get current working directory of a terminal
ipcMain.handle("terminal-get-cwd", async (event, terminalId) => {
  return terminalManager.getCurrentWorkingDirectory(terminalId)
})

/**
 * @description Open a new window from an URL
 * @param {*} url The URL of the page to open
 * @returns {BrowserWindow} The new window
 */
function openWindowFromURL(url) {
  const isHeadless = process.argv.some(arg => arg.includes('--no-gui'))
  if (!isHeadless) {
    let window = new BrowserWindow({
      icon: path.join(__dirname, "../resources/MEDomicsLabWithShadowNoText100.png"),
      width: 700,
      height: 700,
      transparent: true,
      center: true
    })

    window.loadURL(url)
    window.once("ready-to-show", () => {
      window.show()
      window.focus()
    })
  }
}


