import React, { useEffect, useState } from "react"
import Iframe from "react-iframe"
import { defaultJupyterPort } from "../layout/flexlayout/mainContainerClass"

/**
 * Jupyter Notebook viewer
 * @param {string} path - the path of the file to edit
 * @returns {JSX.Element} - A Jupyter Notebook viewer
 */
const JupyterNotebookViewer = ({ path }) => {
  const [error, setError] = useState(null)
  const fileName = path.basename(path) // Get the file name from the path
  const relativePath = path.relative("DATA", path) // Get the relative path from the DATA directory

  const getJupyterURL = () => {
    return "http://localhost:" + defaultJupyterPort + "/notebooks/" + relativePath
  }

  const refreshIframe = () => {
    document.getElementById("iframe-" + fileName).src += ''
  }

  useEffect( () => {
    if (!path) return
  }, [path])

  

  return (
    <div className="jupyter-notebook-viewer">
      {error && <p className="error-message">{error}</p>}
      <div id="loading-div">
          <h2 id="loading-content">Loading...</h2>
      </div>
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
