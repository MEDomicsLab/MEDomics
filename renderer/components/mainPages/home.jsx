import React, { useContext, useEffect, useState } from "react"
import Image from "next/image"
import myimage from "../../../resources/medomics_transparent_bg.png"
import { Button, Stack } from "react-bootstrap"
import { WorkspaceContext } from "../workspace/workspaceContext"
import { ipcRenderer } from "electron"
import FirstSetupModal from "../generalPurpose/installation/firstSetupModal"
import { MEDDataObject } from "../workspace/NewMedDataObject"
import { insertMEDDataObjectIfNotExists, findMEDDataObjectByName } from "../mongoDB/mongoDBUtils"
import { randomUUID } from "crypto"
import { requestBackend } from "../../utilities/requests"
import { ServerConnectionContext } from "../serverConnection/connectionContext"
import { toast } from "react-toastify"
import { FaRegQuestionCircle } from "react-icons/fa";
import ConnectionModal from "./connectionModal"

/**
 *
 * @returns the home page component
 */
const HomePage = () => {
  const { workspace, setWorkspace, recentWorkspaces } = useContext(WorkspaceContext)
  const [hasBeenSet, setHasBeenSet] = useState(workspace.hasBeenSet)
  const [appVersion, setAppVersion] = useState("")
  const [sampleGenerated, setSampleGenerated] = useState(false)
  const { port } = useContext(ServerConnectionContext)
  const [showConnectionModal, setShowConnectionModal] = useState(false)


  const [requirementsMet, setRequirementsMet] = useState(true)

  async function handleWorkspaceChange() {
    ipcRenderer.send("messageFromNext", "requestDialogFolder")
  }

  const generateSampleData = async () => {
    // Create a new MEDDataObject with the sample data
    const sampleID = randomUUID()
    const object = new MEDDataObject({
      id: sampleID,
      name: "SampleData.csv",
      type: "csv",
      parentID: "DATA",
      childrenIDs: [],
      inWorkspace: false
    })

    const jsonToSend = {
      datasetRequested: "diabetes", // Choose which dataset to generate from pycaret
      newSampleID: sampleID
    }

    // Request the creation of the sample data to the go server
    requestBackend(
      port,
      "/input/generate_sample_data/",
      jsonToSend,
      async (jsonResponse) => {
        console.log("jsonResponse", jsonResponse)
        if (jsonResponse.error) {
          console.log("Sample data error")
          if (jsonResponse.error.message) {
            console.error(jsonResponse.error.message)
            toast.error(jsonResponse.error.message)
          } else {
            console.error(jsonResponse.error)
            toast.error(jsonResponse.error)
          }
        } else {
          // Insert the MEDDataObject in the mongoDB database
          await insertMEDDataObjectIfNotExists(object)
          MEDDataObject.updateWorkspaceDataObject()
          setSampleGenerated(true)
          toast.success("Sample data generated successfully.")
        }
      },
      (error) => {
        console.log(error)
        toast.error("Error generating sample data " + error)
      }
    )
  }

  // Check if the requirements are met
  useEffect(() => {
    ipcRenderer.invoke("checkRequirements").then((data) => {
      console.log("Requirements: ", data)
      if (data.pythonInstalled && data.mongoDBInstalled) {
        setRequirementsMet(true)
      } else {
        setRequirementsMet(false)
      }
    })
    ipcRenderer.invoke("getAppVersion").then((data) => {
      setAppVersion(data)
    })
  }, [])

  // We set the workspace hasBeenSet state
  useEffect(() => {
    const checkDataSampleExists = async () => {
      findMEDDataObjectByName("SampleData.csv").then((data) => {
        if (data) {
          setSampleGenerated(true)
        } else {
          console.log("Sample data not found")
          setSampleGenerated(false)
        }
      })
    }

    if (workspace.hasBeenSet == false) {
      setHasBeenSet(true)
    } else {
      setHasBeenSet(false)
      setTimeout(() => { // Small delay to prevent the check from re-enabling the button after generating
        checkDataSampleExists().then(() => { console.log("Data sample checked") })
      }, 1000);
    }
  }, [workspace])

  // We set the recent workspaces -> We send a message to the main process to get the recent workspaces, the workspace context will be updated by the main process in _app.js
  useEffect(() => {
    ipcRenderer.send("messageFromNext", "getRecentWorkspaces")
  }, [])

  const handleRemoteConnect = () => {
    // Example: Save connection info to context or state
    // setRemoteConnection(connectionInfo);
    // Optionally close the modal
    setShowConnectionModal(false);
    // Optionally show a toast or message
    toast.success("Connected to remote workspace!");
    // You can also update ServerConnectionContext or trigger any logic needed for remote mode
  };

  return (
    <>
      <div className="container" style={{ paddingTop: "1rem", display: "flex", flexDirection: "vertical", flexGrow: "10" }}>
        <Stack direction="vertical" gap={1} style={{ padding: "0 0 0 0", alignContent: "center" }}>
          <h2>Home page</h2>
          <Stack direction="horizontal" gap={0} style={{ padding: "0 0 0 0", alignContent: "center" }}>
            <h1 style={{ fontSize: "5rem" }}>MEDomicsLab </h1>
            <h2 style={{ fontSize: "2rem", marginTop: "1.5rem" }}>v{appVersion}</h2>

            <Image src={myimage} alt="" style={{ height: "175px", width: "175px" }} />
          </Stack>
          {hasBeenSet ? (
            <>
              <h5>Set up your workspace to get started</h5>
              <Button onClick={handleWorkspaceChange} style={{ margin: "1rem" }}>
                Set Workspace
              </Button>
              <h5>Or open a recent workspace</h5>
              <Stack direction="vertical" gap={0} style={{ padding: "0 0 0 0", alignContent: "center", flex: "0 1 auto", marginBottom: "3rem" }}>
                {recentWorkspaces.map((workspace, index) => {
                  if (index > 4) return
                  return (
                    <a
                      key={index}
                      onClick={() => {
                        ipcRenderer.invoke("setWorkingDirectory", workspace.path).then((data) => {
                          if (workspace !== data) {
                            let workspaceToSet = { ...data }
                            setWorkspace(workspaceToSet)
                          }
                        })
                      }}
                      style={{ margin: "0rem", color: "var(--blue-600)" }}
                    >
                      <h6>{workspace.path}</h6>
                    </a>
                  )
                })}
              </Stack>
              <h5>Or connect to a remote workspace</h5>
              <Button onClick={() => setShowConnectionModal(true)} style={{ margin: "1rem" }}>
                Connect to a remote workspace
              </Button>
            </>
          ) : (
            <div className="workspace-set" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
              <h5>Workspace is set to {workspace.workingDirectory.path}</h5>
              {!sampleGenerated && (
                <div>
                  <Button style={{ marginTop: "0.5rem" }} onClick={generateSampleData}>Import sample data</Button>
                  <FaRegQuestionCircle title="Creates a SampleData.csv file in your workspace filled with a default PyCaret dataset (currently 'Diabetes')" style={{fontSize: "30px", color: "#444", marginTop: "0.5rem", marginLeft: "0.5rem"}} />
                </div>
              )}
            </div>
          )}
        </Stack>
      </div>
      {!requirementsMet && process.platform !=="darwin" && <FirstSetupModal visible={!requirementsMet} closable={false} setRequirementsMet={setRequirementsMet} />}
      {showConnectionModal && <ConnectionModal
        visible={showConnectionModal}
        closable={false}
        onClose={() => setShowConnectionModal(false)}
        onConnect={handleRemoteConnect}
      />}
    </>
  )
}

export default HomePage
