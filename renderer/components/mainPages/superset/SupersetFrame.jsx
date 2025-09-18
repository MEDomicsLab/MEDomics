import { error } from "console"
import { ipcRenderer } from "electron"
import { readdir } from 'fs/promises'
import os from "os"
import { Accordion, AccordionTab } from 'primereact/accordion'
import { Button } from "primereact/button"
import { Card } from "primereact/card"
import { confirmDialog } from 'primereact/confirmdialog'
import { InputText } from 'primereact/inputtext'
import { OverlayPanel } from 'primereact/overlaypanel'
import { Password } from 'primereact/password'
import { Tooltip } from 'primereact/tooltip'
import { useContext, useEffect, useRef, useState } from 'react'
import Iframe from "react-iframe"
import { toast } from "react-toastify"
import { requestBackend } from "../../../utilities/requests"
import { ErrorRequestContext } from "../../generalPurpose/errorRequestContext"
import ProgressBarRequests from "../../generalPurpose/progressBarRequests"
import { LayoutModelContext } from "../../layout/layoutContext"
import { WorkspaceContext } from "../../workspace/workspaceContext"
import ModulePage from "../moduleBasics/modulePage"
import { SupersetRequestContext } from "./supersetRequestContext"

/**
 *
 * @returns the superset page
 */
const SupersetDashboard = () => {
  const [newUserUsername, setNewUserUsername] = useState(null)
  const [newUserPassword, setNewUserPassword] = useState(null)
  const [newFirstName, setNewFirstName] = useState(null)
  const [newLastName, setNewLastName] = useState(null)
  const [newUserEmail, setNewUserEmail] = useState(null)
  const [isEmailValid, setIsEmailValid] = useState(true)
  const [loading, setLoading] = useState(true)
  const [progress, setProgress] = useState(0)
  const [loadingUser, setLoadingUser] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const sleep = ms => new Promise(r => setTimeout(r, ms))
  const { port } = useContext(WorkspaceContext)
  const { setError } = useContext(ErrorRequestContext)
  const { dispatchLayout } = useContext(LayoutModelContext)
  const { url, supersetPort, launched, setUrl, setSupersetPort, setLaunched } = useContext(SupersetRequestContext)
  const op = useRef(null)

  const getDirectories = async source =>
    (await readdir(source, { withFileTypes: true }))
      .filter(dirent => (dirent.isDirectory() && dirent.name.startsWith("python")))
      .map(dirent => dirent.name)

  async function getSupersetProcesses() {
    // For windows only
    // Run tasklist
    const { exec } = require('child_process')
    const system = os.platform()
    // Windows
    if (system === "win32") {
      const pid = await new Promise((resolve, reject) => {
        exec(`tasklist | findstr superset.exe`, (err, stdout, stderr) => {
          if (err) {
            console.error(err)
            reject(error)
          }
          console.log("stdout", stdout)
          console.error("stderr", stderr)

          // Parse stdout
          if (stdout === "") {
            resolve(null)
            return
          }
          let match = stdout.split(/\s+/g)
          match = match.filter((el) => el !== "")

          // Return PID
          resolve(match[1])
        })
      })
      return pid
    }
  }

  async function launchSuperset() {
    let freePort = 8080 // in the future maybe we'll use getPort() from get-port package
    let pythonPath = await ipcRenderer.invoke("getBundledPythonEnvironment")

    // Send the request to the backend
    let jsonToSend = {
      "port": freePort,
      "pythonPath": pythonPath,
    }
    setLoading(true)
    requestBackend(
      port,
      "/superset/launch/",
      jsonToSend,
      async (jsonResponse) => {
        setLoading(false)
        if (jsonResponse.error) {
          if (jsonResponse.error.message) {
            console.error(jsonResponse.error.message)
            toast.error(jsonResponse.error.message, {autoClose: 5000})
            setError(jsonResponse.error)
          } else {
            console.error(jsonResponse.error)
            toast.error("Error launching superset. Check console for more details", {autoClose: 5000})
            setError({"message": jsonResponse.error})
          }
          setLoading(false)
        } else {
          // get port
          if (!jsonResponse.hasOwnProperty("port")){
            toast.error("Could not retrieve port from response", {autoClose: 5000})
            console.error("Could not retrieve port from response", jsonResponse)
            setLoading(false)
            return
          }
          freePort = jsonResponse.port
          setSupersetPort(freePort)
          setUrl("http://localhost:" + freePort)
          setLaunched(true)
          setLoading(false)
          refreshSuperset()
          toast.success("Superset launched successfully on port " + freePort)
        }
      },
      (error) => {
        console.error(error)
        toast.error("Error launching superset. Check console for more details", {autoClose: 5000})
        setLoading(false)
      }
    )
  }

  async function createUser() {
    // get Python path
    let pythonPath = await ipcRenderer.invoke("getBundledPythonEnvironment")

    // Send the request to the backend
    let jsonToSend = {
      "pythonPath": pythonPath,
      "username": newUserUsername,
      "password": newUserPassword,
      "firstname": newFirstName,
      "lastname": newLastName,
      "email": newUserEmail,
    }
    setLoadingUser(true)
    requestBackend(
      port,
      "/superset/create_user/",
      jsonToSend,
      async (jsonResponse) => {
        console.log("jsonResponse", jsonResponse)
        setLoadingUser(false)
        if (jsonResponse.error) {
          if (jsonResponse.error.message) {
            console.error(jsonResponse.error.message)
            toast.error(jsonResponse.error.message, {autoClose: 5000})
          } else {
            console.error(jsonResponse.error)
            toast.error(jsonResponse.error, {autoClose: 5000})
          }
        } else {
          toast.success("User created successfully")
          op.current.hide()
          // Reset the fields
          setNewUserUsername(null)
          setNewUserPassword(null)
          setNewFirstName(null)
          setNewLastName(null)
          setNewUserEmail(null)
        }
      },
      (error) => {
        setLoadingUser(false)
        console.error(error)
        toast.error("Error creating user " + error, {autoClose: 5000})
      }
    )
  }

  function renderCreateUser() {
    return (
      <Card title="Create New User" subTitle="Enter the details of the new user" 
        style={{
          background: "transparent",
          boxShadow: "none",
          border: "none",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}>
        <div className="card flex justify-content-center flex-column gap-2" style={{borderWidth: "0px"}}>
          <div className="p-inputgroup">
              <span className="p-inputgroup-addon">
                <i className="pi pi-user"></i>
              </span>
              <InputText placeholder="Username" onChange={(e) => {setNewUserUsername(e.target.value)}}/>
          </div>
          <div className="p-inputgroup">
              <span className="p-inputgroup-addon">
                <i className="pi pi-user"></i>
              </span>
              <InputText placeholder="First Name" onChange={(e) => setNewFirstName(e.target.value)}/>
          </div>
          <div className="p-inputgroup">
              <span className="p-inputgroup-addon">
                <i className="pi pi-user"></i>
              </span>
              <InputText placeholder="Last Name" onChange={(e) => setNewLastName(e.target.value)}/>
          </div>
          <div className="p-inputgroup">
              <span className="p-inputgroup-addon">
                <i className="pi pi-key"></i>
              </span>
              <Password placeholder="Password" onChange={(e) => setNewUserPassword(e.target.value)} toggleMask/>
          </div>
          <div className="p-inputgroup">
              <span className="p-inputgroup-addon">
                <i className="pi pi-envelope"></i>
              </span>
              <InputText placeholder="Email" onChange={(e) => setNewUserEmail(e.target.value)}/>
          </div>
          {!isEmailValid && <small className="text-danger">Please enter a valid email address</small>}
          <Button 
            label="Create User" 
            severity="info" 
            loading={loadingUser}
            disabled={newUserUsername === null || newUserPassword === null || newFirstName === null || newLastName === null || newUserEmail === null} 
            onClick={() => createUser()}
          />
        </div>
      </Card>
    )
  }

  async function killProcess() {
     // Get system
     const { exec } = require('child_process')
     const system = os.platform()

    // Get PID of the process for windows
    let pid = null
    if (system === "win32") {
      pid = await getSupersetProcesses()
    }
    // Confirm dialog
    const accept = () => {
      // Windows
      if (system === "win32") {
        if (!pid) {
          toast.error("Superset's PID not found", {autoClose: 5000})
          return
        }
        exec(`taskkill /F /PID ${pid}`, (err, stdout, stderr) => {
          if (err) {
            console.error(err)
            toast.error("Error killing process", {autoClose: 5000})
            return
          }
          console.log("stdout", stdout)
          console.error("stderr", stderr)
          setLaunched(false)
          setSupersetPort(null)
          toast.success("Process killed successfully")
        })
      } else {
        // Linux or MacOS
        exec(`killall superset`, (err, stdout, stderr) => {
          if (err) {
            console.error(err)
            return
          }
          console.log("stdout", stdout)
          console.error("stderr", stderr)
          setLaunched(false)
          setSupersetPort(null)
          toast.success("Process killed successfully")
        })
      }
      // Close tab
      dispatchLayout({ type: "DELETE_DATA_OBJECT", payload: {uuid: "Superset"} })
    }
    const reject = () => {
      return
    }
    confirmDialog({
      message: `This will shutdown Superset, are you sure you want to proceed?`, 
      header: "Confirmation",
      icon: "pi pi-exclamation-triangle",
      accept,
      reject,
      acceptClassName: 'p-button-danger',
      rejectClassName: 'p-button-info',
    })
    return
  }

  const getEnvPath = (pythonPath) => {
    if (!pythonPath) return ''
    
    const isWindows = os.platform() === "win32"
    if (isWindows) {
      const pathParts = pythonPath.split(/[\\/]/)
      pathParts.pop()
      return `${pathParts.join('\\')}\\superset_env\\Scripts\\python.exe`
    } else {
      return pythonPath.replace(/bin(\/|$)/, 'bin/superset_env/bin/')
    }
  }

  const getSupersetConfigPath = async (pythonPath) => {
    const envPath = getEnvPath(pythonPath)
    if (!envPath) return ''
    
    const isWindows = os.platform() === "win32"
    if (isWindows) {
      return `${envPath}\\Lib\\site-packages\\superset`
    } else {
      const basePath = envPath.split('/superset_env/bin')[0]
      // Find python directory
      const pythonDirs = await getDirectories(`${basePath}/superset_env/lib`)
      if(pythonDirs.length === 0){
        console.error("Could not find python directory", pythonDirs)
        toast.error("Could not find python directory", {autoClose: 5000})
        return
      }
      return `${basePath}/superset_env/lib/${pythonDirs[0]}/site-packages/superset/config.py`
    }
  }

  async function editConfig() {
    // Get config path
    let pythonPath = await ipcRenderer.invoke("getBundledPythonEnvironment")
    let configPath = await getSupersetConfigPath(pythonPath)

    // If object already in the DB, show a confirmation dialog to overwrite it
    const accept = () => {
      dispatchLayout({ type: "openGenericCodeEditor", payload: {path: configPath} })
    }

    const reject = () => {
      return
    }
    confirmDialog({
      message: `Changing the default configuration can lead to issues running Superset. Are you sure you want to proceed?`, 
      header: "Confirmation",
      icon: "pi pi-exclamation-triangle",
      accept,
      reject,
      acceptClassName: 'p-button-danger',
      rejectClassName: 'p-button-info',
    })
    return
  }

  async function refreshSuperset() {
    await sleep(3000)
    setRefresh(refresh+1)
    getSupersetProcesses()
  }

  useEffect(() => {
    if (newUserEmail) {
      if (newUserEmail.match(/^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/)) {
        setIsEmailValid(true)
      }
      else {
        setIsEmailValid(false)
      }
    }
  }, [newUserEmail])

  useEffect(() => {
    refreshSuperset()
  }, [url, launched])

  // Launch superset on mount
  useEffect(() => {
    if (!launched){
      try {
        launchSuperset()
      } catch (error) {
        console.error("Error launching Superset:", error)
      }
    }
  }, [])

  return (
    <>
      {launched ? (
        <div>
          {/* Tooltips */}
          <Tooltip target=".p-button" />
          <OverlayPanel ref={op} showCloseIcon id="overlaypanel" style={{width: '450px'}}>
            {renderCreateUser()}
          </OverlayPanel>
          <Accordion>
            <AccordionTab header="Superset tools">
              <div className="card flex flex-container gap-2" style={{borderWidth: "0px", justifyContent: "left"}}>
                <span className="p-inputgroup-addon" style={{border: "0.5px solid #ccc"}}>Superset is running on port {supersetPort ? supersetPort : "8080"}</span>
                <Button icon="pi pi-refresh" severity="success" tooltip="Refresh page" tooltipOptions={{ position: 'bottom' }} onClick={() => refreshSuperset()}/>
                <Button label="Create New User" severity="info" onClick={(e) => op.current.toggle(e)} />
                <Button label="Edit Superset Configuration" severity="info" onClick={() => editConfig()}/>
                <Button label="Kill Superset" severity="danger" onClick={() => killProcess()}/>
              </div>
            </AccordionTab>
          </Accordion>

          {/* Superset Frame */}
          <Iframe
            id="superset-frame"
            key={refresh}
            src={url}
            frameborder="0"
            width="100%"
            height="900"
            allowtransparency
          ></Iframe>
        </div>
      ) : (
        <div style={{justifyContent: "center", textAlign: "center", maxWidth: "80%", marginLeft: "auto", marginRight: "auto", marginTop: "20%"}}>
          <Card 
            title="Launching superset..."
            subTitle="This process will change and override your superset configuration file and launch superset in the background.
                Avoid using Superset within MEDomicsLab if you have a running instance of superset or if you want to keep your current configuration.">
            {loading && (
              <ProgressBarRequests
                progressBarProps={{ animated: true, variant: "success" }}
                isUpdating={loading}
                setIsUpdating={setLoading}
                progress={progress}
                setProgress={setProgress}
                requestTopic={"superset/progress/"}
              />
            )}
          </Card>
        </div>
      )}
      {/* bottom center - progress bar <div className="panel-bottom-center">*/}
    </>
  )
}

/**
 *
 * @param {String} pageId The page id
 * @returns the super page with the module page
 */
const SupersetFrame = ({ pageId = "SupersetDashboard-id" }) => {
  return (
    <ModulePage pageId={pageId} shadow>
        <SupersetDashboard pageId={pageId} />
    </ModulePage>
  )
}

export default SupersetFrame
