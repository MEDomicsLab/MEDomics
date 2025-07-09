import { MEDDataObject } from "../../components/workspace/NewMedDataObject"
import { recursivelyRecenseWorkspaceTree } from "./workspaceUtils"
import { connectToMongoDB, insertMEDDataObjectIfNotExists } from "../../components/mongoDB/mongoDBUtils"

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
  await recursivelyRecenseWorkspaceTree(rootChildren, rootParentID)
}

/**
 * @descritption load the MEDDataObjects from the MongoDB database
 * @returns medDataObjectsDict dict containing the MEDDataObjects in the Database
 */
export async function loadMEDDataObjects() {
  let medDataObjectsDict = {}
  try {
    // Get global data
    const fs = require("fs")

    // Import GridFS if needed
    const { GridFSBucket } = require("mongodb")
    const db = await connectToMongoDB()
    const collection = db.collection("medDataObjects")
    const medDataObjectsArray = await collection.find().toArray()

    // Format data
    medDataObjectsArray.forEach(async (data) => {
      const medDataObject = new MEDDataObject(data)

      // Check if local objects still exist
      if (medDataObject.inWorkspace && medDataObject.path) {
        try {
          fs.accessSync(medDataObject.path)
          medDataObjectsDict[medDataObject.id] = medDataObject
        } catch (error) {
          console.error(`${medDataObject.name}: not found locally`, medDataObject)
          // Check if the object is in the database but not in the local workspace, if so, we just set the inWorkspace to false
          if (medDataObject.inWorkspace && !fs.existsSync(medDataObject.path)) {
            // Check the size of the file in MongoDB
            let mongodbObject = await collection.findOne({ id: medDataObject.id })
            if (!mongodbObject) {
              console.warn(`${medDataObject.name}: not found in the database`, medDataObject)
              return
            } else {
              console.warn(`${medDataObject.name}: file not found locally, but exists in the database`, medDataObject)
              // Check if the object is present in GridFS
              const bucket = new GridFSBucket(db, { bucketName: "medDataObjects" })
              const file = await bucket.find({ _id: medDataObject.id }).toArray()
              if (!file || file.length === 0) {
                console.warn(`${medDataObject.name}: not found in GridFS`, medDataObject)
              }
              medDataObject.inWorkspace = false
              medDataObjectsDict[medDataObject.id] = medDataObject
              // Optionally, you could also update the database to reflect this change
              await collection.updateOne({ id: medDataObject.id }, { $set: { inWorkspace: false } })
            }
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
