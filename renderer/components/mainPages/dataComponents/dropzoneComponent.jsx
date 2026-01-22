import React, { useCallback, useState, useContext } from "react"
import { useDropzone } from "react-dropzone"
import { MEDDataObject } from "../../workspace/NewMedDataObject"
import { toast } from "react-toastify"
import { getDroppedOrSelectedFiles } from "html5-file-selector"
import { DataContext } from "../../workspace/dataContext"
import { randomUUID } from "crypto"
import { insertMEDDataObjectIfNotExists } from "../../mongoDB/mongoDBUtils"

// Import fs and path
const fs = require("fs")
const path = require("path")

/**
 * @typedef {React.FunctionComponent} DropzoneComponent
 * @description This component is the dropzone component that will be used to upload files to the workspace.
 * @params {Object} children - The children of the component
 * @summary This component is used to upload files to the workspace. It is used in the InputSidebar.
 * @todo Add the functionality to upload more file types than just CSV files
 */
export default function DropzoneComponent({ children, item = undefined, setIsDropping, ...props }) {
  const [style, setStyle] = useState({
    display: "block",
    position: "relative",
    width: "100%",
    height: "100%",
    borderWidth: "0px"
  })

  const { globalData } = useContext(DataContext)

  /**
   * @description This function is used to get the fullPath of the dragged files, in order to know if we drag only file(s) or a folder
   * @param {Event} event
   * @returns A list of File Objects with fullPath property
   */
  async function myCustomFileGetter(event) {
    const fileObjects = []
    let files = await getDroppedOrSelectedFiles(event)

    const folderMap = new Map() // Map to store folder path and MEDDataObject
    const parentID = item.index
    let globalDataCopy = { ...globalData }

    for (const file of files) {
      let fileObject = file.fileObject
      const stats = fs.lstatSync(fileObject.path)
      const isDirectory = stats.isDirectory()

      // Get the relative path from the parent directory
      const pathParts = file.fullPath.split("/").slice(1)

      let currentParentID = parentID
      for (let i = 0; i < pathParts.length; i++) {
        const partPath = pathParts[i]

        if (i < pathParts.length - 1) {
          console.log("Folder")
          // It's a folder
          if (!folderMap.has(partPath)) {
            const folderUUID = randomUUID()
            const folderUniqueName = MEDDataObject.getUniqueNameForCopy(globalDataCopy, partPath, currentParentID)
            const folderObject = new MEDDataObject({
              id: folderUUID,
              name: folderUniqueName,
              type: "directory",
              parentID: currentParentID,
              childrenIDs: [],
              inWorkspace: false
            })
            folderMap.set(partPath, folderObject)
            globalDataCopy[folderUUID] = folderObject

            // Update parent with new child
            if (currentParentID !== parentID) {
              const parentObject = globalDataCopy[currentParentID]
              parentObject.childrenIDs.push(folderUUID)
            }

            currentParentID = folderUUID
          } else {
            currentParentID = folderMap.get(partPath).id
          }
        } else {
          // It's a file or the last folder in the path
          const fileUUID = randomUUID()
          const fileUniqueName = MEDDataObject.getUniqueNameForCopy(globalDataCopy, file.name, currentParentID)
          const fileType = isDirectory ? "directory" : path.extname(fileObject.path).slice(1)
          const medObject = new MEDDataObject({
            id: fileUUID,
            name: fileUniqueName,
            type: fileType,
            parentID: currentParentID,
            childrenIDs: [],
            inWorkspace: false
          })
          Object.defineProperty(fileObject, "medObject", { value: medObject })
          globalDataCopy[fileUUID] = medObject
          fileObjects.push(fileObject)

          if (!isDirectory) {
            const parentObject = globalDataCopy[currentParentID]
            parentObject.childrenIDs.push(fileUUID)
          }
        }
      }
    }
    // Set new folders in globalData
    for (const folder of folderMap) {
      await insertMEDDataObjectIfNotExists(folder[1])
    }
    return fileObjects
  }

  /**
   * @description The function to be executed when a file is dropped in the dropzone
   */
  const onDrop = useCallback(async (files) => {
    if (files && files.length > 0) {
      for (const file of files) {
        await insertMEDDataObjectIfNotExists(file.medObject, file.path)
      }
    }
    MEDDataObject.updateWorkspaceDataObject()
    setIsDropping(false)
    setStyle({ ...style, ...baseStyle })
  }, [])

  /**
   * @description The function to be executed when a file is dropped in the dropzone but is rejected
   */
  const onDropRejected = useCallback((fileRejections) => {
    console.log("fileRejections", fileRejections)
    fileRejections.forEach((rejection) => {
      if (rejection.file && rejection.file.name) {
        if (rejection.errors && rejection.errors.length > 0 && rejection.errors[0].message) {
          toast.error(rejection.file.name + " rejected: " + rejection.errors[0].message)
        } else {
          toast.error(rejection.file.name + " rejected: File type not accepted in this folder")
        }
      } else {
        toast.error("File type not accepted in this folder")
      }
    })
    setIsDropping(false)
  }, [])

  // Event handler for dropzone hover
  const onDragOver = (event) => {
    event.preventDefault()
    setIsDropping(true)
    setStyle({ ...style, ...focusStyle })
  }
  // Event handler for dropzone hover leave
  const onDragLeave = (event) => {
    event.preventDefault()
    setIsDropping(false)
    setStyle({ ...style, ...baseStyle })
  }

  /**
   * @description - This is the useDropzone hook that is used to create the dropzone component
   * @param {Object} onDrop - The function to be executed when a file is dropped in the dropzone
   * @param {Object} onDropRejected - The function to be executed when a file is dropped in the dropzone but is rejected
   * @param {Object} noClick - A boolean that indicates if the dropzone should not be clickable
   * @returns {JSX.Element}
   * @see SidebarDirectoryTreeControlled - "../../layout/sidebarTools/sidebarDirectoryTreeControlled.jsx" This component is used in the SidebarDirectoryTreeControlled component
   */
  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    onDropRejected,
    getFilesFromEvent: (event) => myCustomFileGetter(event),
    onDragOver,
    onDragLeave,
    noClick: props.noClick || false,
    noDragEventsBubbling: true
  })

  // The style changes if the dropzone is focused
  const baseStyle = {
    display: "block",
    position: "relative",
    width: "100%",
    height: "100%",
    borderWidth: "0px"
  }

  const focusStyle = {
    borderWidth: "2px",
    borderColor: "#FFFFFF"
  }

  return (
    <div style={{ display: "block" }}>
      <div className="directory-tree-dropzone" {...getRootProps({ style })}>
        <input {...getInputProps()} />
        {children}
      </div>
    </div>
  )
}
