import { randomUUID } from "crypto"
import fs from "fs"
import path from "path"
import { confirmDialog } from "primereact/confirmdialog"
import { toast } from "react-toastify"
import { insertMEDDataObjectIfNotExists } from "../../../mongoDB/mongoDBUtils"
import { MEDDataObject } from "../../../workspace/NewMedDataObject"

const untouchableIDs = ["ROOT", "DATA", "EXPERIMENTS"]

/**
 * This function reorders the array of folders and files so that the folders are first and the files are last.
 * @param {Array} array - The array of folders and files
 * @param {Object} dataContextObject - The data context object
 * @returns {Array} - The reordered array of folders and files
 */
function reorderArrayOfFoldersAndFiles(array, dataContextObject) {
  let folders = []
  let files = []
  array.forEach((item) => {
    if (dataContextObject[item] !== undefined) {
      if (dataContextObject[item].type == "directory") {
        folders.push(item)
      } else {
        files.push(item)
      }
    }
  })
  return folders.concat(files)
}

/**
 * This function converts the data context object to a tree object that can be used by the directory tree component.
 * @param {Object} medDataContext - The data context object
 * @returns {Object} - The tree object
 */
export function fromJSONtoTree(data) {
  let tree = {}
  const namesYouCantRename = ["DATA", "EXPERIMENTS"] // These names cannot be renamed
  Object.keys(data).forEach((key) => {
    let element = data[key]
    if (element.name != ".medomics" && element.name != ".ipynb_checkpoints" && element.name != ".DS_Store") {
      let ableToRename = !namesYouCantRename.includes(element.name)
      tree[element.id] = {
        index: element.id,
        canMove: ableToRename,
        isFolder: element.type == "directory",
        children: element.childrenIDs ? reorderArrayOfFoldersAndFiles(element.childrenIDs, data) : [],
        data: element.name,
        canRename: ableToRename,
        type: element.type,
        inWorkspace: element.inWorkspace,
        path: element.path ? element.path : null,
        isLocked: element.isLocked,
        usedIn: element.usedIn
      }
    }
  })
  return tree
}

/**
 * @description This function renames a `MedDataObject` in the workspace.
 * @param {Dict} globalData - The global data
 * @param {String} workspacePath - The workspace path
 * @param {Object} item - The item linked to a `MedDataObject` to rename
 * @param {string} newName - The new name of the `MedDataObject`
 * @returns {void}
 * @note - This function is called when the user renames a file or folder in the directory tree, either by F2 or by right-clicking and selecting "Rename".
 */
export function rename(globalData, workspacePath, item, newName) {
  if (newName == "") {
    toast.error("Error: Name cannot be empty")
    return
  }
  // Check if the name keeps the original extension
  if (globalData[item.index].type != "directory") {
    const newNameParts = newName.split(".")
    if (globalData[item.index].type != newNameParts[newNameParts.length - 1]) {
      toast.error("Invalid Name")
      return
    }
  }
  // Check if the new name is different from the original
  if (item.data == newName) {
    toast.warning("Warning: Name is the same as before")
    return
  }
  // Check if the name is not DATA or EXPERIMENTS
  if (untouchableIDs.includes(newName)) {
    toast.error("Error: This name is reserved and cannot be used")
    return
  }
  // Check if we are not trying to change DATA or EXPERIMENTS
  if (untouchableIDs.includes(item.data)) {
    toast.error("Error: This name cannot be changed")
    return
  }
  MEDDataObject.rename(globalData, item.index, newName, workspacePath)
}

/**
 * @description This function pastes a `MedDataObject` in the workspace.
 * @param {Dict} globalData - The global data
 * @param {string} copiedObjectId - The ID of the `MedDataObject` to paste
 * @param {string} placeToCopyId - The ID of the place to copy `MedDataObject`
 * @returns {void}
 * @note - This function is called when the user pastes a file or folder in the directory tree, either by pressing Ctrl+V or by right-clicking and selecting "Paste".
 */
export function onPaste(globalData, copiedObjectId, placeToCopyId) {
  let copiedObject = globalData[copiedObjectId]
  let placeToCopy = globalData[placeToCopyId]
  // We can't copy an object into a file
  if (placeToCopy.type != "directory") {
    let parentID = placeToCopy.parentID
    placeToCopy = globalData[parentID]
  }
  MEDDataObject.copyMedDataObject(globalData, copiedObject, placeToCopy)
}

/**
 * This function deletes a list of `MEDDataObject` in the workspace.
 * @param {[string]} items - The list `MEDDataObject` to delete
 * @param {Int} index The index of the item to delete
 * @returns {void}
 * @note - This function is called when the user deletes files or folders in the directory tree, either by pressing the delete key or by right-clicking and selecting "Delete".
 */
export async function onDeleteSequentially(globalData, workspacePath, setIsDialogShowing, items, index = 0) {
  MEDDataObject.updateWorkspaceDataObject()  // Update the workspace data object before deleting
  MEDDataObject.verifyLockedObjects(globalData)  // Verify if the locked objects and unlock them if they are not linked to any other object
  const id = items[index]
  // check if the item is locked
  if (globalData[id] && globalData[id].isLocked) {
    let notebookName = globalData[id].usedIn ? globalData[globalData[id].usedIn].name : "a generated notebook"
    confirmDialog({
      message: `${globalData[id].name} is linked to ${notebookName}, deleting it will break the notebook. Are you sure you want to delete it?`,
      header: "Delete Confirmation",
      icon: "pi pi-info-circle",
      closable: false,
      accept: async () => {
        await MEDDataObject.deleteObjectAndChildren(globalData, id, workspacePath)
        toast.success(`Deleted ${globalData[id].name}`)
        setIsDialogShowing(false)
      },
      reject: () => {
        setIsDialogShowing(false)
      }
    })
    MEDDataObject.updateWorkspaceDataObject()  // Update the workspace data object
    return
  }
  if (index >= items.length || !globalData[id]) {
    return // All items have been processed
  }
  if (untouchableIDs.includes(id)) {
    toast.warning(`Cannot delete this element ${globalData[id].name}`)
    onDeleteSequentially(globalData, workspacePath, setIsDialogShowing, items, index + 1) // Move to the next item
  } else {
    setIsDialogShowing(true)
    confirmDialog({
      message: `Are you sure you want to delete ${globalData[id].name}?`,
      header: "Delete Confirmation",
      icon: "pi pi-info-circle",
      closable: false,
      accept: async () => {
        const name = globalData[id].name
        await MEDDataObject.deleteObjectAndChildren(globalData, id, workspacePath)
        toast.success(`Deleted ${name}`)
        setIsDialogShowing(false)
        setTimeout(() => {
          onDeleteSequentially(globalData, workspacePath, setIsDialogShowing, items, index + 1) // Move to the next item
        }, 1000)
      },
      reject: () => {
        setIsDialogShowing(false)
        setTimeout(() => {
          onDeleteSequentially(globalData, workspacePath, setIsDialogShowing, items, index + 1) // Move to the next item
        }, 1000)
      }
    })
  }
}

/**
 * @description This function creates a new folder in the workspace with the name "New Folder" and the parent folder being the selected folder.
 * The button that triggers this function is only visible if the accordion is not collapsed.
 * @param {Dict} globalData - The global data
 * @param {Array} selectedItems - The array of selected items in the directory tree
 * @returns {void}
 */
export async function createFolder(globalData, selectedItems, workspacePath) {
  if (selectedItems && selectedItems.length > 0) {
    const item = globalData[selectedItems[0]]
    let parentID = null
    // Check if the selected item is a directory or a file
    if (item.type == "directory") {
      parentID = item.id
    } else if (item.parentID) {
      parentID = item.parentID
    } else {
      toast.warning("Selected item is not a directory and has no parent. Setting parent to ROOT.") 
      parentID = "ROOT"
    }
    // Check if the selected item is in the workspace and has a valid path
    let currentPath = null
    if (!item.inWorkspace || !item.path) {
      toast.warning("Selected item is not in the workspace or has no path. Setting parent to ROOT.")
      parentID = "ROOT"
      currentPath = workspacePath
    } else {
      currentPath = item.path
    }
    const medObject = new MEDDataObject({
      id: randomUUID(),
      name: MEDDataObject.getNewNameForType(globalData, "directory", parentID),
      type: "directory",
      parentID: parentID,
      childrenIDs: [],
      inWorkspace: true
    })
    medObject.path = path.join(currentPath, medObject.name)
    await insertMEDDataObjectIfNotExists(medObject)
    MEDDataObject.updateWorkspaceDataObject()
    
    // Check if the folder already exists
    if (!fs.existsSync(medObject.path)) {
      fs.mkdir(medObject.path, { recursive: true }, (err) => {
        if (err) {
          console.error(err)
          return
        }
        console.log("Folder created successfully!")
      })
    }
  } else {
    toast.warning("Please select a directory")
  }
}

/**
 * This function handles the drop of an item in the directory tree.
 * @param {Array} items - The array of items to drop
 * @param {Object} target - The target object
 * @returns {void}
 * @note - This function is called when the user drops an item in the directory tree.
 */
export const onDrop = async (items, target) => {
  console.log("HERE", items, target)
  /* const currentItems = tree.current.treeEnvironmentContext.items
    for (const item of items) {
      const parent = Object.values(currentItems).find((potentialParent) => potentialParent.children?.includes(item.index))

      if (!parent) {
        throw Error(`Could not find parent of item "${item.index}"`)
      }

      if (!parent.children) {
        throw Error(`Parent "${parent.index}" of item "${item.index}" did not have any children`)
      }

      if (target.targetType === "item" || target.targetType === "root") {
        if (target.targetItem === parent.index) {
          // NO Operation
        } else {
          let dataObject = globalData[item.index]
          if (dataObject.type == "directory") {
            MedDataObject.move(dataObject, globalData[target.targetItem], globalData, setGlobalData)
            //MedDataObject.updateWorkspaceDataObject()
          } else {
            MedDataObject.move(dataObject, globalData[target.targetItem], globalData, setGlobalData)
            //MedDataObject.updateWorkspaceDataObject()
          }
        }
      } else {
        if (target.parentItem === item.index) {
          // Trying to drop inside itself
          return
        }
        let dataObject = globalData[item.UUID]
        if (target.parentItem === dataObject.parentID) {
          // NO Operation
        } else {
          MedDataObject.move(dataObject, globalData[target.parentItem], globalData, setGlobalData)
          //MedDataObject.updateWorkspaceDataObject()
        }
      }
    } */
}

/**
 * Function to evaluate if the target of an event is a child of a given id
 * @param {Object} event - The event
 * @param {string} id - The id of the parent
 * @returns {boolean} - True if the target is a child of the given id, false otherwise
 */
export function evaluateIfTargetIsAChild(event, id) {
  let target = event.target
  let parent = target.parentElement
  let isChild = false
  while (parent !== null) {
    if (parent.id === id) {
      isChild = true
      break
    }
    parent = parent.parentElement
  }
  return isChild
}
