import React, { useContext } from "react"
import { Stack, Accordion } from "react-bootstrap"
import { WorkspaceContext } from "../../../workspace/workspaceContext"
import SidebarDirectoryTreeControlled from "../directoryTree/sidebarDirectoryTreeControlled"
import SupersetPanel from "../../../mainPages/superset/supersetPanel"

/**
 * @description - This component is the sidebar for almost all the modules in the application
 * @returns {JSX.Element}
 * @param {Object} children - The children components that will be rendered in the sidebar
 * @param {String} pageTitle - The title of the page that will be displayed in the sidebar
 */
const GeneralModuleSidebar = ({children, pageTitle="Undefined"}) => {
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
        {pageTitle} Module
        </p>

        {children}
        
        <Accordion defaultActiveKey={["dirTree"]} alwaysOpen>
          <SidebarDirectoryTreeControlled />
        </Accordion>
        
        {workspace.hasBeenSet == true && (<SupersetPanel />)}
        {/* We render the workspace only if it is set, otherwise it throws an error */}
      </Stack>
    </>
  )
}

export default GeneralModuleSidebar
