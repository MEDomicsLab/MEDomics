import { MEDDataObject } from "../../components/workspace/NewMedDataObject"
import { recursivelyRecenseWorkspaceTree } from "./workspaceUtils"
import { connectToMongoDB, insertMEDDataObjectIfNotExists } from "../../components/mongoDB/mongoDBUtils"
import { ipcRenderer } from "electron"

/**
 * @description Used to update the data present in the DB with local files not present in the database
 * @param {Object} workspaceObject
 */
export const updateGlobalData = async (workspaceObject) => {
  let rootChildren = workspaceObject.workingDirectory.children
  let rootParentID = "ROOT"
  let rootName = workspaceObject.workingDirectory.name
  let rootType = "directory"
  let rootPath = workspaceObject.workingDirectory.path
  let rootDataObject = new MEDDataObject({
    id: rootParentID,
    name: rootName,
    type: rootType,
    parentID: null,
    childrenIDs: [],
    inWorkspace: true,
    path: rootPath,
    isLocked: false,
    usedIn: null
  })
  await insertMEDDataObjectIfNotExists(rootDataObject, rootPath)
  await recursivelyRecenseWorkspaceTree(rootChildren, rootParentID, workspaceObject.isRemote)
}

/**
 * @descritption load the MEDDataObjects from the MongoDB database
 * @returns medDataObjectsDict dict containing the MEDDataObjects in the Database
 */
export async function loadMEDDataObjects(isRemote = false) {
  console.log("Loading MEDDataObjects from MongoDB...")
  let medDataObjectsDict = {}
  try {
    // Get global data
    const fs = require("fs")
    const db = await connectToMongoDB()
    const collection = db.collection("medDataObjects")
    const medDataObjectsArray = await collection.find().toArray()

    // Format data
    medDataObjectsArray.forEach(async (data) => {
      const medDataObject = new MEDDataObject(data)

      if (medDataObject.inWorkspace && medDataObject.path) {
        if (isRemote) {
          // Check if remote objects still exist
          const fileStatus = await ipcRenderer.invoke('checkRemoteFileExists', medDataObject.path)
          if (fileStatus == "exists") {
            medDataObjectsDict[medDataObject.id] = medDataObject
          } else if (fileStatus == "does not exist") {
            console.error(`${medDataObject.name}: not found remotely`, medDataObject)
          } else {
            console.error(`${medDataObject.name}: error checking remote file`, medDataObject)
          } 
        } else {
          // Check if local objects still exist
          try {
            fs.accessSync(medDataObject.path)
            medDataObjectsDict[medDataObject.id] = medDataObject
          } catch (error) {
            console.error(`${medDataObject.name}: not found locally`, medDataObject)
          }
        }
      } else {
        medDataObjectsDict[medDataObject.id] = medDataObject
      }
    })
  } catch (error) {
    console.error("Failed to load MEDDataObjects: ", error)
  }
  return medDataObjectsDict
}
