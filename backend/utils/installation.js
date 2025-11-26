// Electron dependencies removed / made optional for headless backend usage.
// Attempt dynamic import of electron; fall back to plain filesystem paths if unavailable.
import { execCallbacksForChildWithNotifications } from "../utils/pythonEnv.js"
import { getBundledPythonEnvironment } from "../utils/pythonEnv.js"
import { getMongoDBPath } from "../utils/mongoDBServer.js"
import fs from "fs"
import os from "os"
import path from "path"

let app = null
try {
  const electronMod = await import("electron")
  app = electronMod.app
} catch (e) {
  // Fallback minimal app shim
  app = {
    getPath(name) {
      if (name === "home") return os.homedir()
      if (name === "downloads") return path.join(os.homedir(), "Downloads")
      return process.cwd()
    }
  }
}

// UI window not available in headless mode; use null notify target.
const mainWindow = null

export const checkIsBrewInstalled = async () => {
  let isBrewInstalled = false
  try {
    let { stdout, stderr } = await exec(`brew --version`)
    isBrewInstalled = stdout !== "" && stderr === ""
  } catch (error) {
    isBrewInstalled = false
  }
  return isBrewInstalled
}

export const checkIsXcodeSelectInstalled = async () => {
  let isXcodeSelectInstalled = false
  try {
    let { stdout, stderr } = await exec(`xcode-select -p`)
    isXcodeSelectInstalled = stdout !== "" && stderr === ""
  } catch (error) {
    isXcodeSelectInstalled = false
  }
}

export const installBrew = async () => {
  let installBrewPromise = exec(`/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`)
  execCallbacksForChildWithNotifications(installBrewPromise.child, "Installing Homebrew", null)
  await installBrewPromise
  return true
}

export const installXcodeSelect = async () => {
  let installXcodeSelectPromise = exec(`xcode-select --install`)
  execCallbacksForChildWithNotifications(installXcodeSelectPromise.child, "Installing Xcode Command Line Tools", null)
  await installXcodeSelectPromise
  return true
}


const util = require("util")
const exec = util.promisify(require("child_process").exec)

export const checkRequirements = async () => {
  // Check if .medomics directory exists
  let medomicsDirExists = fs.existsSync(path.join(app.getPath("home"), ".medomics"))
  if (!medomicsDirExists) {
    fs.mkdirSync(path.join(app.getPath("home"), ".medomics"))
  }
  let mongoDBInstalled = getMongoDBPath()
  let pythonInstalled = getBundledPythonEnvironment()

  console.log("MongoDB installed: " + mongoDBInstalled)
  console.log("Python installed: " + pythonInstalled)
  return { pythonInstalled: pythonInstalled, mongoDBInstalled: mongoDBInstalled }
}

export const installMongoDB = async () => {
  if (process.platform === "win32") {
    // Download MongoDB installer
    const downloadUrl = "https://fastdl.mongodb.org/windows/mongodb-windows-x86_64-7.0.12-signed.msi"
    const downloadPath = path.join(app.getPath("downloads"), "mongodb-windows-x86_64-7.0.12-signed.msi")
    let downloadMongoDBPromise = exec(`curl -o ${downloadPath} ${downloadUrl}`)
    execCallbacksForChildWithNotifications(downloadMongoDBPromise.child, "Downloading MongoDB installer", null)
    await downloadMongoDBPromise
    // Install MongoDB
    // msiexec.exe /l*v mdbinstall.log /qb /i mongodb-windows-x86_64-7.0.12-signed.msi ADDLOCAL="ServerNoService" SHOULD_INSTALL_COMPASS="0"
    let installMongoDBPromise = exec(`msiexec.exe /l*v mdbinstall.log /qb /i ${downloadPath} ADDLOCAL="ServerNoService" SHOULD_INSTALL_COMPASS="0"`)
    execCallbacksForChildWithNotifications(installMongoDBPromise.child, "Installing MongoDB", null)
    await installMongoDBPromise

    let removeMongoDBInstallerPromise = exec(`rm ${downloadPath}`, { shell: "powershell" })
    execCallbacksForChildWithNotifications(removeMongoDBInstallerPromise.child, "Removing MongoDB installer", null)
    await removeMongoDBInstallerPromise

    return getMongoDBPath() !== null
  } else if (process.platform === "darwin") {
    // Check if Homebrew is installed
    let isBrewInstalled = await checkIsBrewInstalled()
    if (!isBrewInstalled) {
      await installBrew()
    }
    // Check if Xcode Command Line Tools are installed
    let isXcodeSelectInstalled = await checkIsXcodeSelectInstalled()
    if (!isXcodeSelectInstalled) {
      await installXcodeSelect()
    }

    let installMongoDBPromise = exec(`brew tap mongodb/brew && brew install mongodb-community@7.0.12`)
    execCallbacksForChildWithNotifications(installMongoDBPromise.child, "Installing MongoDB", null)
    

    
    return getMongoDBPath() !== null
  } else if (process.platform === "linux") {
    const linuxURLDict = {
      "Ubuntu 20.04 x86_64": "https://fastdl.mongodb.org/linux/mongodb-linux-x86_64-ubuntu2004-7.0.15.tgz",
      "Ubuntu 22.04 x86_64": "https://fastdl.mongodb.org/linux/mongodb-linux-x86_64-ubuntu2204-7.0.15.tgz",
      "Ubuntu 20.04 aarch64": "https://fastdl.mongodb.org/linux/mongodb-linux-aarch64-ubuntu2004-7.0.15.tgz",
      "Ubuntu 22.04 aarch64": "https://fastdl.mongodb.org/linux/mongodb-linux-aarch64-ubuntu2204-7.0.15.tgz",
      "Debian 10 x86_64": "https://fastdl.mongodb.org/linux/mongodb-linux-x86_64-debian10-7.0.15.tgz",
      "Debian 11 x86_64": "https://fastdl.mongodb.org/linux/mongodb-linux-x86_64-debian11-7.0.15.tgz",
    }
    // Check if MongoDB is installed
    if (getMongoDBPath() !== null) {
      return true
    } else {
      // Check which Linux distribution is being used
      let { stdout, stderr } = await exec(`cat /etc/os-release`)
      let osRelease = stdout
      let isUbuntu = osRelease.includes("Ubuntu")
      if (!isUbuntu) {
        console.log("Only Ubuntu is supported for now")
        return false
      } else {
        // osRelease is a string with the contents of /etc/os-release
        // Get the version of Ubuntu
        let ubuntuVersion = osRelease.match(/VERSION_ID="(.*)"/)[1]
        // Get the architecture of the system
        let architecture = "x86_64"
        if (process.arch === "arm64") {
          architecture = "aarch64"
        }
        // Get the download URL
        let downloadUrl = linuxURLDict[`Ubuntu ${ubuntuVersion} ${architecture}`]
        // Download MongoDB installer
        const downloadPath = path.join(app.getPath("downloads"), `mongodb-linux-${architecture}-ubuntu${ubuntuVersion}-7.0.15.tgz`)
        let downloadMongoDBPromise = exec(`curl -o ${downloadPath} ${downloadUrl}`)
        execCallbacksForChildWithNotifications(downloadMongoDBPromise.child, "Downloading MongoDB installer", null)
        await downloadMongoDBPromise
        // Install MongoDB in the .medomics directory in the user's home directory
        ubuntuVersion = ubuntuVersion.replace(".", "")
        let command = `tar -xvzf ${downloadPath} -C /home/${process.env.USER}/.medomics/ && mv /home/${process.env.USER}/.medomics/mongodb-linux-${architecture}-ubuntu${ubuntuVersion}-7.0.15 /home/${process.env.USER}/.medomics/mongodb`
        let installMongoDBPromise = exec(command)

        // let installMongoDBPromise = exec(`tar -xvzf ${downloadPath} && mv mongodb-linux-${architecture}-ubuntu${ubuntuVersion}-7.0.15 /home/${process.env.USER}/.medomics/mongodb`)
        execCallbacksForChildWithNotifications(installMongoDBPromise.child, "Installing MongoDB", null)
        await installMongoDBPromise
        
        
        

        return getMongoDBPath() !== null
      }
    }
  }
}
