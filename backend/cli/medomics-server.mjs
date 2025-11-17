#!/usr/bin/env node
// MEDomics Server CLI scaffold
// Provides headless management commands for the backend: start, status, ensure, install (stub), upgrade (stub)
// This is an initial scaffold; many operations are stubs to be filled in later.

import path from 'path'
import fs from 'fs'
import os from 'os'
import { fork } from 'child_process'
import http from 'http'
// no __filename/__dirname needed in this scaffold
// Removed __dirname and unused port range constants in scaffold to satisfy lint
function resolveExpressServerPath() {
  // Primary: cwd/backed/expressServer.mjs (original behavior)
  const candidates = []
  const cwdCandidate = path.resolve(process.cwd(), 'backend', 'expressServer.mjs')
  candidates.push(cwdCandidate)
  // Fallback: relative to this CLI file location (supports being invoked from other working dirs)
  try {
    const cliDirUrl = new URL('.', import.meta.url)
    let cliDir = cliDirUrl.pathname
    // On Windows the pathname may start with /C:/ ... strip leading slash if path like /C:/
    if (process.platform === 'win32' && /^\/[a-zA-Z]:\//.test(cliDir)) cliDir = cliDir.slice(1)
    const relCandidate = path.resolve(cliDir, '..', 'expressServer.mjs')
    candidates.push(relCandidate)
  } catch (e) { /* ignore URL resolution errors */ }
  // Environment override: MEDOMICS_SERVER_ROOT (useful for tests)
  if (process.env.MEDOMICS_SERVER_ROOT) {
    candidates.push(path.resolve(process.env.MEDOMICS_SERVER_ROOT, 'backend', 'expressServer.mjs'))
    candidates.push(path.resolve(process.env.MEDOMICS_SERVER_ROOT, 'expressServer.mjs'))
  }
  // Return first existing
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return c
    } catch (e) { /* ignore fs errors */ }
  }
  return candidates[0] // fall back to primary even if missing (caller will error out)
}
function getStateFile(flags) {
  const raw = flags['state-file'] ?? flags['stateFile']
  const hasValidString = typeof raw === 'string' && raw.trim().length > 0
  const f = hasValidString ? raw : null
  const defaultState = path.resolve(os.homedir(), '.medomics', 'medomics-server', 'state.json')
  const p = f ? path.resolve(f) : defaultState
  return p
}

function log(msg) {
  if (!process.env.JSON) console.log(msg)
}

function writeStateAt(stateFile, state) {
  try { fs.mkdirSync(path.dirname(stateFile), { recursive: true }) } catch (e) { /* ignore */ }
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2))
}

function readStateAt(stateFile) {
  if (!fs.existsSync(stateFile)) return null
  try { return JSON.parse(fs.readFileSync(stateFile, 'utf-8')) } catch { return null }
}

function parseArgs(argv) {
  const args = argv.slice(2)
  const flags = {}
  let command = null
  const positionals = []
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (!command && !a.startsWith('-')) { command = a; continue }
    if (a.startsWith('--')) {
      const body = a.slice(2)
      const eq = body.indexOf('=')
      if (eq !== -1) {
        const k = body.slice(0, eq)
        const v = body.slice(eq + 1)
        flags[k] = v
      } else {
        // Support space-delimited values: --key value
        const k = body
        const next = args[i + 1]
        if (next && !next.startsWith('-')) {
          flags[k] = next
          i++
        } else {
          flags[k] = true
        }
      }
    } else {
      positionals.push(a)
    }
  }
  return { command, flags, positionals }
}

async function httpGet(port, pathName) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path: pathName, method: 'GET' }, res => {
      let data=''
      res.on('data', d=> data+=d)
      res.on('end', ()=> {
        try { resolve(JSON.parse(data)) } catch { resolve({ raw: data }) }
      })
    })
    req.on('error', reject)
    req.end()
  })
}

async function httpPost(port, pathName, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body||{})
    const req = http.request({ hostname: '127.0.0.1', port, path: pathName, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } }, res => {
      let data=''
      res.on('data', d=> data+=d)
      res.on('end', ()=> {
        try { resolve(JSON.parse(data)) } catch { resolve({ raw: data }) }
      })
    })
    req.on('error', reject)
    req.write(payload)
    req.end()
  })
}

async function startCommand(flags) {
  const stateFile = getStateFile(flags)
  const existing = readStateAt(stateFile)
  if (existing?.running) {
    if (existing.pid && pidIsAlive(existing.pid)) {
      console.error('Server already running (state file present). Use status or stop.')
      process.exit(1)
    } else {
      // Stale state file; remove and proceed to start fresh
      try { fs.unlinkSync(stateFile) } catch (e) { /* ignore unlink errors */ }
    }
  }
  const expressServerPath = resolveExpressServerPath()
  if (!fs.existsSync(expressServerPath)) {
    console.error('expressServer.mjs not found at expected path: ' + expressServerPath)
    process.exit(1)
  }
  log('Starting MEDomics Express server...')
  // Create placeholder state so the file exists even if startup fails early
  try {
    writeStateAt(stateFile, { starting: true, pid: null, expressPort: null, created: new Date().toISOString() })
  } catch (e) {
    // Best-effort; continue even if we can't write state yet
  }
  // Prepare log capture (tail) and file logging
  const stateDir = path.dirname(stateFile)
  const logFilePath = path.resolve(stateDir, 'server-child.log')
  const appendLog = (prefix, data) => {
    try { fs.appendFileSync(logFilePath, `[${new Date().toISOString()}] ${prefix}: ${data}`) } catch (e) { /* ignore */ }
  }
  const maxTail = 65536
  let stdoutTail = ''
  let stderrTail = ''
  const addTail = (cur, chunk) => {
    cur += chunk
    if (cur.length > maxTail) cur = cur.slice(cur.length - maxTail)
    return cur
  }

  // Use silent fork to capture stdout/stderr, then mirror to console
  const child = fork(expressServerPath, [], { silent: true, env: { ...process.env, NODE_ENV: flags.production ? 'production' : (process.env.NODE_ENV||'development') } })
  if (child.stdout) {
    child.stdout.on('data', (d) => {
      const s = d.toString()
      stdoutTail = addTail(stdoutTail, s)
      try { process.stdout.write(s) } catch (e) { /* ignore write error */ }
      appendLog('stdout', s)
    })
  }
  if (child.stderr) {
    child.stderr.on('data', (d) => {
      const s = d.toString()
      stderrTail = addTail(stderrTail, s)
      try { process.stderr.write(s) } catch (e) { /* ignore write error */ }
      appendLog('stderr', s)
    })
  }
  const timeoutMs = parseInt(flags.timeout||'15000',10)
  let settled = false
  child.on('message', async (msg) => {
    if (settled) return
    if (msg && msg.type === 'EXPRESS_PORT') {
      settled = true
      const state = { running: true, pid: child.pid, expressPort: msg.expressPort, started: new Date().toISOString() }
      writeStateAt(stateFile, state)
      // Always emit a JSON line that background.js can parse
      process.stdout.write(JSON.stringify({ success: true, state, expressPort: state.expressPort })+'\n')
      if (!flags.json) {
        log('Express started on port ' + msg.expressPort)
      }
    }
  })
  child.on('exit', code => {
    if (!settled) {
      console.error('Express server exited prematurely with code', code)
      try {
        const prev = readStateAt(stateFile) || {}
        writeStateAt(stateFile, { ...prev, running: false, failed: true, code: code||1, ended: new Date().toISOString(), lastStdout: stdoutTail, lastStderr: stderrTail, expressPath: expressServerPath, cwd: process.cwd(), node: process.version })
      } catch (e) { /* ignore state write error */ }
      process.exit(code||1)
    }
  })
  // Fallback timeout
  setTimeout(() => {
    if (!settled) {
      console.error('Timed out waiting for Express port message')
      try { child.kill() } catch (e) { /* ignore kill errors */ }
      try {
        const prev = readStateAt(stateFile) || {}
        writeStateAt(stateFile, { ...prev, running: false, failed: true, timeout: true, waitedMs: timeoutMs, ended: new Date().toISOString(), lastStdout: stdoutTail, lastStderr: stderrTail, expressPath: expressServerPath, cwd: process.cwd(), node: process.version })
      } catch (e) { /* ignore state write error */ }
      process.exit(1)
    }
  }, timeoutMs)
}

async function statusCommand(flags) {
  const stateFile = getStateFile(flags)
  const state = readStateAt(stateFile)
  if (!state?.expressPort) {
    console.error('No running state found (start not invoked or state file missing).')
    process.exit(1)
  }
  try {
    const status = await httpGet(state.expressPort, '/status')
    const out = { success: true, pid: state.pid, expressPort: state.expressPort, status }
    process.stdout.write(JSON.stringify(out, null, flags.json?0:2)+'\n')
  } catch (e) {
    console.error('Failed to query status:', e.message)
    process.exit(1)
  }
}

async function ensureCommand(flags) {
  const stateFile = getStateFile(flags)
  const state = readStateAt(stateFile)
  if (!state?.expressPort) {
    console.error('Cannot ensure services: server not started.')
    process.exit(1)
  }
  const port = state.expressPort
  const result = {}
  try {
    if (flags.go) result.go = await httpPost(port, '/ensure-go', {})
    if (flags.mongo) result.mongo = await httpPost(port, '/ensure-mongo', { workspacePath: flags.workspace })
    if (flags.jupyter) result.jupyter = await httpPost(port, '/ensure-jupyter', { workspacePath: flags.workspace })
    process.stdout.write(JSON.stringify({ success: true, ensured: result }, null, flags.json?0:2)+'\n')
  } catch (e) {
    console.error('Ensure failed:', e.message)
    process.exit(1)
  }
}

async function installCommand(flags) {
  // Option 1 implementation: drive existing Express endpoints
  // 1) Ensure Express is running (start if no state)
  const stateFile = getStateFile(flags)
  let state = readStateAt(stateFile)
  if (!state?.expressPort) {
    log('Express not started (no state found). Starting...')
    await startCommand({ ...flags })
    // re-read state after start
    state = readStateAt(stateFile)
  }
  if (!state?.expressPort) {
    console.error('Failed to obtain Express port after start.')
    process.exit(1)
  }
  const port = state.expressPort

  const summary = { actions: [], initial: null, final: null }

  // 2) Check current requirements
  try {
    const check = await httpGet(port, '/check-requirements')
    summary.initial = check
  } catch (e) {
    console.error('check-requirements failed:', e.message)
    process.exit(1)
  }

  const init = summary.initial?.result || summary.initial

  // Helpers to detect missing components tolerant to schema differences
  const needsMongo = () => {
    if (!init) return true
    const candidates = [
      init.mongo?.installed,
      init.mongo?.ok,
      init.mongoInstalled,
      init.mongo_ok,
      init.mongo
    ]
    for (const v of candidates) {
      if (v === true) return false
      if (v === false) return true
    }
    return true
  }

  const needsPythonEnv = () => {
    if (!init) return true
    const candidates = [
      init.python?.installed,
      init.python?.ok,
      init.pythonEnv?.installed,
      init.pythonInstalled,
      init.python_ok,
      init.python
    ]
    for (const v of candidates) {
      if (v === true) return false
      if (v === false) return true
    }
    return true
  }

  const needsPythonPackages = () => {
    if (!init) return true
    const candidates = [
      init.python?.packagesOk,
      init.pythonPackages?.ok,
      init.pythonPackagesOk,
    ]
    for (const v of candidates) {
      if (v === true) return false
      if (v === false) return true
    }
    return true
  }

  // 3) Install MongoDB if needed
  try {
    if (needsMongo()) {
      if (!flags.json) console.log('Installing MongoDB...')
      const r = await httpPost(port, '/install-mongo', {})
      summary.actions.push({ step: 'install-mongo', response: r })
    }
  } catch (e) {
    console.error('install-mongo failed:', e.message)
    process.exit(1)
  }

  // 4) Install Python env and packages if needed
  try {
    if (needsPythonEnv()) {
      if (!flags.json) console.log('Installing bundled Python environment...')
      const r = await httpPost(port, '/install-bundled-python', {})
      summary.actions.push({ step: 'install-bundled-python', response: r })
    }
  } catch (e) {
    console.error('install-bundled-python failed:', e.message)
    process.exit(1)
  }

  try {
    if (needsPythonPackages()) {
      if (!flags.json) console.log('Installing required Python packages...')
      const r = await httpPost(port, '/install-required-python-packages', {})
      summary.actions.push({ step: 'install-required-python-packages', response: r })
    }
  } catch (e) {
    console.error('install-required-python-packages failed:', e.message)
    process.exit(1)
  }

  // 5) Re-check requirements and print summary
  try {
    const final = await httpGet(port, '/check-requirements')
    summary.final = final
  } catch (e) {
    console.error('final check-requirements failed:', e.message)
    process.exit(1)
  }

  process.stdout.write(JSON.stringify({ success: true, install: summary }, null, flags.json?0:2)+'\n')
}

async function upgradeCommand(flags) {
  // Placeholder: Would fetch manifest, compare versions, download, verify, extract.
  process.stdout.write(JSON.stringify({ success: true, message: 'Upgrade stub – implement manifest-driven update.' }, null, flags.json?0:2)+'\n')
}

async function main() {
  const { command, flags } = parseArgs(process.argv)
  if (!command || flags.help) {
    console.log(`MEDomics Server CLI
Usage: medomics-server <command> [flags]

Commands:
  start                 Start Express backend
  stop                  Stop the running backend
  status                Show JSON status snapshot
  ensure [--go --mongo --jupyter --workspace PATH]
  install               Install dependencies (stub)
  upgrade               Upgrade server (stub)

Flags:
  --workspace=PATH      Workspace root for ensure operations
  --timeout=MS          Startup timeout (default 15000)
  --json                Emit compact JSON outputs
  --production          Set NODE_ENV=production
  --state-file=PATH     Path to state file (default ./medomics-server-state.json)
  --help                Display this help
`)
    process.exit(0)
  }
  switch (command) {
    case 'start': return startCommand(flags)
    case 'status': return statusCommand(flags)
    case 'ensure': return ensureCommand(flags)
    case 'install': return installCommand(flags)
    case 'upgrade': return upgradeCommand(flags)
    case 'stop': return stopCommand(flags)
    default:
      console.error('Unknown command:', command)
      process.exit(1)
  }
}

function pidIsAlive(pid) {
  try { process.kill(pid, 0); return true } catch { return false }
}

async function stopCommand(flags) {
  const stateFile = getStateFile(flags)
  const state = readStateAt(stateFile)
  if (!state?.pid) {
    console.error('No running state (nothing to stop).')
    process.exit(1)
  }
  const pid = state.pid
  const alive = pidIsAlive(pid)
  if (!alive) {
    // Stale state file
    fs.unlinkSync(stateFile)
    if (flags.json) {
      process.stdout.write(JSON.stringify({ success: true, message: 'State file removed (process already dead).' })+'\n')
    } else {
      console.log('Process already stopped; state file cleaned.')
    }
    return
  }
  if (!flags.json) console.log('Stopping MEDomics server process PID', pid)
  try {
    process.kill(pid, 'SIGTERM')
  } catch (e) {
    console.error('Failed to send SIGTERM:', e.message)
  }
  const deadline = Date.now() + 5000
  const interval = setInterval(() => {
    if (!pidIsAlive(pid)) {
      clearInterval(interval)
      try { fs.unlinkSync(stateFile) } catch (e) { /* ignore */ }
      const result = { success: true, stopped: true }
      process.stdout.write(JSON.stringify(result)+'\n')
    } else if (Date.now() > deadline) {
      clearInterval(interval)
      // Force kill
  try { process.kill(pid, 'SIGKILL') } catch (e) { /* ignore */ }
      const forced = !pidIsAlive(pid)
      try { fs.unlinkSync(stateFile) } catch (e) { /* ignore */ }
      const result = { success: forced, forced }
      process.stdout.write(JSON.stringify(result)+'\n')
    }
  }, 250)
}

main()
