import React, { useContext } from "react"
import { Accordion, Button, Stack } from "react-bootstrap"
import { ipcRenderer } from "electron"
import SidebarDirectoryTreeControlled from "../directoryTree/sidebarDirectoryTreeControlled"
import { DataContext } from "../../../workspace/dataContext"

const ExplorerSidebar = () => {
  const { setGlobalData } = useContext(DataContext)

  /**
   * @description - This function is called when the user clicks on the change workspace button
   * @summary - This function sends a message to the main process (Electron) to open a dialog box to change the workspace
   */
  async function handleWorkspaceChange() {
    setGlobalData({})
    ipcRenderer.send("messageFromNext", "requestDialogFolder")
  }

  return (
    <>
      <Stack direction="vertical" gap={0}>
        <p
          style={{
            color: "#a3a3a3",
            font: "Arial",
            fontSize: "12px",
            padding: "0.75rem 0.25rem 0.75rem 0.75rem",
            margin: "0 0 0 0"
          }}
        >
          Explorer
        </p>
        <Accordion defaultActiveKey={["0", "1"]} alwaysOpen>
          <Accordion.Item eventKey="0">
            <Accordion.Header>
              <Stack direction="horizontal" style={{ flexGrow: "1" }}>
                <p style={{ marginBottom: "0px", paddingLeft: "1rem" }}>
                  <strong>WORKSPACE</strong>
                </p>
                <div style={{ flexGrow: "10" }} />
              </Stack>
            </Accordion.Header>
            <Accordion.Body>
              <Button onClick={handleWorkspaceChange}>Change Workspace</Button>
            </Accordion.Body>
          </Accordion.Item>
          <SidebarDirectoryTreeControlled />
        </Accordion>
      </Stack>
    </>
  )
}

export default ExplorerSidebar
