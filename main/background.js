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
import { runServer, findAvailablePort } from "./utils/server"
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
import {
  getBundledPythonEnvironment,
  getInstalledPythonPackages,
  installPythonPackage,
  installBundledPythonExecutable,
  checkPythonRequirements,
  installRequiredPythonPackages
} from "./utils/pythonEnv"
import { installMongoDB, checkRequirements } from "./utils/installation"
import {
  getTunnelState,
  getActiveTunnel,
  detectRemoteOS,
  getRemoteWorkspacePath,
  checkRemotePortOpen
} from './utils/remoteFunctions.js'
import { checkJupyterIsRunning, startJupyterServer, stopJupyterServer } from "./utils/jupyterServer.js"
import express from "express"
import bodyParser from "body-parser"

const cors = require("cors");
const expressApp = express();
expressApp.use(bodyParser.json());
expressApp.use(cors());

expressApp.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});
const EXPRESS_PORT = 3000;
expressApp.listen(EXPRESS_PORT, () => {
  console.log(`Express server listening on port ${EXPRESS_PORT}`);
});


const fs = require("fs")
const terminalManager = new TerminalManager()
var path = require("path")
let mongoProcess = null
const dirTree = require("directory-tree")
const { exec, spawn, execSync } = require("child_process")
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
    mainWindow = undefined;
    splashScreen = undefined;
    console.log("Running in headless/server-only mode: no GUI will be created.");
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

  console.log("running mode:", isProd ? "production" : "development")
  console.log("process.resourcesPath: ", process.resourcesPath)
  console.log(MEDconfig.runServerAutomatically ? "Server will start automatically here (in background of the application)" : "Server must be started manually")
  let bundledPythonPath = getBundledPythonEnvironment()
  if (MEDconfig.runServerAutomatically && bundledPythonPath !== null) {
    // Find the bundled python environment
    if (bundledPythonPath !== null) {
      runServer(isProd, serverPort, serverProcess, serverState, bundledPythonPath)
        .then((process) => {
          serverProcess = process
          console.log("Server process started: ", serverProcess)
        })
        .catch((err) => {
          console.error("Failed to start server: ", err)
        })
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
    return setWorkspaceDirectory(data)
  })

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
        result.isRemote = true;
        res.json({ success: true, workspace: result });
      } else {
        console.log('Workspace specified by remote could not be set : ', err)
        res.status(500).json({ success: false, error: err.message });
      }
    } catch (err) {
      console.log('Error setting workspace directory from remote : ', err)
      res.status(500).json({ success: false, error: err.message });
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


  const setWorkspaceDirectory = async (data) => {
    app.setPath("sessionData", data)
    console.log(`setWorkspaceDirectory : ${data}`)
    createWorkingDirectory() // Create DATA & EXPERIMENTS directories
    createMedomicsDirectory(data)
    hasBeenSet = true
    try {
      // Stop MongoDB if it's running
      await stopMongoDB(mongoProcess)
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
      startMongoDB(data, mongoProcess)
      return {
        workingDirectory: dirTree(app.getPath("sessionData")),
        hasBeenSet: hasBeenSet,
        newPort: serverPort
      }
    } catch (error) {
      console.error("Failed to change workspace: ", error)
    }
  }

  ipcMain.handle("setRemoteWorkingDirectory", async (event, data) => {
    app.setPath("remoteSessionData", data)
    createRemoteWorkingDirectory() // Create DATA & EXPERIMENTS directories
    console.log(`setWorkspaceDirectory (remote) : ${data}`)
    createRemoteMedomicsDirectory(data)
    hasBeenSet = true
    try {
      // Stop MongoDB if it's running
      await stopMongoDB(mongoProcess)
      // Kill mongod on remote via SSH exec
      if (activeTunnel && typeof activeTunnel.exec === 'function') {
        // 1. Detect remote OS
        const remoteOS = await detectRemoteOS()
        // 2. Run the appropriate kill command
        let killCmd
        if (remoteOS === 'unix' | remoteOS === 'linux' || remoteOS === 'darwin') {
          killCmd = 'pkill -f mongod || killall mongod || true'
        } else {
          // Windows: try taskkill
          killCmd = 'taskkill /IM mongod.exe /F'
        }
        await new Promise((resolve) => {
          activeTunnel.exec(killCmd, (err, stream) => {
            if (err) return resolve()
            stream.on('close', () => resolve())
            stream.on('data', () => {})
            stream.stderr.on('data', () => {})
          })
        })
      } else {
        // Fallback: local logic if no tunnel
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
      }
      // Start MongoDB with the new configuration
      startMongoDB(data, mongoProcess)
      return {
        workingDirectory: dirTree(app.getPath("remoteSessionData")),
        hasBeenSet: hasBeenSet,
        newPort: serverPort,
        isRemote: false,
        success: true
      }
    } catch (error) {
      console.error("Failed to change workspace: ", error)
    }
  })


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
      runServer(isProd, serverPort, serverProcess, serverState, pythonPath)
        .then((process) => {
          serverProcess = process
          console.log(`success: ${serverState.serverIsRunning}`)
          return serverState.serverIsRunning
        })
        .catch((err) => {
          console.error("Failed to start server: ", err)
          serverState.serverIsRunning = false
          return false
        })
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
                newPort: tunnel.localBackendPort,
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

// Python environment handling
ipcMain.handle("getInstalledPythonPackages", async (event, pythonPath) => {
  const activeTunnel = getActiveTunnel()
  const tunnel = getTunnelState()
  if (activeTunnel && tunnel) {
    let pythonPackages = null
    await axios.get(`http://${tunnel.host}:3000/get-installed-python-packages`, { params: { pythonPath: pythonPath } })
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
    return getBundledPythonEnvironment()
  }
})

ipcMain.handle("installBundledPythonExecutable", async (event) => {
  // Check if Python is installed
  let pythonInstalled = getBundledPythonEnvironment()
  if (pythonInstalled === null) {
    // If Python is not installed, install it
    return installBundledPythonExecutable(mainWindow)
  } else {
    // Check if the required packages are installed
    let requirementsInstalled = checkPythonRequirements()
    if (requirementsInstalled) {
      return true
    } else {
      await installRequiredPythonPackages(mainWindow)
      return true
    }
  }
})

ipcMain.handle("checkRequirements", async (event) => {
  return checkRequirements()
})

ipcMain.handle("checkPythonRequirements", async (event) => {
  return checkPythonRequirements()
})

ipcMain.handle("checkMongoDBisInstalled", async (event) => {
  return getMongoDBPath()
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
  stopMongoDB(mongoProcess)
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

// Function to start MongoDB
function startMongoDB(workspacePath) {
  const mongoConfigPath = path.join(workspacePath, ".medomics", "mongod.conf")
  if (fs.existsSync(mongoConfigPath)) {
    console.log("Starting MongoDB with config: " + mongoConfigPath)
    let mongod = getMongoDBPath()
    if (process.platform !== "darwin") {
      mongoProcess = spawn(mongod, ["--config", mongoConfigPath])
    } else {
      if (fs.existsSync(getMongoDBPath())) {
        mongoProcess = spawn(getMongoDBPath(), ["--config", mongoConfigPath])
      } else {
        mongoProcess = spawn("/opt/homebrew/Cellar/mongodb-community/7.0.12/bin/mongod", ["--config", mongoConfigPath], { shell: true })
      }
    }
    mongoProcess.stdout.on("data", (data) => {
      console.log(`MongoDB stdout: ${data}`)
    })

    mongoProcess.stderr.on("data", (data) => {
      console.error(`MongoDB stderr: ${data}`)
    })

    mongoProcess.on("close", (code) => {
      console.log(`MongoDB process exited with code ${code}`)
    })

    mongoProcess.on("error", (err) => {
      console.error("Failed to start MongoDB: ", err)
      // reject(err)
    })
  } else {
    const errorMsg = `MongoDB config file does not exist: ${mongoConfigPath}`
    console.error(errorMsg)
  }
}

// Function to stop MongoDB
async function stopMongoDB(mongoProcess) {
  return new Promise((resolve, reject) => {
    if (mongoProcess) {
      mongoProcess.on("exit", () => {
        mongoProcess = null
        resolve()
      })
      try {
        mongoProcess.kill()
        resolve()
      } catch (error) {
        console.log("Error while stopping MongoDB ", error)
        // reject()
      }
    } else {
      resolve()
    }
  })
}

export function getMongoDBPath() {
  if (process.platform === "win32") {
    // Check if mongod is in the process.env.PATH
    const paths = process.env.PATH.split(path.delimiter)
    for (let i = 0; i < paths.length; i++) {
      const binPath = path.join(paths[i], "mongod.exe")
      if (fs.existsSync(binPath)) {
        console.log("mongod found in PATH")
        return binPath
      }
    }
    // Check if mongod is in the default installation path on Windows - C:\Program Files\MongoDB\Server\<version to establish>\bin\mongod.exe
    const programFilesPath = process.env["ProgramFiles"]
    if (programFilesPath) {
      const mongoPath = path.join(programFilesPath, "MongoDB", "Server")
      // Check if the MongoDB directory exists
      if (!fs.existsSync(mongoPath)) {
        console.error("MongoDB directory not found")
        return null
      }
      const dirs = fs.readdirSync(mongoPath)
      for (let i = 0; i < dirs.length; i++) {
        const binPath = path.join(mongoPath, dirs[i], "bin", "mongod.exe")
        if (fs.existsSync(binPath)) {
          return binPath
        }
      }
    }
    console.error("mongod not found")
    return null
  } else if (process.platform === "darwin") {
    // Check if it is installed in the .medomics directory
    const binPath = path.join(process.env.HOME, ".medomics", "mongodb", "bin", "mongod")
    if (fs.existsSync(binPath)) {
      console.log("mongod found in .medomics directory")
      return binPath
    }
    if (process.env.NODE_ENV !== "production") {
      // Check if mongod is in the process.env.PATH
      const paths = process.env.PATH.split(path.delimiter)
      for (let i = 0; i < paths.length; i++) {
        const binPath = path.join(paths[i], "mongod")
        if (fs.existsSync(binPath)) {
          console.log("mongod found in PATH")
          return binPath
        }
      }
      // Check if mongod is in the default installation path on macOS - /usr/local/bin/mongod
      const binPath = "/usr/local/bin/mongod"
      if (fs.existsSync(binPath)) {
        return binPath
      }
    }
    console.error("mongod not found")
    return null
  } else if (process.platform === "linux") {
    // Check if mongod is in the process.env.PATH
    const paths = process.env.PATH.split(path.delimiter)
    for (let i = 0; i < paths.length; i++) {
      const binPath = path.join(paths[i], "mongod")
      if (fs.existsSync(binPath)) {
        return binPath
      }
    }
    console.error("mongod not found in PATH" + paths)
    // Check if mongod is in the default installation path on Linux - /usr/bin/mongod
    if (fs.existsSync("/usr/bin/mongod")) {
      return "/usr/bin/mongod"
    }
    console.error("mongod not found in /usr/bin/mongod")

    if (fs.existsSync("/home/" + process.env.USER + "/.medomics/mongodb/bin/mongod")) {
      return "/home/" + process.env.USER + "/.medomics/mongodb/bin/mongod"
    }
    return null
  } else {
    return "mongod"
  }
}

