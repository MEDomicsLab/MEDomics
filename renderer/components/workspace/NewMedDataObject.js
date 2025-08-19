import { randomUUID } from "crypto"
import { ipcRenderer } from "electron"
import fs from "fs-extra"
import path from "path"
import { toast } from "react-toastify"
import { getPathSeparator } from "../../utilities/fileManagementUtils"
import {
  deleteMEDDataObject,
  downloadCollectionToFile,
  insertMEDDataObjectIfNotExists,
  overwriteMEDDataObjectProperties,
  updateMEDDataObjectName,
  updateMEDDataObjectPath
} from "../mongoDB/mongoDBUtils"

/**
 * @description class definition of a MEDDataObject
 */
export class MEDDataObject {
  constructor({ id, name, type, parentID, childrenIDs, inWorkspace, path, isLocked, usedIn }) {
    this.id = id
    this.name = name
    this.type = type
    this.parentID = parentID
    this.childrenIDs = childrenIDs
    this.inWorkspace = inWorkspace
    this.path = path
    this.isLocked = isLocked
    this.usedIn = usedIn
  }

  /**
   * @description Get the MEDDataObjects matching specified types in dict of MEDDataObjects
   * @param {Dictionary} dict of MEDDataObjects (such as globalData)
   * @param {[String]} types property of MEDDataObjects
   * @returns matchingElement list of MEDDataObjects with type in types
   */
  static getMatchingTypesInDict(dict, types) {
    let matchingElements = []
    for (const [, value] of Object.entries(dict)) {
      if (types.includes(value.type)) {
        matchingElements.push(value)
      }
    }
    return matchingElements
  }

  /**
   * Get the child ID with matching name
   * @param {Dictionary} dict of MEDDataObjects (such as globalData)
   * @param {String} parentID The ID of the parent directory
   * @param {String} name The name of the child to find
   */
  static getChildIDWithName(dict, parentID, name) {
    for (const childID of dict[parentID].childrenIDs) {
      if (dict[childID].name == name) {
        return childID
      }
    }
    return null
  }

  /**
   * @description Get the default name for a new object in a dict of MEDDataObjects depending on its type
   * @param {Dictionary} dict of MEDDataObjects (such as globalData)
   * @param {String} type property of MEDDataObject
   * @param {String} parentID identifier of the parent MEDDataObject
   * @returns {String} newName the default name for the new MEDDataObject
   */
  static getNewNameForType(dict, type, parentID) {
    let baseName = type === "directory" ? `new_${type}` : `new_${type}.${type}`
    let newName = baseName
    let counter = 1

    // Get the names of children of the specified parent
    let parentObject = Object.values(dict).find((obj) => obj.id === parentID)
    let childrenNames = new Set()

    if (parentObject && parentObject.childrenIDs) {
      parentObject.childrenIDs.forEach((childID) => {
        let child = dict[childID]
        if (child && child.type === type) {
          childrenNames.add(child.name)
        }
      })
    }

    // Check for name uniqueness within the children of the specified parent
    while (childrenNames.has(newName)) {
      if (type === "directory") {
        newName = `${baseName}_${counter}`
      } else {
        newName = `new_${type}_${counter}.${type}`
      }
      counter++
    }

    return newName
  }

  /**
   * @description Get a unique name for a copied MEDDataObject in a target directory
   * @param {Dictionary} dict - dictionary of all MEDDataObjects
   * @param {String} baseName - the base name of the object to copy
   * @param {String} parentID - the ID of the target directory
   * @returns {String} uniqueName - the unique name for the copied MEDDataObject
   */
  static getUniqueNameForCopy(dict, baseName, parentID) {
    let newName = baseName
    let counter = 1

    const parentObject = dict[parentID]
    const existingNames = new Set()

    if (parentObject && parentObject.childrenIDs) {
      parentObject.childrenIDs.forEach((childID) => {
        const child = dict[childID]
        if (child) {
          existingNames.add(child.name)
        }
      })
    }

    const baseNameParts = baseName.split(".")
    const isDirectory = baseNameParts.length === 1
    const nameWithoutExtension = isDirectory ? baseName : baseNameParts.slice(0, -1).join(".")
    const extension = isDirectory ? "" : `.${baseNameParts[baseNameParts.length - 1]}`

    while (existingNames.has(newName)) {
      if (isDirectory) {
        newName = `${baseName}_${counter}`
      } else {
        newName = `${nameWithoutExtension}_${counter}${extension}`
      }
      counter++
    }
    return newName
  }

  /**
   * @description Recursively get the full path of the object in the workspace
   * @param {Dictionary} dict - dictionary of all MEDDataObjects
   * @param {String} id - the id of the object to find the path for
   * @param {String} workspacePath - the root path of the workspace
   * @returns {String} fullPath - the full path of the object
   */
  static getFullPath(dict, id, workspacePath) {
    let object = dict[id]
    let pathParts = [object.name]
    while (object.parentID) {
      object = dict[object.parentID]
      // Avoid to have 2 times the workspace name in the returned path
      if (object.id != "ROOT") {
        pathParts.unshift(object.name)
      }
    }
    return path.join(workspacePath, ...pathParts)
  }

  /**
   * @description Creates an empty folder in the file system.
   * @param {string} name
   * @param {string} path
   */
  static createFolderFSsync(path) {
    // eslint-disable-next-line no-undef
    let fs = require("fs")
    const fsPromises = fs.promises
    this.updateWorkspaceDataObject(1000)
    return new Promise((resolve) => {
      fsPromises
        .mkdir(path, { recursive: true })
        .then(function () {
          resolve(path)
        })
        .catch(function () {
          console.error("failed to create directory")
        })
    })
  }

  /**
   *
   * @param {Object} exportObj object to be exported
   * @param {String} path path to the folder where the file will be saved
   * @param {String} name name of the exported file
   * @param {String} extension extension of the exported file (json or even custom (e.g. abc)))
   *
   * @description
   * This function takes an object, a path and a name and saves the object as a json file with a custom extension
   * @returns {String} pathToCreate the path where the file was saved
   */
  static writeFileSync(exportObj, path, name, extension) {
    let newPath = typeof path === "string" ? path : path.join(getPathSeparator())
    const pathToCreate = `${newPath}${getPathSeparator()}${name}.${extension}`
    if (!fs.existsSync(newPath)) {
      this.createFolderFSsync(newPath).then(() => {
        let convertedExportObj = typeof exportObj === "string" ? exportObj : JSON.stringify(exportObj, null, 2)
        const fsPromises = fs.promises
        // this.updateWorkspaceDataObject(1000)
        new Promise((resolve) => {
          fsPromises
            .writeFile(pathToCreate, convertedExportObj)
            .then(function () {
              console.log("file created at " + pathToCreate)
              resolve(pathToCreate)
            })
            .catch(function (e) {
              console.error("failed to create directory", e)
            })
        })
      })
    } else {
      let convertedExportObj = typeof exportObj === "string" ? exportObj : JSON.stringify(exportObj, null, 2)
      const fsPromises = fs.promises
      this.updateWorkspaceDataObject(1000)
      new Promise((resolve) => {
        fsPromises
          .writeFile(pathToCreate, convertedExportObj)
          .then(function () {
            console.log("file created at " + pathToCreate)
            resolve(pathToCreate)
          })
          .catch(function (e) {
            console.error("failed to create directory", e)
          })
      })
    }
    return pathToCreate
  }

  /**
   * @description Delete a MEDDataObject and its children from the dictionary and the local workspace
   * @param {Dictionary} dict - dictionary of all MEDDataObjects
   * @param {String} id - the id of the object to delete
   * @param {String} workspacePath - the root path of the workspace
   * @returns {Promise<void>}
   */
  static async deleteObjectAndChildren(dict, id, workspacePath) {
    // Get the object to delete
    const objectToDelete = dict[id]

    if (!objectToDelete) {
      console.log(`Object with id ${id} not found`)
      return
    }

    // Delete the file/directory from the local filesystem if it exists and is in workspace
    if (objectToDelete.inWorkspace) {
      // Get the full path of the object in the workspace
      const fullPath = this.getFullPath(dict, id, workspacePath)
      fs.rmSync(fullPath, { recursive: true, force: true })
      console.log(`Deleted ${fullPath} from workspace`)
    }

    // Delete the object and its children recursively
    await deleteMEDDataObject(id)
    this.updateWorkspaceDataObject()
  }

  /**
   * @description Delete a MEDDataObject and its children from the local workspace
   * @param {Dictionary} dict - dictionary of all MEDDataObjects
   * @param {String} id - the id of the object to delete
   * @param {String} workspacePath - the root path of the workspace
   * @param {Boolean} notify - Wether to display a toast message while success
   * @returns {Promise<void>}
   */
  static async deleteObjectAndChildrenFromWorkspace(dict, id, workspacePath, notify = true) {
    // Get the object to delete
    const objectToDelete = dict[id]

    if (!objectToDelete) {
      console.log(`Object with id ${id} not found`)
      return
    }

    // Delete the file/directory from the local filesystem if it exists and is in workspace
    if (objectToDelete.inWorkspace) {
      // Get the full path of the object in the workspace
      const fullPath = this.getFullPath(dict, id, workspacePath)
      fs.rmSync(fullPath, { recursive: true, force: true })
      console.log(`Deleted ${fullPath} from workspace`)
      const success = await overwriteMEDDataObjectProperties(id, { inWorkspace: false })
      if (success) {
        this.updateWorkspaceDataObject()
        if (notify) {
          toast.success(`Removed ${dict[id].name} from workspace`)
        }
      }
    }
  }

  /**
   * @description Recursively copies a MEDDataObject and its children to a new parent directory
   * @param {Object} dict - dictionary of all MEDDataObjects
   * @param {Object} copiedObject - the MEDDataObject to copy
   * @param {Object} placeToCopy - the target MEDDataObject where the copied object will be placed
   * @returns {Promise<void>}
   */
  static async copyMedDataObject(dict, copiedObject, placeToCopy) {
    if (placeToCopy.type !== "directory") {
      throw new Error("Target object must be a directory")
    }

    const newId = randomUUID()
    const uniqueName = this.getUniqueNameForCopy(dict, copiedObject.name, placeToCopy.id)
    const newPath = path.join(placeToCopy.path, uniqueName)
    const newObject = new MEDDataObject({
      id: newId,
      name: uniqueName,
      type: copiedObject.type,
      parentID: placeToCopy.id,
      path: newPath,
      childrenIDs: [],
      inWorkspace: false
    })

    await insertMEDDataObjectIfNotExists(newObject, null, null, copiedObject.id)

    // Update the dictionary
    dict[newId] = newObject
    placeToCopy.childrenIDs.push(newId)

    // Recursively copy children
    for (const childId of copiedObject.childrenIDs) {
      const childObject = dict[childId]
      if (childObject) {
        await this.copyMedDataObject(dict, childObject, newObject)
      }
    }

    // Save the updated dictionary
    this.updateWorkspaceDataObject()
  }

  /**
   * @description Lock a MEDDataObject to prevent it from being deleted
   * @param {String} id - the id of the MEDDataObject to lock
   *
   * @returns {void}
   */
  static async lockMedDataObject(id) {
    const success = await overwriteMEDDataObjectProperties(id, { isLocked: true })
    if (success) {
      console.log(`Locked MEDDataObject with id ${id}`)
    } else {
      console.error(`Failed to lock MEDDataObject with id ${id}`)
    }
    this.updateWorkspaceDataObject()
  }

  /**
   * @description Unlock a MEDDataObject to allow it to be deleted
   * @param {String} id - the id of the MEDDataObject to unlock
   *
   * @returns {void}
   */
  static async unlockMedDataObject(id) {
    const success = await overwriteMEDDataObjectProperties(id, { isLocked: false })
    if (success) {
      console.log(`Unlocked MEDDataObject with id ${id}`)
    } else {
      console.error(`Failed to unlock MEDDataObject with id ${id}`)
    }
    this.updateWorkspaceDataObject()
  }

  /**
   * @description Verify locked objects in the workspace and unlock them if not linked to any other object
   * @param {Dictionary} dict - dictionary of all MEDDataObjects
   *
   * @returns {void}
   */
  static verifyLockedObjects(dict) {
    for (const [, object] of Object.entries(dict)) {
      if (object.isLocked) {
        let isUsed = false
        for (const [, obj] of Object.entries(dict)) {
          if (object.usedIn === obj.id) {
            isUsed = true
            break
          }
        }
        if (!isUsed) {
          this.unlockMedDataObject(object.id)
        }
      }
    }
  }

  /**
   * @description Rename a MEDDataObject ensuring the new name is unique in the parent directory
   * @param {Dictionary} dict - dictionary of all MEDDataObjects
   * @param {String} id - the id of the MEDDataObject to rename
   * @param {String} newName - the new name for the MEDDataObject
   * @param {String} workspacePath - the root path of the workspace
   * @returns {void}
   */
  static async rename(dict, id, newName, workspacePath) {
    const object = dict[id]

    if (!object) {
      throw new Error(`Object with id ${id} not found`)
    }

    const uniqueName = this.getUniqueNameForCopy(dict, newName, object.parentID)

    // Update the dictionary with the new name
    const succeed = await updateMEDDataObjectName(id, newName)

    if (!succeed) {
      console.log("Failed to rename MEDDataObject")
      return
    }

    // Update the local filesystem if the object is in workspace
    if (object.inWorkspace) {
      const oldPath = this.getFullPath(dict, id, workspacePath)
      object.name = uniqueName
      const newPath = this.getFullPath(dict, id, workspacePath)
      object.path = newPath
      const success = await updateMEDDataObjectPath(id, newPath)
      if (!success) {
        console.error(`Failed to update path for MEDDataObject with id ${id}`)
        toast.error(`Failed to rename ${object.name}`)
        return
      }
      fs.renameSync(oldPath, newPath)
      console.log(`Renamed ${oldPath} to ${newPath}`)
    }

    // Notify the system to update the workspace
    this.updateWorkspaceDataObject()
  }

  /**
   * @description Load the MEDdataObject (and its parents) content from the DB into the Workspace
   * @param {Dictionary} dict - dictionary of all MEDDataObjects
   * @param {String} id - the id of the MEDDataObject to sync
   * @param {String} workspacePath - the root path of the workspace
   * @param {Boolean} notify - Wether to display a toast message while success
   * @param {Set} syncedObjects - A set to track already synced objects to avoid infinite loops
   */
  static async sync(dict, id, workspacePath, notify = true, syncedObjects = new Set()) {
    const medDataObject = dict[id]

    if (!medDataObject) {
      console.log(`MEDDataObject with id ${id} not found`)
      return
    }

    // Check if this object has already been synced to avoid infinite loops
    if (syncedObjects.has(id)) {
      return
    }
    syncedObjects.add(id)

    // Recursively sync parent objects
    if (medDataObject.parentID && medDataObject.parentID !== "ROOT") {
      await this.sync(dict, medDataObject.parentID, workspacePath, notify, syncedObjects)
    }

    // Define the file path where the content will be downloaded
    const filePath = this.getFullPath(dict, id, workspacePath)

    // Ensure the directory exists
    const directoryPath = path.dirname(filePath)
    if (!fs.existsSync(directoryPath)) {
      fs.mkdirSync(directoryPath, { recursive: true })
    }

    // Download the content based on the type
    try {
      if (medDataObject.type != "directory" && medDataObject.type != "medml" && medDataObject.type != "medeval" && medDataObject.type != "medmlres" && medDataObject.type != "medmodel") {
        await downloadCollectionToFile(id, filePath, medDataObject.type)
      }

      // Sync child objects for specific types
      if (medDataObject.type === "medml" || medDataObject.type === "medeval" || medDataObject.type === "medmlres" || medDataObject.type === "medmodel") {
        await this.syncChildren(dict, medDataObject.childrenIDs, workspacePath, notify, syncedObjects)
      }

      // If the object is a directory, create it in the workspace and sync its children
      if (medDataObject.type === "directory") {
        await this.syncChildren(dict, medDataObject.childrenIDs, workspacePath, notify, syncedObjects)
      }

      // Update inWorkspace property to true after successful download
      if (!medDataObject.inWorkspace) {
        const updateData = { inWorkspace: true }
        const updateSuccess = await overwriteMEDDataObjectProperties(id, updateData)

        if (updateSuccess) {
          medDataObject.inWorkspace = true // Update local dictionary as well
          if (notify) {
            toast.success(`Sync ${medDataObject.name} successfully`)
          }
        } else {
          console.error(`Failed to update inWorkspace property for MEDDataObject with id ${id}`)
        }
      }
    } catch (error) {
      console.error(`Failed to download collection ${id}: ${error.message}`)
    }
  }

  /**
   * @description Recursively sync child objects
   * @param {Dictionary} dict - dictionary of all MEDDataObjects
   * @param {Array} childrenIDs - array of child IDs to sync
   * @param {String} workspacePath - the root path of the workspace
   * @param {Boolean} notify - Whether to display a toast message while success
   * @param {Set} syncedObjects - A set to track already synced objects to avoid infinite loops
   */
  static async syncChildren(dict, childrenIDs, workspacePath, notify, syncedObjects) {
    for (const childID of childrenIDs) {
      const child = dict[childID]
      if (!child) {
        console.log(`Child MEDDataObject with id ${childID} not found`)
        continue
      }
      await this.sync(dict, childID, workspacePath, notify, syncedObjects)
      await this.syncChildren(dict, child.childrenIDs, workspacePath, notify, syncedObjects)
    }
  }

  /**
   * @description Recursive function to update the children IDs of a MEDDataObject to a new path
   * @param {Dictionary} dict - dictionary of all MEDDataObjects
   * @param {String} id - the id of the MEDDataObject to update
   * @param {String} newPath - the new path for the MEDDataObject
   * @param {String} workspacePath - the root path of the workspace
   * @returns {void}
   */
  static async updatePathRecursively(dict, id, newPath) {
    // Get the object to update
    const object = dict[id]
    if (!object) {
      console.log(`Object with id ${id} not found`)
      return
    }

    // Update the path of the object in the dictionary
    object.path = newPath
    await updateMEDDataObjectPath(id, newPath)
    console.log(`Updated path for MEDDataObject with id ${id} to ${newPath}`)
    if (object.type === "directory") {
      // Recursively update the path of the children
      for (const childID of object.childrenIDs) {
        const child = dict[childID]
        if (child) {
          const childNewPath = path.join(newPath, child.name)
          await this.updatePathRecursively(dict, childID, childNewPath)
        }
      }
    }
  }

  /**
   * @description Move a MEDDataObject to a new parent directory
   * @param {Dictionary} dict - dictionary of all MEDDataObjects
   * @param {String} id - the id of the MEDDataObject to move
   * @param {String} newParentID - the id of the new parent directory
   * @param {String} workspacePath - the root path of the workspace
   * @returns {void}
   */
  static async move(dict, id, newParentID, workspacePath) {
    const dataObject = dict[id]
    const oldParentID = dataObject.parentID

    if (!dataObject) {
      console.log(`MEDDataObject with id ${id} not found`)
      return
    }
    const newParent = dict[newParentID]
    if (!newParent) {
      console.log(`New parent MEDDataObject with id ${newParentID} not found`)
      return
    }
    // Move the data object in the working directory if it is in the workspace
    const oldPath = this.getFullPath(dict, id, workspacePath)
    const newParentPath = this.getFullPath(dict, newParentID, workspacePath)
    let newPath = path.join(newParentPath, dataObject.name)
    if (dataObject.inWorkspace) {
      if (fs.existsSync(newPath)) {
        console.error(`Cannot move ${dataObject.name} to ${newParent.name} because a file with the same name already exists`)
        toast.error(`Cannot move ${dataObject.name} to ${newParent.name} because a file with the same name already exists`)
        return
      } else {
        try {
          await fs.move(oldPath, newPath, { overwrite: false, recursive: true })
        } catch (error) {
          console.error(`Failed to move ${dataObject.name}:`, error)
          toast.error(`Failed to move ${dataObject.name}: ${error.message}`)
          return
        }
      }
    } else {
      console.log(`MEDDataObject with id ${id} is not in the workspace`)
    }

    if (dataObject.type === "directory") {
      newPath = path.join(newParentPath, dataObject.name)
      await this.updatePathRecursively(dict, id, newPath, workspacePath)
    }
    // Update the path of the data object in the dictionary
    dataObject.path = newPath
    dataObject.parentID = newParentID
    // Update the path of the data object in the database
    const success = await updateMEDDataObjectPath(id, newPath)
    // Update the parentID of the data object in the database
    const successParent = await overwriteMEDDataObjectProperties(id, { parentID: newParentID })

    if (success && successParent) {
      console.log(`Moved MEDDataObject with id ${id} to new parent with id ${newParentID}`)
    } else {
      console.error(`Failed to move MEDDataObject with id ${id} to new parent with id ${newParentID}, failed to update path or parentID`)
    }
    // Remove the data object from the old parent's children IDs
    const oldParent = dict[oldParentID]
    if (oldParent) {
      oldParent.childrenIDs = oldParent.childrenIDs.filter((id) => id !== dataObject.id)
    }
    // Update the old parent ID in the DB
    const successOldParent = await overwriteMEDDataObjectProperties(oldParentID, { childrenIDs: oldParent.childrenIDs })
    if (!successOldParent) {
      console.error(`Failed to update old parent with id ${oldParentID}`)
    }

    // Add the data object to the new parent's children IDs
    newParent.childrenIDs.push(dataObject.id)
    // Update the new parent ID in the DB
    const successNewParent = await overwriteMEDDataObjectProperties(newParentID, { childrenIDs: newParent.childrenIDs })
    if (!successNewParent) {
      console.error(`Failed to update the children of new parent with id ${newParentID}`)
    }
    // Notify the system to update the workspace
    this.updateWorkspaceDataObject()
  }

  /**
   * @description Updates the workspace data object.
   */
  static updateWorkspaceDataObject() {
    ipcRenderer.send("messageFromNext", "updateWorkingDirectory")
  }
}
