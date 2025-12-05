import React, { useContext } from "react"
import { Accordion, Button, Stack } from "react-bootstrap"
import { WorkspaceContext } from "../../../workspace/workspaceContext"
import { ipcRenderer } from "electron"
import SidebarDirectoryTreeControlled from "../directoryTree/sidebarDirectoryTreeControlled"
import SupersetPanel from "../../../mainPages/superset/supersetPanel"

/**
 * @description - This component is the sidebar tools component that will be used in the sidebar component as the home page
 *
 */
const HomeSidebar = () => {
  const { workspace } = useContext(WorkspaceContext) // We get the workspace from the context to retrieve the directory tree of the workspace, thus retrieving the data files

  /**
   * @description - This function is used to send a message to the main process to request a folder from the user
   */
  async function handleWorkspaceChange() {
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
          Home
        </p>
        {workspace.hasBeenSet == false && <h3 style={{ color: "white", paddingInline: "1rem" }}>No workspace</h3>}
        {workspace.hasBeenSet == false && (
          <Button onClick={handleWorkspaceChange} style={{ margin: "1rem" }}>
            Set Workspace
          </Button>
        )}
        <Accordion defaultActiveKey={["dirTree"]} alwaysOpen>
          <SidebarDirectoryTreeControlled />
        </Accordion>

        {workspace.hasBeenSet == true && (<SupersetPanel />)}
      </Stack>
    </>
  )
}

export default HomeSidebar
