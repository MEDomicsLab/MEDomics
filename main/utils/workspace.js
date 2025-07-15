import { app, dialog, ipcRenderer } from "electron"
import MEDconfig from "../../medomics.dev"

const fs = require("fs")
var path = require("path")
const dirTree = require("directory-tree")
const { getTunnelState } = require('../../renderer/utilities/tunnelState')

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
export function createWorkingDirectory() {
  // See the workspace menuTemplate in the repository
  createFolder("DATA")
  createFolder("EXPERIMENTS")
}

// Function to create the working directory on the server
export function createRemoteWorkingDirectory() {
  // See the workspace menuTemplate in the repository
  const folderPath = app.getPath("remoteSessionData")
  createRemoteFolder(folderPath + "/DATA")
  createRemoteFolder(folderPath + "/EXPERIMENTS")
}

// Function to create a folder from a given path
function createFolder(folderString) {
  // Creates a folder in the working directory
  const folderPath = path.join(app.getPath("sessionData"), folderString)
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

// Function to create a folder on the server from a given path using SFTP
function createRemoteFolder(folderPath, callback) {
  // Use SFTP via active tunnel to create a folder in the remote working directory
  const tunnel = getTunnelState()
  if (!tunnel || !tunnel.tunnelActive || !tunnel.tunnelObject || !tunnel.tunnelObject.sshClient) {
    const errMsg = 'No active SSH tunnel for remote folder creation.'
    console.error(errMsg)
    if (callback) callback(new Error(errMsg))
    return
  }

  tunnel.tunnelObject.sshClient.sftp((err, sftp) => {
    if (err) {
      console.error('SFTP error:', err)
      if (callback) callback(err)
      return
    }
    // Check if folder exists
    sftp.stat(folderPath, (statErr, stats) => {
      if (!statErr && stats && stats.isDirectory && stats.isDirectory()) {
        // Folder exists
        if (callback) callback(null, 'exists')
        sftp.end && sftp.end()
        return
      }
      // Try to create folder
      sftp.mkdir(folderPath, { mode: 0o755 }, (mkErr) => {
        if (mkErr) {
          console.error('SFTP mkdir error:', mkErr)
          if (callback) callback(mkErr)
        } else {
          console.log('Remote folder created successfully!')
          if (callback) callback(null, 'created')
        }
        sftp.end && sftp.end()
      })
    })
  })
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


// Function to create the .medomics directory and necessary files
export const createRemoteMedomicsDirectory = (directoryPath) => {
  const medomicsDir = path.join(directoryPath, ".medomics")
  const mongoDataDir = path.join(medomicsDir, "MongoDBdata")
  const mongoConfigPath = path.join(medomicsDir, "mongod.conf")

  // Create the .medomics directory on the remote server
  createRemoteFolder(medomicsDir, (err) => {
    if (err) {
      console.error("Error creating remote .medomics directory:", err)
      return
    }
    console.log(".medomics directory created successfully on remote server.")
  })

  // Create the mongoDataDir directory on the remote server
  createRemoteFolder(mongoDataDir, (err) => {
    if (err) {
      console.error("Error creating remote .medomics directory:", err)
      return
    }
    console.log(".medomics directory created successfully on remote server.")
  })

  // SFTP: Check if mongod.conf exists and write if not
  const tunnel = getTunnelState()
  if (!tunnel || !tunnel.tunnelActive || !tunnel.tunnelObject || !tunnel.tunnelObject.sshClient) {
    console.error('No active SSH tunnel for remote file creation.')
    return
  }
  tunnel.tunnelObject.sshClient.sftp((err, sftp) => {
    if (err) {
      console.error('SFTP error:', err)
      return
    }
    sftp.stat(mongoConfigPath, (statErr, stats) => {
      if (!statErr && stats && stats.isFile && stats.isFile()) {
        // File exists, do nothing
        sftp.end && sftp.end()
        return
      }
      // File does not exist, write it
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
      const writeStream = sftp.createWriteStream(mongoConfigPath, { encoding: 'utf8', mode: 0o644 })
      writeStream.on('error', (e) => {
        console.error('SFTP write error:', e)
        sftp.end && sftp.end()
      })
      writeStream.on('finish', () => {
        console.log('mongod.conf created successfully on remote server.')
        sftp.end && sftp.end()
      })
      writeStream.write(mongoConfig)
      writeStream.end()
    })
  })
}