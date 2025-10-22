import serverPathUtils from "./utils/serverPathUtils.js"
const { setAppPath } = serverPathUtils
import express from "express"
import bodyParser from "body-parser"
import serverWorkspace from "./utils/serverWorkspace.js"
const { createServerMedomicsDirectory, createServerWorkingDirectory } = serverWorkspace
import mongoDBServer from "./utils/mongoDBServer.js"
const { startMongoDB, stopMongoDB, getMongoDBPath } = mongoDBServer
import cors from "cors"
import dirTree from "directory-tree"
import { exec, execSync } from "child_process"
import pythonEnv from "./utils/pythonEnv.js"
const { getBundledPythonEnvironment } = pythonEnv
import jupyterServer from "./utils/jupyterServer.js"
const { startJupyterServer, stopJupyterServer, checkJupyterIsRunning } = jupyterServer
import serverInstallation  from "./utils/serverInstallation.js"
const { checkRequirements } = serverInstallation
import { runServer, findAvailablePort } from "./utils/server.mjs"

const expressApp = express()
expressApp.use(bodyParser.json())
expressApp.use(cors())

expressApp.use(function(req, res, next) {
	res.header("Access-Control-Allow-Origin", "*")
	res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept")
	next()
})

const EXPRESS_PORT_START = 3000
const EXPRESS_PORT_END = 8000

let isProd = process.env.NODE_ENV && process.env.NODE_ENV === "production"
let serverProcess = null

export async function startExpressServer() {
	try {
		const expressPort = await findAvailablePort(EXPRESS_PORT_START, EXPRESS_PORT_END)
		expressApp.listen(expressPort, () => {
			console.log(`Express server listening on port ${expressPort}`)
		})
		// Notify the Electron main process about the port
		if (process.send) {
			process.send({ type: "EXPRESS_PORT", expressPort })
		}
	} catch (err) {
		console.error("Failed to start Express server - no available port:", err)
		throw err
	}
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

expressApp.post("/run-go-server", async (req, res) => {
  try {
    console.log("Received request to run Go server")
    if (serverProcess) {
      serverProcess.kill()
      console.log("Previous Go server process killed")
    }

    let bundledPythonPath = getBundledPythonEnvironment()
    if (!bundledPythonPath) {
      throw new Error("Bundled Python environment not found")
    }

    runServer()

  } catch (err) {
    console.error("Error running Go server: ", err)
    res.status(500).json({ success: false, error: err.message })
  }
})


expressApp.post("/set-working-directory", async (req, res, next) =>{
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
			startMongoDB(workspacePath)
			return {
				workingDirectory: dirTree(workspacePath),
				hasBeenSet: hasBeenSet,
				newPort: EXPRESS_PORT
			}
		} catch (error) {
			console.error("Failed to change workspace: ", error)
		}
}

if (process.argv[1] && process.argv[1].endsWith("expressServer.mjs")) {
	// check requirements (MongoDB, Python)
	checkRequirements()
	// if not met, prompt to install
	// start servers once requirements are met
	startExpressServer()
}
