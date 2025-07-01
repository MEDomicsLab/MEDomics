import React, { useEffect, useState } from "react"
import { ipcRenderer } from "electron"
import ModulePage from "./moduleBasics/modulePage"
import { Col } from "react-bootstrap"

//
/**
 * @description This is the terminal page that displays the log events from the main process and is used for debugging
 * @param {String} pageId The id of the page
 * @param {String} configPath The path to the config file
 * @returns The terminal page component
 */
const TerminalPage = ({ pageId = "terminal", configPath = undefined }) => {
  const [terminalData, setTerminalData] = useState([]) // Stores the data from log events from the main process in the form of [time, data]

  // Creates a listener for the log event from the main process
  useEffect(() => {
    ipcRenderer.removeAllListeners("log")
    ipcRenderer.on("log", (event, data) => {
      setTerminalData((terminalData) => {
        let newData = [...terminalData, [new Date().toLocaleTimeString(), data]]
        if (newData.length > 100) {
          newData.shift()
        }
        return newData
      })
    })
  }, [])

  /**
   * @description Formats the terminal data into a string
   * @param {Array} data The terminal data
   * @returns The formatted terminal data
   */
  function formatTerminalData(data) {
    let formattedDataString = ""
    data.forEach((data) => {
      formattedDataString += `${data[0]}: ${data[1]} \n`
    })
    return formattedDataString
  }

  return (
    <>
      <ModulePage pageId={pageId} configPath={configPath} style={{ backgroundColor: "#1f1f1f", top: "-20px" }}>
        <div className="terminal" style={{ backgroundColor: "#1f1f1f", padding: "1rem 1rem", top: "20px", width: "100%" }}>
          {/* Button for clearing the log */}
          <button
            className="btn btn-outline-danger"
            style={{ position: "sticky", top: "20px", left: "calc(100% - 1rem)", zIndex: "3", backgroundColor: "#d55757", color: "white" }}
            onClick={() => setTerminalData([])}
          >
            Clear
          </button>
          {/* Button for downloading the whole log */}
          <a href={`data:text/json;charset=utf-8,${encodeURIComponent(formatTerminalData(terminalData))}`} download="log.log">
            <button className="btn btn-outline-primary" style={{ position: "sticky", top: "20px", left: "calc(100% - 12rem)", zIndex: "3", backgroundColor: "#007bff", color: "white" }}>
              Download
            </button>
          </a>
          <Col style={{ backgroundColor: "#1f1f1f", position: "relative", top: "-50px", padding: "1rem 1rem" }}>
            {terminalData.map((data, index) => (
              <h6 key={index} style={{ color: "white" }}>
                <b style={{ color: "#007bff" }}>{data[0]}:</b> {data[1]}
              </h6>
            ))}
          </Col>
        </div>
      </ModulePage>
    </>
  )
}

export default TerminalPage
