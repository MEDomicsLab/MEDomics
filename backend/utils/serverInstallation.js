import { getBundledPythonEnvironment, execCallbacksForChildWithNotifications } from "./pythonEnv.js"
import { getMongoDBPath } from "./mongoDBServer.js"
import { getAppPath } from "./serverPathUtils.js"
import fs from "fs"
import readline from "readline"

async function checkIsBrewInstalled() {
  let isBrewInstalled = false
  try {
    let { stdout, stderr } = await exec(`brew --version`)
    isBrewInstalled = stdout !== "" && stderr === ""
  } catch (error) {
    isBrewInstalled = false
  }
  return isBrewInstalled
}

async function checkIsXcodeSelectInstalled() {
  let isXcodeSelectInstalled = false
  try {
    let { stdout, stderr } = await exec(`xcode-select -p`)
    isXcodeSelectInstalled = stdout !== "" && stderr === ""
  } catch (error) {
    isXcodeSelectInstalled = false
  }
  return isXcodeSelectInstalled
}

async function installBrew(){
  let installBrewPromise = exec(`/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`)
  await installBrewPromise
  return true
}

async function installXcodeSelect() {
  let installXcodeSelectPromise = exec(`xcode-select --install`)
  await installXcodeSelectPromise
  return true
}


import path from "path"
import util from "util"
import { exec as childProcessExec } from "child_process"
const exec = util.promisify(childProcessExec)

async function checkRequirements() {
  // Ensure .medomics directory exists
  const homeDir = getAppPath("home")
  const medomicsDir = path.join(homeDir, ".medomics")
  if (!fs.existsSync(medomicsDir)) {
    fs.mkdirSync(medomicsDir)
  }
  const mongoDBInstalled = getMongoDBPath()
  const pythonInstalled = getBundledPythonEnvironment()

  console.log("MongoDB installed:", mongoDBInstalled ? mongoDBInstalled : "Not found")
  console.log("Python installed:", pythonInstalled ? pythonInstalled : "Not found")
  return { pythonInstalled, mongoDBInstalled }
}

async function installMongoDB() {
  if (process.platform === "win32") {
    // Download MongoDB installer
    const downloadUrl = "https://fastdl.mongodb.org/windows/mongodb-windows-x86_64-7.0.12-signed.msi"
    const downloadPath = path.join(getAppPath("downloads"), "mongodb-windows-x86_64-7.0.12-signed.msi")
    let downloadMongoDBPromise = exec(`curl -o ${downloadPath} ${downloadUrl}`)
    execCallbacksForChildWithNotifications(downloadMongoDBPromise.child, "Downloading MongoDB installer")
    await downloadMongoDBPromise
    // Install MongoDB
    // msiexec.exe /l*v mdbinstall.log /qb /i mongodb-windows-x86_64-7.0.12-signed.msi ADDLOCAL="ServerNoService" SHOULD_INSTALL_COMPASS="0"
    let installMongoDBPromise = exec(`msiexec.exe /l*v mdbinstall.log /qb /i ${downloadPath} ADDLOCAL="ServerNoService" SHOULD_INSTALL_COMPASS="0"`)
    execCallbacksForChildWithNotifications(installMongoDBPromise.child, "Installing MongoDB")
    await installMongoDBPromise

    let removeMongoDBInstallerPromise = exec(`rm ${downloadPath}`, { shell: "powershell" })
    execCallbacksForChildWithNotifications(removeMongoDBInstallerPromise.child, "Removing MongoDB installer")
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
    execCallbacksForChildWithNotifications(installMongoDBPromise.child, "Installing MongoDB")
    

    
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
        const downloadPath = path.join(getAppPath("downloads"), `mongodb-linux-${architecture}-ubuntu${ubuntuVersion}-7.0.15.tgz`)
        let downloadMongoDBPromise = exec(`curl -o ${downloadPath} ${downloadUrl}`)
        execCallbacksForChildWithNotifications(downloadMongoDBPromise.child, "Downloading MongoDB installer")
        await downloadMongoDBPromise
        // Install MongoDB in the .medomics directory in the user's home directory
        ubuntuVersion = ubuntuVersion.replace(".", "")
        let command = `tar -xvzf ${downloadPath} -C /home/${process.env.USER}/.medomics/ && mv /home/${process.env.USER}/.medomics/mongodb-linux-${architecture}-ubuntu${ubuntuVersion}-7.0.15 /home/${process.env.USER}/.medomics/mongodb`
        let installMongoDBPromise = exec(command)

        // let installMongoDBPromise = exec(`tar -xvzf ${downloadPath} && mv mongodb-linux-${architecture}-ubuntu${ubuntuVersion}-7.0.15 /home/${process.env.USER}/.medomics/mongodb`)
        execCallbacksForChildWithNotifications(installMongoDBPromise.child, "Installing MongoDB")
        await installMongoDBPromise
        
        
        

        return getMongoDBPath() !== null
      }
    }
  }
}

// Helper: CLI prompt for MongoDB install
async function promptAndInstallMongoDB() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const question = (q) => new Promise((res) => rl.question(q, res))
  const answer = await question("MongoDB is not installed. Would you like to install it now? (Y/n): ")
  rl.close()
  if (answer.trim().toLowerCase() === "y" || answer.trim() === "") {
    const success = await installMongoDB()
    if (success) {
      console.log("MongoDB installed successfully.")
    } else {
      console.log("MongoDB installation failed. Please install manually.")
    }
  } else {
    console.log("MongoDB installation skipped. The application may not function correctly without it.")
  }
}

export {
  checkIsBrewInstalled,
  checkIsXcodeSelectInstalled,
  installBrew,
  installXcodeSelect,
  installMongoDB,
  promptAndInstallMongoDB,
  checkRequirements
}