import { app, ipcMain, Menu, dialog, BrowserWindow, protocol, shell } from "electron"
import axios from "axios"
import serve from "electron-serve"
import { createWindow } from "./helpers"
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
import { generateSSHKeyPair } from './sshKeygen.js'
import { Client } from 'ssh2'
import { setTunnelObject } from "../renderer/utilities/tunnelState.js"
import express from "express"; // or: const express = require("express");
import bodyParser from "body-parser";

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
  const openRecentWorkspacesSubmenuOptions = getRecentWorkspacesOptions(null, mainWindow, hasBeenSet, serverPort)
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

  // Remote express requests
  expressApp.post("/set-working-directory", async (req, res, next) =>{
    console.log(`received set-working-directory : `, req.body)
    const workspacePath = req.body.workspacePath.startsWith("/") ? req.body.workspacePath.slice(1) : req.body.workspacePath;
    try {
      const result = await setWorkspaceDirectory(workspacePath);
      console.log(`post setWorkspaceDirectory : ${workspacePath}`)
      if (result && result.hasBeenSet) {
        toast.success('Workspace set to: ' + workspacePath)
        res.json({ success: true });
      } else {
        console.log('error1, ', err)
        res.status(500).json({ success: false, error: err.message });
      }
    } catch (err) {
      console.log('error2, ', err)
      res.status(500).json({ success: false, error: err.message });
    }
  });

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
      event.reply("updateDirectory", {
        workingDirectory: dirTree(app.getPath("sessionData")),
        hasBeenSet: hasBeenSet,
        newPort: serverPort
      }) // Sends the folder structure to Next.js
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
})()

ipcMain.handle("request", async (_, axios_request) => {
  const result = await axios(axios_request)
  return { data: result.data, status: result.status }
})

// Python environment handling
ipcMain.handle("getInstalledPythonPackages", async (event, pythonPath) => {
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
  return getBundledPythonEnvironment()
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
  // Check if something is running on the port MEDconfig.mongoPort
  let port = MEDconfig.mongoPort
  let isRunning = false
  if (process.platform === "win32") {
    isRunning = exec(`netstat -ano | findstr :${port}`).toString().trim() !== ""
  } else if (process.platform === "darwin") {
    isRunning = exec(`lsof -i :${port}`).toString().trim() !== ""
  } else {
    isRunning = exec(`netstat -tuln | grep ${port}`).toString().trim() !== ""
  }

  return isRunning
})

app.on("window-all-closed", () => {
  console.log("app quit")
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

/**
 * @description Open a new window from an URL
 * @param {*} url The URL of the page to open
 * @returns {BrowserWindow} The new window
 */
function openWindowFromURL(url) {
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

export function getRemoteMongoDBPath() {
  const remotePlatform = getRemoteOS()

  if (remotePlatform === "win32") {
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

export function checkRemoteFolderExists(folderPath) {
  // Ensure tunnel is active and SSH client is available
  const tunnel = getTunnelState()
  if (!tunnel || !tunnel.tunnelActive || !tunnel.tunnelObject || !tunnel.tunnelObject.sshClient) {
    const errMsg = 'No active SSH tunnel for remote folder creation.'
    console.error(errMsg)
    return "tunnel inactive"
  }
  tunnel.tunnelObject.sshClient.sftp((err, sftp) => {
    if (err) {
      console.error('SFTP error:', err)
      return "sftp error"
    }

    // Check if folder exists
    sftp.stat(folderPath, (statErr, stats) => {
      if (!statErr && stats && stats.isDirectory && stats.isDirectory()) {
        // Folder exists
        sftp.end && sftp.end()
        return "exists"
      }
    })
  })
  return "does not exist"
}

async function detectRemoteOS() {
  return new Promise((resolve, reject) => {
    activeTunnel.exec('uname -s', (err, stream) => {
      if (err) {
        // Assume Windows if uname fails
        resolve('win32')
        return
      }
      let output = ''
      stream.on('data', (outputData) => { output += outputData.toString() })
      stream.on('close', () => {
        const out = output.trim().toLowerCase()
        if (out.includes('linux')) {
          resolve('linux')
        } else if (out.includes('darwin')) {
          resolve('darwin')
        } else if (out.includes('bsd')) {
          resolve('unix')
        } else {
          resolve('win32')
        }
      })
      stream.stderr.on('data', () => resolve('win32'))
    })
  })
}

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

let activeTunnel = null
let activeTunnelServer = null // Track the TCP server for proper cleanup
ipcMain.handle('startSSHTunnel', async (_event, {
  host,
  username,
  privateKey,
  password,
  remotePort,
  localBackendPort,
  remoteBackendPort,
  localMongoPort,
  remoteMongoPort
}) => {
  return new Promise((resolve, reject) => {
    if (activeTunnelServer) {
      try { activeTunnelServer.backendServer.close() } catch {}
      try { activeTunnelServer.mongoServer.close() } catch {}
      activeTunnelServer = null
    }
    if (activeTunnel) {
      try { activeTunnel.end() } catch {}
      activeTunnel = null
    }
    const connConfig = {
      host,
      port: parseInt(remotePort),
      username
    }
    if (privateKey) connConfig.privateKey = privateKey
    if (password) connConfig.password = password
    const conn = new Client()
    conn.on('ready', () => {
      const net = require('net')
      // Backend port forwarding
      const backendServer = net.createServer((socket) => {
        conn.forwardOut(
          socket.localAddress || '127.0.0.1',
          socket.localPort || 0,
          '127.0.0.1',
          parseInt(remoteBackendPort),
          (err, stream) => {
            if (err) {
              socket.destroy()
              return
            }
            socket.pipe(stream).pipe(socket)
          }
        )
      })
      backendServer.listen(localBackendPort, '127.0.0.1')

      // MongoDB port forwarding
      const mongoServer = net.createServer((socket) => {
        conn.forwardOut(
          socket.localAddress || '127.0.0.1',
          socket.localPort || 0,
          '127.0.0.1',
          parseInt(remoteMongoPort),
          (err, stream) => {
            if (err) {
              socket.destroy()
              return
            }
            socket.pipe(stream).pipe(socket)
          }
        )
      })
      mongoServer.listen(localMongoPort, '127.0.0.1')

      backendServer.on('error', (e) => {
        conn.end()
        reject(new Error('Backend local server error: ' + e.message))
      })
      mongoServer.on('error', (e) => {
        conn.end()
        reject(new Error('Mongo local server error: ' + e.message))
      })

      activeTunnel = conn
      setTunnelObject(conn)
      activeTunnelServer = { backendServer: backendServer, mongoServer: mongoServer }
      resolve({ success: true })
    }).on('error', (err) => {
      reject(new Error('SSH connection error: ' + err.message))
    }).connect(connConfig)
  })
})

ipcMain.handle('stopSSHTunnel', async () => {
  let success = false
  let error = null
  if (activeTunnelServer) {
    try {
      await new Promise((resolve, reject) => {
        activeTunnelServer.close((err) => {
          if (err) reject(err)
          else resolve()
        })
      })
      activeTunnelServer = null
      success = true
    } catch (e) {
      error = e.message || String(e)
    }
  }
  if (activeTunnel) {
    try { activeTunnel.end() } catch {}
    activeTunnel = null
    success = true
  }
  if (success) return { success: true }
  return { success: false, error: error || 'No active tunnel' }
})

ipcMain.handle('listRemoteDirectory', async (_event, { path: remotePath }) => {
  return new Promise((resolve, reject) => {
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
          return p
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

// Unified remote directory navigation handler
ipcMain.handle('navigateRemoteDirectory', async (_event, { action, path: currentPath, dirName }) => {
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
    return p
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

ipcMain.handle('createRemoteFolder', async (_event, { path: parentPath, folderName }) => {
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
    return p
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
        const parent = normalizePath(parentPath)
        // Step 1: resolve canonical parent path
        let canonicalParent = await new Promise((res, rej) => {
          sftp.realpath(parent, (e, abs) => e ? res(parent) : res(abs))
        })
        // Step 2: build new folder path
        let newFolderPath = canonicalParent.replace(/\/$/, '') + '/' + folderName
        // Step 3: create directory
        await new Promise((res, rej) => {
          sftp.mkdir(newFolderPath, (e) => e ? rej(e) : res())
        })
        closeSftp()
        resolve({ success: true })
      } catch (e) {
        closeSftp()
        resolve({ success: false, error: e.message })
      }
    })
  })
})
