import { app, dialog, ipcRenderer } from "electron"
import MEDconfig from "../../medomics.dev"

const fs = require("fs")
var path = require("path")
const dirTree = require("directory-tree")

/**
 * @description Set the working directory
 * @summary Opens the dialog to select the working directory and  creates the folder structure if it does not exist
 *          When the working directory is set, the function returns the folder structure of the working directory as a JSON object in a reply to Next.js
 * @param {*} event
 * @param {*} mainWindow
 * @param {*} hasBeenSet
 */
export function setWorkingDirectory(event, mainWindow) {
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
                mainWindow.webContents.send("setWorkingDirectoryInApp", file)
                mainWindow.webContents.send("setRecentWorkspacesInApp", file)
              } else if (result.response === 1) {
                // If the user clicks on "No"
                console.log("Dialog was canceled")
                event.reply("messageFromElectron", "Dialog was canceled")
              }
            })
        } else if (file === app.getPath("sessionData")) {
          // If the working directory is already set to the selected folder
          console.log("Working directory is already set to " + file)
        } else {
          // If the working directory is not set to the selected folder
          // The working directory is set to the selected folder and the folder structure is returned to Next.js
          mainWindow.webContents.send("setWorkingDirectoryInApp", file)
        }
      }
    })
    .catch((err) => {
      console.log(err)
    })
}

function getWorkingDirectory() {
  // Returns the working directory
  return app.getPath("sessionData")
}

/**
 * Loads the recent workspaces
 * @returns {Array} An array of workspaces
 */
export function loadWorkspaces() {
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
export function updateWorkspace(workspacePath) {
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
 * @param {*} hasBeenSet A boolean indicating if the workspace has been set
 * @param {*} workspacesArray The array of workspaces, if null, the function will load the workspaces
 * @returns {Array} An array of recent workspaces options
 */
export function getRecentWorkspacesOptions(event, mainWindow, hasBeenSet, serverPort, workspacesArray = null) {
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
        let workspaceObject = {
          workingDirectory: dirTree(workspace.path),
          hasBeenSet: true,
          newPort: serverPort
        }
        hasBeenSet = true
        //mainWindow.webContents.send("openWorkspace", workspaceObject)
      }
    }
  })
  return recentWorkspacesOptions
}

// Function to create the working directory
export function createWorkingDirectory(basePath) {
  // Create DATA and EXPERIMENTS directories under the given workspace path
  createFolder(basePath, "DATA")
  createFolder(basePath, "EXPERIMENTS")
}

// Function to create a folder under the given base path
function createFolder(basePath, folderString) {
  const folderPath = path.join(basePath, folderString)
  // Check if the folder already exists
  if (!fs.existsSync(folderPath)) {
    fs.mkdir(folderPath, { recursive: true }, (err) => {
      if (err) {
        console.error(err)
        return
      }
      console.log("Folder created successfully!")
    })
  }
}

// Function to create the .medomics directory and necessary files
export const createMedomicsDirectory = (directoryPath) => {
  const medomicsDir = path.join(directoryPath, ".medomics")
  const mongoDataDir = path.join(medomicsDir, "MongoDBdata")
  const mongoConfigPath = path.join(medomicsDir, "mongod.conf")

  if (!fs.existsSync(medomicsDir)) {
    // Create .medomicsDir
    fs.mkdirSync(medomicsDir)
  }

  if (!fs.existsSync(mongoDataDir)) {
    // Create MongoDB data dir
    fs.mkdirSync(mongoDataDir)
  }

  if (!fs.existsSync(mongoConfigPath)) {
    // Create mongod.conf
    const mongoConfig = `
    systemLog:
      destination: file
      path: ${path.join(medomicsDir, "mongod.log")}
      logAppend: true
    storage:
      dbPath: ${mongoDataDir}
    net:
      bindIp: localhost
      port: ${MEDconfig.mongoPort}
    `
    fs.writeFileSync(mongoConfigPath, mongoConfig)
  }
}
