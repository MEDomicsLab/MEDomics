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
  remoteBackendExecutablePath = p
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
}

export function setTunnelState(info) {
  // Exclude password
  const { password, privateKey, ...safeInfo } = info
  tunnelInfo = { ...tunnelInfo, ...safeInfo, tunnelActive: safeInfo.tunnelActive }
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

// Helpers for managing remote backend (GO) server lifecycle
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
    if (remoteBackendExecutablePath) {
      // Verify it exists
      if (remoteOS === 'win32') {
        const r = await execRemote(conn, `powershell -NoProfile -Command "If (Test-Path '${remoteBackendExecutablePath.replace(/'/g, "''")}') { Write-Output '${remoteBackendExecutablePath.replace(/'/g, "''")}' }"`)
        if (r.stdout) return { path: remoteBackendExecutablePath }
      } else {
        const r = await execRemote(conn, `[ -x '${remoteBackendExecutablePath.replace(/'/g, "'\\''")}' ] && echo '${remoteBackendExecutablePath.replace(/'/g, "'\\''")}' || true`)
        if (r.stdout) return { path: remoteBackendExecutablePath }
      }
    }
    const home = await getRemoteHome(conn, remoteOS)
    if (remoteOS === 'win32') {
      const candidates = [
        `${home}\\.medomics\\MEDomicsLab\\go_executables\\server_go_win32.exe`,
        `${home}\\.medomics\\go_executables\\server_go_win32.exe`,
        `C:\\Program Files\\MEDomicsLab\\go_executables\\server_go_win32.exe`
      ]
      const ps = `powershell -NoProfile -Command "${candidates.map(p=>`If (Test-Path '${p.replace(/'/g, "''")}') { Write-Output '${p.replace(/'/g, "''")}'; exit }`).join(' ')}"`
      const r = await execRemote(conn, ps)
      if (r.stdout) return { path: r.stdout }
      const whereCmd = await execRemote(conn, 'where server_go_win32.exe')
      if (whereCmd.stdout) return { path: whereCmd.stdout.split(/\r?\n/)[0] }
    } else {
      const candidates = [
        `${home}/.medomics/MEDomicsLab/go_executables/server_go`,
        `${home}/.medomics/go_executables/server_go`,
        `${home}/MEDomicsLab/go_executables/server_go`
      ]
      const testCmd = candidates.map(p=>`[ -x '${p.replace(/'/g, "'\\''")}' ] && { echo '${p.replace(/'/g, "'\\''")}'; exit 0; }`).join(' ') + '; command -v server_go || true'
      const r = await execRemote(conn, `bash -lc "${testCmd}"`)
      if (r.stdout) return { path: r.stdout.split(/\r?\n/)[0] }
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
    let cmd
    if (remoteOS === 'win32') {
      if (isScript) {
        cmd = `powershell -NoProfile -Command "$env:PORT=${remotePort}; Start-Process -FilePath 'node' -ArgumentList '${exePath.replace(/'/g, "''")}' -WindowStyle Hidden -PassThru | Out-Null"`
      } else {
        cmd = `powershell -NoProfile -Command "$env:PORT=${remotePort}; Start-Process -FilePath '${exePath.replace(/'/g, "''")}' -WindowStyle Hidden -PassThru | Out-Null"`
      }
    } else {
      if (isScript) {
        cmd = `bash -lc 'export PORT=${remotePort}; nohup node "${exePath.replace(/"/g, '\\"')}" >/dev/null 2>&1 < /dev/null & echo $!'`
      } else {
        cmd = `bash -lc 'export PORT=${remotePort}; nohup "${exePath.replace(/"/g, '\\"')}" >/dev/null 2>&1 < /dev/null & echo $!'`
      }
    }
    const r = await execRemote(conn, cmd)
    if (r && r.stderr && r.stderr.trim() && !r.stdout) {
      return { success: false, status: 'failed-to-start', error: r.stderr.trim() }
    }
    // Poll for port to open
    await sleep(800)
    const maxAttempts = 15
    for (let i = 0; i < maxAttempts; i++) {
      const open = await checkRemotePortOpen(conn, remotePort)
      if (open) return { success: true, status: 'express-running' }
      await sleep(600)
    }
    return { success: false, status: 'timeout', error: `Express did not open port ${remotePort} in time` }
  } catch (e) {
    return { success: false, status: 'failed-to-start', error: e && e.message ? e.message : String(e) }
  }
}

function sleep(ms){ return new Promise(r=>setTimeout(r, ms)) }

async function detectRemoteArch(conn, remoteOS) {
  try {
    if (remoteOS === 'win32') {
      const r = await execRemote(conn, 'powershell -NoProfile -Command "$env:PROCESSOR_ARCHITECTURE"')
      const a = (r.stdout || '').trim().toLowerCase()
      if (a.includes('arm64') || a.includes('aarch64')) return 'arm64'
      return 'x64'
    } else {
      const r = await execRemote(conn, 'uname -m || true')
      const a = (r.stdout || '').trim().toLowerCase()
      if (a.includes('arm64') || a.includes('aarch64')) return 'arm64'
      if (a.includes('x86_64') || a.includes('amd64')) return 'x64'
      return 'x64'
    }
  } catch {
    return 'x64'
  }
}

function mapOsKey(remoteOS) {
  // Map Node-like OS ids to manifest os keys
  if (remoteOS === 'win32') return ['windows', 'win32']
  if (remoteOS === 'darwin') return ['darwin', 'macos', 'osx']
  return ['linux']
}

function selectAssetForRemote(manifest, remoteOS, remoteArch) {
  const assets = (manifest && manifest.assets) || []
  const osKeys = mapOsKey(remoteOS)
  const first = assets.find(a => osKeys.includes(String(a.os||'').toLowerCase()) && (!a.arch || String(a.arch).toLowerCase() === remoteArch))
  return first || null
}

function sendInstallProgress(payload) {
  try { mainWindow && mainWindow.webContents && mainWindow.webContents.send('remoteBackendInstallProgress', payload) } catch {}
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
    // 1) Ensure Express is reachable on remote targetPort
    let isOpen = await checkRemotePortOpen(conn, targetPort)
    if (!isOpen) {
      const remoteOS = await detectRemoteOS()
      const exePath = getRemoteBackendExecutablePath()
      if (!exePath) {
        return { success: false, status: 'not-found', action: 'locate-or-install', error: 'Express not running and no remote path set' }
      }
      const startRes = await startRemoteBackend(conn, remoteOS, exePath, targetPort)
      if (!startRes.success) {
        return startRes
      }
      // Double-check
      isOpen = await checkRemotePortOpen(conn, targetPort)
      if (!isOpen) {
        return { success: false, status: 'timeout', error: `Express did not open port ${targetPort}` }
      }
    }

    // 2) Ask Express (reachable through the tunnel at localPort) to start GO
    try {
      const url = `http://127.0.0.1:${localPort}/run-go-server`
      const res = await axios.post(url, {})
      if (res && res.status >= 200 && res.status < 300) {
        return { success: true, status: 'running', message: 'Express running; GO start requested via backend', port: targetPort }
      }
      return { success: false, status: 'go-start-failed', error: `Unexpected status ${res && res.status}` }
    } catch (err) {
      return { success: false, status: 'go-start-error', error: err && err.message ? err.message : 'Failed to call /run-go-server' }
    }
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

ipcMain.handle('startRemoteBackendUsingPath', async (_event, { path: exePath, port }) => {
  const conn = getActiveTunnel()
  if (!conn) return { success: false, error: 'No active SSH tunnel' }
  const remoteOS = await detectRemoteOS()
  const res = await startRemoteBackend(conn, remoteOS, exePath, port || (getTunnelState().remoteExpressPort))
  return res
})

ipcMain.handle('installRemoteBackendFromURL', async (_event, { manifestUrl, version } = {}) => {
  const conn = getActiveTunnel()
  if (!conn) return { success: false, error: 'No active SSH tunnel' }
  try {
    if (!manifestUrl) return { success: false, error: 'missing-manifest-url' }
    sendInstallProgress({ phase: 'fetch-manifest', manifestUrl })
    const { data: manifest } = await axios.get(manifestUrl, { timeout: 30000 })
    const manifestVersion = version || manifest?.version
    if (!manifestVersion) return { success: false, error: 'no-version-in-manifest' }

    const remoteOS = await detectRemoteOS()
    const remoteArch = await detectRemoteArch(conn, remoteOS)
    const asset = selectAssetForRemote(manifest, remoteOS, remoteArch)
    if (!asset) return { success: false, error: 'no-asset-for-remote', details: { remoteOS, remoteArch } }
    const url = asset.url
    const expectedSha = (asset.sha256||'').trim().toLowerCase()
    if (!url) return { success: false, error: 'asset-has-no-url' }

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
    sendInstallProgress({ phase: 'download-start', url, remoteDownloadPath })
    if (remoteOS === 'win32') {
      const ps = `powershell -NoProfile -Command "Invoke-WebRequest -Uri '${url.replace(/'/g, "''")}' -OutFile '${remoteDownloadPath.replace(/'/g, "''")}' -UseBasicParsing"`
      const r = await execRemote(conn, ps)
      if (r.code !== 0 && r.stderr) return { success: false, error: 'download-failed', details: r.stderr }
    } else {
      const sh = `bash -lc "curl -L --fail -o '${remoteDownloadPath.replace(/'/g, "'\\''")}' '${url.replace(/'/g, "'\\''")}'"`
      const r = await execRemote(conn, sh)
      if (r.code !== 0 && r.stderr) return { success: false, error: 'download-failed', details: r.stderr }
    }
    sendInstallProgress({ phase: 'download-complete', remoteDownloadPath })

    // Verify SHA256
    if (expectedSha) {
      sendInstallProgress({ phase: 'verify-start' })
      if (remoteOS === 'win32') {
        const r = await execRemote(conn, `powershell -NoProfile -Command "(Get-FileHash -Algorithm SHA256 '${remoteDownloadPath.replace(/'/g, "''")}').Hash"`)
        const actual = (r.stdout||'').trim().toLowerCase()
        if (!actual || actual !== expectedSha) return { success: false, error: 'checksum-mismatch', expectedSha, actual }
      } else {
        // Prefer sha256sum, fallback to shasum
        const r = await execRemote(conn, `bash -lc "if command -v sha256sum >/dev/null 2>&1; then sha256sum '${remoteDownloadPath.replace(/'/g, "'\\''")}' | awk '{print $1}'; else shasum -a 256 '${remoteDownloadPath.replace(/'/g, "'\\''")}' | awk '{print $1}'; fi"`)
        const actual = (r.stdout||'').trim().toLowerCase()
        if (!actual || actual !== expectedSha) return { success: false, error: 'checksum-mismatch', expectedSha, actual }
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
        if (r.code !== 0 && r.stderr) return { success: false, error: 'extract-failed', details: r.stderr }
      } else {
        // Attempt tar if available (Windows 10+)
        const r = await execRemote(conn, `tar -xf "${remoteDownloadPath}" -C "${versionDir}" 2>&1 || powershell -NoProfile -Command "throw 'Unsupported archive format'"`)
        if (r.code !== 0 && r.stderr) return { success: false, error: 'extract-failed', details: r.stderr }
      }
    } else {
      if (fileName.toLowerCase().endsWith('.tar.gz') || fileName.toLowerCase().endsWith('.tgz')) {
        const r = await execRemote(conn, `bash -lc "tar -xzf '${remoteDownloadPath.replace(/'/g, "'\\''")}' -C '${versionDir.replace(/'/g, "'\\''")}'"`)
        if (r.code !== 0 && r.stderr) return { success: false, error: 'extract-failed', details: r.stderr }
      } else if (fileName.toLowerCase().endsWith('.zip')) {
        const r = await execRemote(conn, `bash -lc "unzip -o '${remoteDownloadPath.replace(/'/g, "'\\''")}' -d '${versionDir.replace(/'/g, "'\\''")}'"`)
        if (r.code !== 0 && r.stderr) return { success: false, error: 'extract-failed', details: r.stderr }
      } else {
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
    if (!exePath) return { success: false, error: 'executable-not-found' }
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
        // Express (backend) port forwarding
        // Backward compatibility mapping
        if (!localExpressPort && localBackendPort) localExpressPort = localBackendPort
        if (!remoteExpressPort && remoteBackendPort) remoteExpressPort = remoteBackendPort
        const expressServer = net.createServer((socket) => {
          conn.forwardOut(socket.localAddress || "127.0.0.1", socket.localPort || 0, "127.0.0.1", parseInt(remoteExpressPort), (err, stream) => {
            if (err) {
              console.error(err)
              socket.destroy()
              return
            }
            socket.pipe(stream).pipe(socket)
          })
        })
        expressServer.listen(localExpressPort, "127.0.0.1")
        expressServer.on("error", (e) => {
          conn.end()
          console.error("Connection to Express server error:", e)
          reject(new Error("Express local server error: " + e.message))
        })
        // Optional GO forwarding if provided
        let goServer = null
        if (remoteGoPort && localGoPort) {
          goServer = net.createServer((socket) => {
            conn.forwardOut(socket.localAddress || "127.0.0.1", socket.localPort || 0, "127.0.0.1", parseInt(remoteGoPort), (err, stream) => {
              if (err) {
                console.error(err)
                socket.destroy()
                return
              }
              socket.pipe(stream).pipe(socket)
            })
          })
          goServer.listen(localGoPort, "127.0.0.1")
          goServer.on("error", (e) => {
            console.warn("GO forwarding server error:", e.message)
          })
        }

        setActiveTunnel(conn)
        setActiveTunnelServer({ expressServer, goServer })
        resolve({ success: true })
      })
      .on("error", (err) => {
        reject(new Error("SSH connection error: " + err.message))
      })
      .connect(connConfig)
  })
}

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
    // Windows: use netstat and findstr
    checkCmd = `netstat -an | findstr :${port}`
  } else {
    // Linux/macOS: use ss or netstat/grep
    checkCmd = `bash -c "command -v ss >/dev/null 2>&1 && ss -ltn | grep :${port} || netstat -an | grep LISTEN | grep :${port}" || netstat -an | grep :${port}`
  }
  return new Promise((resolve, reject) => {
    conn.exec(checkCmd, (err, stream) => {
      if (err) {
        console.log("SSH exec error:", err)
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
        resolve(found)
      })
    })
  })
}

/**
 * @description Starts the MongoDB port forwarding tunnel using an existing SSH connection.
 * Checks if the remote port is open before creating the tunnel, with retries.
 * @returns {Promise<{success: boolean}>}
 */
export async function startMongoTunnel() {
  mainWindow.webContents.send("setSidebarLoading", { processing: true, message: "Starting MongoDB Tunnel..." })
  return new Promise(async (resolve, reject) => {
    const conn = getActiveTunnel()
    if (!conn) {
      reject(new Error("No active SSH connection for MongoDB tunnel."))
    }

    // Retry logic: up to 5 times, 3s delay
    let portOpen = false
    let attempts = 0
    const maxAttempts = 5
    const delayMs = 3000
    while (attempts < maxAttempts && !portOpen) {
      try {
        console.log(`Checking if remote MongoDB port ${mongoDBRemotePort} is open...`)
        portOpen = await checkRemotePortOpen(conn, mongoDBRemotePort)
      } catch (e) {
        // If SSH command fails, treat as not open
        portOpen = false
      }
      if (!portOpen) {
        attempts++
        if (attempts < maxAttempts) {
          await new Promise((res) => setTimeout(res, delayMs))
        }
      }
    }
    if (!portOpen) {
      reject(new Error(`MongoDB server is not listening on remote port ${mongoDBRemotePort} after ${maxAttempts} attempts.`))
    }

    // If mongoServer already exists, close it first
    if (activeTunnelServer && activeTunnelServer.mongoServer) {
      try {
        activeTunnelServer.mongoServer.close()
      } catch {}
    }
    const mongoServer = net.createServer((socket) => {
      conn.forwardOut(socket.localAddress || "127.0.0.1", socket.localPort || 0, "127.0.0.1", parseInt(mongoDBRemotePort), (err, stream) => {
        if (err) {
          console.error(err)
          socket.destroy()
          return
        }
        socket.pipe(stream).pipe(socket)
      })
    })
    mongoServer.listen(mongoDBLocalPort, "127.0.0.1")

    mongoServer.on("error", (e) => {
      conn.end()
      console.error("Connection to backend Mongo error:", e)
      reject(new Error("Mongo local server error: " + e.message))
    })

    // Update activeTunnelServer to include mongoServer
    setActiveTunnelServer({
      ...(activeTunnelServer || {}),
      mongoServer: mongoServer
    })
    resolve({ success: true })
  })
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
  return new Promise((resolve, reject) => {
    // Check the value of activeTunnelServer.mongoServer every 3000 ms, up to 10 times
    let attempts = 0
    const maxAttempts = 10
    const interval = setInterval(() => {
      if (activeTunnelServer && activeTunnelServer.mongoServer) {
        clearInterval(interval)
        console.log("MongoDB tunnel is active and listening.")
        resolve({ success: true })
      } else {
        attempts++
        if (attempts >= maxAttempts) {
          clearInterval(interval)
          reject({ success: false, error: "MongoDB tunnel is not listening after multiple attempts." })
        }
      }
    }, 3000)
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
  if (success) return { success: true }
  return { success: false, error: error || "No active tunnel" }
}

/**
 * @description Starts the Jupyter port forwarding tunnel using an existing SSH connection.
 * Checks if the remote port is open before creating the tunnel, with retries.
 * @returns {Promise<{success: boolean}>}
 */
export async function startJupyterTunnel() {
  return new Promise(async (resolve, reject) => {
    const conn = getActiveTunnel()
    if (!conn) {
      reject(new Error("No active SSH connection for Jupyter tunnel."))
    }

    // If jupyterServer already exists, return
    if (activeTunnelServer && activeTunnelServer.jupyterServer) {
      resolve({ success: true })
    }

    // Retry logic: up to 5 times, 3s delay
    let portOpen = false
    let attempts = 0
    const maxAttempts = 5
    const delayMs = 3000
    while (attempts < maxAttempts && !portOpen) {
      try {
        console.log(`Checking if remote Jupyter port ${jupyterRemotePort} is open...`)
        portOpen = await checkRemotePortOpen(conn, jupyterRemotePort)
      } catch (e) {
        // If SSH command fails, treat as not open
        portOpen = false
      }
      if (!portOpen) {
        attempts++
        if (attempts < maxAttempts) {
          await new Promise((res) => setTimeout(res, delayMs))
        }
      }
    }
    if (!portOpen) {
      reject(new Error(`Jupyter server is not listening on remote port ${jupyterRemotePort} after ${maxAttempts} attempts.`))
    }

    const jupyterServer = net.createServer((socket) => {
      conn.forwardOut(socket.localAddress || "127.0.0.1", socket.localPort || 0, "127.0.0.1", parseInt(jupyterRemotePort), (err, stream) => {
        if (err) {
          console.error(err)
          socket.destroy()
          return
        }
        socket.pipe(stream).pipe(socket)
      })
    })
    jupyterServer.listen(jupyterLocalPort, "127.0.0.1")

    jupyterServer.on("error", (e) => {
      conn.end()
      console.error("Connection to backend Mongo error:", e)
      reject(new Error("Mongo local server error: " + e.message))
    })

    // Update activeTunnelServer to include jupyterServer
    setActiveTunnelServer({
      ...(activeTunnelServer || {}),
      jupyterServer: jupyterServer
    })
    resolve({ success: true })
  })
}


/**
 * @description This function uses SFTP to check if a file exists at the given remote path.
 * @param {string} filePath - The remote path of the file to check
 * @returns {string>} - Status of the file existence check: "exists", "does not exist", "sftp error", or "tunnel inactive"
 */
export async function checkRemoteFileExists(filePath) {
  // Ensure tunnel is active and SSH client is available
  const activeTunnel = getActiveTunnel()
  if (!activeTunnel) {
    const errMsg = 'No active SSH tunnel for remote file check.'
    console.error(errMsg)
    return "tunnel inactive"
  }

  const getSftp = () => new Promise((resolve, reject) => {
    activeTunnel.sftp((err, sftp) => {
      if (err) return reject(err)
      resolve(sftp)
    })
  })

  const statFile = (sftp, filePath) => new Promise((resolve, reject) => {
    sftp.stat(filePath, (err, stats) => {
      if (err) return resolve(false) // File does not exist
      const exists = stats && ((stats.isFile && stats.isFile()) || (stats.isDirectory && stats.isDirectory()))
      resolve(exists)
    })
  })

  try {
    const sftp = await getSftp()
    const exists = await statFile(sftp, filePath)
    sftp.end && sftp.end()
    if (exists) {
      return "exists"
    } else {
      return "does not exist"
    }
  } catch (error) {
    console.error("SFTP error:", error)
    return "sftp error"
  }
}

/**
 * @description This function uses SFTP to call lstat on a remote file path.
 * @param {string} filePath - The remote path of the file to check
 * @returns {{ isDir: boolean, isFile: boolean, stats: Object } | string} - Returns an object with file stats or "sftp error" if an error occurs.
 */
export async function getRemoteLStat(filePath) {
  // Ensure tunnel is active and SSH client is available
  const activeTunnel = getActiveTunnel()
  if (!activeTunnel) {
    const errMsg = 'No active SSH tunnel for remote lstat.'
    console.error(errMsg)
    return null
  }
    const getSftp = () => new Promise((resolve, reject) => {
    activeTunnel.sftp((err, sftp) => {
      if (err) return reject(err)
      resolve(sftp)
    })
  })

  const lstatFile = (sftp, filePath) => new Promise((resolve, reject) => {
    sftp.stat(filePath, (err, stats) => {
      if (err) return reject(err) // File does not exist
      resolve(stats)
    })
  })

  try {
    const sftp = await getSftp()
    const fileStats = await lstatFile(sftp, filePath)
    sftp.end && sftp.end()
    return { isDir: fileStats.isDirectory(), isFile: fileStats.isFile(), stats: fileStats }
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
 * @description This function uses a terminal command to detect the operating system of the remote server.
 * @returns {Promise<string>}
 */
export async function detectRemoteOS() {
  return new Promise((resolve, reject) => {
    activeTunnel.exec("uname -s", (err, stream) => {
      if (err) {
        // Assume Windows if uname fails
        resolve("win32")
        return
      }
      let output = ""
      stream.on("data", (outputData) => {
        output += outputData.toString()
      })
      stream.on("close", () => {
        const out = output.trim().toLowerCase()
        if (out.includes("linux")) {
          resolve("linux")
        } else if (out.includes("darwin")) {
          resolve("darwin")
        } else if (out.includes("bsd")) {
          resolve("unix")
        } else {
          resolve("win32")
        }
      })
      stream.stderr.on("data", () => resolve("win32"))
    })
  })
}

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

ipcMain.handle('startMongoTunnel', async () => {
  return startMongoTunnel()
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
  return startJupyterTunnel()
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