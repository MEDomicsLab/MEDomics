/* eslint-disable no-unused-vars */
import useInterval from "@khalidalansi/use-interval"
import { ipcRenderer } from "electron"
import fs from "fs"
import { Check2Circle, Folder2Open, XCircleFill } from "react-bootstrap-icons"
import { Button } from "primereact/button"
import { Column } from "primereact/column"
import { DataTable } from "primereact/datatable"
import { InputNumber } from "primereact/inputnumber"
import { InputText } from "primereact/inputtext"
import { TabPanel, TabView } from "primereact/tabview"
import { useCallback, useContext, useEffect, useRef, useState } from "react"
import { Col } from "react-bootstrap"
import { toast } from "react-toastify"
import { requestBackend } from "../../utilities/requests"
import FirstSetupModal from "../generalPurpose/installation/firstSetupModal"
import { WorkspaceContext } from "../workspace/workspaceContext"
import ModulePage from "./moduleBasics/modulePage"


var path = require("path")
const { spawn } = require("child_process")

/**
 * Settings page
 * @param {Object} props
 * @param {string} [props.pageId="settings"] - Page id for backend requests
 * @param {boolean} [props.isActive=true] - Whether the Settings tab is visible in the layout
 * @returns {JSX.Element} Settings page
 */
const SettingsPage = ({ pageId = "settings", isActive = true }) => {
  const { workspace, port } = useContext(WorkspaceContext)
  const [settings, setSettings] = useState(null)
  const [serverIsRunning, setServerIsRunning] = useState(false)
  const [mongoServerIsRunning, setMongoServerIsRunning] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [condaPath, setCondaPath] = useState("")
  const [seed, setSeed] = useState(54288)
  const [bundledPythonPath, setBundledPythonPath] = useState(null)
  const [pythonPackages, setPythonPackages] = useState(null)
  const [showPythonPackages, setShowPythonPackages] = useState(false)
  const [firstSetupModalVisible, setFirstSetupModalVisible] = useState(false)
  const [missingRequirements, setMissingRequirements] = useState(null) // null until checked
  const [requirementsCheckError, setRequirementsCheckError] = useState(null)
  const [isCheckingRequirements, setIsCheckingRequirements] = useState(false)
  const [isInstallingRequirements, setIsInstallingRequirements] = useState(false)

  const isMountedRef = useRef(true)
  const saveSettingsTimeoutRef = useRef(null)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      if (saveSettingsTimeoutRef.current) {
        clearTimeout(saveSettingsTimeoutRef.current)
      }
    }
  }, [])

  const checkMongoIsRunning = useCallback(() => {
    ipcRenderer.invoke("checkMongoIsRunning").then((status) => {
      if (!isMountedRef.current) return
      setMongoServerIsRunning((prev) => (prev === status ? prev : status))
    })
  }, [])

  const checkServer = useCallback(() => {
    requestBackend(
      port,
      "get_server_health",
      { pageId: pageId },
      (data) => {
        if (!isMountedRef.current) return
        setServerIsRunning((prev) => {
          const next = !!data
          return prev === next ? prev : next
        })
      },
      () => {
        if (!isMountedRef.current) return
        setServerIsRunning((prev) => (prev ? false : prev))
      }
    )
  }, [port, pageId])

  const checkBundledPython = useCallback(() => {
    ipcRenderer.invoke("getBundledPythonEnvironment").then((res) => {
      if (!isMountedRef.current) return
      setBundledPythonPath((prev) => (prev === res ? prev : res))
    })
  }, [])

  const loadPythonPackages = useCallback((pythonPath) => {
    if (!pythonPath) return
    ipcRenderer.invoke("getInstalledPythonPackages", pythonPath).then((packages) => {
      if (!isMountedRef.current) return
      setPythonPackages(packages)
    })
  }, [])

  useEffect(() => {
    ipcRenderer.invoke("get-settings").then((receivedSettings) => {
      if (!isMountedRef.current) return
      setSettings(receivedSettings)
      if (receivedSettings?.condaPath) {
        setCondaPath(receivedSettings.condaPath)
      }
      if (receivedSettings?.seed) {
        setSeed(receivedSettings.seed)
      }
    })
    ipcRenderer.invoke("getBundledPythonEnvironment").then((res) => {
      if (!isMountedRef.current) return
      setBundledPythonPath((prev) => (prev === res ? prev : res))
    })
  }, [])

  /**
   * Get the settings from the main process
   * if the conda path is defined in the settings, set it
   * Check if the server is running and set the state
   */
  useEffect(() => {
    if (bundledPythonPath && !condaPath) {
      setCondaPath(bundledPythonPath)
    }
  }, [bundledPythonPath])

  useEffect(() => {
    if (!isActive) return
    checkMongoIsRunning()
    checkServer()
  }, [isActive, checkMongoIsRunning, checkServer])

  useInterval(
    () => {
      checkServer()
      checkMongoIsRunning()
    },
    isActive ? 5000 : null
  )

  const checkMissingRequirements = useCallback((pythonPath) => {
    if (!pythonPath) return
    setIsCheckingRequirements(true)
    ipcRenderer
      .invoke("getMissingPythonRequirements", pythonPath)
      .then((missing) => {
        if (!isMountedRef.current) return
        setMissingRequirements(missing)
        setRequirementsCheckError(null)
      })
      .catch((error) => {
        if (!isMountedRef.current) return
        setMissingRequirements(null)
        setRequirementsCheckError(String(error?.message || error))
      })
      .finally(() => isMountedRef.current && setIsCheckingRequirements(false))
  }, [])

  const installMissingRequirements = () => {
    setIsInstallingRequirements(true)
    ipcRenderer
      .invoke("installMissingPythonRequirements", bundledPythonPath, missingRequirements.map((r) => r.requirement))
      .then(({ success, code }) => {
        if (success) {
          toast.success("Missing Python packages installed")
        } else {
          toast.error(`Package installation failed (pip exit code ${code}). See the notifications for pip's output.`)
        }
      })
      .finally(() => {
        if (!isMountedRef.current) return
        setIsInstallingRequirements(false)
        checkMissingRequirements(bundledPythonPath)
        if (showPythonPackages) loadPythonPackages(bundledPythonPath)
      })
  }

  useEffect(() => {
    checkMissingRequirements(bundledPythonPath)
  }, [bundledPythonPath, checkMissingRequirements])

  useEffect(() => {
    if (showPythonPackages && bundledPythonPath) {
      loadPythonPackages(bundledPythonPath)
    } else if (!showPythonPackages) {
      setPythonPackages(null)
    }
  }, [showPythonPackages, bundledPythonPath, loadPythonPackages])

  /**
   * Save the settings in the main process
   * @param {Object} newSettings - New settings object
   * @returns {void}
   */
  const saveSettings = (newSettings) => {
    if (saveSettingsTimeoutRef.current) {
      clearTimeout(saveSettingsTimeoutRef.current)
    }
    saveSettingsTimeoutRef.current = setTimeout(() => {
      ipcRenderer.send("save-settings", newSettings)
    }, 1000)
  }

  const startMongo = () => {
    let workspacePath = workspace.workingDirectory.path
    const mongoConfigPath = path.join(workspacePath, ".mediml", "mongod.conf")
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
      const paths = process.env.PATH.split(path.delimiter)
      for (let i = 0; i < paths.length; i++) {
        const binPath = path.join(paths[i], "mongod.exe")
        if (fs.existsSync(binPath)) {
          return binPath
        }
      }

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
        if (fs.existsSync(path.join(process.env.HOME, ".mediml", "mongodb", "bin", "mongod"))) {
          return path.join(process.env.HOME, ".mediml", "mongodb", "bin", "mongod")
        }
      } else {
        return "mongod"
      }
    } else if (process.platform === "linux") {
      const paths = process.env.PATH.split(path.delimiter)
      for (let i = 0; i < paths.length; i++) {
        const binPath = path.join(paths[i], "mongod")
        if (fs.existsSync(binPath)) {
          return binPath
        }
      }
      console.error("mongod not found in PATH"+paths)
      if (fs.existsSync("/usr/bin/mongod")) {
        return "/usr/bin/mongod"
      }
      console.error("mongod not found in /usr/bin/mongod")

      if (fs.existsSync("/home/"+process.env.USER+"/.mediml/mongodb/bin/mongod")) {
        return "/home/"+process.env.USER+"/.mediml/mongodb/bin/mongod"
      }
      return null

    }
  }

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
                        ipcRenderer.invoke("open-dialog-exe").then((selectedPath) => {
                          setCondaPath(selectedPath)
                          saveSettings({ ...settings, condaPath: selectedPath })
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
                        setSeed(e.value)
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
                      setFirstSetupModalVisible(true)
                    }}
                  />
                  </>)}
                </Col>
                <Col xs={12} md={12} style={{ display: "flex", flexDirection: "row", justifyContent: "flex-start", alignItems: "center", flexWrap: "wrap", marginTop: ".75rem" }}>
                  <Col xs={12} md="auto" style={{ display: "flex", flexDirection: "row", justifyContent: "flex-start", alignItems: "center", flexWrap: "wrap" }}>
                    <h5>Python bundled : &nbsp;</h5>
                  </Col>
                  <Col xs={12} md="auto" style={{ display: "flex", flexDirection: "row", justifyContent: "flex-start", alignItems: "center", flexWrap: "nowrap", flexGrow: "1" }}>
                    {bundledPythonPath && <Check2Circle size="25" style={{ marginInline: "1rem", color: "green" }} />}
                    {!bundledPythonPath && <XCircleFill size="25" style={{ marginInline: "1rem", color: "#d55757" }} />}
                    <h5>{bundledPythonPath ? `Yes` : "No"} &nbsp;</h5>

                    {!bundledPythonPath && (
                      <Button
                        label="Install Python"
                        onClick={() => {
                          ipcRenderer.invoke("installBundledPythonExecutable").then(() => {
                            checkBundledPython()
                          })
                        }}
                      />
                    )}
                    {bundledPythonPath && (
                      <Button
                        label={showPythonPackages ? "Hide Python Packages" : "Show Python Packages"}
                        onClick={() => {
                          setShowPythonPackages((prev) => !prev)
                        }}
                      />
                    )}
                  </Col>
                  {bundledPythonPath && typeof bundledPythonPath === "string" && <h6 style={{ marginTop: "0.5rem" }}>at {bundledPythonPath}</h6>}
                </Col>
                {bundledPythonPath && (
                  <Col xs={12} md={12} className="d-flex flex-wrap align-items-center gap-3 mt-3">
                    <h5 className="mb-0">Required packages :</h5>
                    {isCheckingRequirements || isInstallingRequirements ? (
                      <h5 className="mb-0 text-muted">{isInstallingRequirements ? "Installing..." : "Checking..."}</h5>
                    ) : requirementsCheckError ? (
                      <>
                        <XCircleFill size="25" className="text-danger" />
                        <h5 className="mb-0 text-danger">Could not check the requirements</h5>
                      </>
                    ) : missingRequirements?.length === 0 ? (
                      <>
                        <Check2Circle size="25" className="text-success" />
                        <h5 className="mb-0">All requirements are met</h5>
                      </>
                    ) : missingRequirements ? (
                      <>
                        <XCircleFill size="25" className="text-danger" />
                        <h5 className="mb-0 text-danger">
                          {missingRequirements.length} missing or outdated package{missingRequirements.length > 1 ? "s" : ""}
                        </h5>
                      </>
                    ) : null}
                    <Button
                      label="Check again"
                      className="p-button-secondary p-button-outlined"
                      onClick={() => checkMissingRequirements(bundledPythonPath)}
                      disabled={isCheckingRequirements || isInstallingRequirements}
                    />
                    {missingRequirements?.length > 0 && (
                      <Button
                        label="Install missing packages"
                        icon="pi pi-download"
                        onClick={installMissingRequirements}
                        disabled={isCheckingRequirements || isInstallingRequirements}
                        loading={isInstallingRequirements}
                      />
                    )}
                  </Col>
                )}
                {requirementsCheckError && <small className="d-block mt-2 text-danger">{requirementsCheckError}</small>}
                {missingRequirements?.length > 0 && (
                  <DataTable value={missingRequirements} size="small" className="mt-3">
                    <Column field="requirement" header="Required" />
                    <Column header="Installed" body={(row) => row.installed || "Not installed"} />
                  </DataTable>
                )}
                {showPythonPackages && (
                  <DataTable value={pythonPackages} size="small" scrollable scrollHeight="25rem" style={{ marginTop: "1rem" }}>
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
