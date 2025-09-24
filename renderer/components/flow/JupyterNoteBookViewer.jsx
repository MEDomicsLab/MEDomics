import { useEffect, useState } from "react"
import path from "node:path"
import Iframe from "react-iframe"
import { defaultJupyterPort } from "../layout/flexlayout/mainContainerClass"
import { ipcRenderer } from "electron"
import { useTunnel } from "../tunnel/TunnelContext"

/**
 * Jupyter Notebook viewer
 * @param {string} filePath - the path of the file to edit
 * @param {string} startJupyterServer - function to start the Jupyter server
 * @param {boolean} isRemote - whether the file is remote or local
 * @param {object} jupyterStatus - status of the Jupyter server (running, error)
 * @param {function} setJupyterStatus - function to set the Jupyter server status
 * @returns {JSX.Element} - A Jupyter Notebook viewer
 */
const JupyterNotebookViewer = ({ filePath, startJupyterServer, isRemote = false, jupyterStatus, setJupyterStatus }) => {
  const [loading, setLoading] = useState(true)
  const fileName = path.basename(filePath) // Get the file name from the path
  // Get the relative path after "DATA" in the filePath
  // This works cross-platform (Windows, Mac, Linux)
  const match = filePath.replace(/\\/g, "/").match(/DATA\/(.+)$/)
  const relativePath = match ? match[1] : filePath

  const tunnel = useTunnel()

  const checkJupyterServerRunning = async () => {
    return await ipcRenderer.invoke("checkJupyterIsRunning")
  }

  ipcRenderer.on("jupyterReady", () => {
    if (filePath) {
      refreshIframe()
    }
  })

  useEffect(() => {
    console.log("JupyterNoteBookViewer mounted, checking Jupyter server status...")

    const runJupyter = async () => {
      const isRunning = await checkJupyterServerRunning()
      console.log("Jupyter server running status:", isRunning)
      if (!isRunning.running) {
        // Start the Jupyter server
        setLoading(true)
        try{
          await startJupyterServer()
          if (isRemote) {
            let tunnelSuccess = await ipcRenderer.invoke('startJupyterTunnel')
            console.log("SSH Tunnel start result:", tunnelSuccess, jupyterStatus)
            if (!tunnelSuccess) {
              setJupyterStatus({ running: false, error: "Failed to start SSH tunnel for Jupyter. Please check the tunnel settings." })
              setLoading(false)
              return
            }
          }
          setLoading(false)
        } catch (error) {
          setLoading(false)
          setJupyterStatus({ running: false, error: "Failed to start Jupyter server. Please check the logs." })
          console.error("Error starting Jupyter server:", error)
          return
        }
      } 
      setLoading(false)
    }
    runJupyter()
  }
  , [])

  const getJupyterURL = () => {
    if (isRemote) {
      return "http://localhost:" + tunnel.localJupyterPort + "/notebooks/" + relativePath
    }
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
