import fs from "fs"
import { getBundledPythonEnvironment } from "../utils/pythonEnv"
import { ipcMain } from "electron"

const { spawn } = require('child_process')

let jupyterStatus = { running: false, error: null }
let jupyterStarting = false
export const defaultJupyterPort = 8900

async function getPythonPath() {
  let pythonPath = getBundledPythonEnvironment()
  // Check if pythonPath is set
  if (pythonPath === "") {
    console.error("Python path is not set. Jupyter server cannot be started.")
    return null
  }
  return pythonPath
}


export async function startJupyterServer(workspacePath) {
  if (!workspacePath) {
    return { running: false, error: "No workspace path found. Jupyter server cannot be started." }
  }
  const pythonPath = await getPythonPath()
  if (!pythonPath) {
    return { running: false, error: "Python path is not set. Jupyter server cannot be started." }
  }
  const configSet = await setJupyterConfig()
  if (!configSet.success) {
    return { running: false, error: configSet.error }
  }
  if (!jupyterStatus.running) {
    const jupyter = spawn(pythonPath, [
      '-m', 'jupyter', 'notebook',
      `--NotebookApp.token=''`,
      `--NotebookApp.password=''`,
      '--no-browser',
      `--port=${defaultJupyterPort}`,
      `${workspacePath}/DATA`
    ])
    jupyterStarting = false
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

async function setJupyterConfig() {
  let pythonPath = await this.getPythonPath()
  if (!pythonPath) {
    return { success: false, error: "Python path is not set. Cannot configure Jupyter." }
  }
  // Check if jupyter is installed
  try {
    await exec(`${pythonPath} -m jupyter --version`).then((result) => {
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
    const result = await exec(`${pythonPath} -m jupyter --paths`)
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
          const output = await exec(`${pythonPath} -m jupyter notebook --generate-config`)            
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
    const pid = await getJupyterPid(defaultJupyterPort)
    
    if (!pid) {
      console.log("No running Jupyter server found")
      return { running: false, error: null }
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
      await exec(`${pythonPath} -m jupyter notebook stop ${defaultJupyterPort}`)
      return { running: false, error: null }
    } catch (fallbackError) {
      console.error("Fallback stop method also failed:", fallbackError)
      return { running: false, error: "Failed to stop server" }
    }
  } finally {
    jupyterStarting = false
  }
}

checkJupyterIsRunning = async () => {
  try {
    const pythonPath = await getPythonPath()
    if (!pythonPath) {
      return { running: false, error: "Python path is not set. Cannot check Jupyter server status." }
    }
    const result = await exec(`${pythonPath} -m jupyter notebook list`)
    if (result.stderr) {
      return { running: false, error: "Jupyter server is not running. You can start it from the settings page." }
    }
    const isRunning = result.stdout.includes(defaultJupyterPort.toString())
    return { running: isRunning, error: isRunning ? null : "Jupyter server is not running. You can start it from the settings page." }
  } catch (error) {
    return { running: false, error: "Error while checking Jupyter server status." }
  }
}

ipcMain.handle("startJupyterServer", async (event, workspacePath) => {
  return startJupyterServer(workspacePath)
})

ipcMain.handle("stopJupyterServer", async () => {
  return stopJupyterServer()
})

ipcMain.handle("checkJupyterIsRunning", async () => {
  return checkJupyterIsRunning()
})
