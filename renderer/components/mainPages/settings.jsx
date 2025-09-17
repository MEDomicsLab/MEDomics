/* eslint-disable no-unused-vars */
import React, { useEffect, useState, useContext } from "react"
import { connectToMongoDB } from "../mongoDB/mongoDBUtils"
var path = require("path")
import fs from "fs"
const { spawn } = require("child_process")
import { ipcRenderer } from "electron"
import ModulePage from "./moduleBasics/modulePage"
import { Button } from "primereact/button"
import { TabView, TabPanel } from "primereact/tabview"
import { Col } from "react-bootstrap"
import { Check2Circle, Folder2Open, XCircleFill } from "react-bootstrap-icons"
import { InputText } from "primereact/inputtext"
import { InputNumber } from "primereact/inputnumber"
import { DataTable } from "primereact/datatable"
import { Column } from "primereact/column"
import { WorkspaceContext } from "../workspace/workspaceContext"
import FirstSetupModal from "../generalPurpose/installation/firstSetupModal"
import { requestBackend } from "../../utilities/requests"

/**
 * Settings page
 * @returns {JSX.Element} Settings page
 */
const SettingsPage = (pageId = "settings") => {
  const { workspace, port } = useContext(WorkspaceContext)
  const [settings, setSettings] = useState(null) // Settings object
  const [serverIsRunning, setServerIsRunning] = useState(false) // Boolean to know if the server is running
  const [mongoServerIsRunning, setMongoServerIsRunning] = useState(false) // Boolean to know if the server is running
  const [activeIndex, setActiveIndex] = useState(0) // Index of the active tab
  const [condaPath, setCondaPath] = useState("") // Path to the conda environment
  const [seed, setSeed] = useState(54288) // Seed for random number generation
  const [pythonEmbedded, setPythonEmbedded] = useState({}) // Boolean to know if python is embedded
  const [showPythonPackages, setShowPythonPackages] = useState(false) // Boolean to know if python packages are shown

  /**
   * Check if the mongo server is running and set the state
   * @returns {void}
   */
  const checkMongoIsRunning = () => {
    ipcRenderer.invoke("checkMongoIsRunning").then((status) => {
      console.log("MongoDB is running: ", status)
      setMongoServerIsRunning(status)
    })
  }

  /**
   * Check if the server is running
   */
  const checkServer = () => {
    requestBackend(
      port,
      "get_server_health",
      { pageId: pageId },
      (data) => {
        console.log("Server health: ", data)
        if (data) {
          setServerIsRunning(true)
        }
      },
      () => {
        setServerIsRunning(false)
      }
    )
  }

  /**
   * Get the settings from the main process
   * if the conda path is defined in the settings, set it
   * Check if the server is running and set the state
   */
  useEffect(() => {
    ipcRenderer.invoke("get-settings").then((receivedSettings) => {
      console.log("received settings", receivedSettings)
      setSettings(receivedSettings)
      if (receivedSettings?.condaPath) {
        setCondaPath(receivedSettings?.condaPath)
      }
      if (receivedSettings?.seed) {
        setSeed(receivedSettings?.seed)
      }
    })
    // ipcRenderer.invoke("server-is-running").then((status) => {
    //   setServerIsRunning(status)
    //   console.log("server is running", status)
    // })
    checkMongoIsRunning()
    checkServer()
  }, [])

  /**
   * Save the settings in the main process
   * @param {Object} newSettings - New settings object
   * @returns {void}
   * Creates a timeout to avoid too many calls to the server when the user is typing
   * The timeout is cleared and reset every time the user types
   */
  const saveSettings = (newSettings) => {
    clearTimeout(window.saveSettingsTimeout)
    window.saveSettingsTimeout = setTimeout(() => {
      ipcRenderer.send("save-settings", newSettings)
    }, 1000)
  }

  /**
   * Check if the server is running every 5 seconds
   */
  useEffect(() => {
    const interval = setInterval(() => {
      // ipcRenderer.invoke("server-is-running").then((status) => {
      //   setServerIsRunning(status)
      //   console.log("server is running", status)
      // })
      checkServer()
      checkMongoIsRunning()
      ipcRenderer.invoke("getBundledPythonEnvironment").then((res) => {
        console.log("Python embedded: ", res)

        if (res !== null) {
          ipcRenderer.invoke("getInstalledPythonPackages", res).then((pythonPackages) => {
            console.log("Installed Python Packages: ", pythonPackages)
            setPythonEmbedded({ pythonEmbedded: res, pythonPackages: pythonPackages })
          })
        }
      })
    }, 5000)
    return () => clearInterval(interval)
  })

  useEffect(() => {
    ipcRenderer.invoke("getBundledPythonEnvironment").then((res) => {
      console.log("Python embedded: ", res)
      if (res !== null) {
        ipcRenderer.invoke("getInstalledPythonPackages", res).then((pythonPackages) => {
          console.log("Installed Python Packages: ", pythonPackages)
          setPythonEmbedded({ pythonEmbedded: res, pythonPackages: pythonPackages })
        })
      }
    })
  }, [])

  const startMongo = () => {
    let workspacePath = workspace.workingDirectory.path
    const mongoConfigPath = path.join(workspacePath, ".medomics", "mongod.conf")
    let mongod = getMongoDBPath()
    let mongoResult = spawn(mongod, ["--config", mongoConfigPath])

    mongoResult.stdout.on("data", (data) => {
      console.log(`MongoDB stdout: ${data}`)
    })

    mongoResult.stderr.on("data", (data) => {
      console.error(`MongoDB stderr: ${data}`)
    })

    mongoResult.on("close", (code) => {
      console.log(`MongoDB process exited with code ${code}`)
    })

    mongoResult.on("error", (err) => {
      console.error("Failed to start MongoDB: ", err)
      // reject(err)
    })
    console.log("Mongo result from start ", mongoResult)
  }

  const installMongoDB = () => {
    ipcRenderer.invoke("installMongoDB").then((success) => {
      console.log("MongoDB installed: ", success)
    })
  }

  function getMongoDBPath() {
    if (process.platform === "win32") {
      // Check if mongod is in the process.env.PATH
      const paths = process.env.PATH.split(path.delimiter)
      for (let i = 0; i < paths.length; i++) {
        const binPath = path.join(paths[i], "mongod.exe")
        if (fs.existsSync(binPath)) {
          return binPath
        }
      }

      // Check if mongod is in the default installation path on Windows - C:\Program Files\MongoDB\Server\<version to establish>\bin\mongod.exe
      const programFilesPath = process.env["ProgramFiles"]
      if (programFilesPath) {
        const mongoPath = path.join(programFilesPath, "MongoDB", "Server")
        const dirs = fs.readdirSync(mongoPath)
        for (let i = 0; i < dirs.length; i++) {
          const binPath = path.join(mongoPath, dirs[i], "bin", "mongod.exe")
          if (fs.existsSync(binPath)) {
            return binPath
          }
        }
      }
      console.error("mongod not found")
      return null
    } else if (process.platform === "darwin") {
      if (process.env.NODE_ENV === "production") {
        if (fs.existsSync(path.join(process.env.HOME, ".medomics", "mongodb", "bin", "mongod"))) {
          return path.join(process.env.HOME, ".medomics", "mongodb", "bin", "mongod")
        }
      } else {
        return "mongod"
      }
    } else if (process.platform === "linux") {
      // Check if mongod is in the process.env.PATH
      const paths = process.env.PATH.split(path.delimiter)
      for (let i = 0; i < paths.length; i++) {
        const binPath = path.join(paths[i], "mongod")
        if (fs.existsSync(binPath)) {
          return binPath
        }
      }
      console.error("mongod not found in PATH"+paths)
      // Check if mongod is in the default installation path on Linux - /usr/bin/mongod
      if (fs.existsSync("/usr/bin/mongod")) {
        return "/usr/bin/mongod"
      }
      console.error("mongod not found in /usr/bin/mongod")
      
      if (fs.existsSync("/home/"+process.env.USER+"/.medomics/mongodb/bin/mongod")) {
        return "/home/"+process.env.USER+"/.medomics/mongodb/bin/mongod"
      }
      return null

    }
  }

  const [firstSetupModalVisible, setFirstSetupModalVisible] = useState(false)
  /**
   *
   */

  return (
    <>
      <ModulePage pageId="Settings">
        <TabView panelContainerStyle={{ padding: "0rem" }} className="settingsTab" activeIndex={activeIndex} onTabChange={(e) => setActiveIndex(e.index)}>
          <TabPanel index={1} headerStyle={{ padding: "0rem", color: "black" }} style={{ padding: "0rem" }} header="User" leftIcon="pi pi-fw pi-cog">
            <div className="settings-user" style={{ marginTop: "1rem" }}>
              <Col>
                <Col xs={12} md={10} style={{ display: "flex", flexDirection: "row", justifyContent: "flex-start", alignItems: "center", flexWrap: "wrap" }}>
                  <h5 style={{ marginBottom: "0rem" }}>Server status : </h5>
                  <h5 style={{ marginBottom: "0rem", marginLeft: "1rem", color: serverIsRunning ? "green" : "#d55757" }}>{serverIsRunning ? "Running" : "Stopped"}</h5>
                  {serverIsRunning ? <Check2Circle size="30" style={{ marginInline: "1rem", color: "green" }} /> : <XCircleFill size="25" style={{ marginInline: "1rem", color: "#d55757" }} />}
                  <Button
                    label="Start server"
                    className=" p-button-success"
                    onClick={() => {
                      console.log("conda path", condaPath)
                      ipcRenderer.invoke("start-server", condaPath).then((status) => {
                        console.log("Server started manually", status)
                      })
                    }}
                    style={{ backgroundColor: serverIsRunning ? "grey" : "#54a559", borderColor: serverIsRunning ? "grey" : "#54a559", marginRight: "1rem" }}
                    disabled={serverIsRunning}
                  />
                  <Button
                    label="Stop server"
                    className="p-button-danger"
                    onClick={() => {
                      ipcRenderer.invoke("kill-server").then((stopped) => {
                        if (stopped) {
                          setServerIsRunning(false)
                          console.log("server was stopped", stopped)
                        }
                      })
                    }}
                    style={{ backgroundColor: serverIsRunning ? "#d55757" : "grey", borderColor: serverIsRunning ? "#d55757" : "grey" }}
                    disabled={!serverIsRunning}
                  />
                </Col>
                <Col xs={12} md={12} style={{ display: "flex", flexDirection: "row", justifyContent: "flex-start", alignItems: "center", flexWrap: "wrap", marginTop: ".75rem" }}>
                  <Col xs={12} md="auto" style={{ display: "flex", flexDirection: "row", justifyContent: "flex-start", alignItems: "center", flexWrap: "wrap" }}>
                    <h5>Python environment path : </h5>
                  </Col>
                  <Col xs={12} md="auto" style={{ display: "flex", flexDirection: "row", justifyContent: "flex-start", alignItems: "center", flexWrap: "nowrap", flexGrow: "1" }}>
                    <InputText
                      style={{ marginInline: "0.5rem", width: "90%" }}
                      placeholder={settings?.condaPath ? settings?.condaPath : "Not defined"}
                      value={condaPath}
                      onChange={(e) => {
                        setCondaPath(e.target.value)
                        saveSettings({ ...settings, condaPath: e.target.value })
                      }}
                    />
                    <a
                      onClick={() => {
                        ipcRenderer.invoke("open-dialog-exe").then((path) => {
                          console.log("path", path)
                          setCondaPath(path)
                          saveSettings({ ...settings, condaPath: path })
                        })
                      }}
                    >
                      <Folder2Open size="30" style={{ marginLeft: "0rem" }} />
                    </a>
                  </Col>
                </Col>
                <Col xs={12} md={12} style={{ display: "flex", flexDirection: "row", justifyContent: "flex-start", alignItems: "center", flexWrap: "wrap", marginTop: ".75rem" }}>
                  <Col xs={12} md="auto" style={{ display: "flex", flexDirection: "row", justifyContent: "flex-start", alignItems: "center", flexWrap: "wrap" }}>
                    <h5>General Seed for Random Number Generation: </h5>
                  </Col>
                  <Col xs={12} md="auto" style={{ display: "flex", flexDirection: "row", justifyContent: "flex-start", alignItems: "center", flexWrap: "nowrap", flexGrow: "1" }}>
                    <InputNumber
                      style={{ marginInline: "0.5rem", width: "90%" }}
                      value={seed}
                      onChange={(e) => {
                        saveSettings({ ...settings, seed: e.value })
                      }}
                    />
                  </Col>
                </Col>
                {/* Mongo Status */}
                <Col xs={12} md={10} style={{ display: "flex", flexDirection: "row", justifyContent: "flex-start", alignItems: "center", flexWrap: "wrap", marginTop: ".75rem" }}>
                  <h5 style={{ marginBottom: "0rem" }}>MongoDB status : </h5>
                  <h5 style={{ marginBottom: "0rem", marginLeft: "1rem", color: mongoServerIsRunning ? "green" : "#d55757" }}>{mongoServerIsRunning ? "Running" : "Stopped"}</h5>
                  {mongoServerIsRunning ? <Check2Circle size="30" style={{ marginInline: "1rem", color: "green" }} /> : <XCircleFill size="25" style={{ marginInline: "1rem", color: "#d55757" }} />}
                  <Button
                    label="Start server"
                    className=" p-button-success"
                    onClick={() => {
                      startMongo()
                    }}
                    style={{ backgroundColor: mongoServerIsRunning ? "grey" : "#54a559", borderColor: mongoServerIsRunning ? "grey" : "#54a559", marginRight: "1rem" }}
                    disabled={mongoServerIsRunning}
                  />
                  {process.env.NODE_ENV === "development" && (
                    <>
                  <Button
                    label="Show first setup modal"
                    className="p-button-info"
                    onClick={() => {
                      console.log("show first setup modal")
                      setFirstSetupModalVisible(true)

                    }}
                    // style={{ backgroundColor: serverIsRunning ? "#d55757" : "grey", borderColor: serverIsRunning ? "#d55757" : "grey" }}
                    // disabled={!serverIsRunning}
                  />
                  </>)}
                </Col>
                <Col xs={12} md={12} style={{ display: "flex", flexDirection: "row", justifyContent: "flex-start", alignItems: "center", flexWrap: "wrap", marginTop: ".75rem" }}>
                  <Col xs={12} md="auto" style={{ display: "flex", flexDirection: "row", justifyContent: "flex-start", alignItems: "center", flexWrap: "wrap" }}>
                    <h5>Python bundled : &nbsp;</h5>
                  </Col>
                  <Col xs={12} md="auto" style={{ display: "flex", flexDirection: "row", justifyContent: "flex-start", alignItems: "center", flexWrap: "nowrap", flexGrow: "1" }}>
                    {pythonEmbedded.pythonEmbedded && <Check2Circle size="25" style={{ marginInline: "1rem", color: "green" }} />}
                    {!pythonEmbedded.pythonEmbedded && <XCircleFill size="25" style={{ marginInline: "1rem", color: "#d55757" }} />}
                    <h5>{pythonEmbedded.pythonEmbedded ? `Yes` : "No"} &nbsp;</h5>

                    {!pythonEmbedded.pythonEmbedded && (
                      <Button
                        label="Install Python"
                        onClick={() => {
                          ipcRenderer.invoke("installBundledPythonExecutable")
                        }}
                      />
                    )}
                    {pythonEmbedded.pythonEmbedded && (
                      <Button
                        label={showPythonPackages ? "Hide Python Packages" : "Show Python Packages"}
                        onClick={() => {
                          setShowPythonPackages(!showPythonPackages)
                          console.log(pythonEmbedded.pythonPackages)
                        }}
                      />
                    )}
                  </Col>
                  {/* If pythonEmbedded.pythonEmbedded is defined and a string, show it in a label just under this way: "at ${pythonEmbedded.pythonEmbedded}"*/}
                  {pythonEmbedded.pythonEmbedded && typeof pythonEmbedded.pythonEmbedded === "string" && <h6 style={{ marginTop: "0.5rem" }}>at {pythonEmbedded.pythonEmbedded}</h6>}
                </Col>
                {showPythonPackages && (
                  <DataTable value={pythonEmbedded.pythonPackages} size="small" scrollable scrollHeight="25rem" style={{ marginTop: "1rem" }}>
                    <Column field="name" header="Name" />
                    <Column field="version" header="Version" />
                  </DataTable>
                )}
              </Col>
            </div>
          </TabPanel>
        </TabView>
      </ModulePage>
      <FirstSetupModal visible={firstSetupModalVisible} onHide={() => setFirstSetupModalVisible(false)} closable={false} />
    </>
  )
}

export default SettingsPage
