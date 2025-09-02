import { app, ipcMain, Menu, dialog, BrowserWindow, protocol, nativeTheme } from "electron"
import axios from "axios"
import serve from "electron-serve"
import { createWindow } from "./helpers"
import { installExtension, REACT_DEVELOPER_TOOLS } from "electron-extension-installer"
import MEDconfig, { PORT_FINDING_METHOD } from "../medomics.dev"
import { saveJSON, loadJSON } from "./helpers/datamanager"

const os = require("os")
const fs = require("fs")
var path = require("path")
const dirTree = require("directory-tree")
const { spawn, exec, execFile } = require("child_process")
var serverProcess = null
var serverPort = MEDconfig.defaultPort
var hasBeenSet = false
var recentWorkspaces = {}
const isProd = process.env.NODE_ENV === "production"
var serverIsRunning = false
let splashScreen // The splash screen is the window that is displayed while the application is loading
var mainWindow // The main window is the window of the application
const medCondaEnv = "med_conda_env"
var pythonEnvironment = null

//**** LOG ****// This is used to send the console.log messages to the main window
const originalConsoleLog = console.log
/**
 * @description Sends the console.log messages to the main window
 * @param {*} message The message to send
 * @summary We redefine the console.log function to send the messages to the main window
 */
console.log = function () {
  try {
    originalConsoleLog(...arguments)
    if (mainWindow !== undefined) {
      mainWindow.webContents.send("log", ...arguments)
    }
  } catch (error) {
    console.error(error)
  }
}

if (isProd) {
  serve({ directory: "app" })
} else {
  app.setPath("userData", `${app.getPath("userData")} (development)`)
}

;(async () => {
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
  const openRecentWorkspacesSubmenuOptions = getRecentWorkspacesOptions(null, mainWindow)
  console.log("openRecentWorkspacesSubmenuOptions", JSON.stringify(openRecentWorkspacesSubmenuOptions, null, 2))
  const menuTemplate = [
    {
      label: "File",
      submenu: [{ label: "Open recent", submenu: getRecentWorkspacesOptions(null, mainWindow) }, { type: "separator" }, { role: "quit" }]
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

  //******* PYTHON ENVIRONMENT *******//
  function getPythonEnvironment() {
    // Returns the python environment
    let pythonEnvironment = process.env.MED_ENV

    // Retrieve the path to the conda environment from the settings file
    let userDataPath = app.getPath("userData")
    let settingsFilePath = path.join(userDataPath, "settings.json")
    let settingsFound = fs.existsSync(settingsFilePath)
    let settings = {}
    if (settingsFound) {
      let settings = JSON.parse(fs.readFileSync(settingsFilePath, "utf8"))
      // Check if the conda environment is defined in the settings file
      if (settings.condaPath !== undefined) {
        pythonEnvironment = settings.condaPath
      }
    }

    if (pythonEnvironment === undefined) {
      if (pythonEnvironment === undefined || pythonEnvironment === null) {
        let userPath = process.env.HOME
        let anacondaPath = getCondaPath(userPath)
        if (anacondaPath !== null) {
          // If a python environment is found, the path to the python executable is returned
          if (checkCondaEnvs(anacondaPath).includes(medCondaEnv)) {
            pythonEnvironment = getThePythonExecutablePath(anacondaPath, medCondaEnv)
          }
        }
      }
    }
    // If the python environment is found, the conda path is saved in the settings file if it is not already defined
    if (pythonEnvironment !== undefined && pythonEnvironment !== null) {
      if (settingsFound && settings.condaPath === undefined) {
        settings.condaPath = pythonEnvironment
        fs.writeFileSync(settingsFilePath, JSON.stringify(settings))
      }
    }
    return pythonEnvironment
  }

  /**
   * @description Returns the path to the conda directory
   * @param {String} parentPath The path to the parent directory
   * @returns {String} The path to the conda directory
   */
  function getCondaPath(parentPath) {
    let condaPath = null
    const possibleCondaPaths = ["anaconda3", "miniconda3", "anaconda", "miniconda", "Anaconda3", "Miniconda3", "Anaconda", "Miniconda"]
    condaPath = checkDirectories(parentPath, possibleCondaPaths)
    if (condaPath === null) {
      if (process.platform !== "win32") {
        let condaPathTemp = path.join(parentPath, "opt")
        condaPath = checkDirectories(condaPathTemp, possibleCondaPaths)
        if (condaPath === null) {
          condaPathTemp = path.join(parentPath, "bin")
          condaPath = checkDirectories(condaPathTemp, possibleCondaPaths)
        }
      } else {
        parentPath = "C:\\"
        let condaPathTemp = path.join(parentPath, "ProgramData")
        condaPath = checkDirectories(condaPathTemp, possibleCondaPaths)
        if (condaPath === null) {
          condaPathTemp = path.join(parentPath, "Program Files")
          condaPath = checkDirectories(condaPathTemp, possibleCondaPaths)
          if (condaPath === null) {
            condaPathTemp = path.join(parentPath, "Program Files (x86)")
            condaPath = checkDirectories(condaPathTemp, possibleCondaPaths)
          }
        }
      }
      if (process.platform == "darwin" && condaPath === null) {
        parentPath = "/opt/homebrew"
        condaPath = checkDirectories(parentPath, possibleCondaPaths)
      }
      if (condaPath === null && process.platform !== "darwin") {
        console.log("No conda environment found")
        dialog.showMessageBoxSync({
          type: "error",
          title: "No conda environment found",
          message: "No conda environment found. Please install anaconda or miniconda and try again."
        })
      }
    }
    return condaPath
  }

  /**
   * Checks if a list of directories exists from a parent directory
   * @param {String} parentPath The path to the parent directory
   * @param {Array} directories The list of directories to check
   * @returns {String} The path to the directory that exists
   */
  function checkDirectories(parentPath, directories) {
    let directoryPath = null
    directories.forEach((directory) => {
      if (directoryPath === null) {
        let directoryPathTemp = path.join(parentPath, directory)
        console.log("directoryPathTemp: ", directoryPathTemp)
        if (fs.existsSync(directoryPathTemp)) {
          console.log("directoryPathTemp EXISTS: ", directoryPathTemp)
          directoryPath = directoryPathTemp
        }
      }
    })
    return directoryPath
  }

  /**
   * @description Returns the condas environments
   * @param {String} condaPath The path to the conda environment
   * @returns {Array} The condas environments
   */
  function checkCondaEnvs(condaPath) {
    let envsPath = path.join(condaPath, "envs")
    let envs = []
    if (fs.existsSync(envsPath)) {
      envs = fs.readdirSync(envsPath)
    }
    return envs
  }

  /**
   * @description Returns the path to the python executable
   * @param {String} condaPath The path to the conda environment
   * @param {String} envName The name of the conda environment
   * @returns {String} The path to the python executable
   */
  function getThePythonExecutablePath(condaPath, envName) {
    // Returns the path to the python executable
    let pythonExecutablePath = null
    if (process.platform == "win32") {
      pythonExecutablePath = path.join(condaPath, "envs", envName, "python.exe")
    } else {
      pythonExecutablePath = path.join(condaPath, "envs", envName, "bin", "python")
    }
    return pythonExecutablePath
  }

  //**** SERVER ****//
  function runServer(condaPath = null) {
    // Runs the server

    pythonEnvironment = getPythonEnvironment()
    if (process.platform !== "win32" && condaPath === null) {
      condaPath = pythonEnvironment
      if (pythonEnvironment !== undefined) {
        condaPath = pythonEnvironment
      }
    }

    if (!isProd) {
      //**** DEVELOPMENT ****//
      let args = [serverPort, "dev", process.cwd()]
      // Get the temporary directory path
      args.push(os.tmpdir())

      if (condaPath !== null) {
        args.push(condaPath)
      }

      findAvailablePort(MEDconfig.defaultPort)
        .then((port) => {
          serverPort = port
          serverIsRunning = true
          serverProcess = execFile(`${process.platform == "win32" ? "main.exe" : "./main"}`, args, {
            windowsHide: false,
            cwd: path.join(process.cwd(), "go_server")
          })
          if (serverProcess) {
            serverProcess.stdout.on("data", function (data) {
              console.log("data: ", data.toString("utf8"))
            })
            serverProcess.stderr.on("data", (data) => {
              console.log(`stderr: ${data}`)
            })
            serverProcess.on("close", (code) => {
              serverIsRunning = false
              console.log(`server child process close all stdio with code ${code}`)
            })
          }
        })
        .catch((err) => {
          console.error(err)
        })
    } else {
      //**** PRODUCTION ****//
      let args = [serverPort, "prod", process.resourcesPath]
      // Get the temporary directory path
      args.push(os.tmpdir())
      if (condaPath !== null) {
        args.push(condaPath)
      }

      findAvailablePort(MEDconfig.defaultPort)
        .then((port) => {
          serverPort = port
          console.log("_dirname: ", __dirname)
          console.log("process.resourcesPath: ", process.resourcesPath)

          if (process.platform == "win32") {
            serverProcess = execFile(path.join(process.resourcesPath, "go_executables\\server_go_win32.exe"), args, {
              windowsHide: false
            })
            serverIsRunning = true
          } else if (process.platform == "linux") {
            serverProcess = execFile(path.join(process.resourcesPath, "go_executables/server_go_linux"), args, {
              windowsHide: false
            })
            serverIsRunning = true
          } else if (process.platform == "darwin") {
            serverProcess = execFile(path.join(process.resourcesPath, "go_executables/server_go_mac"), args, {
              windowsHide: false
            })
            serverIsRunning = true
          }
          if (serverProcess) {
            serverProcess.stdout.on("data", function (data) {
              console.log("data: ", data.toString("utf8"))
            })
            serverProcess.stderr.on("data", (data) => {
              console.log(`stderr: ${data}`)
              serverIsRunning = true
            })
            serverProcess.on("close", (code) => {
              serverIsRunning = false
              console.log(`my server child process close all stdio with code ${code}`)
            })
          }
        })
        .catch((err) => {
          console.error(err)
        })
    }
    return serverIsRunning
  }

  // link: https://medium.com/red-buffer/integrating-python-flask-backend-with-electron-nodejs-frontend-8ac621d13f72
  console.log("running mode:", isProd ? "production" : "development")
  console.log(MEDconfig.runServerAutomatically ? "Server will start automatically here (in background of the application)" : "Server must be started manually")
  if (MEDconfig.runServerAutomatically) {
    runServer()
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
      getRecentWorkspacesOptions(event, mainWindow)
    }
  })

  ipcMain.on("setWorkingDirectory", (event, data) => {
    app.setPath("sessionData", data)
    console.log("setWorkingDirectory : ", data)
    hasBeenSet = true
    event.reply("workingDirectorySet", {
      workingDirectory: dirTree(app.getPath("sessionData")),
      hasBeenSet: true,
      newPort: serverPort
    })
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
    return serverIsRunning
  })

  /**
   * @description Kills the server
   * @returns {Boolean} True if the server was killed successfully, false otherwise
   * @summary Kills the server if it is running
   */
  ipcMain.handle("kill-server", async () => {
    if (serverProcess) {
      let success = await serverProcess.kill()
      serverIsRunning = false
      return success
    } else {
      return null
    }
  })

  /**
   * @description Starts the server
   * @param {*} event The event
   * @param {*} condaPath The path to the python executable (optional) - If null, the default python executable will be used (see environment variables MED_ENV)
   * @returns {Boolean} True if the server is running, false otherwise
   */
  ipcMain.handle("start-server", async (_event, condaPath = null) => {
    console.log("CONDA PATH: ", condaPath)
    if (serverProcess) {
      // kill the server if it is already running
      serverProcess.kill()
    }
    if (MEDconfig.runServerAutomatically) {
      let success = runServer(condaPath)
      return success
    }
    return serverIsRunning
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

  ipcMain.on("messageFromNext", (event, data) => {
    // Receives a message from Next.js
    console.log("messageFromNext : ", data)
    if (data === "requestDialogFolder") {
      // If the message is "requestDialogFolder", the function setWorkingDirectory is called
      setWorkingDirectory(event, mainWindow)
    } else if (data === "requestWorkingDirectory") {
      // If the message is "requestWorkingDirectory", the function getTheWorkingDirectoryStructure is called and the folder structure is returned to Next.js
      event.reply("messageFromElectron", {
        workingDirectory: dirTree(app.getPath("sessionData")),
        hasBeenSet: hasBeenSet,
        newPort: serverPort
      })
      updateWorkspace(app.getPath("sessionData"))
      event.reply("workingDirectorySet", {
        workingDirectory: dirTree(app.getPath("sessionData")),
        hasBeenSet: hasBeenSet,
        newPort: serverPort
      })
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


  // --- OAuth Key handlers ---
ipcMain.handle("tailscale-save-oauth-key", async (_event, oauthKey) => {
  try {
    const userDataPath = app.getPath("userData");
    const settingsFilePath = path.join(userDataPath, "settings.json");
    let settings = {};
    if (fs.existsSync(settingsFilePath)) {
      settings = JSON.parse(fs.readFileSync(settingsFilePath, "utf8"));
    }
    settings.tailscale = settings.tailscale || {};
    // optional: base64 encode to avoid raw-plaintext-looking, not real security
    settings.tailscale.oauthKey = Buffer.from(oauthKey, "utf8").toString("base64");
    settings.tailscale.oauthSavedAt = new Date().toISOString();
    fs.writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2));
    return { success: true };
  } catch (e) {
    console.error("Failed to save OAuth key:", e);
    return { success: false, message: e.message };
  }
});

ipcMain.handle("tailscale-get-oauth-key", async () => {
  try {
    const userDataPath = app.getPath("userData");
    const settingsFilePath = path.join(userDataPath, "settings.json");
    if (!fs.existsSync(settingsFilePath)) return { success: false, message: "no settings file" };
    const settings = JSON.parse(fs.readFileSync(settingsFilePath, "utf8"));
    if (!settings.tailscale || !settings.tailscale.oauthKey) {
      return { success: false, message: "oauth key not saved" };
    }
    const oauthKey = Buffer.from(settings.tailscale.oauthKey, "base64").toString("utf8");
    return { success: true, oauthKey };
  } catch (e) {
    console.error("Failed to get OAuth key:", e);
    return { success: false, message: e.message };
  }
});

ipcMain.handle("tailscale-delete-oauth-key", async () => {
  try {
    const userDataPath = app.getPath("userData");
    const settingsFilePath = path.join(userDataPath, "settings.json");
    if (!fs.existsSync(settingsFilePath)) return { success: true };
    const settings = JSON.parse(fs.readFileSync(settingsFilePath, "utf8"));
    if (settings.tailscale && settings.tailscale.oauthKey) {
      delete settings.tailscale.oauthKey;
      delete settings.tailscale.oauthSavedAt;
      fs.writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2));
    }
    return { success: true };
  } catch (e) {
    console.error("Failed to delete OAuth key:", e);
    return { success: false, message: e.message };
  }
});

ipcMain.handle("tailscale-has-oauth-key", async () => {
  try {
    const userDataPath = app.getPath("userData");
    const settingsFilePath = path.join(userDataPath, "settings.json");
    if (!fs.existsSync(settingsFilePath)) return { success: true, hasKey: false };
    const settings = JSON.parse(fs.readFileSync(settingsFilePath, "utf8"));
    return { success: true, hasKey: !!(settings.tailscale && settings.tailscale.oauthKey) };
  } catch (e) {
    console.error("Failed to check OAuth key presence:", e);
    return { success: false, message: e.message };
  }
});

// --- Auth Key handlers ---
ipcMain.handle("tailscale-save-auth-key", async (_event, args) => {
  try {
    if (!args || typeof args !== "object") {
      return { success: false, message: "Expected an object with authKey and expires" };
    }
    const { authKey, expires } = args;
    console.log("Saving Auth key:", authKey, "Expires:", expires);

    const userDataPath = app.getPath("userData");
    const settingsFilePath = path.join(userDataPath, "settings.json");
    let settings = {};
    if (fs.existsSync(settingsFilePath)) {
      settings = JSON.parse(fs.readFileSync(settingsFilePath, "utf8"));
    }
    settings.tailscale = settings.tailscale || {};
    settings.tailscale.authKey = Buffer.from(authKey, "utf8").toString("base64");
    settings.tailscale.authSavedAt = new Date().toISOString();
        const expDate = new Date(expires);
    if (isNaN(expDate)) {
      return { success: false, message: "Invalid expiry format" };
    }
    settings.tailscale.expires = expDate.toISOString();
    fs.writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2));
    return { success: true };
  } catch (e) {
    console.error("Failed to save Auth key:", e);
    return { success: false, message: e.message };
  }
});

ipcMain.handle("tailscale-get-auth-key", async () => {
  try {
    const userDataPath = app.getPath("userData");
    const settingsFilePath = path.join(userDataPath, "settings.json");
    if (!fs.existsSync(settingsFilePath)) {
      return { success: false, message: "no settings file" };
    }

    const settings = JSON.parse(fs.readFileSync(settingsFilePath, "utf8"));
    if (!settings.tailscale || !settings.tailscale.authKey) {
      return { success: false, message: "auth key not saved" };
    }

    const authKey = Buffer.from(settings.tailscale.authKey, "base64").toString("utf8");

    let expires = null;
    let expired = false;
    let remainingSeconds = null;

    if (settings.tailscale.expires) {
      const expDate = new Date(settings.tailscale.expires);
      if (!isNaN(expDate)) {
        const now = Date.now();
        remainingSeconds = Math.max(0, Math.floor((expDate.getTime() - now) / 1000));
        expired = remainingSeconds === 0;
        expires = expDate.toISOString();
      } else {
        console.warn("Invalid expires value in settings:", settings.tailscale.expires);
      }
    }

    return {
      success: true,
      authKey,
      expires, // ISO string or null if absent/invalid
      expired,
      remainingSeconds, // null if unknown
      savedAt: settings.tailscale?.authSavedAt || null,
    };
  } catch (e) {
    console.error("Failed to get Auth key:", e);
    return { success: false, message: e.message };
  }
});


ipcMain.handle("tailscale-delete-auth-key", async () => {
  try {
    const userDataPath = app.getPath("userData");
    const settingsFilePath = path.join(userDataPath, "settings.json");
    if (!fs.existsSync(settingsFilePath)) return { success: true };
    const settings = JSON.parse(fs.readFileSync(settingsFilePath, "utf8"));
    if (settings.tailscale && settings.tailscale.authKey) {
      delete settings.tailscale.authKey;
      delete settings.tailscale.authSavedAt;
      fs.writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2));
    }
    return { success: true };
  } catch (e) {
    console.error("Failed to delete Auth key:", e);
    return { success: false, message: e.message };
  }
});

ipcMain.handle("tailscale-has-auth-key", async () => {
  try {
    const userDataPath = app.getPath("userData");
    const settingsFilePath = path.join(userDataPath, "settings.json");
    if (!fs.existsSync(settingsFilePath)) return { success: true, hasKey: false };
    const settings = JSON.parse(fs.readFileSync(settingsFilePath, "utf8"));
    return { success: true, hasKey: !!(settings.tailscale && settings.tailscale.authKey) };
  } catch (e) {
    console.error("Failed to check Auth key presence:", e);
    return { success: false, message: e.message };
  }
});


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

  splashScreen?.destroy()
  mainWindow.maximize()
  mainWindow.show()
})()

/**
 * @description Set the working directory
 * @summary Opens the dialog to select the working directory and  creates the folder structure if it does not exist
 *          When the working directory is set, the function returns the folder structure of the working directory as a JSON object in a reply to Next.js
 * @param {*} event
 * @param {*} mainWindow
 */
function setWorkingDirectory(event, mainWindow) {
  dialog
    .showOpenDialog(mainWindow, {
      // Opens the dialog to select the working directory (Select a folder window)
      properties: ["openDirectory"]
    })
    .then((result) => {
      if (result.canceled) {
        // If the user cancels the dialog
        console.log("Dialog was canceled")
        event.reply("messageFromElectron", "Dialog was canceled")
      } else {
        const file = result.filePaths[0]
        console.log(file)
        if (dirTree(file).children.length > 0) {
          // If the selected folder is not empty
          console.log("Selected folder is not empty")
          event.reply("messageFromElectron", "Selected folder is not empty")
          // Open a dialog to ask the user if he wants to still use the selected folder as the working directory or if he wants to select another folder
          dialog
            .showMessageBox(mainWindow, {
              type: "question",
              buttons: ["Yes", "No"],
              title: "Folder is not empty",
              message: "The selected folder is not empty. Do you want to use this folder as the working directory?"
            })
            .then((result) => {
              if (result.response === 0) {
                // If the user clicks on "Yes"
                console.log("Working directory set to " + file)
                event.reply("messageFromElectron", "Working directory set to " + file)
                // Add selected folder to the recent workspaces
                updateWorkspace(file)
                app.setPath("sessionData", file)
                createWorkingDirectory()
                hasBeenSet = true // The boolean hasBeenSet is set to true to indicate that the working directory has been set
                // This is the variable that controls the disabled/enabled state of the IconSidebar's buttons in Next.js
                event.reply("messageFromElectron", dirTree(file))
                event.reply("workingDirectorySet", {
                  workingDirectory: dirTree(file),
                  hasBeenSet: hasBeenSet
                })
              } else if (result.response === 1) {
                // If the user clicks on "No"
                console.log("Dialog was canceled")
                event.reply("messageFromElectron", "Dialog was canceled")
              }
            })
        } else if (file === app.getPath("sessionData")) {
          // If the working directory is already set to the selected folder
          console.log("Working directory is already set to " + file)
          event.reply("messageFromElectron", "Working directory is already set to " + file)
          event.reply("workingDirectorySet", {
            workingDirectory: dirTree(file),
            hasBeenSet: hasBeenSet
          })
        } else {
          // If the working directory is not set to the selected folder
          // The working directory is set to the selected folder and the folder structure is returned to Next.js
          console.log("Working directory set to " + file)
          event.reply("messageFromElectron", "Working directory set to " + file)
          app.setPath("sessionData", file)
          updateWorkspace(file)
          createWorkingDirectory()
          hasBeenSet = true // The boolean hasBeenSet is set to true to indicate that the working directory has been set
          // This is the variable that controls the disabled/enabled state of the IconSidebar's buttons in Next.js
          event.reply("messageFromElectron", dirTree(file))
          event.reply("workingDirectorySet", {
            workingDirectory: dirTree(file),
            hasBeenSet: hasBeenSet
          })
        }
      }
    })
    .catch((err) => {
      console.log(err)
    })
}

function createWorkingDirectory() {
  // See the workspace menuTemplate in the repository
  createFolder("DATA")
  createFolder("EXPERIMENTS")
}

function createFolder(folderString) {
  // Creates a folder in the working directory
  const folderPath = path.join(app.getPath("sessionData"), folderString)

  fs.mkdir(folderPath, { recursive: true }, (err) => {
    if (err) {
      console.error(err)
      return
    }

    console.log("Folder created successfully!")
  })
}

function getTheWorkingDirectoryStructure() {
  // Returns the folder structure of the working directory
  const dirTree = require("directory-tree")
  const tree = dirTree(getWorkingDirectory())
  return tree
}

function getWorkingDirectory() {
  // Returns the working directory
  return app.getPath("sessionData")
}

ipcMain.handle("request", async (_, axios_request) => {
  const result = await axios(axios_request)
  return { data: result.data, status: result.status }
})

app.on("window-all-closed", () => {
  console.log("app quit")
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

if (MEDconfig.useReactDevTools) {
  app.on("ready", async () => {
    await installExtension(REACT_DEVELOPER_TOOLS, {
      loadExtensionOptions: {
        allowFileAccess: true
      }
    })
  })
}

function findAvailablePort(startPort, endPort = 8000) {
  let killProcess = MEDconfig.portFindingMethod === PORT_FINDING_METHOD.FIX || !MEDconfig.runServerAutomatically
  let platform = process.platform
  return new Promise((resolve, reject) => {
    let port = startPort
    function tryPort() {
      if (platform == "darwin") {
        exec(`lsof -i:${port}`, (err, stdout, stderr) => {
          if (err) {
            console.log(`Port ${port} is available !`)
            resolve(port)
          } else {
            if (killProcess) {
              exec("kill -9 $(lsof -t -i:" + port + ")", (err, stdout, stderr) => {
                if (!err) {
                  console.log("Previous server instance was killed successfully")
                  console.log(`Port ${port} is now available !`)
                  resolve(port)
                }
                stdout && console.log(stdout)(stderr) && console.log(stderr)
              })
            } else {
              port++
              if (port > endPort) {
                reject("No available port")
              }
              tryPort()
            }
          }
        })
      } else {
        exec(`netstat ${platform == "win32" ? "-ano | find" : "-ltnup | grep"} ":${port}"`, (err, stdout, stderr) => {
          if (err) {
            console.log(`Port ${port} is available !`)
            resolve(port)
          } else {
            if (killProcess) {
              let PID = stdout.trim().split(/\s+/)[stdout.trim().split(/\s+/).length - 1].split("/")[0]
              exec(`${platform == "win32" ? "taskkill /f /t /pid" : "kill"} ${PID}`, (err, stdout, stderr) => {
                if (!err) {
                  console.log("Previous server instance was killed successfully")
                  console.log(`Port ${port} is now available !`)
                  resolve(port)
                }
                stdout && console.log(stdout)(stderr) && console.log(stderr)
              })
            } else {
              port++
              if (port > endPort) {
                reject("No available port")
              }
              tryPort()
            }
          }
        })
      }
    }
    tryPort()
  })
}

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

/**
 * Loads the recent workspaces
 * @returns {Array} An array of workspaces
 */
function loadWorkspaces() {
  const userDataPath = app.getPath("userData")
  const workspaceFilePath = path.join(userDataPath, "workspaces.json")
  if (fs.existsSync(workspaceFilePath)) {
    const workspaces = JSON.parse(fs.readFileSync(workspaceFilePath, "utf8"))
    // Sort workspaces by date, most recent first
    let sortedWorkspaces = workspaces.sort((a, b) => new Date(b.last_time_it_was_opened) - new Date(a.last_time_it_was_opened))
    // Check if the workspaces still exist
    let workspacesThatStillExist = []
    sortedWorkspaces.forEach((workspace) => {
      if (fs.existsSync(workspace.path)) {
        workspacesThatStillExist.push(workspace)
      } else {
        console.log("Workspace does not exist anymore: ", workspace.path)
      }
    })
    return workspacesThatStillExist
  } else {
    return []
  }
}

/**
 * Saves the recent workspaces
 * @param {Array} workspaces An array of workspaces
 */
function saveWorkspaces(workspaces) {
  const userDataPath = app.getPath("userData")
  const workspaceFilePath = path.join(userDataPath, "workspaces.json")
  fs.writeFileSync(workspaceFilePath, JSON.stringify(workspaces))
}

/**
 * Updates the recent workspaces
 * @param {String} workspacePath The path of the workspace to update
 */
function updateWorkspace(workspacePath) {
  const workspaces = loadWorkspaces()
  const workspaceIndex = workspaces.findIndex((workspace) => workspace.path === workspacePath)
  if (workspaceIndex !== -1) {
    // Workspace exists, update it
    workspaces[workspaceIndex].status = "opened"
    workspaces[workspaceIndex].last_time_it_was_opened = new Date().toISOString()
  } else {
    // Workspace doesn't exist, add it
    workspaces.push({
      path: workspacePath,
      status: "opened",
      last_time_it_was_opened: new Date().toISOString()
    })
  }
  app.setPath("sessionData", workspacePath)
  saveWorkspaces(workspaces)
}

/**
 * Generate recent workspaces options
 * @param {*} event The event
 * @param {*} mainWindow The main window
 * @param {*} workspacesArray The array of workspaces, if null, the function will load the workspaces
 * @returns {Array} An array of recent workspaces options
 */
function getRecentWorkspacesOptions(event, mainWindow, workspacesArray = null) {
  let workspaces
  if (workspacesArray === null) {
    workspaces = loadWorkspaces()
  } else {
    workspaces = workspacesArray
  }
  const recentWorkspaces = workspaces.filter((workspace) => workspace.status === "opened")
  if (event !== null) {
    event.reply("recentWorkspaces", recentWorkspaces)
  }
  const recentWorkspacesOptions = recentWorkspaces.map((workspace) => {
    return {
      label: workspace.path,
      click() {
        updateWorkspace(workspace.path)
        let workspaceObject = { workingDirectory: dirTree(workspace.path), hasBeenSet: true, newPort: serverPort }
        hasBeenSet = true
        mainWindow.webContents.send("openWorkspace", workspaceObject)
      }
    }
  })
  return recentWorkspacesOptions
}
