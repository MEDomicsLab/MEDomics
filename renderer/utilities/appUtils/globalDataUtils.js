import { MEDDataObject } from "../../components/workspace/NewMedDataObject"
import { recursivelyRecenseWorkspaceTree } from "./workspaceUtils"
import { connectToMongoDB, insertMEDDataObjectIfNotExists } from "../../components/mongoDB/mongoDBUtils"
import { pathExists } from "../fileManagement/fileOps"

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
  let medDataObjectsDict = {}
  try {
    // Get global data
    const db = await connectToMongoDB()
    const collection = db.collection("medDataObjects")
    const medDataObjectsArray = await collection.find().toArray()
    // Format data
    for (const data of medDataObjectsArray) {
      const medDataObject = new MEDDataObject(data)
      // Check if local objects still exist
      if (medDataObject.inWorkspace && medDataObject.path) {
        const exists = await pathExists(medDataObject.path, { isRemote })
        if (exists) {
          medDataObjectsDict[medDataObject.id] = medDataObject
        } else {
          console.error(`${medDataObject.name}: not found ${isRemote ? "remotely" : "locally"}, path will be set to null`, medDataObject)
          medDataObject.path = null
          medDataObject.inWorkspace = false
          medDataObjectsDict[medDataObject.id] = medDataObject

          collection.updateOne(
            { id: medDataObject.id },
            { $set: { path: null, inWorkspace: false } }
          ).then(() => {
            console.log(`Database updated for MEDDataObject with id ${medDataObject.id}: path set to null and inWorkspace set to false`)
          }).catch((updateError) => {
            console.error(`Failed to update MEDDataObject with id ${medDataObject.id} in database: `, updateError)
          })
        }
      } else {
        medDataObjectsDict[medDataObject.id] = medDataObject
      }
    }
  } catch (error) {
    console.error("Failed to load MEDDataObjects: ", error)
  }
  return medDataObjectsDict
}
