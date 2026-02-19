import * as serverPathUtils from "./utils/serverPathUtils.js"
const { setAppPath } = serverPathUtils
import express from "express"
import bodyParser from "body-parser"
import * as serverWorkspace from "./utils/serverWorkspace.js"
const { createServerMedomicsDirectory, createServerWorkingDirectory, getServerWorkingDirectory } = serverWorkspace
import * as mongoDBServer from "./utils/mongoDBServer.js"
const { startMongoDB, stopMongoDB, getMongoDBPath, checkMongoIsRunning, getMongoDebugInfo } = mongoDBServer
import cors from "cors"
import dirTree from "directory-tree"
import { exec, execSync } from "child_process"
import * as pythonEnv from "./utils/pythonEnv.js"
const { getBundledPythonEnvironment, installBundledPythonExecutable, installRequiredPythonPackages, checkPythonRequirements, ensurePythonRequirementsInstalled } = pythonEnv
import * as jupyterServer from "./utils/jupyterServer.js"
const { startJupyterServer, stopJupyterServer, checkJupyterIsRunning } = jupyterServer
import MEDconfig from "./utils/medomics.server.dev.js"
import * as serverInstallation  from "./utils/serverInstallation.js"
const { checkRequirements } = serverInstallation
import { runServer, findAvailablePort } from "./utils/server.mjs"
import fs from "fs"
import path from "path"
import os from "os"

const expressApp = express()
expressApp.use(bodyParser.json())
expressApp.use(cors())

expressApp.use(function(req, res, next) {
	res.header("Access-Control-Allow-Origin", "*")
	res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept")
	next()
})

const EXPRESS_PORT_START = 5000
const EXPRESS_PORT_END = 8000

// Service state snapshot to report via /status and to keep idempotent ensures
const serviceState = {
	expressPort: null,
	go: { running: false, port: null },
	mongo: { running: false, port: null },
	jupyter: { running: false, port: null }
}

// Keep a handle to the HTTP server to support graceful stop via endpoint
let httpServer = null

// --- State file helpers ---
function getStateFilePath() {
	const dir = path.join(os.homedir(), ".medomics", "medomics-server")
	try { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }) } catch(e) { console.warn("[state-file] mkdir error:", e && e.message ? e.message : e) }
	return path.join(dir, "state.json")
}

function snapshotState(started) {
	return {
		started: !!started,
		expressPort: serviceState.expressPort,
		pid: process.pid,
		updatedAt: new Date().toISOString()
	}
}

function writeStateFile(started) {
	try {
		const p = getStateFilePath()
		const payload = snapshotState(started)
		fs.writeFileSync(p, JSON.stringify(payload, null, 2))
	} catch (e) {
		console.warn("[state-file] write error:", e && e.message ? e.message : e)
	}
}

// On process termination, mark started=false best-effort
function setupGracefulShutdownState() {
	const markStopped = () => {
		try { writeStateFile(false) } catch(e) { console.warn("[state-file] write error on shutdown:", e && e.message ? e.message : e) }
	}
	try {
		process.on("SIGINT", () => { markStopped(); process.exit(0) })
		process.on("SIGTERM", () => { markStopped(); process.exit(0) })
		process.on("beforeExit", () => { markStopped() })
		process.on("exit", () => { markStopped() })
	} catch(e) { console.warn("[state-file] error setting up graceful shutdown handlers:", e && e.message ? e.message : e) }
}

let isProd = process.env.NODE_ENV && process.env.NODE_ENV === "production"
let goServerProcess = null

export async function startExpressServer() {
	try {
		console.log('[express:start] scanning ports', EXPRESS_PORT_START, '-', EXPRESS_PORT_END)
		const envPort = process.env.MEDOMICS_EXPRESS_PORT && Number(process.env.MEDOMICS_EXPRESS_PORT)
		let expressPort = null
		if (envPort && envPort > 0 && envPort < 65536) {
			console.log('[express:start] using MEDOMICS_EXPRESS_PORT override', envPort)
			expressPort = envPort
		} else {
			// Primary legacy finder (may rely on netstat/lsof)
			let primaryFailed = null
			try {
				expressPort = await Promise.race([
					findAvailablePort(EXPRESS_PORT_START, EXPRESS_PORT_END),
					new Promise((_, reject) => setTimeout(() => reject(new Error('legacy-port-scan-timeout')), 8000))
				])
			} catch (e) {
				primaryFailed = e
				console.warn('[express:start] legacy port finder failed:', e && e.message ? e.message : e)
			}
			if (!expressPort) {
				console.log('[express:start] falling back to simple net binding scan')
				expressPort = await simpleFindAvailablePort(EXPRESS_PORT_START, EXPRESS_PORT_END)
			}
			if (!expressPort) {
				throw primaryFailed || new Error('no-port-found')
			}
		}
		console.log('[express:start] selected port', expressPort)
		httpServer = expressApp.listen(expressPort, () => {
			console.log(`Express server listening on port ${expressPort}`)
			// Write state.json with started=true and selected port
			writeStateFile(true)
			setupGracefulShutdownState()
		})
		httpServer.on('error', (err) => {
			console.error('[express:start] server error event', err && err.stack ? err.stack : err)
		})
		httpServer.on('close', () => {
			// Mark stopped on server close
			writeStateFile(false)
			serviceState.expressPort = null
			httpServer = null
		})
		serviceState.expressPort = expressPort
		if (process.send) {
			process.send({ type: 'EXPRESS_PORT', expressPort })
		}
	} catch (err) {
		console.error('[express:start] failed to start Express server:', err && err.stack ? err.stack : err)
		throw err
	}
}

// Simple fallback port finder using net module only
import net from 'net'
async function simpleFindAvailablePort(start, end) {
	for (let p = start; p <= end; p++) {
		const ok = await new Promise(resolve => {
			const tester = net.createServer()
			tester.once('error', () => { try { tester.close(()=>resolve(false)) } catch { resolve(false) } })
			tester.once('listening', () => tester.close(() => resolve(true)))
			tester.listen(p, '127.0.0.1')
		})
		if (ok) return p
	}
	return null
}

function normalizePathForPlatform(p) {
	if (!p) return p
	let normalized = p.replace(/\\/g, '/')
	if (process.platform === 'win32') {
		normalized = normalized.replace(/\//g, '\\')
		if (normalized.match(/^\\[A-Za-z]:/)) {
			normalized = normalized.slice(1)
		}
	}
	return normalized
}

async function startGoServer(preferredPort = null) {
	// Kick the Go server using existing helper; capture process handle and update state
	try {
		// Ensure bundled python exists and has required packages (e.g. pandas)
		// so GO-launched scripts don't fail at import time.
		try {
			const pythonExe = getBundledPythonEnvironment()
			if (!pythonExe) {
				throw new Error('Bundled Python environment not found')
			}
			const reqOk = checkPythonRequirements(pythonExe)
			if (!reqOk) {
				console.log('[python] requirements missing; installing into', pythonExe)
				await ensurePythonRequirementsInstalled(null, pythonExe)
			}
		} catch (pyErr) {
			console.error('[python] ensure requirements failed:', pyErr && pyErr.message ? pyErr.message : pyErr)
			throw pyErr
		}

		const { process: proc, port } = await runServer(isProd, preferredPort, goServerProcess, serviceState.go, null)
		goServerProcess = proc
		serviceState.go.running = true
		serviceState.go.port = port
		return { running: true, port }
	} catch (err) {
		serviceState.go.running = false
		serviceState.go.port = null
		throw err
	}
}

expressApp.post("/run-go-server", async (req, res) => {
  try {
    console.log("Received request to run Go server")
		if (goServerProcess) {
			goServerProcess.kill()
      console.log("Previous Go server process killed")
    }

    let bundledPythonPath = getBundledPythonEnvironment()
    if (!bundledPythonPath) {
      throw new Error("Bundled Python environment not found")
    }

		await startGoServer()

  } catch (err) {
    console.error("Error running Go server: ", err)
    res.status(500).json({ success: false, error: err.message })
		return
  }
	res.json({ success: true, running: true, port: serviceState.go.port })
})

// Stop Express server gracefully
expressApp.post("/stop-express", async (req, res) => {
	try {
		if (!httpServer) {
			return res.status(200).json({ success: true, message: 'Express not running' })
		}
		httpServer.close(() => {
			try { writeStateFile(false) } catch (e) { /* ignore */ }
			serviceState.expressPort = null
			httpServer = null
			res.json({ success: true, stopped: true })
		})
	} catch (err) {
		console.error("Error stopping Express server:", err)
		res.status(500).json({ success: false, error: err.message })
	}
	// Stop GO server if running
	try {
		if (goServerProcess) {
			console.log('[express:stop] stopping GO server...')
			try { goServerProcess.kill('SIGTERM') } catch (_) { /* ignore */ }
			// Best-effort wait, then force kill if needed
			await new Promise(r => setTimeout(r, 500))
			try { goServerProcess.kill('SIGKILL') } catch (_) { /* ignore */ }
			goServerProcess = null
			serviceState.go.running = false
			serviceState.go.port = null
		}
	} catch (e) {
		console.warn('[express:stop] GO stop warning:', e && e.message ? e.message : e)
	}

	// Stop MongoDB if running
	try {
		if (serviceState.mongo.running) {
			console.log('[express:stop] stopping MongoDB...')
			try { await stopMongoDB() } catch (e) { console.warn('[express:stop] stopMongoDB warning:', e && e.message ? e.message : e) }
			serviceState.mongo.running = false
			serviceState.mongo.port = null
		}
	} catch (e) { console.warn('[express:stop] Mongo stop warning:', e && e.message ? e.message : e) }

	// Stop Jupyter if running
	try {
		if (serviceState.jupyter.running) {
			console.log('[express:stop] stopping Jupyter...')
			try { await stopJupyterServer() } catch (e) { console.warn('[express:stop] stopJupyter warning:', e && e.message ? e.message : e) }
			serviceState.jupyter.running = false
			serviceState.jupyter.port = null
		}
	} catch (e) { console.warn('[express:stop] Jupyter stop warning:', e && e.message ? e.message : e) }
})


expressApp.post("/set-working-directory", async (req, res) =>{
	let workspacePath = normalizePathForPlatform(req.body.workspacePath)
	console.log("Received request to set workspace directory from remote: ", workspacePath)
	try {
		const result = await setWorkspaceDirectoryServer(workspacePath)
		if (result && result.hasBeenSet) {
			console.log('Workspace (from remote) set to: ' + workspacePath)
			result.isRemote = true
			res.json({ success: true, workspace: result })
		} else {
			console.log('Workspace specified by remote could not be set')
			res.status(500).json({ success: false, error: 'Could not set workspace' })
		}
	} catch (err) {
		console.log('Error setting workspace directory from remote : ', err)
		res.status(500).json({ success: false, error: err.message })
	}
})

// Status: single source of truth snapshot for all services this backend manages
expressApp.get("/status", async (req, res) => {
		try {
      console.log("Received request to get service status")
			// Refresh GO runtime state by probing the recorded port.
			try {
				if (serviceState.go.port) {
					const goUp = await checkGoIsListening(serviceState.go.port, 300)
					serviceState.go.running = !!goUp
					if (!goUp) serviceState.go.port = null
				}
			} catch (_) {
				// ignore detection failure
			}
			// Optionally refresh Jupyter runtime status on demand
			try {
				const jStatus = await checkJupyterIsRunning()
				serviceState.jupyter.running = !!(jStatus && jStatus.running)
				// Port not tracked dynamically here; defaults are managed in module
			} catch (e) {
				// ignore status refresh failures
			}
			// Refresh Mongo runtime state based on listening port
			try {
				const mongoUp = await checkMongoIsRunning(MEDconfig.mongoPort)
				serviceState.mongo.running = !!mongoUp
				if (mongoUp && !serviceState.mongo.port) serviceState.mongo.port = MEDconfig.mongoPort
			} catch (e) {
				// ignore detection failure
			}
		res.json({
			success: true,
			expressPort: serviceState.expressPort,
			go: { running: serviceState.go.running, port: serviceState.go.port },
			mongo: { running: serviceState.mongo.running, port: serviceState.mongo.port },
			jupyter: { running: serviceState.jupyter.running, port: serviceState.jupyter.port }
		})
	} catch (err) {
		res.status(500).json({ success: false, error: err.message })
	}
})

// Ensure GO: idempotent start; returns current/active port
expressApp.post("/ensure-go", async (req, res) => {
	try {
		if (serviceState.go.running) {
			return res.json({ success: true, running: true, port: serviceState.go.port })
		}
		const preferredPort = req?.body?.preferredPort || null
		await startGoServer(preferredPort)
		return res.json({ success: true, running: true, port: serviceState.go.port })
	} catch (err) {
		console.error("ensure-go error:", err)
		res.status(500).json({ success: false, running: false, error: err.message })
	}
})

// Ensure MongoDB: idempotently start mongod using the workspace's .medomics/mongod.conf
// Body optional: { workspacePath?: string }
expressApp.post("/ensure-mongo", async (req, res) => {
	try {
		// If already running, return current state
		const mongoUp = await checkMongoIsRunning(MEDconfig.mongoPort)
		if (serviceState.mongo.running || mongoUp) {
			serviceState.mongo.running = true
			if (!serviceState.mongo.port) serviceState.mongo.port = MEDconfig.mongoPort
			return res.json({ success: true, running: true, port: serviceState.mongo.port || MEDconfig.mongoPort })
		}
		// Determine workspace path: prefer body.workspacePath, else current sessionData
		let workspacePath = req?.body?.workspacePath || getServerWorkingDirectory()
		workspacePath = normalizePathForPlatform(workspacePath)
		// Ensure .medomics config and data directories exist
		createServerMedomicsDirectory(workspacePath)

		// If a mongod process is already spawned (e.g., by /set-working-directory) but hasn't opened the port yet,
		// wait for it instead of spawning a second instance (which can fail due to log file/port locks).
		try {
			const dbg = getMongoDebugInfo()
			if (dbg && (dbg.running || dbg.pid)) {
				const upExisting = await waitForMongoUp(MEDconfig.mongoPort, 12000)
				serviceState.mongo.running = !!upExisting
				serviceState.mongo.port = MEDconfig.mongoPort
				if (!upExisting) {
					return res.status(500).json({
						success: false,
						running: false,
						error: "MongoDB process exists but did not start listening within timeout",
						port: MEDconfig.mongoPort,
						mongoDebug: getMongoDebugInfo()
					})
				}
				return res.json({ success: true, running: true, port: MEDconfig.mongoPort })
			}
		} catch (_) {
			// best-effort; continue with fresh start below
		}


		// Start MongoDB and record default port from config
		startMongoDB(workspacePath)
		// Wait briefly for port to open so the caller gets a reliable signal
		const up = await waitForMongoUp(MEDconfig.mongoPort, 12000)
		serviceState.mongo.running = !!up
		serviceState.mongo.port = MEDconfig.mongoPort
		if (!up) {
			return res.status(500).json({
				success: false,
				running: false,
				error: "MongoDB did not start listening within timeout",
				port: MEDconfig.mongoPort,
				mongoDebug: getMongoDebugInfo()
			})
		}
		return res.json({ success: true, running: true, port: serviceState.mongo.port })
	} catch (err) {
		console.error("ensure-mongo error:", err)
		return res.status(500).json({ success: false, running: false, error: err.message, mongoDebug: getMongoDebugInfo() })
	}
})

// Debug: retrieve last MongoDB spawn/exit/stdout/stderr info
expressApp.get("/mongo-debug", (req, res) => {
	try {
		return res.json({ success: true, mongoDebug: getMongoDebugInfo() })
	} catch (err) {
		return res.status(500).json({ success: false, error: err.message })
	}
})

// Ensure Jupyter: idempotent start, returns running and port
// Body optional: { workspacePath?: string, preferredPort?: number }
expressApp.post("/ensure-jupyter", async (req, res) => {
	try {
		const preferredPort = req?.body?.preferredPort || 8900
		let workspacePath = req?.body?.workspacePath || getServerWorkingDirectory()
		workspacePath = normalizePathForPlatform(workspacePath)

		// Check current runtime state
		try {
			const jStatus = await checkJupyterIsRunning()
			serviceState.jupyter.running = !!(jStatus && jStatus.running)
		} catch (_) {
			// ignore transient status errors
		}

		if (serviceState.jupyter.running) {
			// If running but we have no port stored, assume preferredPort or default
			if (!serviceState.jupyter.port) serviceState.jupyter.port = preferredPort
			return res.json({ success: true, running: true, port: serviceState.jupyter.port })
		}

		// Not running: start it
		const result = await startJupyterServer(workspacePath, preferredPort)
		if (!result || result.running !== true) {
			const errMsg = (result && result.error) ? result.error : "Failed to start Jupyter"
			serviceState.jupyter.running = false
			serviceState.jupyter.port = null
			return res.status(500).json({ success: false, running: false, error: errMsg })
		}

		serviceState.jupyter.running = true
		serviceState.jupyter.port = preferredPort
		return res.json({ success: true, running: true, port: serviceState.jupyter.port })
	} catch (err) {
		console.error("ensure-jupyter error:", err)
		return res.status(500).json({ success: false, running: false, error: err.message })
	}
})

expressApp.get("/get-working-dir-tree", (req, res) => {
	try {
		let requestPath = normalizePathForPlatform(req.query.requestedPath)
		console.log("Received request to get working directory tree for path: ", requestPath)
		const workingDirectory = dirTree(requestPath)
		if (!workingDirectory) {
			console.log("No working directory found for the requested path:" + requestPath)
			res.status(500).json({ success: false, error: "Working directory not found" })
		}
		res.json({ success: true, workingDirectory: workingDirectory })
	} catch (err) {
		console.error("Error getting working directory: ", err)
		res.status(500).json({ success: false, error: err.message })
	}
})

expressApp.post("/insert-object-into-collection", async (req, res) => {
	try {
		if (!req.body) {
			console.error("No object provided in request body")
			return res.status(400).json({ success: false, error: "No object provided" })
		} else if (!req.body.objectPath || !req.body.medDataObject) {
			console.error("Invalid request body: objectPath and medDataObject are required")
			return res.status(400).json({ success: false, error: "Invalid request body" })
		}
		console.log("Received request to insert object into collection: ", req.body)
		// This would need to be refactored for headless mode (no mainWindow)
		// await mainWindow.webContents.send("insertObjectIntoCollection", req.body)
		res.status(200).json({ success: true, message: "Object insertion request received (headless mode: not implemented)" })
	} catch (err) {
		console.error("Error inserting object into remote collection: ", err)
		res.status(500).json({ success: false, error: err.message })
	}
})

expressApp.post("/download-collection-to-file", async (req, res) => {
	try {
		if (!req.body) {
			console.error("No object provided in request body")
			return res.status(400).json({ success: false, error: "No object provided" })
		} else if (!req.body.collectionId || !req.body.filePath || !req.body.type) {
			console.error("Invalid request body: downloadCollectionToFile requires collectionId, filePath, and type")
			return res.status(400).json({ success: false, error: "Invalid request body" })
		}
		console.log("Received request to download collection to file: ", req.body)
		// This would need to be refactored for headless mode (no mainWindow)
		// await mainWindow.webContents.send("downloadCollectionToFile", req.body)
		res.status(200).json({ success: true, message: "Collection download request received (headless mode: not implemented)" })
	} catch (err) {
		console.error("Error downloading object to file: ", err)
		res.status(500).json({ success: false, error: err.message })
	}
})

expressApp.get("/get-bundled-python-environment", (req, res) => {
	try {
		console.log("Received request to get bundled python environment")
		const pythEnv = getBundledPythonEnvironment()
		if (!pythEnv) {
			res.status(500).json({ success: false, error: "Bundled python environment not found" })
		}
		res.status(200).json({ success: true, pythonEnv: pythEnv })
	} catch (err) {
		console.error("Error getting bundled python environment: ", err)
		res.status(500).json({ success: false, error: err.message })
	}
})

expressApp.get("/get-installed-python-packages", (req, res) => {
	try {
		console.log("Received request to get installed python packages")
		const pythonPackages = getBundledPythonEnvironment()
		if (!pythonPackages) {
			res.status(500).json({ success: false, error: "No installed python packages found" })
		}
		res.status(200).json({ success: true, packages: pythonPackages })
	} catch (err) {
		console.error("Error getting installed python packages: ", err)
		res.status(500).json({ success: false, error: err.message })
	}
})

expressApp.post("/start-mongo", async (req, res) => {
	try {
		if (!req.body) {
			console.error("No object provided in request body")
			return res.status(400).json({ success: false, error: "No object provided" })
		} else if (!req.body.workspacePath) {
			console.error("Invalid request body: startMongo requires a workspacePath")
			return res.status(400).json({ success: false, error: "Invalid request body (no path provided)" })
		}
		let workspacePath = normalizePathForPlatform(req.body.workspacePath)
		console.log("Received request to start mongoDB with path : ", workspacePath)
		startMongoDB(workspacePath)
		res.status(200).json({ success: true, message: "Started MongoDB on remote server" })
	} catch (err) {
		console.error("Error starting MongoDB (request from remote client): ", err)
		res.status(500).json({ success: false, error: err.message })
	}
})

expressApp.get("/check-jupyter-status", async (req, res) => {
	try {
		console.log("Received request to check Jupyter status")
		const result = await checkJupyterIsRunning()
		res.status(200).json({ running: result.running, error: result.error || null })
	} catch (err) {
		console.error("Error checking Jupyter server status: ", err)
		res.status(500).json({ running: false, error: err.message })
	}
})

expressApp.post("/start-jupyter-server", async (req, res) => {
	try {
		if (!req.body) {
			console.error("No object provided in request body")
			return res.status(400).json({ running: false, error: "No object provided" })
		} else if (!req.body.workspacePath) {
			console.error("Invalid request body: startJupyterServer requires a workspacePath")
			return res.status(400).json({ running: false, error: "Invalid request body (no path provided)" })
		}
		let workspacePath = normalizePathForPlatform(req.body.workspacePath)
		console.log("Received request to start Jupyter Server with path : ", workspacePath)
		const result = await startJupyterServer(workspacePath)
		console.log("Jupyter server started: ", result)
		res.status(200).json({ running: result.running, error: result.error || null })
	} catch (err) {
		console.error("Error starting Jupyter (request from remote client): ", err)
		res.status(500).json({ running: false, error: err.message })
	}
})

expressApp.post("/stop-jupyter-server", async (req, res) => {
	try {
		console.log("Received request to stop Jupyter Server")
		const result = stopJupyterServer()
		res.status(200).json(result)
	} catch (err) {
		console.error("Error stopping Jupyter (request from remote client): ", err)
		res.status(500).json({ running: false, error: err.message })
	}
})

	// Stop MongoDB (remote call)
	expressApp.post("/stop-mongo", async (req, res) => {
		try {
			console.log("Received request to stop MongoDB")
			await stopMongoDB()
			res.status(200).json({ success: true })
		} catch (err) {
			console.error("Error stopping MongoDB:", err)
			res.status(500).json({ success: false, error: err.message })
		}
	})

	// Get path to mongod executable
	expressApp.get("/get-mongo-path", (req, res) => {
		try {
			const path = getMongoDBPath()
			if (!path) return res.status(404).json({ success: false, error: "mongod not found" })
			res.status(200).json({ success: true, path })
		} catch (err) {
			console.error("Error getting mongo path:", err)
			res.status(500).json({ success: false, error: err.message })
		}
	})

	// Install MongoDB via helper
	expressApp.post("/install-mongo", async (req, res) => {
		try {
			console.log("Received request to install MongoDB")
			const result = await serverInstallation.installMongoDB()
			res.status(200).json({ success: !!result })
		} catch (err) {
			console.error("Error installing MongoDB:", err)
			const payload = { success: false, error: err.message }
			// Surface installer exit code (e.g., Windows Installer 1601) to the renderer
			if (typeof err.code !== "undefined") {
				payload.errorCode = err.code
				payload.installerExitCode = err.code
				if (err.code === 1601) {
					payload.windowsInstallerError = true
				}
			}
			res.status(500).json(payload)
		}
	})

	// Install bundled python executable
	expressApp.post("/install-bundled-python", async (req, res) => {
		try {
			console.log("Received request to install bundled python")
			// Provide a basic notify callback that logs to console in headless mode
			const notify = (payload) => console.log("install-bundled-python:", payload)
			const result = await installBundledPythonExecutable(notify)
			res.status(200).json({ success: !!result })
		} catch (err) {
			console.error("Error installing bundled python:", err)
			res.status(500).json({ success: false, error: err.message })
		}
	})

	// Install required python packages for a given python path
	expressApp.post("/install-required-python-packages", async (req, res) => {
		try {
			const pythonPath = req.body && req.body.pythonPath
			console.log("Requested install-required-python-packages for:", pythonPath)
			const notify = (payload) => console.log("install-required-python-packages:", payload)
			await installRequiredPythonPackages(notify, pythonPath)
			res.status(200).json({ success: true })
		} catch (err) {
			console.error("Error installing required python packages:", err)
			res.status(500).json({ success: false, error: err.message })
		}
	})

	// Check system requirements (MongoDB, Python)
	expressApp.get("/check-requirements", async (req, res) => {
		try {
			const result = await checkRequirements()
			res.status(200).json({ success: true, result })
		} catch (err) {
			console.error("Error checking requirements:", err)
			res.status(500).json({ success: false, error: err.message })
		}
	})

	// Check whether the python requirements are met for a given pythonPath
	expressApp.get("/check-python-requirements", (req, res) => {
		try {
			const pythonPath = req.query.pythonPath || null
			const ok = checkPythonRequirements(pythonPath)
			res.status(200).json({ success: true, requirementsMet: !!ok })
		} catch (err) {
			console.error("Error checking python requirements:", err)
			res.status(500).json({ success: false, error: err.message })
		}
	})

export async function setWorkspaceDirectoryServer(workspacePath) {
	if (!workspacePath) {
		throw new Error("No workspace path provided")
	}
	setAppPath("sessionData", workspacePath)
	console.log("Setting workspace directory to: " + workspacePath)
	createServerWorkingDirectory()
	createServerMedomicsDirectory(workspacePath)
	let hasBeenSet = true
	try {
			await stopMongoDB()
			if (process.platform === "win32") {
				// killProcessOnPort(serverPort)
			} else if (process.platform === "darwin") {
				await new Promise((resolve) => {
					exec("pkill -f mongod", () => {
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
			startMongoDB(workspacePath)
			return {
				workingDirectory: dirTree(workspacePath),
				hasBeenSet: hasBeenSet,
				newPort: serviceState.mongo.port
			}
		} catch (error) {
			console.error("Failed to change workspace: ", error)
		}
}

async function waitForMongoUp(port, timeoutMs = 12000) {
	const start = Date.now()
	while (Date.now() - start < timeoutMs) {
		try {
			if (await checkMongoIsRunning(port)) return true
		} catch (_) {
			// ignore
		}
		await new Promise(r => setTimeout(r, 250))
	}
	return false
}

async function checkGoIsListening(port, timeoutMs = 300) {
	return await new Promise(resolve => {
		try {
			if (!port || typeof port !== 'number') return resolve(false)
			const socket = new net.Socket()
			let settled = false
			const finish = (ok) => {
				if (settled) return
				settled = true
				try { socket.destroy() } catch (_) { /* ignore */ }
				resolve(ok)
			}
			socket.setTimeout(timeoutMs)
			socket.once('connect', () => finish(true))
			socket.once('timeout', () => finish(false))
			socket.once('error', () => finish(false))
			socket.connect(port, '127.0.0.1')
		} catch (_) {
			resolve(false)
		}
	})
}

if (process.argv[1] && process.argv[1].endsWith('expressServer.mjs')) {
	(async () => {
		console.log('[bootstrap] entrypoint detected')
		try {
			console.log('[bootstrap] running requirements check')
			const reqResult = await checkRequirements()
			console.log('[bootstrap] requirements result', reqResult)
			console.log('[bootstrap] starting express')
			await startExpressServer()
			console.log('[bootstrap] express started on', serviceState.expressPort)
			try {
				await startGoServer()
				console.log('[bootstrap] go server started on', serviceState.go.port)
			} catch (goErr) {
				console.error('[bootstrap] failed to start Go server:', goErr && goErr.stack ? goErr.stack : goErr)
				// Continue running Express even if Go server fails to start
				serviceState.go.running = false
				serviceState.go.port = null
			}
		} catch (e) {
			console.error('[bootstrap] fatal startup error', e && e.stack ? e.stack : e)
			process.exit(1)
		}
	})()
}
