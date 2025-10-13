import MEDconfig from "../../medomics.dev.js"
const { getAppPath, setAppPath } = require("./serverPathUtils.js")

const fs = require("fs")
var path = require("path")
const dirTree = require("directory-tree")

function getServerWorkingDirectory() {
  // Returns the working directory
  return getAppPath("sessionData")
}

function loadServerWorkspaces() {
  const userDataPath = getAppPath("userData")
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
function saveServerWorkspaces(workspaces) {
  const userDataPath = getAppPath("userData")
  const workspaceFilePath = path.join(userDataPath, "workspaces.json")
  fs.writeFileSync(workspaceFilePath, JSON.stringify(workspaces))
}

/**
 * Updates the recent workspaces
 * @param {String} workspacePath The path of the workspace to update
 */
function updateServerWorkspace(workspacePath) {
  const workspaces = loadServerWorkspaces()
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
  setAppPath("sessionData", workspacePath)
  saveServerWorkspaces(workspaces)
}

/**
 * Generate recent workspaces options
 * @param {*} event The event
 * @param {*} mainWindow The main window
 * @param {*} hasBeenSet A boolean indicating if the workspace has been set
 * @param {*} workspacesArray The array of workspaces, if null, the function will load the workspaces
 * @returns {Array} An array of recent workspaces options
 */
function getRecentServerWorkspacesOptions(event, mainWindow, hasBeenSet, serverPort, workspacesArray = null) {
  let workspaces
  if (workspacesArray === null) {
    workspaces = loadServerWorkspaces()
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
        updateServerWorkspace(workspace.path)
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
function createServerWorkingDirectory() {
  // See the workspace menuTemplate in the repository
  createFolder("DATA")
  createFolder("EXPERIMENTS")
}


// Function to create a folder from a given path
function createFolder(folderString) {
  // Creates a folder in the working directory
  const folderPath = path.join(getAppPath("sessionData"), folderString)
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
const createServerMedomicsDirectory = (directoryPath) => {
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

export {
  getServerWorkingDirectory,
  loadServerWorkspaces,
  updateServerWorkspace,
  getRecentServerWorkspacesOptions,
  createServerWorkingDirectory,
  createServerMedomicsDirectory
}

if (typeof module !== "undefined" && typeof module.exports !== "undefined") {
  module.exports = {
    getServerWorkingDirectory,
    loadServerWorkspaces,
    updateServerWorkspace,
    getRecentServerWorkspacesOptions,
    createServerWorkingDirectory,
    createServerMedomicsDirectory
   }
}