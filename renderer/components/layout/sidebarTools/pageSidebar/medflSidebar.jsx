import React, { useContext } from "react"
import { Stack, Accordion } from "react-bootstrap"
import { WorkspaceContext } from "../../../workspace/workspaceContext"
import SidebarDirectoryTreeControlled from "../directoryTree/sidebarDirectoryTreeControlled"

/**
 * @description - This component is the sidebar tools component for the MEDfl module
 * @summary - It contains the dropzone component and the workspace directory tree component
 * @returns {JSX.Element} - The MEDflSidebar component
 */
const MEDflSidebar = () => {
  // eslint-disable-next-line no-unused-vars
  const { workspace } = useContext(WorkspaceContext) // We get the workspace from the context to retrieve the directory tree of the workspace, thus retrieving the data files

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
          MEDfl Module
        </p>
        <Accordion defaultActiveKey={["dirTree"]} alwaysOpen>
          <SidebarDirectoryTreeControlled />
        </Accordion>

        {/* We render the workspace only if it is set, otherwise it throws an error */}
      </Stack>
    </>
  )
}

export default MEDflSidebar
