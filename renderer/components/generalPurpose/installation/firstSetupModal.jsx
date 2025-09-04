import { Dialog } from "primereact/dialog"
import React, { useState, useContext, useEffect } from "react"
import { NotificationContext } from "../notificationContext"
import { ipcRenderer } from "electron"
import { ProgressBar } from "primereact/progressbar"
import { Button } from 'primereact/button'

/**
 *
 * @param {*} param0
 * @returns
 */
const FirstSetupModal = ({ visible, onHide, closable, setRequirementsMet }) => {
  const { notifications, setNotifications } = useContext(NotificationContext)
  const [pythonNotifications, setPythonNotifications] = useState({})
  const [mongoDBNotifications, setMongoDBNotifications] = useState({})
  const [pythonIsInstalled, setPythonIsInstalled] = useState(false)
  const [pythonIsInstalling, setPythonIsInstalling] = useState(false)
  const [pythonInstallationProgress, setPythonInstallationProgress] = useState(0)
  const [mongoDBIsInstalled, setMongoDBIsInstalled] = useState(false)
  const [mongoDBInstallationProgress, setMongoDBInstallationProgress] = useState(0)
  const [checkIsRunning, setCheckIsRunning] = useState(false)
  const [localRequirementsMet, setLocalRequirementsMet] = useState(false)
  const [clicked, setClicked] = useState(false)

  const checkPython = () => {
    ipcRenderer.invoke("getBundledPythonEnvironment").then((data) => {
      if (data) {
        ipcRenderer.invoke("checkPythonRequirements").then((data) => {
          console.log("Python requirements: ", data)
          if (data) {
            setPythonIsInstalled(true)
            setPythonInstallationProgress(100)
          }
        })
      }
    })
  }

  const checkMongoDB = () => {
    ipcRenderer.invoke("checkMongoDBisInstalled").then((data) => {
      console.log("MongoDB is installed: ", data)
      if (data !== null) {
        setMongoDBIsInstalled(true)
        setMongoDBInstallationProgress(100)
      } else {
        setMongoDBIsInstalled(false)
      }
    })
  }

  const installPython = () => {
    setPythonIsInstalling(true)
    ipcRenderer.invoke("installBundledPythonExecutable").then((data) => {
      console.log("Python installation: ", data)
    })
  }

  const installMongoDB = () => {
    ipcRenderer.invoke("installMongoDB")
  }

  const startSetup = () => {
    setClicked(true)
    if (!mongoDBIsInstalled) installMongoDB()
    installPython()
  }

  const closeFirstSetupModal = () => {
    setNotifications([])
    // Check if setRequirementsMet is a function before calling it
    if (typeof setRequirementsMet === "function") {
      setRequirementsMet(true)
    }
    ipcRenderer.invoke("getBundledPythonEnvironment").then((pythonPath) => {
      console.log("Starting the go server with the bundled python environment: " + pythonPath)
      ipcRenderer.invoke("start-server", pythonPath).then((serverProcess) => {
        console.log("Server process: ", serverProcess)
      })
    })
    if (typeof onHide === "function") {
      onHide()
    }
  }

  useEffect(() => {
    checkMongoDB()
    checkPython()
  }, [])

  useEffect(() => {
    console.log("FirstSetupModal pythonNotifications: ", pythonNotifications)
  }, [pythonNotifications])

  useEffect(() => {
    console.log("FirstSetupModal mongoDBNotifications: ", mongoDBNotifications)
  }, [mongoDBNotifications])

  useEffect(() => {
    console.log("FirstSetupModal notifications: ", notifications)

    // Count the number of Python notifications and calculate the progress
    let accumulatedPythonProgress = 0
    let accumulatedMongoDBProgress = 0
    let totalNumberOfPythonNotifications = 6857

    let newPythonNotifications = { ...pythonNotifications }
    let newMongoDBNotifications = { ...mongoDBNotifications }

    for (let notification of notifications) {
      if (notification.header.includes("Python")) {
        // Check if the notification is already in the dictionary
        if (newPythonNotifications[notification.id] === undefined) {
          notification.messages = [notification.message]
          notification.messagesCount = 1
          notification.done = false
          newPythonNotifications[notification.id] = notification
        } else {
          // Update the notification
          let newPythonNotification = newPythonNotifications[notification.id]
          newPythonNotification.messages.push(notification.message)
          newPythonNotification.messagesCount = newPythonNotification.messagesCount + 1
          newPythonNotifications[notification.id] = newPythonNotification
        }

        if (notification.message.includes("exited with code 0")) {
          newPythonNotifications[notification.id].done = true
        }
      } else if (notification.header.toLowerCase().includes("mongodb")) {
        if (newMongoDBNotifications[notification.id] === undefined) {
          notification.messages = [notification.message]
          notification.messagesCount = 1
          notification.done = false
          newMongoDBNotifications[notification.id] = notification
        } else {
          // Update the notification
          let newMongoDBNotification = newMongoDBNotifications[notification.id]
          newMongoDBNotification.messages.push(notification.message)
          newMongoDBNotification.messagesCount = newMongoDBNotification.messagesCount + 1
          newMongoDBNotifications[notification.id] = newMongoDBNotification
        }

        if (notification.message.includes("exited with code 0")) {
          newMongoDBNotifications[notification.id].done = true
        }
      }
    }

    if (!mongoDBIsInstalled) {
      let numberOfSteps = 3
      for (let notification in newMongoDBNotifications) {
        let mongoDBNotification = newMongoDBNotifications[notification]
        if (mongoDBNotification.done) {
          accumulatedMongoDBProgress += 1
        }
      }
      if (accumulatedMongoDBProgress == numberOfSteps) {
        setMongoDBInstallationProgress(100)
      } else {
        setMongoDBInstallationProgress(((accumulatedMongoDBProgress / numberOfSteps) * 100).toFixed(1))
      }
    }

    if (!pythonIsInstalled || pythonIsInstalling) {
      setPythonIsInstalling(true)
      let totalMessages = 0
      let numberOfPythonSteps = 5
      for (let notification in newPythonNotifications) {
        let pythonNotification = newPythonNotifications[notification]
        totalMessages += pythonNotification.messagesCount
        if (pythonNotification.done) {
          accumulatedPythonProgress += 1
        }
      }
      if (accumulatedPythonProgress == numberOfPythonSteps) {
        setPythonInstallationProgress(100)
      } else {
        let progress = -2 + (totalMessages / totalNumberOfPythonNotifications) * 100

        if (progress >= 100) {
          progress = 99.9
        }
        if (progress < 0) {
          progress = 0
        }

        setPythonInstallationProgress(progress.toFixed(1))
      }
      console.log("Total messages: ", totalMessages)
    }
    setPythonNotifications(newPythonNotifications)
    setMongoDBNotifications(newMongoDBNotifications)
  }, [notifications])

  /**
   * Timer to check the requirements
   * @returns
   * @summary This function is used to check the requirements every 5 seconds
   *         If the requirements are met, the function stops
   *         If the requirements are not met, the function continues
   */
  useEffect(() => {
    const interval = setInterval(() => {
      setCheckIsRunning(true)
      ipcRenderer.invoke("checkRequirements").then((data) => {
        console.log("Requirements: ", data)
        setCheckIsRunning(false)
        let pythonIsFullyInstalled = false
        if (data.pythonInstalled) {
          // Check if the python requirements are met
          ipcRenderer.invoke("checkPythonRequirements").then((pythonRequirements) => {
            console.log("Python requirements met: ", pythonRequirements)
            if (pythonRequirements) {
              setPythonIsInstalled(true)
              setPythonInstallationProgress(100)
              console.log("Python requirements met 2: ", pythonRequirements)
              pythonIsFullyInstalled = true
            }

            if (data.mongoDBInstalled) {
              setMongoDBIsInstalled(true)
              setMongoDBInstallationProgress(100)
            }

            if (data.mongoDBInstalled && pythonIsFullyInstalled) {
              console.log("REQUIREMENTS MET")
              try {
                setLocalRequirementsMet(true)
              } catch (error) {
                console.warn(error)
              }
            }
          })
        }
      })
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  return (
    <Dialog header="Application first setup" visible={visible} onHide={onHide} style={{ width: "50vw" }} closable={closable}>
      <div className="p-grid p-fluid">
        <div className="p-col-12">
          <h4>Thank you for installing the MEDomicsLab application!</h4>
          <p>Before you can start using it, we need to perform some initial setup.</p>
          <p>Ensure you are connected to the internet and click the button below to start the setup.</p>
          <p>Once the setup is complete, you will be able to start using the application.</p>
        </div>
        <div className="p-col-12 p-md-4">
          <Button
            style={{ display: "flex", alignContent: "center", marginBottom: "0.5rem" }}
            label="Start setup"
            disabled={clicked || localRequirementsMet}
            onClick={startSetup}
          />
        </div>
        <div className="p-col-12 p-md-4">
          <h4>MongoDB Installation</h4>
          {/* Progress bar */}
          <ProgressBar
            value={mongoDBInstallationProgress}
            displayValueTemplate={() => `${mongoDBInstallationProgress}%`}
            mode={checkIsRunning ? "indeterminate" : "determinate"}
            color={mongoDBIsInstalled ? "#22c55e" : ""}
          />
        </div>
        <div className="p-col-12 p-md-4">
          <h4>Python Installation</h4>
          {/* Progress bar */}
          <ProgressBar
            value={pythonInstallationProgress}
            displayValueTemplate={() => `${pythonInstallationProgress}%`}
            mode={checkIsRunning ? "indeterminate" : "determinate"}
            color={pythonInstallationProgress == 100 && pythonIsInstalled ? "#22c55e" : ""}
          />
        </div>
        <div className="p-end p-row-12" style={{ display: "flex", flexDirection: "row-reverse" }}>
          {localRequirementsMet && (
              <Button 
                style={{ display: "flex", alignContent: "right", marginBottom: "0.5rem", width: "100px" }}
                label="Close"
                severity="info" 
                onClick={closeFirstSetupModal} 
              />
          )}
        </div>
      </div>
      {/* Terminal Notification Panel */}
      {(clicked) && <div
        style={{
          backgroundColor: "#000",
          color: "#00ff00",
          padding: "1rem",
          borderRadius: "5px",
          marginTop: "1rem",
          marginBottom: "1rem",
          height: "200px",
          overflowY: "scroll",
          fontFamily: "monospace",
        }}
      >
        {notifications.map((notification, index) => (
          <div key={index}>
            <strong>{notification.header}:</strong> {notification.message}
          </div>
        ))}
      </div>}
    </Dialog>
  )
}

export default FirstSetupModal
