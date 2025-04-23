import React, { useState, useEffect, useContext } from "react"
import { randomUUID } from "crypto"
import { Panel } from "react-resizable-panels"
import dynamic from 'next/dynamic'; // Import next/dynamic
import { WorkspaceContext } from "../../workspace/workspaceContext"
import { toast } from "react-toastify"
import { requestBackend } from "../../../utilities/requests"
import resizable from "../../../styles/resizable.module.css"
import { connectToMongoDB, insertMEDDataObjectIfNotExists } from "../../mongoDB/mongoDBUtils"
import { MEDDataObject } from "../../workspace/NewMedDataObject"
// import MEDcohortFigure from "./MEDcohortFigure" // Comment out or remove static import

// Dynamically import MEDcohortFigure with SSR disabled
const DynamicMEDcohortFigure = dynamic(() => import('./MEDcohortFigure'), {
  ssr: false,
  loading: () => <p>Loading Chart...</p> // Optional: Add a loading indicator
});



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
  // eslint-disable-next-line no-unused-vars
  const [jsonDataIsLoaded, setJsonDataIsLoaded] = useState(false)

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
        MEDprofilesJsonFileID: object.id,
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
    <div className="med-profiles-viewer">
      {/* ... other components ... */}
      <Panel className={resizable.Panel} defaultSize={50} order={1}>
        {/* Conditionally render the dynamic component */}
        {jsonID && <DynamicMEDcohortFigure jsonID={jsonID} setJsonDataIsLoaded={setJsonDataIsLoaded} />}
      </Panel>
      {/* ... other components ... */}
    </div>
  )
}

export default MEDprofilesViewer
