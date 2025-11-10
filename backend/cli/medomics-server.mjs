#!/usr/bin/env node
// MEDomics Server CLI scaffold
// Provides headless management commands for the backend: start, status, ensure, install (stub), upgrade (stub)
// This is an initial scaffold; many operations are stubs to be filled in later.

import path from 'path'
import fs from 'fs'
import { fork } from 'child_process'
import http from 'http'
// no __filename/__dirname needed in this scaffold
// Removed __dirname and unused port range constants in scaffold to satisfy lint
const STATE_FILE = path.resolve(process.cwd(), 'medomics-server-state.json')

function log(msg) {
  if (!process.env.JSON) console.log(msg)
}

function writeState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
}

function readState() {
  if (!fs.existsSync(STATE_FILE)) return null
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8')) } catch { return null }
}

function parseArgs(argv) {
  const args = argv.slice(2)
  const flags = {}
  let command = null
  let positionals = []
  for (let i=0; i<args.length; i++) {
    const a = args[i]
    if (!command && !a.startsWith('-')) { command = a; continue }
    if (a.startsWith('--')) {
      const [k,v] = a.substring(2).split('=')
      flags[k] = v === undefined ? true : v
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
  if (readState()?.running) {
    console.error('Server already running (state file present). Use status or stop (not yet implemented).')
    process.exit(1)
  }
  const expressServerPath = path.resolve(process.cwd(), 'backend', 'expressServer.mjs')
  if (!fs.existsSync(expressServerPath)) {
    console.error('expressServer.mjs not found at expected path: ' + expressServerPath)
    process.exit(1)
  }
  log('Starting MEDomics Express server...')
  const child = fork(expressServerPath, [], { stdio: ['inherit','inherit','inherit','ipc'], env: { ...process.env, NODE_ENV: flags.production ? 'production' : (process.env.NODE_ENV||'development') } })
  const timeoutMs = parseInt(flags.timeout||'15000',10)
  let settled = false
  child.on('message', async (msg) => {
    if (settled) return
    if (msg && msg.type === 'EXPRESS_PORT') {
      settled = true
      const state = { running: true, pid: child.pid, expressPort: msg.expressPort, started: new Date().toISOString() }
      writeState(state)
      if (flags.json) {
        process.stdout.write(JSON.stringify({ success: true, state })+'\n')
      } else {
        log('Express started on port ' + msg.expressPort)
      }
    }
  })
  child.on('exit', code => {
    if (!settled) {
      console.error('Express server exited prematurely with code', code)
      process.exit(code||1)
    }
  })
  // Fallback timeout
  setTimeout(() => {
    if (!settled) {
      console.error('Timed out waiting for Express port message')
  try { child.kill() } catch (e) { /* ignore kill errors */ }
      process.exit(1)
    }
  }, timeoutMs)
}

async function statusCommand(flags) {
  const state = readState()
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
  const state = readState()
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
  let state = readState()
  if (!state?.expressPort) {
    log('Express not started (no state found). Starting...')
    await startCommand({ ...flags })
    // re-read state after start
    state = readState()
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
  const state = readState()
  if (!state?.pid) {
    console.error('No running state (nothing to stop).')
    process.exit(1)
  }
  const pid = state.pid
  const alive = pidIsAlive(pid)
  if (!alive) {
    // Stale state file
    fs.unlinkSync(STATE_FILE)
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
  try { fs.unlinkSync(STATE_FILE) } catch (e) { /* ignore */ }
      const result = { success: true, stopped: true }
      process.stdout.write(JSON.stringify(result)+'\n')
    } else if (Date.now() > deadline) {
      clearInterval(interval)
      // Force kill
  try { process.kill(pid, 'SIGKILL') } catch (e) { /* ignore */ }
      const forced = !pidIsAlive(pid)
  try { fs.unlinkSync(STATE_FILE) } catch (e) { /* ignore */ }
      const result = { success: forced, forced }
      process.stdout.write(JSON.stringify(result)+'\n')
    }
  }, 250)
}

main()
