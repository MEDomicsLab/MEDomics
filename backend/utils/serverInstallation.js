const { getBundledPythonEnvironment } = require("./pythonEnv.js")
const { getMongoDBPath } = require("./mongoDBServer.js")
const { getAppPath } = require("./serverPathUtils.js")
const fs = require("fs")
const readline = require("readline")

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
}

async function installBrew(){
  let installBrewPromise = exec(`/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`)
  execCallbacksForChildWithNotifications(installBrewPromise.child, "Installing Homebrew", mainWindow)
  await installBrewPromise
  return true
}

async function installXcodeSelect() {
  let installXcodeSelectPromise = exec(`xcode-select --install`)
  execCallbacksForChildWithNotifications(installXcodeSelectPromise.child, "Installing Xcode Command Line Tools", mainWindow)
  await installXcodeSelectPromise
  return true
}


var path = require("path")
const util = require("util")
const exec = util.promisify(require("child_process").exec)

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

  // Prompt user to install MongoDB if not found
  if (!mongoDBInstalled) {
    await promptAndInstallMongoDB()
  }
  // (Optional) Prompt for Python install if needed, similar logic can be added
  return { pythonInstalled, mongoDBInstalled: getMongoDBPath() }
}

async function installMongoDB() {
  const exec = require("util").promisify(require("child_process").exec)
  const downloadsDir = getAppPath("downloads")
  if (process.platform === "win32") {
    const downloadUrl = "https://fastdl.mongodb.org/windows/mongodb-windows-x86_64-7.0.12-signed.msi"
    const downloadPath = path.join(downloadsDir, "mongodb-windows-x86_64-7.0.12-signed.msi")
    console.log("Downloading MongoDB installer...")
    await exec(`curl -o "${downloadPath}" "${downloadUrl}"`)
    console.log("Running MongoDB installer...")
    await exec(`msiexec.exe /l*v mdbinstall.log /qb /i "${downloadPath}" ADDLOCAL="ServerNoService" SHOULD_INSTALL_COMPASS="0"`)
    // Remove installer
    try { await exec(`del "${downloadPath}"`, { shell: "powershell.exe" }) } catch {}
    return getMongoDBPath() !== null
  } else if (process.platform === "darwin") {
    console.log("Installing MongoDB via Homebrew...")
    await exec(`brew tap mongodb/brew && brew install mongodb-community@7.0.12`)
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
    if (getMongoDBPath() !== null) return true
    const { stdout } = await exec(`cat /etc/os-release`)
    const osRelease = stdout
    const isUbuntu = osRelease.includes("Ubuntu")
    if (!isUbuntu) {
      console.log("Only Ubuntu is supported for now")
      return false
    }
    const ubuntuVersion = osRelease.match(/VERSION_ID="(.*)"/)[1]
    let architecture = process.arch === "arm64" ? "aarch64" : "x86_64"
    const downloadUrl = linuxURLDict[`Ubuntu ${ubuntuVersion} ${architecture}`]
    const downloadPath = path.join(downloadsDir, `mongodb-linux-${architecture}-ubuntu${ubuntuVersion}-7.0.15.tgz`)
    console.log("Downloading MongoDB installer...")
    await exec(`curl -o "${downloadPath}" "${downloadUrl}"`)
    const homeDir = getAppPath("home")
    const medomicsDir = path.join(homeDir, ".medomics")
    const extractCmd = `tar -xvzf "${downloadPath}" -C "${medomicsDir}" && mv "${medomicsDir}/mongodb-linux-${architecture}-ubuntu${ubuntuVersion}-7.0.15" "${medomicsDir}/mongodb"`
    console.log("Extracting and installing MongoDB...")
    await exec(extractCmd)
    try { await exec(`rm "${downloadPath}"`) } catch {}
    return getMongoDBPath() !== null
  }
}

// Helper: CLI prompt for MongoDB install
async function promptAndInstallMongoDB() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const question = (q) => new Promise((res) => rl.question(q, res))
  const answer = await question("MongoDB is not installed. Would you like to install it now? (Y/n): ")
  rl.close()
  if (answer.trim().toLowerCase() === "y" || answer.trim() === "") {
    const success = await exports.installMongoDB()
    if (success) {
      console.log("MongoDB installed successfully.")
    } else {
      console.log("MongoDB installation failed. Please install manually.")
    }
  } else {
    console.log("MongoDB installation skipped. The application may not function correctly without it.")
  }
}

module.exports = {
  checkIsBrewInstalled,
  checkIsXcodeSelectInstalled,
  installBrew,
  installXcodeSelect,
  installMongoDB,
  promptAndInstallMongoDB,
  checkRequirements
}