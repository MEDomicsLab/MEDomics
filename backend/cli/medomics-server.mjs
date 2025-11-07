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
  // Placeholder: Would perform dependency installations (Mongo/Python) using existing endpoints.
  process.stdout.write(JSON.stringify({ success: true, message: 'Install stub – implement dependency bootstrap.' }, null, flags.json?0:2)+'\n')
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
    default:
      console.error('Unknown command:', command)
      process.exit(1)
  }
}

main()
