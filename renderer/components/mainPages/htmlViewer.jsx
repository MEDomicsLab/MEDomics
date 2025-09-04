import React, { useEffect, useState, useContext } from "react"
//import { connectToMongoDB } from "../mongoDB/mongoDBUtils"
import Iframe from "react-iframe"
import { DataContext } from "../workspace/dataContext"
import { MEDDataObject } from "../workspace/NewMedDataObject"
import { WorkspaceContext } from "../workspace/workspaceContext"
import { toLocalPath } from "../../utilities/fileManagementUtils"

/**
 * @param config currently a MEDDataObject
 * @returns a page that shows the html content
 */
const HtmlViewer = ({ config }) => {
  const [localPath, setLocalPath] = useState(undefined)
  const { globalData } = useContext(DataContext)
  const { workspace } = useContext(WorkspaceContext)

  useEffect(() => {
    async function onMount(medObject) {
      // We need to have a local file to display it
      if (!medObject.inWorkspace) {
        await MEDDataObject.sync(globalData, medObject.id, workspace.workingDirectory.path, false)
      }

      const medObjectPath = MEDDataObject.getFullPath(globalData, medObject.id, workspace.workingDirectory.path)
      toLocalPath(medObjectPath).then((localPath) => {
        setLocalPath(localPath)
      })
    }

    const medObject = globalData[config.id]
    const alreadyInWorkspace = medObject.inWorkspace
    onMount(medObject)

    // returned function will be called on component unmount
    return () => {
      // Remove downloaded file from workspace
      if (!alreadyInWorkspace) {
        MEDDataObject.deleteObjectAndChildrenFromWorkspace(globalData, medObject.id, workspace.workingDirectory.path, false)
      }
    }
  }, [])

  return <>{localPath && <Iframe url={localPath} width="100%" height="100%" />}</>
}

export default HtmlViewer
