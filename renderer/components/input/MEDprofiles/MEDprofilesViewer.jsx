import { randomUUID } from "crypto"
import { ProgressSpinner } from "primereact/progressspinner"
import React, { useContext, useEffect, useState } from "react"
import { toast } from "react-toastify"
import { requestBackend } from "../../../utilities/requests"
import ModulePage from "../../mainPages/moduleBasics/modulePage"
import { connectToMongoDB, insertMEDDataObjectIfNotExists } from "../../mongoDB/mongoDBUtils"
import { MEDDataObject } from "../../workspace/NewMedDataObject"
import { WorkspaceContext } from "../../workspace/workspaceContext"
import MEDcohortFigure from "./MEDcohortFigure"
import path from "path"

/**
 *
 * @param {String} pageId Page identifier
 * @param {MEDDataObject} MEDclassesFolder Folder containing the generated MEDclasses
 * @param {MEDDataObject} MEDprofilesBinaryFile Binary file containing the instantiated MEDprofiles
 *
 * @returns {JSX.Element} a page
 *
 * @description
 * This page is part of the MEDprofiles' module (submodule of the input module) and all the necessary
 * elements to display and interact with the figure(s) displayed.
 *
 */
const MEDprofilesViewer = ({ pageId, MEDclassesFolder, MEDprofilesBinaryFile }) => {
  const [jsonID, setJsonID] = useState(null)
  const { port } = useContext(WorkspaceContext) // we get the port for server connexion
  const [jsonDataIsLoaded, setJsonDataIsLoaded] = useState(false)

  /**
   * @description
   * Get the parent's path from the MEDDataObject by removing the file name at the end
   * @param {MEDDataObject} medDataObject The object from which to get the path
   * @returns {String} The parent's path
   */
  const getParentPath = (medDataObject) => {
    if (!medDataObject || !medDataObject.path) return null
    const pathParts = medDataObject.path.split(path.sep)
    pathParts.pop() // remove the file name
    return path.join(...pathParts)
  }

  /**
   * @description
   * This function is called while the page elements are loaded in order
   * to load the MEDprofiles' data (ie. MEDcohort) as JSON data
   */
  const loadCohort = async () => {
    // check if the MEDprofiles.json data already exists in the database
    const db = await connectToMongoDB()
    let collection = db.collection("medDataObjects")
    let object = await collection.findOne({ name: "MEDprofiles.json", type: "json", parentID: MEDprofilesBinaryFile.parentID })

    // If object not in the DB we create and insert it
    if (!object) {
      object = new MEDDataObject({
        id: randomUUID(),
        name: "MEDprofiles.json",
        type: "json",
        parentID: MEDprofilesBinaryFile.parentID,
        childrenIDs: [],
        // MEDprofilesBinaryFile.path : "path/to/your/medprofiles_bin.pkl" --> Get the path from the MEDprofilesBinaryFile but remove the file name
        path: path.join(getParentPath(MEDprofilesBinaryFile), "MEDprofiles.json"),
        inWorkspace: false
      })
    } else {
      // In case the object already in the DB delete its content
      collection = db.collection(object.id)
      await collection.deleteMany({})
    }

    requestBackend(
      port,
      "/MEDprofiles/load_pickle_cohort/" + pageId,
      {
        MEDclassesFolder: MEDclassesFolder.path,
        MEDprofilesBinaryFileID: MEDprofilesBinaryFile.id,
        MEDprofilesBinaryFile: MEDprofilesBinaryFile.path,
        MEDprofilesJsonFileID: object.id
      },
      (jsonResponse) => {
        console.log("received results:", jsonResponse)
        if (!jsonResponse.error) {
          setJsonID(object.id)
        } else {
          toast.error(`Reading failed: ${jsonResponse.error}`)
        }
      },
      function (err) {
        console.error(err)
        toast.error(`Reading failed: ${err}`)
      }
    )
    await insertMEDDataObjectIfNotExists(object)
  }

  // Called when the page open, in order to load data
  useEffect(() => {
    if (MEDclassesFolder && MEDprofilesBinaryFile) {
      loadCohort()
    }
  }, [])

  return (
    <>
      <ModulePage pageId={pageId}>
        <h1 className="center">MEDprofiles Viewer</h1>
        {!jsonDataIsLoaded && (
          <div className="centered-container">
            <ProgressSpinner />
          </div>
        )}
        {jsonID && <MEDcohortFigure jsonID={jsonID} setJsonDataIsLoaded={setJsonDataIsLoaded} />}
      </ModulePage>
    </>
  )
}

export default MEDprofilesViewer
