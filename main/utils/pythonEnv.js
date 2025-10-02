const { getAppPath } = require("./serverPathUtils.js")
var path = require("path")
const util = require("util")
const { execSync } = require("child_process")
const exec = util.promisify(require("child_process").exec)

function getPythonEnvironment(medCondaEnv = "med_conda_env") {
  let pythonEnvironment = process.env.MED_ENV

  // Retrieve the path to the conda environment from the settings file
  let userDataPath = getAppPath("userData")
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

function getBundledPythonEnvironment() {
  let pythonEnvironment = null

  let bundledPythonPath = null

  // Check if the python path can be found in the .medomics directory
  let medomicsDirExists = fs.existsSync(path.join(getAppPath("home"), ".medomics", "python"))

  if (process.env.NODE_ENV === "production") {
    // Get the user path followed by .medomics
    let userPath = getHomePath()
    let medomicsPath = path.join(userPath, ".medomics")

    // Check if the .medomics directory exists
    if (fs.existsSync(medomicsPath)) {
      // Check if the python directory exists
      let pythonPath = path.join(medomicsPath, "python")
      if (fs.existsSync(pythonPath)) {
        bundledPythonPath = pythonPath
      }
    } else {
      // Create the .medomics directory
      fs.mkdirSync(medomicsPath)
    }

    bundledPythonPath = path.join(userPath, ".medomics", "python")
  } else {
    if (medomicsDirExists) {
      bundledPythonPath = path.join(getHomePath(), ".medomics", "python")
    } else {
      bundledPythonPath = path.join(process.cwd(), "python")
    }
  }

  pythonEnvironment = path.join(bundledPythonPath, "bin", "python")
  if (process.platform == "win32") {
    pythonEnvironment = path.join(bundledPythonPath, "python.exe")
  }
  if (!fs.existsSync(pythonEnvironment)) {
    pythonEnvironment = null
  }
  return pythonEnvironment
}

async function installRequiredPythonPackages(notify, pythonExecutablePath) {
  let requirementsFileName = "merged_requirements.txt"
  if (process.env.NODE_ENV === "production") {
    installPythonPackage(notify, pythonExecutablePath, null, path.join(process.cwd(), "resources", "pythonEnv", requirementsFileName))
  } else {
    installPythonPackage(notify, pythonExecutablePath, null, path.join(process.cwd(), "pythonEnv", requirementsFileName))
  }
}

function comparePythonInstalledPackages(pythonPackages, requirements) {
  let missingPackages = []
  for (let i = 0; i < requirements.length; i++) {
    let requirement = requirements[i]
    let requirementParts = requirement.split("==")
    let requirementName = requirementParts[0]
    let requirementVersion = requirementParts[1]
    let found = false
    for (let j = 0; j < pythonPackages.length; j++) {
      let pythonPackage = pythonPackages[j]
      if (pythonPackage.name === requirementName && pythonPackage.version === requirementVersion) {
        found = true
        break
      } else if (pythonPackage.name.replace('-', '_') === requirementName && pythonPackage.version === requirementVersion) {
        found = true
        break
      } else if (pythonPackage.name.replace('_', '-') === requirementName && pythonPackage.version === requirementVersion) {
        found = true
        break
      }
    }
    if (!found) {
      missingPackages.push({ name: requirementName, version: requirementVersion })
    }
  }
  console.log("Missing packages: " + JSON.stringify(missingPackages))
  return missingPackages
}

function checkPythonRequirements(pythonPath = null, requirementsFilePath = null) {
  let pythonRequirementsMet = false
  if (pythonPath === null) {
    // pythonPath = getPythonEnvironment()
    pythonPath = getBundledPythonEnvironment()
  }
  if (requirementsFilePath === null) {
    if (process.env.NODE_ENV === "production") {
      requirementsFilePath = path.join(process.resourcesPath, "pythonEnv", "merged_requirements.txt")
    } else {
      requirementsFilePath = path.join(process.cwd(), "pythonEnv", "merged_requirements.txt")
    }
  }
  let pythonPackages = getInstalledPythonPackages(pythonPath)
  let requirements = fs.readFileSync(requirementsFilePath, "utf8").split("\n")
  // # Remove empty lines and \r
  requirements = requirements.filter((line) => line.trim() !== "")
  requirements = requirements.map((line) => line.replace("\r", ""))

  let missingPackages = comparePythonInstalledPackages(pythonPackages, requirements)
  if (missingPackages.length === 0) {
    pythonRequirementsMet = true
  }
  return pythonRequirementsMet
}

function getInstalledPythonPackages(pythonPath = null) {
  let pythonPackages = []
  if (pythonPath === null) {
    pythonPath = getPythonEnvironment()
  }

  let pythonPackagesOutput = ""
  try {
    pythonPackagesOutput = execSync(`${pythonPath} -m pip list --format=json`).toString()
  } catch (error) {
    console.warn("Error retrieving python packages:", error)
  }
  try {
    pythonPackages = JSON.parse(pythonPackagesOutput)
  } catch (error) {
    console.warn(error)
  }
  return pythonPackages
}

async function installPythonPackage(notify, pythonPath, packageName = null, requirementsFilePath = null) {
  console.log("Installing python package: ", packageName, requirementsFilePath, " with pythonPath: ", pythonPath)
  let execSyncResult = null
  let pipUpgradePromise = exec(`${pythonPath} -m pip install --upgrade pip`)
  execCallbacksForChildWithNotifications(pipUpgradePromise.child, "Python pip Upgrade", notify)
  await pipUpgradePromise
  if (requirementsFilePath !== null) {
    let installPythonPackagePromise = exec(`${pythonPath} -m pip install -r ${requirementsFilePath}`)
    execCallbacksForChildWithNotifications(installPythonPackagePromise.child, "Python Package Installation from requirements", notify)
    await installPythonPackagePromise
  } else {
    let installPythonPackagePromise = exec(`${pythonPath} -m pip install ${packageName}`)
    execCallbacksForChildWithNotifications(installPythonPackagePromise.child, "Python Package Installation", notify)
    await installPythonPackagePromise
  }
}

function execCallbacksForChildWithNotifications(child, id, notify) {
  if (!notify) notify = () => {}
  notify({ id: id, message: `Starting...`, header: `${id} in progress` })
  child.stdout.on("data", (data) => {
    notify({ id: id, message: `stdout: ${data}`, header: `${id} in progress` })
  })
  child.stderr.on("data", (data) => {
    notify({ id: id, message: `stderr: ${data}`, header: `${id} Error` })
  })
  child.on("close", (code) => {
    notify({ id: id, message: `${id} exited with code ${code}`, header: `${id} Finished` })
  })
}

function getHomePath() {
  let homePath = null
  if (process.platform === "win32") {
    homePath = process.env.USERPROFILE
  } else {
    homePath = process.env.HOME
  }
  return homePath
}

async function installBundledPythonExecutable(notify) {
  let bundledPythonPath = null

  let medomicsPath = null
  let pythonParentFolderExtractString = ""
  if (process.env.NODE_ENV === "production") {
    console.log("getHomePath(): ", getHomePath())
    let userPath = getHomePath()

    medomicsPath = path.join(userPath, ".medomics")
    pythonParentFolderExtractString = "-C " + medomicsPath
    let pythonPath = path.join(medomicsPath, "python")
    // Check if the .medomics directory exists
    if (fs.existsSync(medomicsPath)) {
      // Check if the python directory exists
      if (fs.existsSync(pythonPath)) {
        bundledPythonPath = pythonPath
      } else {
        fs.mkdirSync(pythonPath)
      }
    } else {
      // Create the .medomics directory
      fs.mkdirSync(medomicsPath)
      fs.mkdirSync(pythonPath)
    }
    bundledPythonPath = pythonPath
  } else {
    bundledPythonPath = path.join(process.cwd(), "python")
  }
  // Check if the python executable is already installed
  let pythonExecutablePath = null
  if (process.platform == "win32") {
    pythonExecutablePath = path.join(bundledPythonPath, "python.exe")
  } else {
    pythonExecutablePath = path.join(bundledPythonPath, "bin", "python")
  }
  if (!fs.existsSync(pythonExecutablePath)) {
    // If the python executable is not installed, download the python executable
    if (process.platform == "win32") {
      // Download the python executable
      let url = "https://github.com/indygreg/python-build-standalone/releases/download/20240224/cpython-3.9.18+20240224-x86_64-pc-windows-msvc-shared-install_only.tar.gz"
      let outputFileName = "cpython-3.9.18+20240224-x86_64-pc-windows-msvc-shared-install_only.tar.gz"

      let downloadPromise = exec(`wget ${url} -O ${outputFileName}`, { shell: "powershell.exe" })

      execCallbacksForChildWithNotifications(downloadPromise.child, "Python Downloading", notify)

      const { stdout, stderr } = await downloadPromise
      let extractCommand = `tar -xvf ${outputFileName} ${pythonParentFolderExtractString}`
      let extractionPromise = exec(extractCommand, { shell: "powershell.exe" })
      execCallbacksForChildWithNotifications(extractionPromise.child, "Python Exec. Extracting", notify)

      const { stdout: extrac, stderr: extracErr } = await extractionPromise

      // Install the required python packages
      if (process.env.NODE_ENV === "production") {
        installPythonPackage(notify, pythonExecutablePath, null, path.join(process.cwd(), "resources", "pythonEnv", "merged_requirements.txt"))
      } else {
        installPythonPackage(notify, pythonExecutablePath, null, path.join(process.cwd(), "pythonEnv", "merged_requirements.txt"))
      }
      let removeCommand = `rm ${outputFileName}`
      let removePromise = exec(removeCommand, { shell: "powershell.exe" })
      execCallbacksForChildWithNotifications(removePromise.child, "Python Exec. Removing", notify)
      const { stdout: remove, stderr: removeErr } = await removePromise
    } else if (process.platform == "darwin") {
      // Download the right python executable (arm64 or x86_64)
      let isArm64 = process.arch === "arm64"
      let file = "cpython-3.9.18+20240224-x86_64-apple-darwin-install_only.tar.gz"
      if (isArm64 === "arm64") {
        file = `cpython-3.9.18+20240224-aarch64-apple-darwin-install_only.tar.gz`
      }

      let url = `https://github.com/indygreg/python-build-standalone/releases/download/20240224/${file}`
      let extractCommand = `tar -xvf ${file} ${pythonParentFolderExtractString}`
      let downloadPromise = exec(`/bin/bash -c "$(curl -fsSLO ${url})"`)
      execCallbacksForChildWithNotifications(downloadPromise.child, "Python Downloading", notify)
      const { stdout, stderr } = await downloadPromise

      // Extract the python executable
      let extractionPromise = exec(extractCommand)
      execCallbacksForChildWithNotifications(extractionPromise.child, "Python Exec. Extracting", notify)
      const { stdout: extrac, stderr: extracErr } = await extractionPromise

      // Remove the downloaded file
      let removeCommand = `rm ${file}`
      let removePromise = exec(removeCommand)
      execCallbacksForChildWithNotifications(removePromise.child, "Python Exec. Removing", notify)
      const { stdout: remove, stderr: removeErr } = await removePromise

      // Install the required python packages
      if (process.env.NODE_ENV === "production") {
        installPythonPackage(notify, pythonExecutablePath, null, path.join(process.resourcesPath, "pythonEnv", "requirements_mac.txt"))
      } else {
        installPythonPackage(notify, pythonExecutablePath, null, path.join(process.cwd(), "pythonEnv", "requirements_mac.txt"))
      }
    } else if (process.platform == "linux") {
      // Download the right python executable (arm64 or x86_64)
      // https://github.com/indygreg/python-build-standalone/releases/download/20240224/cpython-3.9.18+20240224-x86_64_v4-unknown-linux-gnu-install_only.tar.gz      let file = "cpython-3.9.18+20240224-x86_64_v4-unknown-linux-gnu-install_only.tar.gz"
      let file = "cpython-3.9.18+20240224-x86_64_v3-unknown-linux-gnu-install_only.tar.gz"
      if (process.arch === "arm64") {
        file = "cpython-3.9.18+20240224-aarch64-unknown-linux-gnu-install_only.tar.gz"
      }

      let url = `https://github.com/indygreg/python-build-standalone/releases/download/20240224/${file}`
      let extractCommand = `tar -xvf ${file}  ${pythonParentFolderExtractString}`

      let downloadPromise = exec(`wget ${url}`)
      execCallbacksForChildWithNotifications(downloadPromise.child, "Python Downloading", notify)
      const { stdout: download, stderr: downlaodErr } = await downloadPromise
      // Extract the python executable
      let extractionPromise = exec(extractCommand)
      execCallbacksForChildWithNotifications(extractionPromise.child, "Python Exec. Extracting", notify)
      const { stdout: extrac, stderr: extracErr } = await extractionPromise

      // Remove the downloaded file
      let removeCommand = `rm ${file}`
      let removePromise = exec(removeCommand)
      execCallbacksForChildWithNotifications(removePromise.child, "Python Exec. Removing", notify)
      const { stdout: remove, stderr: removeErr } = await removePromise

      console.log("pythonExecutablePath: ", pythonExecutablePath)
      console.log("process.cwd(): ", process)
      console.log("process.resourcesPath: ", process.resourcesPath)
      // Install the required python packages
      if (process.env.NODE_ENV === "production") {
        installPythonPackage(notify, pythonExecutablePath, null, path.join(process.resourcesPath, "pythonEnv", "merged_requirements.txt"))
      } else {
        installPythonPackage(notify, pythonExecutablePath, null, path.join(process.cwd(), "pythonEnv", "merged_requirements.txt"))
      }
    }
  }
}

module.exports = { 
  getPythonEnvironment,
  getBundledPythonEnvironment,
  installRequiredPythonPackages,
  checkPythonRequirements,
  getInstalledPythonPackages,
  installPythonPackage,
  execCallbacksForChildWithNotifications,
  installBundledPythonExecutable
}

