import { React, createContext } from "react"

const DATA = "DATA"
const EXPERIMENTS = "EXPERIMENTS"

/**
 * @typedef {React.Context} WorkspaceContext
 * @description
 * @summary
 * @see
 */
const WorkspaceContext = createContext(null)

/**
 * @typedef {React.FunctionComponent} WorkspaceProvider
 * @description This component provides the context for the workspace. It will provide the workspace object and the setWorkspace function to the children.
 * @params {Object} children -
 * @params {Object} workspaceObject -
 * @summary The workspace object is the object that contains the workspace information. It is an object that contains the following properties:'hasBeenSet' and 'workspaceObject'.
 *          The 'hasBeenSet' property is a boolean that indicates if the workspace has been set. The 'workspaceObject' property is the workspace containing information about all the files and folders in the workspace.
 */
function WorkspaceProvider({ workspace, setWorkspace, port, setPort, recentWorkspaces, setRecentWorkspaces, isRemoteWorkspace, setIsRemoteWorkspace, children }) {
  /**
   *
   * @param {string} name The name of the folder to get the path of
   * @param {*} returnObj return the object instead of the path (default false)
   * @returns {string} The path of the folder or the object if returnObj is true
   */
  const getBasePath = (name, returnObj = false) => {
    let returnValue = null
    workspace.workingDirectory.children.forEach((element) => {
      if (element.name === name) {
        returnValue = returnObj ? element : element.path
      }
    })
    return returnValue
  }
  return (
    <>
      <WorkspaceContext.Provider value={{ workspace, setWorkspace, port, setPort, recentWorkspaces, setRecentWorkspaces, isRemoteWorkspace, setIsRemoteWorkspace, getBasePath }}>{children}</WorkspaceContext.Provider>
    </>
  )
}

export { WorkspaceContext, WorkspaceProvider, DATA, EXPERIMENTS }
