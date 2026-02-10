import { Client } from "ssh2"
import { app, ipcMain } from "electron"
import { mainWindow } from "../background.js"
import { generateSSHKeyPair } from '../sshKeygen'
const net = require("net")
var path = require("path")
const fs = require("fs")
const axios = require("axios")

// Global tunnel state for remote connection management
let activeTunnel = null
let activeTunnelServer = null

let mongoDBLocalPort = null
let mongoDBRemotePort = null

let jupyterLocalPort = null
let jupyterRemotePort = null

let remoteWorkspacePath = null
let remoteBackendExecutablePath = null

export function setActiveTunnel(tunnel) {
  activeTunnel = tunnel
}
export function setActiveTunnelServer(server) {
  activeTunnelServer = server
}
export function getActiveTunnel() {
  return activeTunnel
}
export function getActiveTunnelServer() {
  return activeTunnelServer
}
export function setRemoteWorkspacePath(path) {
  remoteWorkspacePath = path
}
export function getRemoteWorkspacePath() {
  return remoteWorkspacePath
}

export function setRemoteBackendExecutablePath(p) {
  // Always store a plain string path
  if (p && typeof p === 'object' && p.path) {
    remoteBackendExecutablePath = p.path
  } else {
    remoteBackendExecutablePath = p
  }
}
export function getRemoteBackendExecutablePath() {
  return remoteBackendExecutablePath
}

// Tunnel information and state management
let tunnelInfo = {
  host: null,
  tunnelActive: false,
  localAddress: "localhost",
  // Express (backend) forwarding
  localExpressPort: null, // local port forwarded to remote Express
  remoteExpressPort: null, // remote Express port
  // Optional GO direct forwarding
  localGoPort: null,
  remoteGoPort: null,
  localDBPort: null,
  remoteDBPort: null,
  localJupyterPort: null,
  remoteJupyterPort: null,
  remotePort: null,
  username: null,
  // Additional statuses/flags
  serverStartedRemotely: false,
  expressStatus: 'unknown',
  expressLogPath: null,
  // Generic list of active tunnels
  tunnels: [] // [{ name: string, localPort: number, remotePort: number, status: 'forwarding'|'closed' }]
}

export function setTunnelState(info) {
  // Exclude password
  const { password, privateKey, ...safeInfo } = info
  const hasFlag = Object.prototype.hasOwnProperty.call(safeInfo, 'tunnelActive')
  const nextTunnelActive = hasFlag
    ? !!safeInfo.tunnelActive
    : (typeof tunnelInfo.tunnelActive === 'boolean' ? tunnelInfo.tunnelActive : false)
  tunnelInfo = { ...tunnelInfo, ...safeInfo, tunnelActive: nextTunnelActive }
}

export function clearTunnelState() {
  tunnelInfo = {
    host: null,
    tunnelActive: false,
    localAddress: "localhost",
    localExpressPort: null,
    remoteExpressPort: null,
    localGoPort: null,
    remoteGoPort: null,
    localDBPort: null,
    remoteDBPort: null,
    localJupyterPort: null,
    remoteJupyterPort: null,
    remotePort: null,
    username: null,
    serverStartedRemotely: false,
    expressStatus: 'unknown',
  }
}

export function getTunnelState() {
  return tunnelInfo
}

ipcMain.handle('getTunnelState', () => {
  return getTunnelState()
})

ipcMain.handle('setTunnelState', (_event, info) => {
  setTunnelState(info)
  mainWindow.webContents.send('tunnelStateUpdate', info)
})

ipcMain.handle('clearTunnelState', () => {
  clearTunnelState()
  mainWindow.webContents.send('tunnelStateClear')
})

// Helpers for managing remote backend (Express) server lifecycle
async function execRemote(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err)
      let stdout = ''
      let stderr = ''
      stream.on('data', (d) => { stdout += d.toString() })
      stream.stderr.on('data', (d) => { stderr += d.toString() })
      stream.on('close', (code) => {
        resolve({ code, stdout: stdout.trim(), stderr: stderr.trim() })
      })
    })
  })
}

async function getRemoteHome(conn, remoteOS) {
  if (remoteOS === 'win32') {
    const r = await execRemote(conn, 'powershell -NoProfile -Command "$env:USERPROFILE"')
    return r.stdout || 'C:\\Users\\Public'
  } else {
    const r = await execRemote(conn, 'printf "%s" "$HOME"')
    return r.stdout || '/home'
  }
}

async function findRemoteBackendExecutable(conn, remoteOS) {
  try {
    // If a path is already stored, verify it exists and is executable
    if (remoteBackendExecutablePath) {
      if (remoteOS === 'win32') {
        const r = await execRemote(conn, `powershell -NoProfile -Command "If (Test-Path '${remoteBackendExecutablePath.replace(/'/g, "''")}') { Write-Output '${remoteBackendExecutablePath.replace(/'/g, "''")}' }"`)
        if ((r.stdout||'').trim()) return { path: remoteBackendExecutablePath }
      } else {
        const r = await execRemote(conn, `[ -x '${remoteBackendExecutablePath.replace(/'/g, "'\\''")}'] && echo '${remoteBackendExecutablePath.replace(/'/g, "'\\''")}' || true`)
        if ((r.stdout||'').trim()) return { path: remoteBackendExecutablePath }
      }
    }

    // Look for medomics-server under the versions directory of ~/.medomics/medomics-server
    const home = await getRemoteHome(conn, remoteOS)
    const baseDir = remoteOS === 'win32' ? `${home}\\.medomics\\medomics-server` : `${home}/.medomics/medomics-server`
    const versionsDir = remoteOS === 'win32' ? `${baseDir}\\versions` : `${baseDir}/versions`

    if (remoteOS === 'win32') {
      // Prefer newest medomics-server.exe found under versions/**/bin
      const ps = `powershell -NoProfile -Command "if (Test-Path '${versionsDir.replace(/'/g, "''")}') { Get-ChildItem -Path '${versionsDir.replace(/'/g, "''")}' -Recurse -Filter medomics-server.exe | Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName }"`
      const r = await execRemote(conn, ps)
      const found = (r.stdout||'').trim()
      if (found) return { path: found }
      // Fallback: check typical bin path for latest version directory
      const ls = await execRemote(conn, `powershell -NoProfile -Command "If (Test-Path '${versionsDir.replace(/'/g, "''")}') { Get-ChildItem -Path '${versionsDir.replace(/'/g, "''")}' -Directory | Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName }"`)
      const latestDir = (ls.stdout||'').trim()
      if (latestDir) {
        const candidate = `${latestDir}\\bin\\medomics-server.exe`
        const chk = await execRemote(conn, `powershell -NoProfile -Command "If (Test-Path '${candidate.replace(/'/g, "''")}') { Write-Output '${candidate.replace(/'/g, "''")}' }"`)
        if ((chk.stdout||'').trim()) return { path: candidate }
      }
    } else {
      // POSIX: prefer current/bin/medomics-server, else search under versions
      const currentBin = `${baseDir}/current/bin/medomics-server`
      const curChk = await execRemote(conn, `bash -lc "[ -x '${currentBin.replace(/'/g, "'\\''")}' ] && echo '${currentBin.replace(/'/g, "'\\''")}' || true"`)
      const curFound = (curChk.stdout||'').trim()
      if (curFound) return { path: currentBin }
      const findCmd = `bash -lc "if [ -d '${versionsDir.replace(/'/g, "'\\''")}' ]; then find '${versionsDir.replace(/'/g, "'\\''")}' -type f -name 'medomics-server' -perm +111 -print -quit; fi || true"`
      const r = await execRemote(conn, findCmd)
      const found = (r.stdout||'').trim()
      if (found) return { path: found }
      // Fallback: check bin under latest version dir
      const ls = await execRemote(conn, `bash -lc "ls -1dt '${versionsDir.replace(/'/g, "'\\''")}'/* 2>/dev/null | head -n1"`)
      const latestDir = (ls.stdout||'').trim()
      if (latestDir) {
        const candidate = `${latestDir}/bin/medomics-server`
        const chk = await execRemote(conn, `bash -lc "[ -x '${candidate.replace(/'/g, "'\\''")}' ] && echo '${candidate.replace(/'/g, "'\\''")}' || true"`)
        if ((chk.stdout||'').trim()) return { path: candidate }
      }
    }
    return null
  } catch (e) {
    return null
  }
}

async function startRemoteBackend(conn, remoteOS, exePath, remotePort) {
  try {
    if (!exePath) {
      return { success: false, status: 'not-found', error: 'No remote Express path provided' }
    }
    const isScript = exePath.endsWith('.js') || exePath.endsWith('.mjs')
    // Derive versionDir and log path similarly to startRemoteExpress
    let versionDir = getVersionDirFromExePath(exePath, remoteOS)
    let baseDir = null
    if (versionDir) {
      const normalizedVersionDir = versionDir.replace(/\\/g, '/')
      baseDir = normalizedVersionDir.includes('/versions/') ? normalizedVersionDir.split('/versions/')[0] : normalizedVersionDir
    }
    let logsDir = null
    let logPath = null
    if (baseDir) {
      logsDir = remoteOS === 'win32' ? `${baseDir.replace(/\//g,'\\')}\\logs` : `${baseDir}/logs`
      logPath = remoteOS === 'win32' ? `${logsDir}\\express.log` : `${logsDir}/express.log`
      // Ensure logs dir exists and truncate previous log
      if (remoteOS === 'win32') {
        await execRemote(conn, `powershell -NoProfile -Command "New-Item -ItemType Directory -Force -Path '${logsDir.replace(/'/g, "''")}' | Out-Null; Clear-Content -Path '${logPath.replace(/'/g, "''")}' -ErrorAction SilentlyContinue; New-Item -ItemType File -Force -Path '${logPath.replace(/'/g, "''")}' | Out-Null"`)
      } else {
        await execRemote(conn, `bash -lc "mkdir -p '${logsDir.replace(/'/g, "'\\''")}' && : > '${logPath.replace(/'/g, "'\\''")}'"`)
      }
    }
    if (logPath) {
      try {
        setTunnelState({ ...getTunnelState(), expressLogPath: logPath })
        try { mainWindow.webContents.send('tunnelStateUpdate', { expressLogPath: logPath }) } catch {}
      } catch {}
    }

    // If we're launching a packaged server binary, prefer using the shipped
    // start script (start.bat/start.sh) so it can set NODE_ENV=production and
    // any other required environment/config.
    if (!isScript) {
      try { setRemoteBackendExecutablePath(exePath) } catch {}
      try {
        const viaScript = await startRemoteExpress(conn, remoteOS, remotePort)
        if (viaScript && viaScript.success) {
          return { success: true, status: 'express-running', port: remotePort }
        }
        // If the script exists but failed, bubble that up.
        if (viaScript && viaScript.status && viaScript.status !== 'script-not-found') {
          return viaScript
        }
      } catch (e) {
        // Fall back to direct executable start below.
        console.warn('[remote] startRemoteBackend startRemoteExpress failed; falling back:', e && e.message ? e.message : e)
      }
    }
    let cmd
    console.log('[remote] startRemoteBackend called', { remoteOS, exePath, remotePort, isScript })
    if (remoteOS === 'win32') {
      if (isScript) {
        cmd = `powershell -NoProfile -Command "$env:NODE_ENV='production'; $env:MEDOMICS_EXPRESS_PORT=${remotePort}; Start-Process -FilePath 'node' -ArgumentList '${exePath.replace(/'/g, "''")}' -WindowStyle Hidden -PassThru | Out-Null"`
      } else {
        // If launching medomics-server.exe, pass explicit CLI args: start --json
        const workDir = (versionDir || path.dirname(exePath)).replace(/\\/g, '\\')
        const exeBase = path.basename(exePath).replace(/\\/g, '\\')
        if (logsDir && logPath) {
          cmd = `cmd.exe /c "cd /d \"${workDir}\" && set NODE_ENV=production && set MEDOMICS_EXPRESS_PORT=${remotePort} && \"${exeBase}\" start --json >> \"${logPath.replace(/\\/g,'\\')}\" 2>&1"`
        } else {
          // Fallback without log redirection
          cmd = `cmd.exe /c "cd /d \"${workDir}\" && set NODE_ENV=production && set MEDOMICS_EXPRESS_PORT=${remotePort} && \"${exeBase}\" start --json"`
        }
      }
    } else {
      if (isScript) {
        cmd = `bash -lc 'export NODE_ENV=production; export MEDOMICS_EXPRESS_PORT=${remotePort}; nohup node "${exePath.replace(/"/g, '\\"')}" >/dev/null 2>&1 < /dev/null & echo $!'`
      } else {
        const exeEsc = exePath.replace(/"/g, '\\"')
        if (logPath) {
          cmd = `bash -lc 'export NODE_ENV=production; export MEDOMICS_EXPRESS_PORT=${remotePort}; nohup "${exeEsc}" start --json >> "${logPath.replace(/"/g, '\\"')}" 2>&1 < /dev/null & echo $!'`
        } else {
          cmd = `bash -lc 'export NODE_ENV=production; export MEDOMICS_EXPRESS_PORT=${remotePort}; nohup "${exeEsc}" start --json >/dev/null 2>&1 < /dev/null & echo $!'`
        }
      }
    }
    console.log('[remote] startRemoteBackend exec cmd', cmd)
    let r = null
    if (remoteOS === 'win32' && !isScript) {
      // Fire-and-forget for the long-running medomics-server.exe so we can poll the port
      try {
        conn.exec(cmd, (err, stream) => {
          if (err) {
            console.log('[remote] startRemoteBackend exec error', err.message || String(err))
            return
          }
          stream.on('data', (d) => {
            try { console.log('[remote] startRemoteBackend stdout chunk', d.toString().slice(0, 200)) } catch {}
          })
          stream.stderr.on('data', (d) => {
            try { console.log('[remote] startRemoteBackend stderr chunk', d.toString().slice(0, 200)) } catch {}
          })
          stream.on('close', (code) => {
            console.log('[remote] startRemoteBackend cmd closed with code', code)
          })
        })
      } catch (e) {
        console.log('[remote] startRemoteBackend exec exception', e && e.message ? e.message : String(e))
      }
    } else {
      r = await execRemote(conn, cmd)
      console.log('[remote] startRemoteBackend exec result', r)
      if (r && r.stderr && r.stderr.trim() && !r.stdout) {
        return { success: false, status: 'failed-to-start', error: r.stderr.trim() }
      }
    }
    // Poll for port to open
    await sleep(800)
    const maxAttempts = 30
    for (let i = 0; i < maxAttempts; i++) {
      const open = await checkRemotePortOpen(conn, remotePort)
      if (open) return { success: true, status: 'express-running' }
      await sleep(600)
    }
    console.log('[remote] startRemoteBackend timeout waiting for port', remotePort)
    return { success: false, status: 'timeout', error: `Express did not open port ${remotePort} in time` }
  } catch (e) {
    return { success: false, status: 'failed-to-start', error: e && e.message ? e.message : String(e) }
  }
}

function sleep(ms){ return new Promise(r=>setTimeout(r, ms)) }

// Derive extracted version directory from stored backend executable path
function getVersionDirFromExePath(p, remoteOS) {
  if (!p) return null
  const normalized = p.replace(/\\/g, '/')
  const parts = normalized.split('/')
  // Typical: .../versions/<ver>/bin/medomics-server[.exe]
  const binIdx = parts.lastIndexOf('bin')
  if (binIdx > 0) {
    const versionParts = parts.slice(0, binIdx)
    return versionParts.join('/')
  }
  // If points directly to medomics-server, use parent directory
  if (normalized.toLowerCase().includes('medomics-server')) {
    const idx = normalized.lastIndexOf('/')
    if (idx > 0) return normalized.slice(0, idx)
  }
  // Unknown layout (e.g., legacy GO path) → let caller fall back to baseDir/current
  return null
}

// Start Express using extracted start scripts under version directory
async function startRemoteExpress(conn, remoteOS, remotePort) {
  try {
    const exePath = getRemoteBackendExecutablePath()
    console.log('[remote] startRemoteExpress called', { remoteOS, remotePort, exePath })
    let versionDir = getVersionDirFromExePath(exePath, remoteOS)
    // Fallback: use ~/.medomics/medomics-server/{current|latest version}
    if (!versionDir) {
      const home = await getRemoteHome(conn, remoteOS)
      const baseDir = remoteOS === 'win32' ? `${home}\\.medomics\\medomics-server` : `${home}/.medomics/medomics-server`
      const versionsDir = remoteOS === 'win32' ? `${baseDir}\\versions` : `${baseDir}/versions`
      // Prefer 'current' symlink on POSIX or latest version directory
      if (remoteOS !== 'win32') {
        const curCheck = await execRemote(conn, `bash -lc "[ -d '${baseDir.replace(/'/g, "'\\''")}/current' ] && readlink -f '${baseDir.replace(/'/g, "'\\''")}/current' || echo"`)
        const curDir = (curCheck.stdout||'').trim()
        if (curDir) versionDir = curDir
      }
      if (!versionDir) {
        if (remoteOS === 'win32') {
          const ls = await execRemote(conn, `powershell -NoProfile -Command "Get-ChildItem -Path '${versionsDir.replace(/'/g, "''")}' -Directory | Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName"`)
          versionDir = (ls.stdout||'').trim()
        } else {
          const ls = await execRemote(conn, `bash -lc "ls -1dt '${versionsDir.replace(/'/g, "'\\''")}'/* 2>/dev/null | head -n1"`)
          versionDir = (ls.stdout||'').trim()
        }
      }
      if (!versionDir) {
        return { success: false, status: 'script-not-found', error: 'Cannot resolve server version directory (no current or versions found)' }
      }
    }
    // Determine baseDir from versionDir and construct logs dir + log file path
    const normalizedVersionDir = versionDir.replace(/\\/g, '/');
    const baseDir = normalizedVersionDir.includes('/versions/') ? normalizedVersionDir.split('/versions/')[0] : normalizedVersionDir;
    const logsDir = remoteOS === 'win32' ? `${baseDir.replace(/\//g,'\\')}\\logs` : `${baseDir}/logs`;
    const logPath = remoteOS === 'win32' ? `${logsDir}\\express.log` : `${logsDir}/express.log`;
    console.log('[remote] startRemoteExpress resolved paths', { versionDir, baseDir, logsDir, logPath })
    // Ensure logs dir exists and truncate previous log
    if (remoteOS === 'win32') {
      await execRemote(conn, `powershell -NoProfile -Command "New-Item -ItemType Directory -Force -Path '${logsDir.replace(/'/g, "''")}' | Out-Null; Clear-Content -Path '${logPath.replace(/'/g, "''")}' -ErrorAction SilentlyContinue; New-Item -ItemType File -Force -Path '${logPath.replace(/'/g, "''")}' | Out-Null"`)
    } else {
      await execRemote(conn, `bash -lc "mkdir -p '${logsDir.replace(/'/g, "'\\''")}' && : > '${logPath.replace(/'/g, "'\\''")}'"`)
    }
    let candidates
    if (remoteOS === 'win32') {
      candidates = [
        `${versionDir}\\start.bat`,
        `${versionDir}\\scripts\\start.bat`,
        `${versionDir}\\bin\\start.bat`,
      ]
    } else {
      candidates = [
        `${versionDir}/start.sh`,
        `${versionDir}/scripts/start.sh`,
        `${versionDir}/bin/start.sh`,
      ]
    }
    console.log("Candidates: ", candidates)
    let scriptPath = null
    for (const candidate of candidates) {
      const checkCmd = remoteOS === 'win32'
        // Use a well-formed PowerShell Test-Path invocation and keep backslashes
        ? `powershell -NoProfile -Command "Test-Path '${candidate.replace(/'/g, "''")}'"`
        : `bash -lc "[ -f '${candidate}' ] && echo yes || echo no"`
      const r = await execRemote(conn, checkCmd)
      const exists = remoteOS === 'win32' ? /True/i.test(r.stdout || '') : /yes/i.test(r.stdout || '')
      if (exists) { scriptPath = candidate; break }
    }
    if (!scriptPath) {
      return { success: false, status: 'script-not-found', error: 'start script not found in server directory' }
    }
    console.log('[remote] startRemoteExpress using scriptPath', scriptPath)
    let cmd
    if (remoteOS === 'win32') {
      // Use cmd.exe directly: cd into the versionDir, set MEDOMICS_EXPRESS_PORT,
      // and run the batch file, redirecting its output to express.log so we can see errors.
      const workDir = versionDir.replace(/\\/g, '\\')
      const batName = path.basename(scriptPath)
      const winLogPath = logPath.replace(/\\/g, '\\')
      cmd = `cmd.exe /c "cd /d \"${workDir}\" && set NODE_ENV=production && set MEDOMICS_EXPRESS_PORT=${remotePort} && echo [launcher] NODE_ENV=%NODE_ENV% MEDOMICS_EXPRESS_PORT=%MEDOMICS_EXPRESS_PORT% >> \"${winLogPath}\" && \"${batName}\" >> \"${winLogPath}\" 2>&1"`
      console.log('[remote] startRemoteExpress exec cmd', cmd)
      // Fire-and-forget: do not await completion of the batch; it runs the server and can stay running.
      try {
        conn.exec(cmd, (err, stream) => {
          if (err) {
            console.log('[remote] startRemoteExpress exec error', err.message || String(err))
            return
          }
          stream.on('data', (d) => {
            // Optionally log a small amount of stdout for debugging
            try { console.log('[remote] startRemoteExpress stdout chunk', d.toString().slice(0, 200)) } catch {}
          })
          stream.stderr.on('data', (d) => {
            try { console.log('[remote] startRemoteExpress stderr chunk', d.toString().slice(0, 200)) } catch {}
          })
          stream.on('close', (code) => {
            console.log('[remote] startRemoteExpress cmd closed with code', code)
          })
        })
      } catch (e) {
        console.log('[remote] startRemoteExpress exec exception', e && e.message ? e.message : String(e))
      }
    } else {
      cmd = `bash -lc "export NODE_ENV=production; export MEDOMICS_EXPRESS_PORT='${remotePort}'; echo '[launcher] NODE_ENV='\"$NODE_ENV\"' MEDOMICS_EXPRESS_PORT='\"$MEDOMICS_EXPRESS_PORT\" >> '${logPath.replace(/'/g, "'\\''")}'; nohup '${scriptPath}' >> '${logPath.replace(/'/g, "'\\''")}' 2>&1 &"`
      console.log('[remote] startRemoteExpress exec cmd', cmd)
      const r2 = await execRemote(conn, cmd)
      console.log('[remote] startRemoteExpress exec result', r2)
    }
    // Poll for port open
    await sleep(800)
    const maxAttempts = 20
    for (let i = 0; i < maxAttempts; i++) {
      const open = await checkRemotePortOpen(conn, remotePort)
      if (open) return { success: true, status: 'running', port: remotePort }
      await sleep(500)
    }
    console.log('[remote] startRemoteExpress timeout waiting for port', remotePort)
    return { success: false, status: 'timeout', error: `Express did not open port ${remotePort} in time` }
  } catch (e) {
    return { success: false, status: 'failed-to-start', error: e && e.message ? e.message : String(e) }
  }
}

// Live log streaming state
let activeExpressLogStream = null

ipcMain.handle('startRemoteServerLogStream', async () => {
  const conn = getActiveTunnel()
  if (!conn) return { success: false, error: 'No active SSH tunnel' }
  if (activeExpressLogStream) return { success: true } // already streaming
  try {
    const { expressLogPath } = getTunnelState()
    if (!expressLogPath) return { success: false, error: 'No expressLogPath available' }
    const remoteOS = await detectRemoteOS()
    let cmd
    if (remoteOS === 'win32') {
      cmd = `powershell -NoProfile -Command \"Get-Content -Path '${expressLogPath.replace(/'/g, "''")}' -Tail 200 -Wait\"`
    } else {
      cmd = `bash -lc "tail -n 200 -F '${expressLogPath.replace(/'/g, "'\\''")}'"`
    }
    return await new Promise((resolve) => {
      conn.exec(cmd, (err, stream) => {
        if (err) return resolve({ success: false, error: err.message })
        activeExpressLogStream = stream
        try { mainWindow.webContents.send('remoteServerLog:state', { streaming: true }) } catch {}
        stream.on('data', (d) => {
          try { mainWindow.webContents.send('remoteServerLog:data', d.toString()) } catch {}
        })
        stream.stderr.on('data', (d) => {
          try { mainWindow.webContents.send('remoteServerLog:data', d.toString()) } catch {}
        })
        stream.on('close', () => {
          activeExpressLogStream = null
          try { mainWindow.webContents.send('remoteServerLog:state', { streaming: false }) } catch {}
        })
        resolve({ success: true })
      })
    })
  } catch (e) {
    return { success: false, error: e && e.message ? e.message : String(e) }
  }
})

ipcMain.handle('stopRemoteServerLogStream', async () => {
  try {
    if (activeExpressLogStream) {
      try { activeExpressLogStream.close && activeExpressLogStream.close() } catch {}
      activeExpressLogStream = null
    }
    try { mainWindow.webContents.send('remoteServerLog:state', { streaming: false }) } catch {}
    return { success: true }
  } catch (e) {
    return { success: false, error: e && e.message ? e.message : String(e) }
  }
})

function mapOsKey(remoteOS) {
  // Map Node-like OS ids to manifest os keys
  if (remoteOS === 'win32') return ['windows', 'win32']
  if (remoteOS === 'darwin') return ['darwin', 'macos', 'osx']
  return ['linux']
}

function selectAssetForRemote(manifest, remoteOS) {
  const assets = (manifest && manifest.assets) || []
  const osKeys = mapOsKey(remoteOS)
  const first = assets.find(a => osKeys.includes(String(a.os||'').toLowerCase()))
  return first || null
}

function sendInstallProgress(payload) {
  try {
    console.log(payload)
    // Try sending to exported mainWindow if available
    const bg = (() => { try { return require('../background.js') } catch { return null } })()
    const win = bg && bg.mainWindow ? bg.mainWindow : (require('electron').BrowserWindow.getAllWindows()[0] || null)
    if (win && win.webContents) {
      win.webContents.send('remoteBackendInstallProgress', payload)
      return
    }
  } catch {}
}

ipcMain.handle('ensureRemoteBackend', async (_event, { port } = {}) => {
  const conn = getActiveTunnel()
  if (!conn) return { success: false, status: 'tunnel-inactive', error: 'No active SSH tunnel' }

  const tunnel = getTunnelState()
  const targetPort = port || tunnel.remoteExpressPort
  const localPort = tunnel.localExpressPort
  if (!targetPort || !localPort) {
    return { success: false, status: 'invalid-config', error: 'Missing local/remote backend port configuration' }
  }
  try {
    // 1) Ensure Express is reachable on remote targetPort; if not, start it using start scripts
    let isOpen = await checkRemotePortOpen(conn, targetPort)
    if (!isOpen) {
      const remoteOS = await detectRemoteOS()
      const startRes = await startRemoteExpress(conn, remoteOS, targetPort)
      if (!startRes.success) return startRes
      isOpen = await checkRemotePortOpen(conn, targetPort)
      if (!isOpen) return { success: false, status: 'timeout', error: `Express did not open port ${targetPort}` }
    }

    // 2) Express is up; set status, infer log path under baseDir/logs/express.log
    // Try to compute log path similarly to startRemoteExpress
    let info = { expressStatus: 'running', serverStartedRemotely: true }
    try {
      const exe = getRemoteBackendExecutablePath()
      const normalized = (exe||'').replace(/\\/g,'/')
      let baseDir = null
      if (normalized.includes('/versions/')) baseDir = normalized.split('/versions/')[0]
      if (!baseDir) {
        const remoteOS = await detectRemoteOS()
        const home = await getRemoteHome(getActiveTunnel(), remoteOS)
        baseDir = remoteOS === 'win32' ? `${home}\\.medomics\\medomics-server` : `${home}/.medomics/medomics-server`
      }
      const remoteOS = await detectRemoteOS()
      const logPath = remoteOS === 'win32' ? `${baseDir}\\logs\\express.log` : `${baseDir}/logs/express.log`
      info = { ...info, expressLogPath: logPath }
    } catch {}
    // 3) Ensure there is a local forward from localPort -> targetPort
    try {
      await startExpressForward({ localExpressPort: localPort, remoteExpressPort: targetPort })
    } catch (e) {
      console.warn('Failed to start Express forward after ensureRemoteBackend:', e && e.message ? e.message : e)
    }
    setTunnelState({ ...getTunnelState(), ...info })
    try { mainWindow.webContents.send('tunnelStateUpdate', info) } catch {}
    return { success: true, status: 'running', port: targetPort }
  } catch (e) {
    return { success: false, status: 'error', error: e && e.message ? e.message : String(e) }
  }
})

function getLocalGoBinaryForOS(remoteOS) {
  // Prefer packaged resources; fallback to repo path
  try {
    let base = process.resourcesPath ? path.join(process.resourcesPath, 'go_executables') : null
    let repo = path.join(process.cwd(), 'go_executables')
    if (remoteOS === 'win32') {
      const cand = [base && path.join(base,'server_go_win32.exe'), path.join(repo,'server_go_win32.exe')].filter(Boolean)
      return cand.find(p=>p && fs.existsSync(p)) || null
    } else if (remoteOS === 'darwin') {
      const cand = [base && path.join(base,'server_go'), path.join(repo,'server_go_mac')].filter(Boolean)
      return cand.find(p=>p && fs.existsSync(p)) || null
    } else {
      // linux
      const cand = [base && path.join(base,'server_go'), path.join(repo,'server_go_linux'), path.join(repo,'server_go')].filter(Boolean)
      return cand.find(p=>p && fs.existsSync(p)) || null
    }
  } catch {
    return null
  }
}

ipcMain.handle('installRemoteBackend', async () => {
  const conn = getActiveTunnel()
  if (!conn) return { success: false, error: 'No active SSH tunnel' }
  try {
    const remoteOS = await detectRemoteOS()
    const localBin = getLocalGoBinaryForOS(remoteOS)
    if (!localBin) return { success: false, error: 'Local GO binary not found for remote OS' }
    const home = await getRemoteHome(conn, remoteOS)
    let remoteDir, remotePath
    if (remoteOS === 'win32') {
      remoteDir = `${home}\\.medomics\\MEDomicsLab\\go_executables`
      remotePath = path.join(remoteDir, 'server_go_win32.exe')
    } else {
      remoteDir = `${home}/.medomics/MEDomicsLab/go_executables`
      remotePath = `${remoteDir}/server_go`
    }
    // mkdir -p remoteDir
    if (remoteOS === 'win32') {
      await execRemote(conn, `powershell -NoProfile -Command "New-Item -ItemType Directory -Force -Path '${remoteDir.replace(/'/g, "''")}' | Out-Null"`)
    } else {
      await execRemote(conn, `bash -lc "mkdir -p '${remoteDir.replace(/'/g, "'\\''")}'"`)
    }
    // Upload file via SFTP
    const sftp = await new Promise((resolve, reject) => conn.sftp((err, s) => err ? reject(err) : resolve(s)))
    await new Promise((resolve, reject) => sftp.fastPut(localBin, remotePath, (err) => err ? reject(err) : resolve()))
    if (remoteOS !== 'win32') {
      await execRemote(conn, `bash -lc "chmod +x '${remotePath.replace(/'/g, "'\\''")}'"`)
    }
    setRemoteBackendExecutablePath(remotePath)
    try { sftp.end && sftp.end() } catch {}
    return { success: true, path: remotePath }
  } catch (e) {
    return { success: false, error: e.message }
  }
})

ipcMain.handle('setRemoteBackendPath', async (_event, p) => {
  setRemoteBackendExecutablePath(p)
  return { success: true, path: p }
})

// Locate remote backend executable under default install folders and persist the path
ipcMain.handle('locateRemoteBackendExecutable', async () => {
  const conn = getActiveTunnel()
  if (!conn) return { success: false, error: 'No active SSH tunnel' }
  try {
    const remoteOS = await detectRemoteOS()
    const exe = await findRemoteBackendExecutable(conn, remoteOS)
    if (exe) {
      const pathValue = (typeof exe === 'object' && exe.path) ? exe.path : exe
      setRemoteBackendExecutablePath(pathValue)
      // Optionally infer and set express log path for convenience
      try {
        const normalized = (pathValue||'').replace(/\\/g,'/')
        let baseDir = null
        if (normalized.includes('/versions/')) baseDir = normalized.split('/versions/')[0]
        if (!baseDir) {
          const home = await getRemoteHome(conn, remoteOS)
          baseDir = remoteOS === 'win32' ? `${home}\\.medomics\\medomics-server` : `${home}/.medomics/medomics-server`
        }
        const logPath = remoteOS === 'win32' ? `${baseDir}\\logs\\express.log` : `${baseDir}/logs/express.log`
        setTunnelState({ ...getTunnelState(), expressLogPath: logPath })
        try { mainWindow.webContents.send('tunnelStateUpdate', { expressLogPath: logPath }) } catch {}
      } catch {}
      return { success: true, path: pathValue }
    }
    return { success: false, error: 'executable-not-found' }
  } catch (e) {
    return { success: false, error: e && e.message ? e.message : String(e) }
  }
})

ipcMain.handle('startRemoteBackendUsingPath', async (_event, { path: exePath, port }) => {
  const conn = getActiveTunnel()
  if (!conn) return { success: false, error: 'No active SSH tunnel' }
  const remoteOS = await detectRemoteOS()
  const state = getTunnelState()
  const targetPort = port || state.remoteExpressPort
  // Persist the chosen path so startRemoteExpress can resolve start scripts relative to it.
  try { setRemoteBackendExecutablePath(exePath) } catch {}
  const res = await startRemoteBackend(conn, remoteOS, exePath, targetPort)
  if (res && res.success) {
    // Mark Express as running, started via app, and ensure forward is active
    try {
      const info = {
        expressStatus: 'running',
        serverStartedRemotely: true,
        remoteExpressPort: targetPort ? Number(targetPort) : state.remoteExpressPort,
      }
      setTunnelState({ ...getTunnelState(), ...info })
      try { mainWindow.webContents.send('tunnelStateUpdate', info) } catch {}
    } catch {}
    try {
      await startExpressForward({ localExpressPort: state.localExpressPort, remoteExpressPort: targetPort })
    } catch (e) {
      console.warn('Failed to start Express forward after startRemoteBackendUsingPath:', e && e.message ? e.message : e)
    }
  }
  return res
})

ipcMain.handle('installRemoteBackendFromURL', async (_event, { manifestUrl, version } = {}) => {
  const conn = getActiveTunnel()
  if (!conn) return { success: false, error: 'No active SSH tunnel' }
  try {
    const remoteOS = await detectRemoteOS()
    let url, expectedSha = '', manifestVersion
    if (manifestUrl) {
      // Legacy manifest-based install
      sendInstallProgress({ phase: 'fetch-manifest', manifestUrl })
      const { data: manifest } = await axios.get(manifestUrl, { timeout: 20000 })
      manifestVersion = version || manifest?.version
      if (!manifestVersion) {
        sendInstallProgress({ phase: 'error', step: 'manifest', error: 'no-version-in-manifest' })
        return { success: false, error: 'no-version-in-manifest' }
      }
      const asset = selectAssetForRemote(manifest, remoteOS)
      if (!asset) {
        sendInstallProgress({ phase: 'error', step: 'manifest', error: 'no-asset-for-remote', details: { remoteOS } })
        return { success: false, error: 'no-asset-for-remote', details: { remoteOS } }
      }
      url = asset.url
      expectedSha = (asset.sha256||'').trim().toLowerCase()
      if (!url) {
        sendInstallProgress({ phase: 'error', step: 'manifest', error: 'asset-has-no-url' })
        return { success: false, error: 'asset-has-no-url' }
      }
    } else {
      // GitHub releases-based install (no manifest provided)
      const defaultOwner = 'MEDomicsLab'
      const defaultRepo = 'MEDomics'
      sendInstallProgress({ phase: 'github-fetch-releases', owner: defaultOwner, repo: defaultRepo })
      const { data: releases } = await axios.get(`https://api.github.com/repos/${defaultOwner}/${defaultRepo}/releases`, {
        headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': 'medomicslab-remote-installer' },
        timeout: 20000
      })
      if (!Array.isArray(releases) || releases.length === 0) {
        sendInstallProgress({ phase: 'error', step: 'github', error: 'no-releases-found' })
        return { success: false, error: 'no-releases-found' }
      }
      const serverReleases = releases.filter(r => {
        const tag = (r.tag_name||'').toLowerCase()
        const name = (r.name||'').toLowerCase()
        return tag.includes('server') || name.includes('server')
      })
      const sorted = (serverReleases.length ? serverReleases : releases).sort((a,b) => {
        const pa = new Date(a.published_at||a.created_at||0).getTime()
        const pb = new Date(b.published_at||b.created_at||0).getTime()
        return pb - pa
      })
      const chosen = sorted[0]
      if (!chosen) {
        sendInstallProgress({ phase: 'error', step: 'github', error: 'no-suitable-release' })
        return { success: false, error: 'no-suitable-release' }
      }
      sendInstallProgress({ phase: 'github-pick-release', tag: chosen.tag_name, name: chosen.name })
      // Select asset by fixed naming pattern: MEDomicsLab-Server-[version]-<os>.zip
      const assets = chosen.assets || []
      const suffix = remoteOS === 'win32' ? '-win32.zip' : (remoteOS === 'darwin' ? '-darwin.zip' : '-linux.zip')
      let candidate = assets.find(a => (a.name||'').toLowerCase().endsWith(suffix))
      if (!candidate) {
        // Fallback: check browser_download_url
        candidate = assets.find(a => (a.browser_download_url||'').toLowerCase().endsWith(suffix))
      }
      if (!candidate) {
        sendInstallProgress({ phase: 'error', step: 'github', error: 'no-asset-for-platform', details: { remoteOS, expectedSuffix: suffix } })
        return { success: false, error: 'no-asset-for-platform', details: { remoteOS, expectedSuffix: suffix } }
      }
      url = candidate.browser_download_url
      if (!url) {
        sendInstallProgress({ phase: 'error', step: 'github', error: 'asset-missing-download-url' })
        return { success: false, error: 'asset-missing-download-url' }
      }
      manifestVersion = chosen.tag_name || chosen.name || 'latest'
      sendInstallProgress({ phase: 'github-select-asset', asset: candidate.name, url })
    }

    const home = await getRemoteHome(conn, remoteOS)
    const baseDir = remoteOS === 'win32' ? `${home}\\.medomics\\medomics-server` : `${home}/.medomics/medomics-server`
    const versionsDir = remoteOS === 'win32' ? `${baseDir}\\versions` : `${baseDir}/versions`
    const versionDir = remoteOS === 'win32' ? `${versionsDir}\\${manifestVersion}` : `${versionsDir}/${manifestVersion}`
    const downloadsDir = remoteOS === 'win32' ? `${baseDir}\\downloads` : `${baseDir}/downloads`

    // Ensure dirs exist
    sendInstallProgress({ phase: 'prepare-dirs', baseDir, versionDir })
    if (remoteOS === 'win32') {
      await execRemote(conn, `powershell -NoProfile -Command "New-Item -ItemType Directory -Force -Path '${baseDir.replace(/'/g, "''")}' | Out-Null; New-Item -ItemType Directory -Force -Path '${versionsDir.replace(/'/g, "''")}' | Out-Null; New-Item -ItemType Directory -Force -Path '${versionDir.replace(/'/g, "''")}' | Out-Null; New-Item -ItemType Directory -Force -Path '${downloadsDir.replace(/'/g, "''")}' | Out-Null"`)
    } else {
      await execRemote(conn, `bash -lc "mkdir -p '${baseDir.replace(/'/g, "'\\''")}' '${versionsDir.replace(/'/g, "'\\''")}' '${versionDir.replace(/'/g, "'\\''")}' '${downloadsDir.replace(/'/g, "'\\''")}'"`)
    }

    // If already installed, try to reuse
    const candidateExeWin = `${versionDir}\\bin\\medomics-server.exe`
    const candidateExePosix = `${versionDir}/bin/medomics-server`
    if (remoteOS === 'win32') {
      const r = await execRemote(conn, `powershell -NoProfile -Command "If (Test-Path '${candidateExeWin.replace(/'/g, "''")}') { Write-Output 'FOUND' }"`)
      if ((r.stdout||'').trim() === 'FOUND') {
        setRemoteBackendExecutablePath(candidateExeWin)
        sendInstallProgress({ phase: 'already-installed', version: manifestVersion, path: candidateExeWin })
        return { success: true, version: manifestVersion, path: candidateExeWin, reused: true }
      }
    } else {
      const r = await execRemote(conn, `bash -lc "[ -x '${candidateExePosix.replace(/'/g, "'\\''")}'] && echo FOUND || true"`)
      if ((r.stdout||'').trim() === 'FOUND') {
        setRemoteBackendExecutablePath(candidateExePosix)
        sendInstallProgress({ phase: 'already-installed', version: manifestVersion, path: candidateExePosix })
        return { success: true, version: manifestVersion, path: candidateExePosix, reused: true }
      }
    }

    // Download
    const fileName = url.split('/').pop().split('?')[0]
    const remoteDownloadPath = remoteOS === 'win32' ? `${downloadsDir}\\${fileName}` : `${downloadsDir}/${fileName}`
    // Try to get expected size to enable percent & speed reporting (final-only)
    let expectedBytes = null
    try {
      const head = await axios.head(url, { timeout: 15000 })
      const len = head?.headers?.['content-length'] || head?.headers?.['Content-Length']
      if (len && !isNaN(Number(len))) expectedBytes = Number(len)
    } catch {}
    const t0 = Date.now()
    sendInstallProgress({ phase: 'download-start', url, remoteDownloadPath })
    if (remoteOS === 'win32') {
      const ps = `powershell -NoProfile -Command "Invoke-WebRequest -Uri '${url.replace(/'/g, "''")}' -OutFile '${remoteDownloadPath.replace(/'/g, "''")}' -UseBasicParsing"`
      const r = await execRemote(conn, ps)
      if (r.code !== 0 && r.stderr) { sendInstallProgress({ phase: 'error', step: 'download', details: r.stderr }); return { success: false, error: 'download-failed', details: r.stderr } }
    } else {
      const sh = `bash -lc "curl -L --fail -o '${remoteDownloadPath.replace(/'/g, "'\\''")}' '${url.replace(/'/g, "'\\''")}'"`
      const r = await execRemote(conn, sh)
      if (r.code !== 0 && r.stderr) { sendInstallProgress({ phase: 'error', step: 'download', details: r.stderr }); return { success: false, error: 'download-failed', details: r.stderr } }
    }
    const dt = Math.max(1, Date.now() - t0) // ms
    let speedBps = null
    if (expectedBytes && dt > 0) {
      speedBps = Math.round((expectedBytes / dt) * 1000) // bytes/sec
    }
    sendInstallProgress({ phase: 'download-complete', remoteDownloadPath, percent: 100, speed: speedBps || undefined })

    // Verify SHA256
    if (expectedSha) {
      sendInstallProgress({ phase: 'verify-start' })
      if (remoteOS === 'win32') {
        const r = await execRemote(conn, `powershell -NoProfile -Command "(Get-FileHash -Algorithm SHA256 '${remoteDownloadPath.replace(/'/g, "''")}').Hash"`)
        const actual = (r.stdout||'').trim().toLowerCase()
        if (!actual || actual !== expectedSha) { sendInstallProgress({ phase: 'error', step: 'verify', expectedSha, actual }); return { success: false, error: 'checksum-mismatch', expectedSha, actual } }
      } else {
        // Prefer sha256sum, fallback to shasum
        const r = await execRemote(conn, `bash -lc "if command -v sha256sum >/dev/null 2>&1; then sha256sum '${remoteDownloadPath.replace(/'/g, "'\\''")}' | awk '{print $1}'; else shasum -a 256 '${remoteDownloadPath.replace(/'/g, "'\\''")}' | awk '{print $1}'; fi"`)
        const actual = (r.stdout||'').trim().toLowerCase()
        if (!actual || actual !== expectedSha) { sendInstallProgress({ phase: 'error', step: 'verify', expectedSha, actual }); return { success: false, error: 'checksum-mismatch', expectedSha, actual } }
      }
      sendInstallProgress({ phase: 'verify-ok' })
    } else {
      sendInstallProgress({ phase: 'verify-skip', reason: 'no-sha256-in-manifest' })
    }

    // Extract
    sendInstallProgress({ phase: 'extract-start', to: versionDir })
    if (remoteOS === 'win32') {
      if (fileName.toLowerCase().endsWith('.zip')) {
        const r = await execRemote(conn, `powershell -NoProfile -Command "Expand-Archive -Path '${remoteDownloadPath.replace(/'/g, "''")}' -DestinationPath '${versionDir.replace(/'/g, "''")}' -Force"`)
        if (r.code !== 0 && r.stderr) { sendInstallProgress({ phase: 'error', step: 'extract', details: r.stderr }); return { success: false, error: 'extract-failed', details: r.stderr } }
      } else {
        // Attempt tar if available (Windows 10+)
        const r = await execRemote(conn, `tar -xf "${remoteDownloadPath}" -C "${versionDir}" 2>&1 || powershell -NoProfile -Command "throw 'Unsupported archive format'"`)
        if (r.code !== 0 && r.stderr) { sendInstallProgress({ phase: 'error', step: 'extract', details: r.stderr }); return { success: false, error: 'extract-failed', details: r.stderr } }
      }
    } else {
      if (fileName.toLowerCase().endsWith('.tar.gz') || fileName.toLowerCase().endsWith('.tgz')) {
        const r = await execRemote(conn, `bash -lc "tar -xzf '${remoteDownloadPath.replace(/'/g, "'\\''")}' -C '${versionDir.replace(/'/g, "'\\''")}'"`)
        if (r.code !== 0 && r.stderr) { sendInstallProgress({ phase: 'error', step: 'extract', details: r.stderr }); return { success: false, error: 'extract-failed', details: r.stderr } }
      } else if (fileName.toLowerCase().endsWith('.zip')) {
        const r = await execRemote(conn, `bash -lc "unzip -o '${remoteDownloadPath.replace(/'/g, "'\\''")}' -d '${versionDir.replace(/'/g, "'\\''")}'"`)
        if (r.code !== 0 && r.stderr) { sendInstallProgress({ phase: 'error', step: 'extract', details: r.stderr }); return { success: false, error: 'extract-failed', details: r.stderr } }
      } else {
        sendInstallProgress({ phase: 'error', step: 'extract', error: 'unsupported-archive-format' })
        return { success: false, error: 'unsupported-archive-format' }
      }
    }
    sendInstallProgress({ phase: 'extract-complete' })

    // Locate executable
    let exePath
    if (remoteOS === 'win32') {
      const findExe = await execRemote(conn, `powershell -NoProfile -Command "Get-ChildItem -Path '${versionDir.replace(/'/g, "''")}' -Recurse -Filter medomics-server.exe | Select-Object -First 1 -ExpandProperty FullName"`)
      exePath = (findExe.stdout || '').trim()
    } else {
      const findExe = await execRemote(conn, `bash -lc "( [ -x '${candidateExePosix.replace(/'/g, "'\\''")}' ] && echo '${candidateExePosix.replace(/'/g, "'\\''")}' ) || find '${versionDir.replace(/'/g, "'\\''")}' -type f -name 'medomics-server' -perm +111 -print -quit || true"`)
      exePath = (findExe.stdout || '').trim()
    }
    if (!exePath) { sendInstallProgress({ phase: 'error', step: 'locate-exe' }); return { success: false, error: 'executable-not-found' } }
    if (remoteOS !== 'win32') {
      await execRemote(conn, `bash -lc "chmod +x '${exePath.replace(/'/g, "'\\''")}'"`)
    }

    // Optional: create 'current' symlink on posix
    if (remoteOS !== 'win32') {
      const currentLink = `${baseDir}/current`
      await execRemote(conn, `bash -lc "ln -sfn '${versionDir.replace(/'/g, "'\\''")}' '${currentLink.replace(/'/g, "'\\''")}'"`)
    }

    setRemoteBackendExecutablePath(exePath)
    sendInstallProgress({ phase: 'done', version: manifestVersion, path: exePath })
    return { success: true, version: manifestVersion, path: exePath }
  } catch (e) {
    try { sendInstallProgress({ phase: 'error', step: 'unexpected', details: e && e.message ? e.message : String(e) }) } catch {}
    return { success: false, error: e && e.message ? e.message : String(e) }
  }
})


/**
 * Starts an SSH tunnel and creates the backend port forwarding server only.
 * MongoDB tunnel can be created later by calling startMongoTunnel.
 * @param {Object} params - SSH and port config.
 * @param {string} params.host - Address of the remote host.
 * @param {string} params.username - Username for SSH connection.
 * @param {string} [params.privateKey] - Private key for SSH authentication.
 * @param {string} [params.password] - Password for SSH authentication.
 * @param {number|string} params.remotePort - Port of the SSH connection
 * @param {number|string} params.localExpressPort - Local port forwarded to the remote Express server.
 * @param {number|string} params.remoteExpressPort - Port on the remote host for the Express server.
 * @param {number|string} params.localGoPort - (Optional) Local port forwarded to the remote GO server.
 * @param {number|string} params.remoteGoPort - (Optional) Port on the remote host for the GO server.
 * @param {number|string} params.localDBPort - Local port for the MongoDB server.
 * @param {number|string} params.remoteDBPort - Port on the remote host for the MongoDB server.
 * @param {number|string} params.localJupyterPort - Local port for the Jupyter server.
 * @param {number|string} params.remoteJupyterPort - Port on the remote host for the Jupyter server.
 * @returns {Promise<{success: boolean}>}
 */
export async function startSSHTunnel({ host, username, privateKey, password, remotePort, localExpressPort, remoteExpressPort, localGoPort, remoteGoPort, localDBPort, remoteDBPort, localJupyterPort, remoteJupyterPort, localBackendPort, remoteBackendPort }) {
  return new Promise((resolve, reject) => {
    mongoDBLocalPort = localDBPort
    mongoDBRemotePort = remoteDBPort
    jupyterLocalPort = localJupyterPort
    jupyterRemotePort = remoteJupyterPort

    if (activeTunnelServer) {
      try {
        activeTunnelServer.expressServer && activeTunnelServer.expressServer.close()
      } catch {}
      try {
        activeTunnelServer.goServer && activeTunnelServer.goServer.close()
      } catch {}
      try {
        activeTunnelServer.mongoServer && activeTunnelServer.mongoServer.close()
      } catch {}
      try {
        activeTunnelServer.jupyterServer && activeTunnelServer.jupyterServer.close()
      } catch {}
      setActiveTunnelServer(null)
    }
    if (activeTunnel) {
      try {
        activeTunnel.end()
      } catch {}
      setActiveTunnel(null)
    }
    const connConfig = {
      host,
      port: parseInt(remotePort),
      username
    }
    if (privateKey) connConfig.privateKey = privateKey
    if (password) connConfig.password = password
    const conn = new Client()
    conn
      .on("ready", () => {
        console.log("SSH connection established to", host)
      // Backward compatibility mapping
        if (!localExpressPort && localBackendPort) localExpressPort = localBackendPort
        if (!remoteExpressPort && remoteBackendPort) remoteExpressPort = remoteBackendPort

        // Defer creating Express/Go forwards until remote /status confirms running.
        // Initialize tunnel state with provided ports and mark services as closed.
        try {
          setTunnelState({
            ...getTunnelState(),
            localExpressPort: localExpressPort ? Number(localExpressPort) : null,
            remoteExpressPort: remoteExpressPort ? Number(remoteExpressPort) : null,
            localGoPort: localGoPort ? Number(localGoPort) : null,
            remoteGoPort: remoteGoPort ? Number(remoteGoPort) : null,
            expressStatus: 'closed'
          })
          mainWindow.webContents.send('tunnelStateUpdate', {
            localExpressPort, remoteExpressPort, localGoPort, remoteGoPort, expressStatus: 'closed'
          })
        } catch {}

        setActiveTunnel(conn)
        setActiveTunnelServer({})
        // Mark tunnel active and emit a consolidated state update
        try {
          setTunnelState({
            ...getTunnelState(),
            host,
            username,
            remotePort: Number(remotePort),
            localDBPort: localDBPort ? Number(localDBPort) : null,
            remoteDBPort: remoteDBPort ? Number(remoteDBPort) : null,
            localJupyterPort: localJupyterPort ? Number(localJupyterPort) : null,
            remoteJupyterPort: remoteJupyterPort ? Number(remoteJupyterPort) : null,
            tunnelActive: true
          })
          mainWindow.webContents.send('tunnelStateChanged', getTunnelState())
        } catch {}
        resolve({ success: true })
      })
      .on("error", (err) => {
        reject(new Error("SSH connection error: " + err.message))
      })
      .connect(connConfig)
  })
}

// IPC to rebind the Express forward to a newly discovered remote port
ipcMain.handle('rebindExpressForward', async (_event, { newRemoteExpressPort, newLocalExpressPort } = {}) => {
  return rebindPortTunnel({ name: 'express', newRemotePort: Number(newRemoteExpressPort), newLocalPort: Number(newLocalExpressPort) })
})

// New: Explicit starters for Express and Go forwarding, invoked after /status confirmation
export async function startExpressForward({ localExpressPort, remoteExpressPort }) {
  try {
    const state = getTunnelState()
    const localPort = Number(localExpressPort || state.localExpressPort)
    const remotePort = Number(remoteExpressPort || state.remoteExpressPort)
    const res = await startPortTunnel({ name: 'express', localPort, remotePort, ensureRemoteOpen: true })
    if (!res.success) return res
    const updates = { localExpressPort: localPort, remoteExpressPort: remotePort, expressStatus: 'forwarding' }
    setTunnelState({ ...getTunnelState(), ...updates })
    try {
      const full = getTunnelState()
      mainWindow.webContents.send('tunnelStateChanged', full)
      mainWindow.webContents.send('tunnelStateUpdate', full)
    } catch {}
    return { success: true, localPort, remotePort }
  } catch (e) {
    return { success: false, error: e && e.message ? e.message : String(e) }
  }
}

// Deprecated wrapper: route to the generic startPortTunnel for GO
export async function startGoForward({ localGoPort, remoteGoPort }) {
  const state = getTunnelState()
  const localPort = Number(localGoPort || state.localGoPort)
  const remotePort = Number(remoteGoPort || state.remoteGoPort)
  return startPortTunnel({ name: 'go', localPort, remotePort, ensureRemoteOpen: true })
}

// Generic port tunnel management
export async function startPortTunnel({ name, localPort, remotePort, ensureRemoteOpen = false }) {
  try {
    const conn = getActiveTunnel()
    if (!conn) {
      console.log('[startPortTunnel] No active SSH tunnel')
      return { success: false, error: 'No active SSH tunnel' }
    }
    const servers = getActiveTunnelServer() || {}
    const state = getTunnelState()
    let lp = Number(localPort)
    const rp = Number(remotePort)
    console.log('[startPortTunnel] request', { name, localPort: lp, remotePort: rp, ensureRemoteOpen })
    // If local port is invalid/missing, fall back to ephemeral (port 0)
    if (!lp || isNaN(lp)) {
      console.log('[startPortTunnel] localPort invalid, using ephemeral port')
      lp = 0
    }
    if (!rp || isNaN(rp)) {
      console.log('[startPortTunnel] invalid remote port', remotePort)
      return { success: false, error: 'invalid-remote-port' }
    }

    // Idempotent no-op: if the tunnel already exists, is listening, and targets the same remote port,
    // don't close/recreate it (heartbeat calls this frequently).
    try {
      const tunnels = Array.isArray(state.tunnels) ? state.tunnels : []
      const existingEntry = tunnels.find(t => t && t.name === name && t.status === 'forwarding')
      const existingServer = servers[name]
      const requestedLocal = lp
      const existingLocal = existingEntry ? Number(existingEntry.localPort) : null
      const existingRemote = existingEntry ? Number(existingEntry.remotePort) : null
      const localOk = !requestedLocal || requestedLocal === 0 || (existingLocal && requestedLocal === existingLocal)
      if (existingServer && existingServer.listening && existingEntry && existingRemote === rp && localOk) {
        console.log('[startPortTunnel] already forwarding', { name, localPort: existingLocal, remotePort: existingRemote })
        return { success: true, name, localPort: existingLocal, remotePort: existingRemote, already: true }
      }
    } catch (_) {
      // best-effort; continue with normal setup
    }

    // Default ensure for canonical names; include retries
    const canonical = ['express', 'go', 'mongo', 'jupyter']
    const shouldEnsure = typeof ensureRemoteOpen === 'boolean' ? ensureRemoteOpen : canonical.includes(String(name || '').toLowerCase())
    if (shouldEnsure) {
      let open = false
      const maxAttempts = 3
      const delayMs = 3000
      for (let i = 0; i < maxAttempts && !open; i++) {
        try {
          open = await checkRemotePortOpen(conn, rp)
          console.log('[startPortTunnel] ensure check', { attempt: i + 1, remotePort: rp, open })
        } catch (err) {
          console.log('[startPortTunnel] ensure check error', err && err.message ? err.message : String(err))
          open = false
        }
        if (!open && i < maxAttempts - 1) { await sleep(delayMs) }
      }
      if (!open) {
        console.log('[startPortTunnel] remote port not open', rp)
        return { success: false, error: 'remote-port-closed' }
      }
    }

    // Close existing server under this name
    if (servers[name]) {
      try {
        console.log('[startPortTunnel] closing existing server for', name)
        await new Promise((resolve) => servers[name].close(() => resolve()))
      } catch (err) {
        console.log('[startPortTunnel] error closing existing server', err && err.message ? err.message : String(err))
      }
    }

    const createForwardServer = () => {
      const server = net.createServer((socket) => {
        conn.forwardOut(socket.localAddress || '127.0.0.1', socket.localPort || 0, '127.0.0.1', rp, (err, stream) => {
          if (err) {
            console.log('[startPortTunnel] forwardOut error', err && err.message ? err.message : String(err))
            socket.destroy();
            return
          }
          socket.pipe(stream).pipe(socket)
        })
      })
      return server
    }

    let netServer = createForwardServer()
    // Try requested local port; on EADDRINUSE, fall back to ephemeral port
    try {
      await new Promise((resolve, reject) => {
        netServer.once('error', reject)
        netServer.listen(lp, '127.0.0.1', () => resolve())
      })
    } catch (err) {
      if (err && err.code === 'EADDRINUSE') {
        try { netServer.close() } catch {}
        netServer = createForwardServer()
        await new Promise((resolve, reject) => {
          netServer.once('error', reject)
          netServer.listen(0, '127.0.0.1', () => resolve())
        })
        const addr = netServer.address()
        if (addr && typeof addr === 'object' && addr.port) {
          lp = Number(addr.port)
        }
      } else {
        console.log('[startPortTunnel] listen error', err && err.message ? err.message : String(err))
        return { success: false, error: err && err.message ? err.message : String(err) }
      }
    }
    console.log('[startPortTunnel] listening', { name, localPort: lp, remotePort: rp })

    // Track server by name
    setActiveTunnelServer({ ...servers, [name]: netServer })

    // Update generic tunnels list in state
    const tunnels = Array.isArray(state.tunnels) ? state.tunnels.slice() : []
    const idx = tunnels.findIndex(t => t.name === name || t.localPort === lp)
    const entry = { name, localPort: lp, remotePort: rp, status: 'forwarding' }
    if (idx >= 0) tunnels[idx] = entry
    else tunnels.push(entry)

    // Also reflect canonical service fields for UI/requests helpers
    const updates = { tunnels }
    const n = String(name || '').toLowerCase()
    if (n === 'express') Object.assign(updates, { localExpressPort: lp, remoteExpressPort: rp, expressStatus: 'forwarding' })
    if (n === 'go') Object.assign(updates, { localGoPort: lp, remoteGoPort: rp })
    if (n === 'mongo') Object.assign(updates, { localDBPort: lp, remoteDBPort: rp })
    if (n === 'jupyter') Object.assign(updates, { localJupyterPort: lp, remoteJupyterPort: rp })

    setTunnelState({ ...state, ...updates })
    try {
      const full = getTunnelState()
      mainWindow.webContents.send('tunnelStateChanged', full)
      mainWindow.webContents.send('tunnelStateUpdate', full)
    } catch {}
    console.log('[startPortTunnel] success', { name, localPort: lp, remotePort: rp })
    return { success: true, name, localPort: lp, remotePort: rp }
  } catch (e) {
    console.log('[startPortTunnel] exception', e && e.message ? e.message : String(e))
    return { success: false, error: e && e.message ? e.message : String(e) }
  }
}

export async function stopPortTunnel({ name, localPort }) {
  try {
    const servers = getActiveTunnelServer() || {}
    const state = getTunnelState()
    let serverName = name
    if (!serverName && localPort) {
      const lp = Number(localPort)
      const match = (state.tunnels || []).find(t => Number(t.localPort) === lp)
      serverName = match ? match.name : undefined
    }
    if (!serverName || !servers[serverName]) return { success: false, error: 'tunnel-not-found' }
    await new Promise((resolve) => servers[serverName].close(() => resolve()))
    const nextServers = { ...servers }
    delete nextServers[serverName]
    setActiveTunnelServer(nextServers)

    const tunnels = Array.isArray(state.tunnels) ? state.tunnels.slice() : []
    const idx = tunnels.findIndex(t => t.name === serverName)
    if (idx >= 0) tunnels[idx] = { ...tunnels[idx], status: 'closed' }
    setTunnelState({ ...state, tunnels })
    try { mainWindow.webContents.send('tunnelStateChanged', getTunnelState()) } catch {}
    return { success: true, name: serverName }
  } catch (e) {
    return { success: false, error: e && e.message ? e.message : String(e) }
  }
}

ipcMain.handle('startPortTunnel', async (_event, payload = {}) => {
  console.log("startPortTunnel IPC called with payload:", payload)
  return startPortTunnel(payload)
})
ipcMain.handle('stopPortTunnel', async (_event, payload = {}) => {
  return stopPortTunnel(payload)
})
ipcMain.handle('listPortTunnels', async () => {
  return { success: true, tunnels: (getTunnelState().tunnels || []) }
})

// Generic rebind helper: stop existing tunnel by name and recreate with new ports
export async function rebindPortTunnel({ name, newRemotePort, newLocalPort }) {
  try {
    const state = getTunnelState()
    const tunnels = Array.isArray(state.tunnels) ? state.tunnels : []
    const entry = tunnels.find(t => t.name === name)
    const localPort = Number(newLocalPort || (entry ? entry.localPort : undefined) || state[
      name === 'express' ? 'localExpressPort' :
      name === 'go' ? 'localGoPort' :
      name === 'mongo' ? 'localDBPort' :
      name === 'jupyter' ? 'localJupyterPort' :
      'localExpressPort'
    ])
    const remotePort = Number(newRemotePort)
    if (!remotePort || isNaN(remotePort)) return { success: false, error: 'invalid-remote-port' }
    await stopPortTunnel({ name })
    const res = await startPortTunnel({ name, localPort, remotePort, ensureRemoteOpen: true })
    if (!res.success) return res
    const updates = {}
    if (name === 'express') Object.assign(updates, { remoteExpressPort: remotePort, localExpressPort: localPort, expressStatus: 'forwarding' })
    if (name === 'go') Object.assign(updates, { remoteGoPort: remotePort, localGoPort: localPort })
    if (name === 'mongo') Object.assign(updates, { remoteDBPort: remotePort, localDBPort: localPort })
    if (name === 'jupyter') Object.assign(updates, { remoteJupyterPort: remotePort, localJupyterPort: localPort })
    if (Object.keys(updates).length) {
      setTunnelState({ ...getTunnelState(), ...updates })
      try {
        const full = getTunnelState()
        mainWindow.webContents.send('tunnelStateChanged', full)
        mainWindow.webContents.send('tunnelStateUpdate', full)
      } catch {}
    }
    return { success: true, name, localPort, remotePort }
  } catch (e) {
    return { success: false, error: e && e.message ? e.message : String(e) }
  }
}

ipcMain.handle('rebindPortTunnel', async (_event, payload = {}) => {
  return rebindPortTunnel(payload)
})

// IPC wrappers for starting forwards explicitly
ipcMain.handle('startExpressForward', async (_event, payload = {}) => {
  return startExpressForward(payload)
})
ipcMain.handle('startGoForward', async (_event, payload = {}) => {
  // Compatibility: route to generic startPortTunnel for GO
  const state = getTunnelState()
  const localPort = Number(payload.localGoPort || state.localGoPort)
  const remotePort = Number(payload.remoteGoPort || state.remoteGoPort)
  return startPortTunnel({ name: 'go', localPort, remotePort, ensureRemoteOpen: true })
})

// Probe GO service reachability: checks remote port open via SSH and local forward HTTP reachability
ipcMain.handle('probeGo', async () => {
  try {
    const state = getTunnelState()
    const conn = getActiveTunnel()
    if (!state || !state.tunnelActive) {
      // Still allow local forward reachability check even if tunnelActive is false
      const localPort = Number(state && state.localGoPort)
      const result = { success: false, error: 'no-tunnel', tunnelActive: !!(state && state.tunnelActive), localPort: localPort || null }
      if (localPort && Number.isFinite(localPort)) {
        try {
          const url = `http://127.0.0.1:${localPort}/connection/connection_test_request`
          const resp = await axios.post(url, { message: JSON.stringify({ data: "" }) }, { timeout: 3000, headers: { 'Content-Type': 'application/json' } })
          result.localReachable = !!resp
          result.localResponse = resp && resp.data ? resp.data : null
          result.success = true
        } catch (e) {
          result.localReachable = false
          result.localError = e && e.message ? e.message : String(e)
        }
      }
      return result
    }
    const remotePort = Number(state.remoteGoPort)
    const localPort = Number(state.localGoPort)
    const result = { success: true, tunnelActive: true, remotePort: remotePort || null, localPort: localPort || null }

    // Remote port open check via SSH
    let remoteOpen = null
    if (remotePort && Number.isFinite(remotePort)) {
      try { remoteOpen = await checkRemotePortOpen(conn, remotePort) }
      catch { remoteOpen = false }
    }
    result.remoteOpen = !!remoteOpen

    // Local forward reachability by hitting the GO verify endpoint (best-effort)
    let localReachable = null
    if (localPort && Number.isFinite(localPort)) {
      try {
        const url = `http://127.0.0.1:${localPort}/connection/connection_test_request`
        const resp = await axios.post(url, { message: JSON.stringify({ data: "" }) }, { timeout: 3000, headers: { 'Content-Type': 'application/json' } })
        result.localResponse = resp && resp.data ? resp.data : null
        localReachable = !!resp
      } catch (e) {
        result.localError = e && e.message ? e.message : String(e)
        localReachable = false
      }
    }
    result.localReachable = !!localReachable
    result.running = !!(result.remoteOpen || result.localReachable)
    return result
  } catch (e) {
    return { success: false, error: e && e.message ? e.message : String(e) }
  }
})

/**
 * Checks if a port is open on the remote host via SSH.
 * @param {Client} conn - The active SSH2 Client connection.
 * @param {number|string} port - The port to check.
 * @returns {Promise<boolean>}
 */
export async function checkRemotePortOpen(conn, port, loadBlocking = false) {
  if (loadBlocking) {
    mainWindow.webContents.send("setSidebarLoading", { processing: true, message: "Checking if MongoDB is running on server..." })
  }
  // Use detectRemoteOS to determine the remote OS and select the right command
  const remoteOS = await detectRemoteOS()
  let checkCmd
  if (remoteOS === "win32") {
    // Windows: only treat the port as open if it's in LISTENING state.
    // This avoids counting TIME_WAIT/CLOSE_WAIT as "open" after a successful stop.
    checkCmd = `netstat -an | findstr LISTENING | findstr :${port}`
  } else {
    // Linux/macOS: use ss or netstat/grep
    checkCmd = `bash -c "command -v ss >/dev/null 2>&1 && ss -ltn | grep :${port} || netstat -an | grep LISTEN | grep :${port}" || netstat -an | grep :${port}`
  }
  console.log('[checkRemotePortOpen] remoteOS:', remoteOS, 'cmd:', checkCmd)
  return new Promise((resolve, reject) => {
    conn.exec(checkCmd, (err, stream) => {
      if (err) {
        console.log("[checkRemotePortOpen] SSH exec error:", err)
        return reject(err)
      }
      let found = false
      let stdout = ""
      let stderr = ""
      stream.on("data", (data) => {
        stdout += data.toString()
        if (data.toString().includes(port)) found = true
      })
      stream.stderr.on("data", (data) => {
        stderr += data.toString()
      })
      stream.on("close", (code, signal) => {
        console.log('[checkRemotePortOpen] close', { code, signal, found, stdout: stdout.trim(), stderr: stderr.trim() })
        resolve(found)
      })
    })
  })
}

// Detect the remote OS via SSH. Returns one of: 'win32' | 'linux' | 'darwin' | 'unix'
export async function detectRemoteOS() {
  const conn = getActiveTunnel()
  if (!conn) return 'win32'
  const tryExec = (cmd) => new Promise((resolve) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return resolve({ code: -1, stdout: '', stderr: String(err && err.message || err) })
      let stdout = ''
      let stderr = ''
      stream.on('data', (d) => { stdout += d.toString() })
      stream.stderr.on('data', (d) => { stderr += d.toString() })
      stream.on('close', (code) => resolve({ code: Number(code), stdout, stderr }))
    })
  })
  // Prefer POSIX detection via bash/uname; fallback to Windows PowerShell; last resort: cmd ver
  const candidates = [
    "bash -lc 'uname -s'",
    'uname -s',
    'powershell -NoProfile -Command "$PSVersionTable.OS.ToString(); [System.Environment]::OSVersion.Platform"',
    'cmd /c ver'
  ]
  for (const cmd of candidates) {
    try {
      const r = await tryExec(cmd)
      const out = (r.stdout || r.stderr || '').trim().toLowerCase()
      if (!out) continue
      if (out.includes('linux')) return 'linux'
      if (out.includes('darwin') || out.includes('mac')) return 'darwin'
      if (out.includes('bsd') || out.includes('unix')) return 'unix'
      if (out.includes('windows') || out.includes('microsoft') || out.includes('version') || out.includes('win')) return 'win32'
    } catch {}
  }
  return 'win32'
}


/**
 * @description Confirms that the mongoDB tunnel is active and the server is listening.
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function confirmMongoTunnel(loadBlocking = false) {
  if (loadBlocking) {
    mainWindow.webContents.send("setSidebarLoading", { processing: true, message: "Confirming that the MongoDB tunnel is active..." })
  }
  console.log("Confirming MongoDB tunnel is active...")
  const conn = getActiveTunnel()
  if (!conn) {
    return { success: false, error: "No active SSH tunnel" }
  }

  return new Promise((resolve, reject) => {
    // Check for a 'mongo' entry in tunnelState.tunnels and verify the remote DB port is listening.
    // Poll every 3000 ms, up to 10 times (keeps prior behavior).
    let attempts = 0
    const maxAttempts = 10
    const intervalMs = 3000

    const tick = async () => {
      try {
        const state = getTunnelState()
        const tunnels = Array.isArray(state.tunnels) ? state.tunnels : []
        const mongoTunnel = tunnels.find(t => t && t.name === 'mongo')
        const remotePort = mongoTunnel && mongoTunnel.remotePort != null
          ? Number(mongoTunnel.remotePort)
          : (state.remoteDBPort != null ? Number(state.remoteDBPort) : null)

        if (!mongoTunnel) {
          attempts++
          if (attempts >= maxAttempts) {
            clearInterval(interval)
            return reject({ success: false, error: "MongoDB tunnel is not present in tunnel state after multiple attempts." })
          }
          return
        }

        if (!remotePort || Number.isNaN(remotePort)) {
          clearInterval(interval)
          return reject({ success: false, error: "MongoDB remote port is missing or invalid in tunnel state." })
        }

        const isRemoteListening = await checkRemotePortOpen(conn, remotePort, false)
        if (isRemoteListening) {
          clearInterval(interval)
          console.log("MongoDB tunnel is active and the remote port is listening.")
          return resolve({ success: true })
        }

        attempts++
        if (attempts >= maxAttempts) {
          clearInterval(interval)
          return reject({ success: false, error: "MongoDB is not listening on the remote port after multiple attempts." })
        }
      } catch (e) {
        attempts++
        if (attempts >= maxAttempts) {
          clearInterval(interval)
          return reject({ success: false, error: e && e.message ? e.message : String(e) })
        }
      }
    }

    const interval = setInterval(() => {
      tick()
    }, intervalMs)

    // Run an immediate check rather than waiting for the first interval.
    tick()
  })
}

/**
 * @description Stops the SSH tunnel and closes all forwarded servers.
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function stopSSHTunnel() {
  let success = false
  let error = null
  if (activeTunnelServer) {
    try {
      await new Promise((resolve, reject) => {
        activeTunnelServer.expressServer && activeTunnelServer.expressServer.close((err) => {
          if (err) reject(err)
          else resolve()
        })
      })
      await new Promise((resolve, reject) => {
        activeTunnelServer.goServer && activeTunnelServer.goServer.close((err) => {
          if (err) reject(err)
          else resolve()
        })
      })
      await new Promise((resolve, reject) => {
        activeTunnelServer.mongoServer && activeTunnelServer.mongoServer.close((err) => {
          if (err) reject(err)
          else resolve()
        })
      })
      setActiveTunnelServer(null)
      success = true
    } catch (e) {
      error = e.message || String(e)
    }
  }
  if (activeTunnel) {
    try {
      activeTunnel.end()
    } catch {}
    setActiveTunnel(null)
    success = true
  }
  // Emit state change reflecting closed forwards and inactive tunnel
  try {
    setTunnelState({
      ...getTunnelState(),
      tunnelActive: false,
      expressStatus: 'closed'
    })
    mainWindow.webContents.send('tunnelStateChanged', getTunnelState())
  } catch {}
  if (success) return { success: true }
  return { success: false, error: error || "No active tunnel" }
}


/**
 * @description This function uses SFTP to check if a file exists at the given remote path.
 * @param {string} filePath - The remote path of the file to check
 * @returns {string>} - Status of the file existence check: "exists", "does not exist", "sftp error", or "tunnel inactive"
 */
export async function checkRemoteFileExists(filePath) {
  const conn = getActiveTunnel()
  if (!conn) return "tunnel inactive"
  const getSftp = () => new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => err ? reject(err) : resolve(sftp))
  })
  const statFile = (sftp, p) => new Promise((resolve) => {
    sftp.stat(p, (err, stats) => {
      if (err) return resolve(false)
      resolve(Boolean(stats))
    })
  })
  try {
    const sftp = await getSftp()
    const exists = await statFile(sftp, filePath)
    if (typeof sftp.end === 'function') { try { sftp.end() } catch {} }
    else if (typeof sftp.close === 'function') { try { sftp.close() } catch {} }
    return exists ? "exists" : "does not exist"
  } catch (error) {
    console.error("SFTP error:", error)
    return "sftp error"
  }
}

export async function getRemoteLStat(filePath) {
  const conn = getActiveTunnel()
  if (!conn) return "tunnel inactive"
  const getSftp = () => new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => err ? reject(err) : resolve(sftp))
  })
  const lstat = (sftp, p) => new Promise((resolve, reject) => {
    sftp.lstat(p, (err, stats) => err ? reject(err) : resolve(stats))
  })
  try {
    const sftp = await getSftp()
    const stats = await lstat(sftp, filePath)
    if (typeof sftp.end === 'function') { try { sftp.end() } catch {} }
    else if (typeof sftp.close === 'function') { try { sftp.close() } catch {} }
    return { isDir: stats && stats.isDirectory ? stats.isDirectory() : false, isFile: stats && stats.isFile ? stats.isFile() : false, stats }
  } catch (error) {
    console.error("SFTP error:", error)
    return "sftp error"
  }
}


/**
 * @description This function uses SFTP to rename a remote file.
 * @param {string} oldPath - The remote path of the file to rename
 * @param {string} newPath - The new remote path of the file
 * @returns {{ success: boolean, error: string }} - Returns an object indicating success or failure with an error message.
 */
ipcMain.handle('renameRemoteFile', async (_event, { oldPath, newPath }) => {
  function sftpRename(sftp, oldPath, newPath) {
    return new Promise((resolve, reject) => {
      sftp.rename(oldPath, newPath, (err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  }

  const activeTunnel = getActiveTunnel()
  if (!activeTunnel) return { success: false, error: 'No active SSH tunnel' }
  return new Promise((resolve) => {
    activeTunnel.sftp(async (err, sftp) => {
      if (err) return resolve({ success: false, error: err.message })
      try {
        await sftpRename(sftp, oldPath, newPath)
        if (typeof sftp.end === 'function') sftp.end()
        resolve({ success: true })
      } catch (e) {
        if (typeof sftp.end === 'function') sftp.end()
        resolve({ success: false, error: e.message })
      }
    })
  })
})


/**
 * @description This function uses SFTP to delete a remote file.
 * @param {string} path - The remote path of the file to delete
 * @param {boolean} recursive - Whether do also delete all contents if the path is a directory
 * @returns {{ success: boolean, error: string }} - Returns an object indicating success or failure with an error message.
 */
ipcMain.handle('deleteRemoteFile', async (_event, { path, recursive = true }) => {
  const activeTunnel = getActiveTunnel()
  if (!activeTunnel) return { success: false, error: 'No active SSH tunnel' }

  function getSftp(callback) {
    if (!activeTunnel) return callback(new Error('No active SSH tunnel'))
    if (activeTunnel.sftp) {
      return activeTunnel.sftp(callback)
    } else if (activeTunnel.sshClient && activeTunnel.sshClient.sftp) {
      return activeTunnel.sshClient.sftp(callback)
    } else {
      return callback(new Error('No SFTP available'))
    }
  }

  // Helper: recursively delete files and folders
  async function sftpDeleteRecursive(sftp, targetPath) {
    // Stat the path to determine if file or directory
    const stats = await new Promise((res, rej) => {
      sftp.stat(targetPath, (err, stat) => {
        if (err) return rej(err)
        res(stat)
      })
    })
    if (stats.isDirectory()) {
      // List directory contents
      const entries = await new Promise((res, rej) => {
        sftp.readdir(targetPath, (err, list) => {
          if (err) return rej(err)
          res(list)
        })
      })
      // Recursively delete each entry
      for (const entry of entries) {
        if (entry.filename === '.' || entry.filename === '..') continue
        const entryPath = targetPath.replace(/[\\/]$/, '') + '/' + entry.filename
        await sftpDeleteRecursive(sftp, entryPath)
      }
      // Remove the directory itself
      await new Promise((res, rej) => {
        sftp.rmdir(targetPath, (err) => {
          if (err) return rej(err)
          res()
        })
      })
    } else {
      // Remove file
      await new Promise((res, rej) => {
        sftp.unlink(targetPath, (err) => {
          if (err) return rej(err)
          res()
        })
      })
    }
  }

  return new Promise((resolve) => {
    getSftp(async (err, sftp) => {
      if (err) return resolve({ success: false, error: err.message })
      let sftpClosed = false
      function closeSftp() {
        if (sftp && !sftpClosed) {
          if (typeof sftp.end === 'function') {
            try { sftp.end() } catch (e) {}
          } else if (typeof sftp.close === 'function') {
            try { sftp.close() } catch (e) {}
          }
          sftpClosed = true
        }
      }
      try {
        if (recursive) {
          await sftpDeleteRecursive(sftp, path)
        } else {
          // Non-recursive: try to delete as file, then as empty dir
          try {
            await new Promise((res, rej) => {
              sftp.unlink(path, (err) => err ? rej(err) : res())
            })
          } catch (e) {
            // If not a file, try as empty directory
            await new Promise((res, rej) => {
              sftp.rmdir(path, (err) => err ? rej(err) : res())
            })
          }
        }
        closeSftp()
        resolve({ success: true })
      } catch (e) {
        closeSftp()
        resolve({ success: false, error: e.message })
      }
    })
  })
})

/**
 * Cross-platform equivalent to path.dirname(): works for both '/' and '\\' separators.
 * @param {string} filePath - The path to extract the directory from.
 * @returns {string} Directory path
 */
export function remoteDirname(filePath) {
  if (!filePath) return ''
  // Always use forward slash for remote paths
  const normalized = filePath.replace(/\\/g, '/')
  const idx = normalized.lastIndexOf('/')
  if (idx === -1) return ''
  if (idx === 0) return '/'
  return normalized.slice(0, idx)
}

/**
 * Helper function to create a directory recursively using SFTP.
 * @param {Object} sftp - The SFTP client instance.
 * @param {string} fullPath - The path of the lowest-level directory to create, including all parent directories.
 */
async function sftpMkdirRecursive(sftp, fullPath) {
  // Always use forward slash for remote paths
  const normalized = fullPath.replace(/\\/g, '/')
  const sep = '/'
  const parts = normalized.split(sep).filter(Boolean)
  let current = normalized.startsWith(sep) ? sep : ''
  for (const part of parts) {
    current = current === sep ? current + part : current + sep + part
    try {
      // Try to stat the directory
      await new Promise((res, rej) => {
        sftp.stat(current, (err, stats) => {
          if (!err && stats && stats.isDirectory()) res()
          else rej()
        })
      })
    } catch {
      // Directory does not exist, try to create
      await new Promise((res, rej) => {
        sftp.mkdir(current, (err) => {
          if (!err) res()
          else rej(err)
        })
      })
    }
  }
}

/**
 * @description This request handler creates a new remote folder in the specified parent path.
 * @param {string} path - The parent path where the new folder will be created
 * @param {string} folderName - The name of the new folder to be created
 * @returns {Promise<{success: boolean, error?: string}>}
 */
ipcMain.handle('createRemoteFolder', async (_event, { path: parentPath, folderName, recursive = false }) => {
  const activeTunnel = getActiveTunnel()
  // Helper to get SFTP client
  function getSftp(cb) {
    if (!activeTunnel) return cb(new Error('No active SSH tunnel'))
    if (activeTunnel.sftp) {
      return activeTunnel.sftp(cb)
    } else if (activeTunnel.sshClient && activeTunnel.sshClient.sftp) {
      return activeTunnel.sshClient.sftp(cb)
    } else {
      return cb(new Error('No SFTP available'))
    }
  }
  // Normalize path for SFTP: always use absolute, default to home dir as '.'
  function normalizePath(p) {
    if (!p || p === '') return '.'
    if (p === '~') return '.'
    if (p.startsWith('~/')) return p.replace(/^~\//, '')
    // Always use forward slash for remote paths
    return p.replace(/\\/g, '/')
  }
  return new Promise((resolve) => {
    getSftp(async (err, sftp) => {
      if (err) return resolve({ success: false, error: err.message })
      let sftpClosed = false
      function closeSftp() {
        if (sftp && !sftpClosed) {
          if (typeof sftp.end === 'function') {
            try { sftp.end() } catch (e) {}
          } else if (typeof sftp.close === 'function') {
            try { sftp.close() } catch (e) {}
          }
          sftpClosed = true
        }
      }
      try {
        console.log('Creating folder', folderName, 'in', parentPath)
        const parent = normalizePath(parentPath)
        // Step 1: resolve canonical parent path
        let canonicalParent = await new Promise((res, rej) => {
          sftp.realpath(parent, (e, abs) => e ? res(parent) : res(abs))
        })
        // Step 2: build new folder path
        let newFolderPath = folderName ? canonicalParent.replace(/\/$/, '') + '/' + folderName : canonicalParent
        // Step 3: create directory
        if (recursive) {
          await sftpMkdirRecursive(sftp, newFolderPath)
        } else {
          await new Promise((res, rej) => {
            sftp.mkdir(newFolderPath, (e) => e ? rej(e) : res())
          })
        }
        closeSftp()
        console.log('Folder created successfully')
        resolve({ success: true })
      } catch (e) {
        closeSftp()
        console.error('Error creating remote folder:', e)
        resolve({ success: false, error: e.message })
      }
    })
  })
})


/**
 * @description This request handler manages the remote navigation of folders on the server.
 * @param {string} action - 'list' to display files and folders, 'up' to go back a directory or 'into' to enter it
 * @param {string} path - The remote path to navigate
 * @param {string} dirName - The name of the directory to enter (only used for 'into' action)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
ipcMain.handle('navigateRemoteDirectory', async (_event, { action, path: currentPath, dirName }) => {
  const activeTunnel = getActiveTunnel()
  // Helper to get SFTP client
  function getSftp(cb) {
    if (!activeTunnel) return cb(new Error('No active SSH tunnel'))
    if (activeTunnel.sftp) {
      // ssh2 v1.15+ attaches sftp method directly
      return activeTunnel.sftp(cb)
    } else if (activeTunnel.sshClient && activeTunnel.sshClient.sftp) {
      return activeTunnel.sshClient.sftp(cb)
    } else {
      return cb(new Error('No SFTP available'))
    }
  }

  // Promisified SFTP realpath
  function sftpRealpath(sftp, p) {
    return new Promise((resolve, reject) => {
      sftp.realpath(p, (err, absPath) => {
        if (err) return reject(err)
        resolve(absPath)
      })
    })
  }

  // Promisified SFTP readdir
  function sftpReaddir(sftp, p) {
    return new Promise((resolve, reject) => {
      sftp.readdir(p, (err, list) => {
        if (err) return reject(err)
        resolve(list)
      })
    })
  }

  // Normalize path for SFTP: always use absolute, default to home dir as '.'
  function normalizePath(p) {
    if (!p || p === '') return '.' // SFTP: '.' means home dir
    if (p === '~') return '.'
    if (p.startsWith('~/')) return p.replace(/^~\//, '')
    // Always use forward slash for remote paths
    return p.replace(/\\/g, '/')
  }

  return new Promise((resolve) => {
    getSftp(async (err, sftp) => {
      if (err) return resolve({ path: currentPath, contents: [], error: err.message })
      let targetPath = normalizePath(currentPath)
      let sftpClosed = false
      // Helper to close SFTP session safely
      function closeSftp() {
        if (sftp && !sftpClosed) {
          if (typeof sftp.end === 'function') {
            try { sftp.end() } catch (e) {}
          } else if (typeof sftp.close === 'function') {
            try { sftp.close() } catch (e) {}
          }
          sftpClosed = true
        }
      }
      try {
        // Step 1: resolve canonical path (absolute)
        let canonicalPath = await sftpRealpath(sftp, targetPath).catch(() => targetPath)
        // Step 2: handle navigation action
        if (action === 'up') {
          // Go up one directory
          if (canonicalPath === '/' || canonicalPath === '' || canonicalPath === '.') {
            // Already at root/home
            // List current
          } else {
            let parts = canonicalPath.split('/').filter(Boolean)
            if (parts.length > 1) {
              parts.pop()
              canonicalPath = '/' + parts.join('/')
            } else {
              canonicalPath = '/'
            }
          }
        } else if (action === 'into' && dirName) {
          // Always join using absolute path
          if (canonicalPath === '/' || canonicalPath === '') {
            canonicalPath = '/' + dirName
          } else if (canonicalPath === '.') {
            // Home dir: get its absolute path
            canonicalPath = await sftpRealpath(sftp, '.').catch(() => '/')
            canonicalPath = canonicalPath.replace(/\/$/, '') + '/' + dirName
          } else {
            canonicalPath = canonicalPath.replace(/\/$/, '') + '/' + dirName
          }
          // Re-resolve in case of symlinks
          canonicalPath = await sftpRealpath(sftp, canonicalPath).catch(() => canonicalPath)
        } else if (action === 'list') {
          // Just list current
        }
        // Step 3: list directory
        let entries = await sftpReaddir(sftp, canonicalPath).catch(() => [])
        let contents = Array.isArray(entries)
          ? entries.filter(e => e.filename !== '.' && e.filename !== '..').map(e => ({
              name: e.filename,
              type: e.attrs.isDirectory() ? 'dir' : 'file'
            }))
          : []
        closeSftp()
        resolve({ path: canonicalPath, contents })
      } catch (e) {
        closeSftp()
        resolve({ path: currentPath, contents: [], error: e.message })
      }
    })
  })
})

ipcMain.handle('startSSHTunnel', async (_event, params) => {
  return startSSHTunnel(params)
})

ipcMain.handle('confirmMongoTunnel', async (_event, loadBlocking ) => {
  return confirmMongoTunnel(loadBlocking)
})

ipcMain.handle('stopSSHTunnel', async () => {
  return stopSSHTunnel()
})

ipcMain.handle('getRemoteLStat', async (_event, path) => {
  return getRemoteLStat(path)
})

ipcMain.handle('checkRemoteFileExists', async (_event, path) => {
  return checkRemoteFileExists(path)
})

ipcMain.handle('setRemoteWorkspacePath', async (_event, path) => {
  return setRemoteWorkspacePath(path)
})

ipcMain.handle('startJupyterTunnel', async () => {
  return startPortTunnel({ name: 'jupyter', localPort: jupyterLocalPort, remotePort: jupyterRemotePort, ensureRemoteOpen: true })
})

/**
 * @description This request handler lists the contents of a remote directory on the server.
 * @param {string} path - The remote path of the folder to list
 * @returns {Promise<{success: boolean, error?: string}>}
 */
ipcMain.handle('listRemoteDirectory', async (_event, { path: remotePath }) => {
  return new Promise((resolve, reject) => {
    const activeTunnel = getActiveTunnel()
    if (!activeTunnel) {
      return resolve({ path: remotePath, contents: [], error: 'No active SSH tunnel' })
    }
    try {
      activeTunnel.sftp((err, sftp) => {
        if (err || !sftp) return resolve({ path: remotePath, contents: [], error: err ? err.message : 'No SFTP' })
        // Normalize path for SFTP: always use absolute, default to home dir as '.'
        function normalizePath(p) {
          if (!p || p === '') return '.' // SFTP: '.' means home dir
          if (p === '~') return '.'
          if (p.startsWith('~/')) return p.replace(/^~\//, '')
          // Always use forward slash for remote paths
          return p.replace(/\\/g, '/')
        }
        const targetPath = normalizePath(remotePath)
        // First, resolve canonical/absolute path
        sftp.realpath(targetPath, (err2, absPath) => {
          const canonicalPath = (!err2 && absPath) ? absPath : targetPath
          sftp.readdir(canonicalPath, (err3, list) => {
            // Always close SFTP session after use
            if (sftp && typeof sftp.end === 'function') {
              try { sftp.end() } catch (e) {}
            } else if (sftp && typeof sftp.close === 'function') {
              try { sftp.close() } catch (e) {}
            }
            if (err3) return resolve({ path: canonicalPath, contents: [], error: err3.message })
            const contents = Array.isArray(list)
              ? list.filter(e => e.filename !== '.' && e.filename !== '..').map(e => ({
                  name: e.filename,
                  type: e.attrs.isDirectory() ? 'dir' : 'file'
                }))
              : []
            resolve({ path: canonicalPath, contents })
          })
        })
      })
    } catch (e) {
      resolve({ path: remotePath, contents: [], error: e.message })
    }
  })
})

// SSH key management
ipcMain.handle('generateSSHKey', async (_event, { comment, username }) => {
  try {
    const userDataPath = app.getPath('userData')
    const privKeyPath = path.join(userDataPath, `${username || 'user'}_id_rsa`)
    const pubKeyPath = path.join(userDataPath, `${username || 'user'}_id_rsa.pub`)
    let privateKey, publicKey
    if (fs.existsSync(privKeyPath) && fs.existsSync(pubKeyPath)) {
      privateKey = fs.readFileSync(privKeyPath, 'utf8')
      publicKey = fs.readFileSync(pubKeyPath, 'utf8')
    } else {
      const result = await generateSSHKeyPair(comment, username)
      privateKey = result.privateKey
      publicKey = result.publicKey
      fs.writeFileSync(privKeyPath, privateKey, { mode: 0o600 })
      fs.writeFileSync(pubKeyPath, publicKey, { mode: 0o644 })
    }
    return { privateKey, publicKey }
  } catch (err) {
    return { error: err.message }
  }
})

ipcMain.handle('getSSHKey', async (_event, { username }) => {
  try {
    const userDataPath = app.getPath('userData')
    const privKeyPath = path.join(userDataPath, `${username || 'user'}_id_rsa`)
    const pubKeyPath = path.join(userDataPath, `${username || 'user'}_id_rsa.pub`)
    let privateKey, publicKey
    if (fs.existsSync(privKeyPath) && fs.existsSync(pubKeyPath)) {
      privateKey = fs.readFileSync(privKeyPath, 'utf8')
      publicKey = fs.readFileSync(pubKeyPath, 'utf8')
      return { privateKey, publicKey }
    } else {
      return { privateKey: '', publicKey: '' }
    }
  } catch (err) {
    return { error: err.message }
  }
})



//  ----- Unused -----
// export function getRemoteMongoDBPath() {
//   const remotePlatform = detectRemoteOS()

//   if (remotePlatform === "win32") {
//     // Check if mongod is in the process.env.PATH
//     const paths = process.env.PATH.split(path.delimiter)
//     for (let i = 0; i < paths.length; i++) {
//       const binPath = path.join(paths[i], "mongod.exe")
//       if (fs.existsSync(binPath)) {
//         console.log("mongod found in PATH")
//         return binPath
//       }
//     }
//     // Check if mongod is in the default installation path on Windows - C:\Program Files\MongoDB\Server\<version to establish>\bin\mongod.exe
//     const programFilesPath = process.env["ProgramFiles"]
//     if (programFilesPath) {
//       const mongoPath = path.join(programFilesPath, "MongoDB", "Server")
//       // Check if the MongoDB directory exists
//       if (!fs.existsSync(mongoPath)) {
//         console.error("MongoDB directory not found")
//         return null
//       }
//       const dirs = fs.readdirSync(mongoPath)
//       for (let i = 0; i < dirs.length; i++) {
//         const binPath = path.join(mongoPath, dirs[i], "bin", "mongod.exe")
//         if (fs.existsSync(binPath)) {
//           return binPath
//         }
//       }
//     }
//     console.error("mongod not found")
//     return null
//   } else if (process.platform === "darwin") {
//     // Check if it is installed in the .medomics directory
//     const binPath = path.join(process.env.HOME, ".medomics", "mongodb", "bin", "mongod")
//     if (fs.existsSync(binPath)) {
//       console.log("mongod found in .medomics directory")
//       return binPath
//     }
//     if (process.env.NODE_ENV !== "production") {
//       // Check if mongod is in the process.env.PATH
//       const paths = process.env.PATH.split(path.delimiter)
//       for (let i = 0; i < paths.length; i++) {
//         const binPath = path.join(paths[i], "mongod")
//         if (fs.existsSync(binPath)) {
//           console.log("mongod found in PATH")
//           return binPath
//         }
//       }
//       // Check if mongod is in the default installation path on macOS - /usr/local/bin/mongod
//       const binPath = "/usr/local/bin/mongod"
//       if (fs.existsSync(binPath)) {
//         return binPath
//       }
//     }
//     console.error("mongod not found")
//     return null
//   } else if (process.platform === "linux") {
//     // Check if mongod is in the process.env.PATH
//     const paths = process.env.PATH.split(path.delimiter)
//     for (let i = 0; i < paths.length; i++) {
//       const binPath = path.join(paths[i], "mongod")
//       if (fs.existsSync(binPath)) {
//         return binPath
//       }
//     }
//     console.error("mongod not found in PATH" + paths)
//     // Check if mongod is in the default installation path on Linux - /usr/bin/mongod
//     if (fs.existsSync("/usr/bin/mongod")) {
//       return "/usr/bin/mongod"
//     }
//     console.error("mongod not found in /usr/bin/mongod")

//     if (fs.existsSync("/home/" + process.env.USER + "/.medomics/mongodb/bin/mongod")) {
//       return "/home/" + process.env.USER + "/.medomics/mongodb/bin/mongod"
//     }
//     return null
//   } else {
//     return "mongod"
//   }
// }

// export function checkRemoteFolderExists(folderPath) {
//   // Ensure tunnel is active and SSH client is available
//   const tunnelObject = getActiveTunnel()
//   if (!tunnelObject) {
//     const errMsg = "No active SSH tunnel for remote folder creation."
//     console.error(errMsg)
//     return Promise.resolve("tunnel inactive")
//   }

//   return new Promise((resolve, reject) => {
//     tunnelObject.sftp((err, sftp) => {
//       if (err) {
//         console.error("SFTP error:", err)
//         resolve("sftp error")
//         return
//       }

//       // Check if folder exists
//       sftp.stat(folderPath, (statErr, stats) => {
//         if (!statErr && stats && stats.isDirectory()) {
//           // Folder exists
//           sftp.end && sftp.end()
//           resolve("exists")
//         } else {
//           resolve("does not exist")
//         }
//       })
//     })
//   })
// }