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
const JupyterNotebookViewer = ({ filePath, startJupyterServer }) => {
  const exec = require("child_process").exec
  const {jupyterStatus, setJupyterStatus} = useContext(LayoutModelContext)
  const [loading, setLoading] = useState(true)
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
    return await ipcRenderer.invoke("checkJupyterIsRunning")
  }

  useEffect(() => {
    const runJupyter = async () => {
      const isRunning = await checkJupyterServerRunning()
      if (!isRunning) {
        // Start the Jupyter server
        setLoading(true)
        try{
          await startJupyterServer()
          setJupyterStatus({ running: true, error: null })
          setLoading(false)
        } catch (error) {
          setLoading(false)
          setJupyterStatus({ running: false, error: "Failed to start Jupyter server. Please check the logs." })
          console.error("Error starting Jupyter server:", error)
          return
        }
        setLoading(false)
      }
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
      {loading ? (
        <div id="loading-div">
          <div id="loading-content">
            <p id="loading-message">Loading Jupyter Notebook...</p>
          </div>
        </div>
      ) : (
      <>
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
      </>
      )}
    </div>
  )
}

export default JupyterNotebookViewer
