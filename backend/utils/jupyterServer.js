const fs = require("fs")
const { getBundledPythonEnvironment } = require("./pythonEnv")

const util = require("util")
const exec = util.promisify(require("child_process").exec)
const { spawn } = require('child_process')

let jupyterStatus = { running: false, error: null }
let jupyterPort = 8900

async function getPythonPath() {
  let pythonPath = getBundledPythonEnvironment()
  // Check if pythonPath is set
  if (pythonPath === "") {
    console.error("Python path is not set. Jupyter server cannot be started.")
    return null
  }
  return pythonPath
}


async function startJupyterServer(workspacePath, port = 8900) {
  if (!workspacePath) {
    return { running: false, error: "No workspace path found. Jupyter server cannot be started." }
  }
  const pythonPath = await getPythonPath()

  if (!pythonPath) {
    return { running: false, error: "Python path is not set. Jupyter server cannot be started." }
  }
  const configSet = await setJupyterConfig(pythonPath)
  if (!configSet.success) {
    return { running: false, error: configSet.error }
  }
  console.log("Checking if Jupyter server is already running before spawning: ", jupyterStatus.running)
  if (!jupyterStatus.running) {
    const jupyter = spawn(pythonPath, [
      '-m', 'jupyter', 'notebook',
      `--NotebookApp.token=''`,
      `--NotebookApp.password=''`,
      '--no-browser',
      `--port=${port}`,
      `${workspacePath}/DATA`
    ])
    jupyter.stderr.on('data', (data) => {
      console.log(`[Jupyter STDOUT]: ${data}`)
      if (data.toString().includes(port.toString())) {
        console.log("Jupyter server is ready and running.")
      }
    })
    jupyter.on('close', (code) => {
      console.log(`[Jupyter] exited with code ${code}`)
    })
    jupyterPort = port
    return { running: true, error: null }
  }
}

async function getJupyterPid (port) {
  if (!port) {
    throw new Error("Port is required to get Jupyter PID")
  }
  const { exec } = require('child_process')
  const { promisify } = require('util')
  const execAsync = promisify(exec)

  const platform = process.platform
  const command = platform === 'win32' 
    ? `netstat -ano | findstr :${port}`
    : `lsof -ti :${port} | head -n 1`

  try {
    const { stdout, stderr } = await execAsync(command)
    if (stderr) throw new Error(stderr)
    
    return platform === 'win32'
      ? stdout.trim().split(/\s+/).pop()
      : stdout.trim()
  } catch (error) {
    throw new Error(`PID lookup failed: ${error.message}`)
  }
 }

async function setJupyterConfig(pythonPathArg) {
  if (!pythonPathArg) {
    return { success: false, error: "Python path is not set. Cannot configure Jupyter." }
  }
  // Check if jupyter is installed
  try {
    await exec(`${pythonPathArg} -m jupyter --version`).then((result) => {
      const trimmedVersion = result.stdout.split("\n")
      const includesJupyter = trimmedVersion.some((line) => line.startsWith("jupyter"))
      if (!includesJupyter) {
        throw new Error("Jupyter is not installed")
      }
    })
  } catch (error) {
    return { success: false, error: "Jupyter is not installed. Please install Jupyter to use this feature."}
  }
  // Check if jupyter_notebook_config.py exists and update it
  try {
    const result = await exec(`${pythonPathArg} -m jupyter --paths`)
    if (result.stderr) {
      console.error("Error getting Jupyter paths:", result.stderr)
      return { success: false, error: "Failed to get Jupyter paths." }
    }
    const configPath = result.stdout.split("\n").find(line => line.includes(".jupyter"))
    
    if (configPath) {
      const configFilePath = configPath.trim() + "/jupyter_notebook_config.py"
      
      // Check if the file exists
      if (!fs.existsSync(configFilePath)) {
        try {
          // Await the config generation
          const output = await exec(`${pythonPathArg} -m jupyter notebook --generate-config`)            
          if (output.stderr) {
            console.error("Error generating Jupyter config:", output.stderr)
            return { success: false, error: "Error generating Jupyter config. Please check the console for more details." }
          }
        } catch (error) {
          console.error("Error generating config:", error)
          return {success: false, error: "Failed to generate Jupyter config" }
        }
      }
      
      // Get last line of configfilepath
      const lastLine = fs.readFileSync(configFilePath, "utf8").split("\n").slice(-1)[0]
      
      if (!lastLine.includes("c.NotebookApp.tornado_settings") || 
          !lastLine.includes("c.ServerApp.allow_unauthenticated_access")) {
        // Add config settings
        fs.appendFileSync(configFilePath, `\nc.ServerApp.allow_unauthenticated_access = True`)
        fs.appendFileSync(configFilePath, `\nc.NotebookApp.tornado_settings={'headers': {'Content-Security-Policy': "frame-ancestors 'self' http://localhost:8888;"}}`)
      }
      return { success: true, error: null }
    }
  } catch (error) {
    console.error("Error in Jupyter config setup:", error)
    return { running: false, error: "Failed to configure Jupyter." }
  }
}

async function stopJupyterServer() {
  const pythonPath = await getPythonPath()
  
  if (!pythonPath) {
    console.error("Python path is not set. Cannot stop Jupyter server.")
    return { running: false, error: "Python path is not set. Cannot stop Jupyter server." }
  }

  try {
    // Get the PID first
    const pid = await getJupyterPid(jupyterPort)
    
    if (!pid) {
      console.log("No running Jupyter server found")
      return { running: false, error: "No running Jupyter server found" }
    }

    // Platform-specific kill command
    const killCommand = process.platform === 'win32'
      ? `taskkill /PID ${pid} /F`
      : `kill ${pid}`

    await exec(killCommand)
    console.log(`Successfully stopped Jupyter server (PID: ${pid})`)
    return { running: false, error: null }
  } catch (error) {
    console.error("Error stopping Jupyter server:", error)
    // Fallback to original method if PID method fails
    try {
      await exec(`${pythonPath} -m jupyter notebook stop ${jupyterPort}`)
      return { running: false, error: null }
    } catch (fallbackError) {
      console.error("Fallback stop method also failed:", fallbackError)
      return { running: true, error: "Failed to stop server" }
    }
  }
}

async function checkJupyterIsRunning() {
  console.log("Checking if Jupyter server is running on port", jupyterPort)
  try {
    const pythonPath = await getPythonPath()
    console.log("Python path for checking Jupyter status:", pythonPath)
    if (!pythonPath) {
      console.log("Python path is not set. Cannot check Jupyter server status.")
      return { running: false, error: "Python path is not set. Cannot check Jupyter server status." }
    }
    const result = await exec(`${pythonPath} -m jupyter notebook list`)
    console.log("Jupyter notebook list result:", result)
    if (result.stderr) {
      console.log("Error checking Jupyter server status:", result.stderr)
      return { running: false, error: "Jupyter server is not running. You can start it from the settings page." }
    }
    const isRunning = result.stdout.includes(jupyterPort.toString())
    console.log("Is Jupyter server running:", isRunning)
    return { running: isRunning, error: isRunning ? null : "Jupyter server is not running. You can start it from the settings page." }
  } catch (error) {
    return { running: false, error: error }
  }
}

module.exports = { startJupyterServer, stopJupyterServer, checkJupyterIsRunning }