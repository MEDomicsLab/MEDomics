import { checkJupyterIsRunning, startJupyterServer, stopJupyterServer } from "./utils/jupyterServer.js"

import express from "express"
import bodyParser from "body-parser"

const cors = require("cors")
const expressApp = express()
expressApp.use(bodyParser.json())
expressApp.use(cors())

expressApp.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*")
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept")
  next()
})

const EXPRESS_PORT = 3000

export function startExpressServer() {
  expressApp.listen(EXPRESS_PORT, () => {
    console.log(`Express server listening on port ${EXPRESS_PORT}`)
  })
}

// Helper to normalize paths for cross-platform compatibility
function normalizePathForPlatform(p) {
  if (!p) return p
  // Always convert Windows backslashes to forward slashes first
  let normalized = p.replace(/\\/g, '/')
  if (process.platform === 'win32') {
    // On Windows, convert all forward slashes to backslashes
    normalized = normalized.replace(/\//g, '\\')
    // Remove leading slash if present (e.g. '/C:/path')
    if (normalized.match(/^\\[A-Za-z]:/)) {
      normalized = normalized.slice(1)
    }
  }
  return normalized
}


// Remote express requests
expressApp.post("/set-working-directory", async (req, res, next) =>{
  let workspacePath = normalizePathForPlatform(req.body.workspacePath)
  console.log("Received request to set workspace directory from remote: ", workspacePath)
  try {
    const result = await setWorkspaceDirectory(workspacePath);
    if (result && result.hasBeenSet) {
      console.log('Workspace (from remote) set to: ' + workspacePath)
      result.isRemote = true
      res.json({ success: true, workspace: result })
    } else {
      console.log('Workspace specified by remote could not be set : ', err)
      res.status(500).json({ success: false, error: err.message })
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
    await mainWindow.webContents.send("insertObjectIntoCollection", req.body)
    res.status(200).json({ success: true, message: "Object insertion request received" })
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
    await mainWindow.webContents.send("downloadCollectionToFile", req.body)
    res.status(200).json({ success: true, message: "Collection download request received" })
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
    startMongoDB(workspacePath, mongoProcess)
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

if (require.main === module) {
  startExpressServer()
}