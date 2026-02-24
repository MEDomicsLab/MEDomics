import { MEDDataObject } from "../../components/workspace/NewMedDataObject"
import { randomUUID } from "crypto"
import { insertMEDDataObjectIfNotExists } from "../../components/mongoDB/mongoDBUtils"
import { lstat } from "../fileManagement/fileOps"
const path = require("path")

/**
 * @param {Object} children - The children of the current directory
 * @param {String} parentID - The UUID of the parent directory
 * @param {Object} newGlobalData - The global data object
 * @param {Array} acceptedFileTypes - The accepted file types for the current directory
 * @returns {Object} - The children IDs of the current directory
 * @description This function is used to recursively recense the directory tree and add the files and folders to the global data object
 * It is called when the working directory is set
 */
export async function recursivelyRecenseWorkspaceTree(children, parentID, isRemote = false) {
  let childType
  for (const child of children) {
    let fileInfo
    try {
      fileInfo = await lstat(child.path, { isRemote })
    } catch (error) {
      console.error(`Error getting file info for ${child.path}:`, error)
      continue
    }
    if (!fileInfo) return
    const fileExt = isRemote ? (child.name.includes(".") ? "." + child.name.split(".")[1] : child.name) : path.extname(child.path)
    childType = fileInfo.isDir &&
      fileExt.slice(1) != "medml" &&
      fileExt.slice(1) != "medmlres" &&
      fileExt.slice(1) != "medeval" &&
      fileExt.slice(1) != "medmodel"
        ? "directory"
        : fileExt.slice(1)
    let uuid = child.name == "DATA" || child.name == "EXPERIMENTS" ? child.name : randomUUID()
    
    let childObject = new MEDDataObject({
      id: uuid,
      name: child.name,
      type: childType,
      parentID: parentID,
      childrenIDs: [],
      inWorkspace: true,
      isLocked: false,
      usedIn: null
    })
    // Real ID in DataBase if object already exists
    const IDinDB = await insertMEDDataObjectIfNotExists(childObject, child.path)
    if (childType == "directory" && child.name != ".medomics") {
      await recursivelyRecenseWorkspaceTree(child.children, IDinDB, isRemote)
    }
  }
}
