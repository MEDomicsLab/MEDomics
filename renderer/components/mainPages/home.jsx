import React, { useContext, useEffect, useState } from "react"
import Image from "next/image"
import myimage from "../../../resources/medomics_transparent_bg.png"
import { Button, Stack } from "react-bootstrap"
import { WorkspaceContext } from "../workspace/workspaceContext"
import { ipcRenderer } from "electron"
import FirstSetupModal from "../generalPurpose/installation/firstSetupModal"

/**
 *
 * @returns the home page component
 */
const HomePage = () => {
  const { workspace, setWorkspace, recentWorkspaces } = useContext(WorkspaceContext)
  const [hasBeenSet, setHasBeenSet] = useState(workspace.hasBeenSet)
  const [appVersion, setAppVersion] = useState("")


  const [requirementsMet, setRequirementsMet] = useState(true)

  async function handleWorkspaceChange() {
    ipcRenderer.send("messageFromNext", "requestDialogFolder")
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
    if (workspace.hasBeenSet == false) {
      setHasBeenSet(true)
    } else {
      setHasBeenSet(false)
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
            <h5>Workspace is set to {workspace.workingDirectory.path}</h5>
          )}
        </Stack>
      </div>
      {!requirementsMet && process.platform !=="darwin" && <FirstSetupModal visible={!requirementsMet} closable={false} setRequirementsMet={setRequirementsMet} />}
    </>
  )
}

export default HomePage
