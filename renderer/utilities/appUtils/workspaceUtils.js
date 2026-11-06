import { MEDDataObject } from "../../components/workspace/NewMedDataObject"
import { randomUUID } from "crypto"
import { insertMEDDataObjectIfNotExists } from "../../components/mongoDB/mongoDBUtils"

// Import fs and path
const fs = require("fs")
const path = require("path")

/**
 * Per-workspace directories holding an app's own MongoDB config and data.
 *
 * These are plumbing, not the user's data, and each contains a *live* mongod
 * data directory: recensing one means walking and inserting every WiredTiger
 * file on every refresh. `.medomics` is this app's own; `.med3pa` belongs to the
 * standalone MED3pa app, which deliberately uses a separate directory so the
 * same folder can be opened in either app -- so a shared workspace must skip it
 * here too.
 */
const APP_WORKSPACE_DIRS = [".medomics", ".med3pa"]

/**
 * @param {Object} children - The children of the current directory
 * @param {String} parentID - The UUID of the parent directory
 * @param {Object} newGlobalData - The global data object
 * @param {Array} acceptedFileTypes - The accepted file types for the current directory
 * @returns {Object} - The children IDs of the current directory
 * @description This function is used to recursively recense the directory tree and add the files and folders to the global data object
 * It is called when the working directory is set
 */
export async function recursivelyRecenseWorkspaceTree(children, parentID) {
  for (const child of children) {
    // Skip the apps' own plumbing entirely rather than only declining to
    // recurse into it, so the directory itself is not recensed either.
    if (APP_WORKSPACE_DIRS.includes(child.name)) {
      continue
    }
    let isDirect = false
    // Check if the path exists
    if (fs.existsSync(child.path)) {
      const stats = fs.lstatSync(child.path)
      isDirect = stats.isDirectory()
    }
    let uuid = child.name == "DATA" || child.name == "EXPERIMENTS" ? child.name : randomUUID()
    let childType =
      isDirect &&
      path.extname(child.path).slice(1) != "medml" &&
      path.extname(child.path).slice(1) != "medmlres" &&
      path.extname(child.path).slice(1) != "medeval" &&
      path.extname(child.path).slice(1) != "medmodel"
        ? "directory"
        : path.extname(child.path).slice(1)
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
    // One unreadable or malformed file must not abandon the rest of the scan:
    // the caller uses the result to refresh globalData, so a throw here used to
    // mean a freshly written object never showed up at all.
    let IDinDB
    try {
      IDinDB = await insertMEDDataObjectIfNotExists(childObject, child.path)
    } catch (error) {
      console.error(`Could not recense ${child.path}: `, error)
      continue
    }
    // directory-tree only sets `children` on actual directories, so a plain file
    // named `<something>.medmodel` is typed "medmodel" but has none -- recursing
    // on it threw "children is not iterable" and took the whole refresh with it.
    if ((childType == "directory" || childType == "medmodel") && Array.isArray(child.children)) {
      await recursivelyRecenseWorkspaceTree(child.children, IDinDB)
    }
  }
}
