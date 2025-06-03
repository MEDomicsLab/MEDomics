import React, { useContext, useEffect, useState } from "react"
import path from "node:path"
import Iframe from "react-iframe"
import { defaultJupyterPort } from "../layout/flexlayout/mainContainerClass"
import { LayoutModelContext } from "../layout/layoutContext"
import { ipcRenderer } from "electron"

/**
 * Jupyter Notebook viewer
 * @param {string} filePath - the path of the file to edit
 * @returns {JSX.Element} - A Jupyter Notebook viewer
 */
const JupyterNotebookViewer = ({ filePath }) => {
  const exec = require("child_process").exec
  const {jupyterStatus, setJupyterStatus} = useContext(LayoutModelContext)
  const fileName = path.basename(filePath) // Get the file name from the path
  // Get the relative path after "DATA" in the filePath
  // This works cross-platform (Windows, Mac, Linux)
  const match = filePath.replace(/\\/g, "/").match(/DATA\/(.+)$/)
  const relativePath = match ? match[1] : filePath

  const getPythonPath = async () => {
    let pythonPath = ""
    await ipcRenderer.invoke("getBundledPythonEnvironment").then((res) => {
      pythonPath = res
    })
    // Check if pythonPath is set
    if (pythonPath === "") {
      return null
    }
    return pythonPath
  }

  const checkJupyterServerRunning = async () => {
    try {
      const pythonPath = await getPythonPath()
      if (!pythonPath) {
        console.error("Python path is not set. Cannot check Jupyter server status.")
        return false
      }
      const result = await exec(`${pythonPath} -m jupyter notebook list`)
      console.log("debug results status:", result)
      if (result.stderr) {
        setJupyterStatus({ running: false, port: defaultJupyterPort, error: "Jupyter server is not running. You can start it from the settings page." })
        console.error("Error checking Jupyter server status:", result.stderr)
        return false
      }
      console.log("debug jupyter list result:", result)
      const isRunning = result.stdout.includes(defaultJupyterPort.toString())
      setJupyterStatus({ running: isRunning, port: defaultJupyterPort, error: "Jupyter server is not running. You can start it from the settings page." })
      return isRunning
    } catch (error) {
      console.error("Error checking Jupyter server status:", error)
      return false
    }
  }

  useEffect(() => {
    const runJupyter = async () => {
      const isRunning = await checkJupyterServerRunning()
    }
    runJupyter()
  }
  , [])

  const getJupyterURL = () => {
    return "http://localhost:" + defaultJupyterPort + "/notebooks/" + relativePath
  }

  const refreshIframe = () => {
    document.getElementById("iframe-" + fileName).src += ''
  }

  useEffect( () => {
    if (!filePath) return
    console.log("Loading Jupyter Notebook:", filePath)
    console.log("Relative Path:", relativePath)
    console.log("File Name:", fileName)
  }, [filePath])

  

  return (
    <div className="jupyter-notebook-viewer">
      {console.log("debug jupyter status", jupyterStatus)}
      {!jupyterStatus.running && <p className="error-message">{jupyterStatus.error}</p>}
      <Iframe id={"iframe-" + fileName} className="jupyter-notebook-frame" src={getJupyterURL()}></Iframe>
      <button onClick={refreshIframe} id="reload-button" className="p-button p-component p-button-outlined">Reload</button>
      <style>
        {`
          #loading-div {
            position: absolute;
            top: 2%;
            left: 50%;
            margin-left: auto;
            text-align: center;
            font-size: 1.2rem;
            color: #555;
            z-index: 1;
          }

          #loading-content {
            position: relative;
            left: -50%;
          }

          #reload-button {
            position: absolute;
            top: 12px;
            right: 10px;
            padding: 5px;
            z-index: 20;
            background-color: #6366f1;
            color: white;
          }

          .jupyter-notebook-frame {
            position: absolute;
            z-index: 10;
            width: 100%;
            height: 99%;
            border: none;
          }

          .jupyter-notebook-viewer {
            padding: 0.5rem;
            overflow: auto;
            height: 100%;
            font-family: 'Arial', sans-serif;
            background: linear-gradient(180deg, #f5f5f5 0%, #e0e0e0 100%);
          }

          .error-message {
            color: #d9534f;
            font-weight: bold;
            padding: 1rem;
            border: 1px solid #d9534f;
            border-radius: 5px;
            background-color: rgba(217, 83, 79, 0.1);
          }
          
          #loading-message {
            text-align: center;
          }
          
        `}
      </style>
    </div>
  )
}

export default JupyterNotebookViewer
