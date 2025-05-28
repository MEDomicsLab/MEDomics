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


/**
 *
 * @returns the home page component
 */
const HomePage = () => {
  const { workspace, setWorkspace, recentWorkspaces } = useContext(WorkspaceContext)
  const [hasBeenSet, setHasBeenSet] = useState(workspace.hasBeenSet)
  const [appVersion, setAppVersion] = useState("")
  const [sampleGenerated, setSampleGenerated] = useState(true)
  const { port } = useContext(ServerConnectionContext)


  const [requirementsMet, setRequirementsMet] = useState(true)

  async function handleWorkspaceChange() {
    ipcRenderer.send("messageFromNext", "requestDialogFolder")
  }

  const generateSampleData = async () => {
    setSampleGenerated(true)
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
          setSampleGenerated(false)
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
          toast.success("Sample data generated successfully.")
        }
      },
      (error) => {
        setSampleGenerated(false)
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
              <Stack direction="vertical" gap={0} style={{ padding: "0 0 0 0", alignContent: "center" }}>
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
            </>
          ) : (
            <div className="workspace-set" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
              <h5>Workspace is set to {workspace.workingDirectory.path}</h5>
              <Button disabled={sampleGenerated} style={{ marginTop: "0.5rem" }} onClick={generateSampleData}>Generate sample data</Button>
            </div>
          )}
        </Stack>
      </div>
      {!requirementsMet && process.platform !=="darwin" && <FirstSetupModal visible={!requirementsMet} closable={false} setRequirementsMet={setRequirementsMet} />}
    </>
  )
}

export default HomePage
