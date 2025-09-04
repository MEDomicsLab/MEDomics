import { randomUUID } from "crypto"
import * as fs from "fs-extra"
import { toast } from "react-toastify"
import { ipcRenderer } from "electron"
import process from "process"
// import { generateRandomColor } from "../input/taggingUtils"

/**
 * Represents a data object in the workspace.
 * @class
 * @property {string} originalName - The original name of the data object.
 * @property {string} name - The name of the data object.
 * @property {string} nameWithoutExtension - The name of the data object without the extension.
 * @property {string} extension - The extension of the data object.
 * @property {string} type - The type of the data object.
 * @property {string} path - The path of the data object.
 * @property {Array} virtualPath - The virtual path of the data object.
 * @property {string} _UUID - The UUID of the data object.
 * @property {Array} parentID - The parent IDs of the data object.
 * @property {Array} childrenIDs - The children IDs of the data object.
 * @property {Date} lastModified - The date when the data object was last modified.
 * @property {Date} created - The date when the data object was created.
 * @property {Boolean} dataLoaded - Indicates whether the data object has loaded data.
 * @property {Object} data - The data of the data object.
 * @property {Array} dataModificationQueue - The data modification queue of the data object.
 * @property {Number} size - The size of the data object.
 * @property {Object} metadata - The metadata of the data object.
 * @property {Array} acceptedFileTypes - The accepted file types for the data object.
 * @property {string} objectType - The object type of the data object.
 * @property {Array} virtualTransformations - The virtual transformations of the data object.
 * @property {Array} relatedInformation - The related information of the data object.
 */
export default class MedDataObject {
  /**
   * Constructor of the data object.
   * @constructor
   * @param {Object} [options={}] - The options for the medical data object.
   * @param {string} [options.originalName="Unnamed"] - The original name of the object.
   * @param {string} [options.name=undefined] - The name of the object.
   * @param {string} [options.type=""] - The type of the object.
   * @param {Array<string>} [options.parentID=[]] - The IDs of the parent objects.
   * @param {string} [options.path=""] - The path of the object.
   * @param {Array<string>} [options.childrenIDs=[]] - The IDs of the child objects.
   * @param {Array<string>} [options.acceptedFileTypes] - The accepted file types for the data object.
   */
  constructor({
    originalName = "Unnamed",
    name = undefined,
    type = "",
    parentID = [],
    path = "",
    childrenIDs = [],
    _UUID = undefined,
    virtualPath = [],
    lastModified = Date(Date.now()),
    created = Date(Date.now()),
    metadata = {},
    acceptedFileTypes = [],
    virtualTransformations = {},
    relatedInformation = {},
    steps = []
  } = {}) {
    this.originalName = originalName
    if (name === undefined) {
      this.name = originalName
    } else {
      this.name = name
    }
    this.nameWithoutExtension = splitStringAtTheLastSeparator(this.name, ".")[0].length > 0 ? splitStringAtTheLastSeparator(this.name, ".")[0] : this.name

    this.extension = splitStringAtTheLastSeparator(this.name, ".")[0].length > 0 ? splitStringAtTheLastSeparator(this.name, ".")[1] : ""
    this.type = type
    this.path = path
    this.virtualPath = virtualPath

    if (_UUID === undefined) {
      this._UUID = randomUUID()
    } else {
      this._UUID = _UUID
    }
    this.UUID = this._UUID
    this.parentID = parentID
    this.childrenIDs = childrenIDs

    this.lastModified = lastModified
    this.created = created
    this.dataLoaded = false
    this.data = null
    this.dataModificationQueue = []
    this.size = 0
    this.metadata = metadata
    this.acceptedFileTypes = acceptedFileTypes
    this.objectType = ""
    this.virtualTransformations = virtualTransformations
    this.relatedInformation = relatedInformation
    this.steps = steps
  }

  /**
   * Creates a folder in the file system if it does not exist.
   * @param {string} path - The path of the folder to create.
   */
  static createFolderFromPath(path) {
    if (!fs.existsSync(path)) {
      fs.mkdirSync(path, { recursive: true })
      this.updateWorkspaceDataObject(1000)
    }
  }

  /**
   *
   * @param {string} path The path to check.
   * @returns {boolean} - True if the path exists, otherwise false.
   */
  static isPathExists(path) {
    return fs.existsSync(path)
  }

  /**
   *
   * @param {string} path The path to check.
   * @param {Object} globalData The global data context.
   * @returns
   */
  static getStepsFromPath(path, globalData) {
    try {
      let dataObject = MedDataObject.checkIfMedDataObjectInContextbyPath(path, globalData)
      if (!dataObject) return null
      return dataObject.getSteps()
    } catch (error) {
      console.error(error)
      toast.error("Error getting steps from path")
      return null
    }
  }

  /**
   *
   * @param {Object} exportObj object to be exported
   * @param {string} completePath absolute path to the folder where the file will be saved
   * @returns
   */
  static writeFileSyncPath(exportObj, completePath) {
    let convertedExportObj = typeof exportObj === "string" ? exportObj : JSON.stringify(exportObj, null, 2)
    const fsPromises = fs.promises
    this.updateWorkspaceDataObject(1000)
    return new Promise((resolve) => {
      fsPromises
        .writeFile(completePath, convertedExportObj)
        .then(function () {
          console.log("file created at " + completePath)
          resolve(completePath)
        })
        .catch(function (e) {
          console.error("failed to create directory", e)
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
   * @returns {Promise} Promise that resolves to the selected json file
   */
  static writeFileSync(exportObj, path, name, extension) {
    console.log("typeof path: ", path)
    let newPath = typeof path === "string" ? path : path.join(getPathSeparator())
    const pathToCreate = `${newPath}${getPathSeparator()}${name}.${extension}`
    if (!fs.existsSync(newPath)) {
      this.createFolderFSsync(newPath).then(() => {
        let convertedExportObj = typeof exportObj === "string" ? exportObj : JSON.stringify(exportObj, null, 2)
        const fsPromises = fs.promises
        // this.updateWorkspaceDataObject(1000)
        return new Promise((resolve) => {
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
      return new Promise((resolve) => {
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
   */
  static writeFile(exportObj, path, name, extension) {
    const pathToCreate = `${path}${getPathSeparator()}${name}.${extension}`
    fs.outputFile(pathToCreate, JSON.stringify(exportObj, null, 2), (err) => {
      if (err) {
        console.error(err)
      } else {
        console.log(`File saved at ${pathToCreate}`)
        this.updateWorkspaceDataObject()
      }
    })
  }

  /**
   * Updates the workspace data object after a specified time interval.
   * @param {number} timer - The time interval in milliseconds before the update is triggered. Default is 200ms.
   */
  static updateWorkspaceDataObject(timer = 200) {
    setTimeout(() => {
      ipcRenderer.send("messageFromNext", "updateWorkingDirectory")
    }, timer)
  }

  /**
   *
   * @param {MedDataObject} dataObject - The MED data object to check.
   * @param {Array} acceptedFileTypes - The accepted file types for the MED data object.
   */
  static setAcceptedFileTypes(dataObject, acceptedFileTypes) {
    let acceptedFileTypesToReturn = acceptedFileTypes
    if (dataObject.name === "DATA") {
      acceptedFileTypesToReturn = undefined
      // Default accepted file types for the DATA folder
    }
    return acceptedFileTypesToReturn
  }

  /**
   * Checks if a MED data object with the given name exists in the global data context.
   * @param {string} dataObjectName - The name of the MED data object to search for.
   * @param {Object} globalDataContext - The global data context object to search in.
   * @returns {string} - The UUID of the MED data object if found, otherwise an empty string.
   */
  static checkIfMedDataObjectInContextbyName(dataObjectName, globalDataContext, parentID) {
    let dataObjectDictionary = { ...globalDataContext }
    let globalDataContextArrayUUIDs = Object.keys(dataObjectDictionary)

    let dataObjectUUID = ""
    globalDataContextArrayUUIDs.forEach((key) => {
      let dataObject = dataObjectDictionary[key]
      if (dataObject.name === dataObjectName) {
        let dataObjectParentID = dataObject.parentID
        if (dataObjectParentID.length > 0) {
          if (dataObjectParentID == parentID) {
            // console.log("Data object found in context by name with the same parent:" + dataObjectName)
            dataObjectUUID = key
          }
        }
      }
    })

    return dataObjectUUID
  }

  /**
   * Checks if a MED data object with the given path exists in the global data context.
   * @param {string} dataObjectPath - The path of the MED data object to search for.
   * @param {Object} globalDataContext - The global data context object to search in.
   * @returns {Object|null} - The MED data object if found, otherwise null.
   */
  static checkIfMedDataObjectInContextbyPath(dataObjectPath, globalDataContext) {
    let dataObjectList = globalDataContext
    let dataObjectToReturn = null
    let arrayObjectUUIDs = Object.keys(dataObjectList)
    arrayObjectUUIDs.forEach((key) => {
      let dataObject = dataObjectList[key]
      if (dataObject.path === dataObjectPath) {
        dataObjectToReturn = dataObject
      }
    })

    return dataObjectToReturn
  }

  /**
   * Checks if a MED data object with the given path exists in the global data context.
   * @param {string} dataObjectPath - The path of the MED data object to search for.
   * @param {Object} globalDataContext - The global data context object to search in.
   * @returns {Object|null} - The MED data object if found, otherwise null.
   */
  static getObjectByPathSync(dataObjectPath, globalDataContext) {
    return new Promise((resolve) => {
      let dataObjectList = globalDataContext
      let dataObjectToReturn = null
      let arrayObjectUUIDs = Object.keys(dataObjectList)
      arrayObjectUUIDs.forEach((key) => {
        let dataObject = dataObjectList[key]
        if (dataObject.path === dataObjectPath) {
          dataObjectToReturn = dataObject
        }
      })
      resolve(dataObjectToReturn)
    })
  }

  /**
   * @param {string} filePath - The path to the file to load.
   * @returns {Promise} - A promise that resolves to the data loaded from the file.
   */
  static loadTableFromDisk = async (filePath) => {
    // eslint-disable-next-line no-undef
  
    const Path = require("path")
    let extension = Path.extname(filePath).slice(1)
    console.log("extension: ", extension)
    // let path = this.path
    let data = undefined
    // eslint-disable-next-line no-undef
      console.log("Loading table from disk: 2", filePath)
    const dfd = require("danfojs")
    if (extension === "xlsx") {
      data = await dfd.readExcel(filePath)
    } else if (extension === "csv") {
      data = await dfd.readCSV(filePath)
    } else if (extension === "json") {
      data = await dfd.readJSON(filePath)
    }
    return data
  }

  /**
   * Creates a copy of a MED data object.
   * @param {MedDataObject} dataObject - The MED data object to copy.
   * @param {Object} [globalDataContext={}] - The global data context object to search in.
   * @returns {MedDataObject} - The copy of the MED data object.
   */
  static createACopy(dataObject, globalDataContext) {
    let copyCanBeCreated = false
    let copyIndex = 1
    if (globalDataContext === undefined) {
      globalDataContext = {}
    }
    let copyName = dataObject.nameWithoutExtension + "_copy" + "." + dataObject.extension
    while (!copyCanBeCreated) {
      // Check if a data object with the same name already exists in the context
      let dataObjectUUID = MedDataObject.checkIfMedDataObjectInContextbyName(copyName, globalDataContext)
      if (dataObjectUUID !== "") {
        copyIndex++
        copyName = dataObject.nameWithoutExtension + "_copy_" + copyIndex + "." + dataObject.extension
      } else {
        copyCanBeCreated = true
      }
    }
    let copy = new MedDataObject(dataObject.originalName, copyName, dataObject.type, dataObject.parentID, dataObject.path, dataObject.childrenIDs)
    copy.parentID = dataObject.getUUID()
  }

  /**
   * Returns the highest parent of a MED data object.
   * @param {MedDataObject} dataObject - The MED data object to check.
   * @param {Object} globalDataContext - The global data context object to search in.
   * @returns {MedDataObject} - The highest parent of the MED data object.
   */
  static getWhoIsTheHighestParent(dataObject, globalDataContext, depth = 0) {
    let parentID = dataObject.parentID
    let parentObject = globalDataContext[parentID]
    if (parentID == "UUID_ROOT") {
      return dataObject
    } else {
      depth++
      return this.getWhoIsTheHighestParent(parentObject, globalDataContext, depth)
    }
  }

  /**
   * Checks the operating system and adapts the provided `path` to the OS.
   * @param {string} path
   * @returns {string} - The adapted path.
   */
  static adaptPathToOS(path) {
    let cwdSlashType = path.includes("/") ? "/" : "\\"
    let cwdSlashTypeInv = cwdSlashType == "/" ? "\\" : "/"
    let newPath = path
    if (process.platform === "win32" && cwdSlashType === "/") {
      toast.error("Path not valid for Windows")
      return ""
    } else if (typeof process !== "undefined" && process.platform === "linux" && cwdSlashType === "\\") {
      toast.error("Path not valid for Linux")
      return ""
    } else if (process.platform === "win32") {
      newPath = path.replaceAll(cwdSlashTypeInv, cwdSlashType)
    } else if (typeof process !== "undefined" && process.platform === "linux") {
      newPath = path.replaceAll(cwdSlashTypeInv, cwdSlashType)
      return newPath
    }
    return newPath
  }

  /**
   *
   * @param {String} path A path to a MedDataObject
   * @returns {Object, Object} - {columnsArray, columnsObject} - The columns of the data object if it is a table.
   */
  static getColumnsFromPath = async (path, globalData, setGlobalData = undefined) => {
    try {
      let dataObject = MedDataObject.checkIfMedDataObjectInContextbyPath(path, globalData)
      let columnsArray = []
      console.log('1')
      if (!dataObject) return { columnsArray: [], columnsObject: {} }
      if (dataObject.metadata.columns) {
        columnsArray = dataObject.metadata.columns
      } else {
        console.log(2)
        console.log("dataObject: ", dataObject)
        columnsArray = await dataObject.getColumns(dataObject.path)
        console.log(3)
        dataObject.metadata.columns = columnsArray
        setGlobalData && setGlobalData({ ...globalData })
      }
      let columnsObject = {}
      columnsArray.forEach((element) => {
        columnsObject[element] = element
      })

      return { columnsArray: columnsArray, columnsObject: columnsObject }
    } catch (error) {
      console.error(error)
      toast.error("Error getting columns from path")
      return { columnsArray: [], columnsObject: {} }
    }
  }

  /**
   * Create an empty folder in the file system.
   * @param {string} name
   * @param {string} path
   */
  static createEmptyFolderFS(name, path) {
    // eslint-disable-next-line no-undef
    let fs = require("fs")
    let newName = "New Folder"
    if (name !== undefined) {
      newName = this.getNewNameForFolder({ name: name, folderPath: path })
    }
    let pathToCreate = path + getPathSeparator() + newName
    fs.mkdirSync(pathToCreate, { recursive: true }, (err) => {
      if (err) {
        console.error(err)
      } else {
        console.log(`Folder created at ${pathToCreate}`)
        return pathToCreate
      }
    })
  }

  /**
   * Create an empty folder in the file system.
   * @param {string} name
   * @param {string} path
   */
  static createEmptyFolderFSsync(name, path, newIfExist = true) {
    // eslint-disable-next-line no-undef
    let fs = require("fs")
    let newName = "New Folder"
    if (name !== undefined) {
      newIfExist ? (newName = this.getNewNameForFolder({ name: name, folderPath: path })) : (newName = name)
    }
    let pathToCreate = path + getPathSeparator() + newName
    const fsPromises = fs.promises
    this.updateWorkspaceDataObject(1000)
    return new Promise((resolve) => {
      fsPromises
        .mkdir(pathToCreate, { recursive: true })
        .then(function () {
          console.log("directory created at " + pathToCreate)
          resolve(pathToCreate)
        })
        .catch(function () {
          console.error("failed to create directory")
        })
    })
  }

  /**
   * Create an empty folder in the file system.
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
          console.log("directory created at " + path)
          resolve(path)
        })
        .catch(function () {
          console.error("failed to create directory")
        })
    })
  }

  /**
   * This function creates a new folder in the workspace with the name "New Folder" and the parent folder being the selected folder.
   * The button that triggers this function is only visible if the accordion is not collapsed.
   * @param {Array} selectedItems - The array of selected items in the directory tree
   * @returns {void}
   */
  static createFolder(UUID, globalData, nameOfTheNewFolder) {
    if (globalData === undefined) {
      console.error("You forgot to specify the global data context")
      return
    }
    if (UUID !== undefined && UUID !== null && UUID !== "" && UUID.length > 0) {
      let parentObject = undefined
      let selectedItemObject = globalData[UUID[0]]
      if (selectedItemObject.type == "folder") {
        parentObject = selectedItemObject
      } else {
        parentObject = globalData[selectedItemObject.parentID]
      }
      let newName = "New Folder"
      if (nameOfTheNewFolder !== undefined) {
        newName = this.getNewNameForFolder({ name: nameOfTheNewFolder, folderPath: parentObject.path })
      }
      this.createEmptyFolderFS(newName, parentObject.path)
      this.updateWorkspaceDataObject()
      return parentObject.path + getPathSeparator() + newName
    } else {
      toast.error("Please select a folder")
    }
  }

  /**
   * Updates a MED data object in the global data context.
   * @param {MedDataObject} dataObject - The MED data object to update.
   * @param {Object} globalDataContext - The global data context object to update.
   * @param {function} setGlobalDataContext - The function to set the updated global data context.
   */
  static updateDataObjectInContext(dataObject, globalDataContext, setGlobalDataContext) {
    let newGlobalData = { ...globalDataContext }
    newGlobalData[dataObject.getUUID()] = dataObject
    setGlobalDataContext(newGlobalData)
  }

  /**
   * Renames a MED data object.
   * @param {MedDataObject} dataObject - The MED data object to rename.
   * @param {string} newName - The new name for the MED data object.
   * @param {Object} globalDataContext - The global data context object to search in.
   * @returns {string} - The new name for the MED data object.
   */
  static rename(dataObject, newName, globalDataContext) {
    console.log("dataObject: ", dataObject)
    let newNameFound = this.getNewName({
      dataObject: dataObject,
      newName: newName,
      globalDataContext: globalDataContext,
      parentID: dataObject.parentID
    })
    console.log("newNameFound: " + newNameFound)
    console.log("newName: " + newName)
    if (newNameFound !== "") {
      if (newNameFound !== newName) {
        toast.warning("Data object renamed to " + newNameFound + " because a data object with the same name already exists in the context")
      } else {
        toast.success("Data object renamed to " + newNameFound)
      }
      dataObject.name = newNameFound

      dataObject.lastModified = Date(Date.now())
      let oldPath = dataObject.path
      let dataObjectRenamed = dataObject.rename(newName)
      // Write data to file
      let newPath = dataObjectRenamed.path

      fs.renameSync(oldPath, newPath, () => {
        console.log(`Data object renamed from ${oldPath} to ${newPath}`)
      })
    }

    return dataObject
  }

  /**
   * Returns the path separator based on the operating system.
   * @returns {string} - The path separator.
   */
  static getPathSeparator() {
    if (process.platform === "win32") {
      return "\\"
    } else if (typeof process !== "undefined" && process.platform !== "win32") {
      return "/"
    }
  }

  /**
   * Returns the names of the folders and files in the provided path.
   * @param {string} path - The path to search in.
   * @returns {Array} - The names of the folders and files in the provided path.
   */
  static getNamesOfFolderAndFilesInPath(path) {
    // eslint-disable-next-line no-undef
    let fs = require("fs")
    let names = fs.readdirSync(path)
    return names
  }

  /**
   * This function renames a `MedDataObject` in the workspace.
   * @param {Object} medObject - The `MedDataObject` to rename
   * @param {string} newName - The new name of the `MedDataObject`
   * @returns {void}
   * @note - This function is called when the user renames a file or folder in the directory tree, either by F2 or by right-clicking and selecting "Rename".
   */
  static handleNameChange(medObject, newName, dataContext, setDataContext) {
    if (this.validateNewName(medObject, newName, dataContext)) {
      // Check if the new name is the same as the current name.
      // Get the UUID of the `MedDataObject` with the current name from the `globalData` object.
      let dataObject = dataContext[medObject._UUID]
      let uuid = medObject._UUID
      // Rename the `MedDataObject` with the new name and update the `globalData` object.
      let renamedDataObject = this.rename(dataObject, newName, dataContext)
      let globalDataCopy = { ...dataContext }
      globalDataCopy[uuid] = renamedDataObject
      setDataContext(globalDataCopy)
      this.updateWorkspaceDataObject()
    }
  }

  /**
   * This function evaluates if a name is valid for a `MedDataObject`.
   * @param {Object} medObject - The `MedDataObject` to rename
   * @param {string} newName - The new name of the `MedDataObject`
   * @param {Object} dataContext - The global data context object to search in.
   * @returns {Boolean} - `true` if the name is valid, `false` otherwise.
   */
  static validateNewName(medObject, newName, dataContext) {
    const namesYouCantRename = ["UUID_ROOT", "DATA", "EXPERIMENTS"]
    if (newName == "") {
      toast.error("Error: Name cannot be empty")
      return false
    } else if (medObject.name == newName) {
      toast.error("Error: You really wanted to rename to the same name?")
      return false
    } else if (boolNameInArray(newName, namesYouCantRename)) {
      toast.error("Error: This name is reserved and cannot be used")
      return false
    } else if (boolNameInArray(medObject.name, namesYouCantRename)) {
      console
      toast.error("Error: This name cannot be changed")
      return false
    } else if (boolNameInArray(newName, Object.keys(dataContext))) {
      toast.error("Error: This name is already used")
      return false
    } else {
      return true
    }
  }

  /**
   * This function returns a new name for a file or folder that is not in the provided list of names.
   * @param {string} name - The name to check.
   * @param {Array} names - The list of names to check against.
   * @param {string} extension - The extension of the file to check.
   */
  static returnNameNotInList(name, names, extension = undefined) {
    let nameFound = false
    let index = 0
    let extensionToReturn = extension ? "." + extension : ""
    let nameToReturn = name + extensionToReturn
    while (!nameFound) {
      if (names.includes(nameToReturn)) {
        nameToReturn = name + "_" + index + extensionToReturn
        index++
      } else {
        nameFound = true
      }
    }
    console.log("nameToReturn: ", { nameToReturn })
    return nameToReturn
  }

  /**
   * This function returns a new name for a  folder that is not in the provided list of names.
   * @param {string} name - The name to check.
   * @param {string} folderPath - The path of the folder to check.
   */
  static getNewNameForFolder({ name, folderPath }) {
    let nameToReturn = name
    let names = this.getNamesOfFolderAndFilesInPath(folderPath)
    nameToReturn = this.returnNameNotInList(name, names)
    return nameToReturn
  }

  /**
   * This function returns a new name for a file that is not in the provided list of names.
   * @param {string} name - The name to check.
   * @param {string} folderPath - The path of the folder to check.
   * @param {string} extension - The extension of the file to check.
   */
  static getNewNameForFile({ name, folderPath, extension }) {
    let nameToReturn = name
    let names = this.getNamesOfFolderAndFilesInPath(folderPath)
    let nameWithoutExtension = splitStringAtTheLastSeparator(name, ".")[0]
    let extensionToReturn = extension
    if (extension === "") {
      extensionToReturn = splitStringAtTheLastSeparator(name, ".")[1]
    }
    console.log("Names: ", names)
    nameToReturn = this.returnNameNotInList(nameWithoutExtension, names, extensionToReturn)
    return nameToReturn
  }

  /**
   * This function returns the total path of a file or folder.
   * @param {string} newName - The name of the file or folder.
   * @param {string} parentPath - The path of the parent folder.
   */
  static getTotalPath(newName, parentPath) {
    let separator = getPathSeparator()
    let totalPath = parentPath + separator + newName
    return totalPath
  }

  /**
   * This function moves a `MedDataObject` to a new folder.
   * @param {Object} dataObject - The `MedDataObject` to move.
   * @param {Object} newParentObject - The `MedDataObject` to move to.
   * @param {Object} globalDataContext - The global data context object to search in.
   * @param {function} setGlobalDataContext - The function to set the updated global data context.
   */
  static move(dataObject, newParentObject, globalDataContext, setGlobalDataContext) {
    let newDataObject = dataObject
    let oldParentID = dataObject.parentID
    let newParentObjectPath = newParentObject.path
    let oldPath = dataObject.path

    newDataObject.path = newParentObjectPath + this.getPathSeparator() + newDataObject.name
    let newNameFound = this.getNewName({
      dataObject: newDataObject,
      newName: dataObject.name,
      globalDataContext: globalDataContext,
      parentID: newParentObject.getUUID()
    })

    if (newNameFound !== "") {
      if (newNameFound !== dataObject.name) {
        console.log("newNameFound: " + newNameFound)
        toast.warning("Data object renamed to " + newNameFound + " because a data object with the same name already exists in the context")
      }
      newDataObject.name = newNameFound
      newDataObject.lastModified = Date(Date.now())
      newDataObject.path = newParentObjectPath + this.getPathSeparator() + newDataObject.name

      console.log("newDataObject: ", { newDataObject })
      newDataObject.name = newNameFound
      let dataObjectRenamed = newDataObject
      // Write data to file
      let newPath = dataObjectRenamed.path

      fs.move(oldPath, newPath, () => {
        console.log(`Data object moved from ${oldPath} to ${newPath}`)
        toast.success(`Data object moved from ${oldPath} to ${newPath}`)
      })

      let newGlobalData = { ...globalDataContext }
      newGlobalData[oldParentID].removeChildID(dataObject.getUUID())

      newGlobalData[newParentObject.getUUID()].addChildID(dataObjectRenamed.getUUID())
      dataObjectRenamed.parentID = newParentObject.getUUID()

      newGlobalData[dataObject.getUUID()] = dataObjectRenamed
      setGlobalDataContext(newGlobalData)
      this.updateWorkspaceDataObject()
    }
  }

  /**
   * Creates a copy of a MED data object.
   * @param {MedDataObject} dataObject - The MED data object to copy.
   * @param {MedDataObject} newParentObject - The MED data object to copy to.
   * @param {Object} globalDataContext - The global data context object to search in.
   * @param {function} setGlobalDataContext - The function to set the updated global data context.
   * @returns {void}
   */
  static copy(dataObject, newParentObject, globalDataContext, setGlobalDataContext) {
    let newMedDataObject = new MedDataObject({
      originalName: dataObject.originalName,
      name: dataObject.name,
      type: dataObject.type,
      parentID: newParentObject.getUUID(),
      childrenIDs: dataObject.childrenIDs ? [] : null
    })

    let newNameWithExtension = undefined
    if (dataObject.type !== "folder") {
      newNameWithExtension = this.getNewNameForFile({ name: dataObject.name, folderPath: newParentObject.path, extension: dataObject.extension })
    } else {
      if (dataObject.getUUID() === newParentObject.getUUID()) {
        newNameWithExtension = this.getNewNameForFolder({ name: dataObject.name + "_sub", folderPath: newParentObject.path })
      } else {
        newNameWithExtension = this.getNewNameForFolder({ name: dataObject.name, folderPath: newParentObject.path })
      }
    }

    newMedDataObject.name = newNameWithExtension
    newMedDataObject.nameWithoutExtension = splitStringAtTheLastSeparator(newNameWithExtension, ".")[0].length > 0 ? splitStringAtTheLastSeparator(newNameWithExtension, ".")[0] : newNameWithExtension
    newMedDataObject.extension = splitStringAtTheLastSeparator(newNameWithExtension, ".")[0].length > 0 ? splitStringAtTheLastSeparator(newNameWithExtension, ".")[1] : ""
    newMedDataObject.path = this.getTotalPath(newNameWithExtension, newParentObject.path)

    newMedDataObject.lastModified = Date(Date.now())
    newMedDataObject.created = Date(Date.now())
    let newGlobalData = { ...globalDataContext }
    newGlobalData[newParentObject.getUUID()].addChildID(newMedDataObject.getUUID())
    newGlobalData[newMedDataObject.getUUID()] = newMedDataObject
    let oldPath = dataObject.path
    let newPath = newMedDataObject.path

    if (dataObject.getUUID() === newParentObject.getUUID()) {
      fs.mkdirSync(newPath, { recursive: true }, (err) => {
        if (err) {
          console.error(err)
        } else {
          console.log(`Folder created at ${newPath}`)
          toast.success("Data object copied to " + newMedDataObject.path)
        }
      })

      let childrenItemsID = dataObject.childrenIDs
      for (let childID of childrenItemsID) {
        let childObject = globalDataContext[childID]
        if (childObject !== undefined) {
          fs.cp(childObject.path, newPath + this.getPathSeparator() + childObject.name, { recursive: true }, (err) => {
            if (err) {
              console.error(err)
            } else {
              console.log(`Data object copied from ${oldPath} to ${newPath}`)
              toast.success("Data object copied to " + newMedDataObject.path)
            }
          })
        }
      }
    } else {
      fs.cp(oldPath, newPath, { recursive: true }, (err) => {
        if (err) {
          console.error(err)
        } else {
          console.log(`Data object copied from ${oldPath} to ${newPath}`)
          toast.success("Data object copied to " + newMedDataObject.path)
        }
      })
    }

    setGlobalDataContext(newGlobalData)
  }

  /**
   * Deletes the file associated with the provided `dataObject`.
   * @param {MedDataObject} dataObject - The `MedDataObject` instance to delete.
   */
  static delete(dataObject, globalDataContext, dispatchLayout = undefined) {
    // eslint-disable-next-line no-undef
    let globalData = { ...globalDataContext }
    let childIDs = dataObject.childrenIDs
    if (childIDs !== null) {
      if (childIDs.length > 0) {
        childIDs.forEach((childID) => {
          let childObject = globalData[childID]
          if (childObject !== undefined) {
            globalData = this.delete(childObject, globalData)
          }
        })
      }
    }
    // eslint-disable-next-line no-undef
    let fs = require("fs")
    let path = dataObject.path
    let medObjectType = dataObject.type
    if (dispatchLayout !== undefined) {
      dispatchLayout({ type: "DELETE_DATA_OBJECT", payload: dataObject })
    }
    delete globalData[dataObject.getUUID()]
    fs.rmSync(path, { recursive: medObjectType == "folder" }, (err) => {
      if (err) {
        console.log(err)
      } else {
        console.log(`Data object deleted from ${path}`)
        toast.success("Data object deleted")
      }
    })
    return globalData
  }

  /**
   * Generates a new name for the provided `dataObject` based on the `newName` parameter and the existing data objects in the `globalDataContext`.
   * @param {Object} options - An object with the following optional properties:
   *   - `dataObject` (required): The `MedDataObject` instance to generate a new name for.
   *   - `newName` (required): The new name for the `MedDataObject` instance.
   *   - `globalDataContext` (optional): The global data context object to search in.
   * @returns {string} - The new name for the `MedDataObject` instance.
   */
  static getNewName({ dataObject, newName, globalDataContext, parentID } = {}) {
    let answer = ""
    let copyCanBeCreated = false
    let copyIndex = 1
    let newNameWithoutExtension = newName
    let dataObjectSuffix = ""
    if (dataObject.type !== "folder") {
      newNameWithoutExtension = splitStringAtTheLastSeparator(newName, ".")[0]
      dataObjectSuffix = "." + dataObject.extension
    }

    console.log("newNameWithoutExtension: " + newNameWithoutExtension)
    if (globalDataContext === undefined) {
      globalDataContext = {}
    }
    let copyName = newNameWithoutExtension + dataObjectSuffix
    while (!copyCanBeCreated) {
      // Check if a data object with the same name already exists in the context
      let dataObjectUUID = MedDataObject.checkIfMedDataObjectInContextbyName(copyName, globalDataContext, parentID)

      if (dataObjectUUID !== "") {
        copyIndex++
        copyName = newNameWithoutExtension + "_" + copyIndex + "." + dataObject.extension
      } else {
        copyCanBeCreated = true
      }
    }
    answer = copyName
    return answer
  }
  /**
   * Creates a new `MedDataObject` instance based on the properties of the provided JSON object.
   * @param {Object} json - The JSON object to create the `MedDataObject` instance from.
   * @returns {MedDataObject} - The new `MedDataObject` instance.
   */
  static fromJSON(json) {
    let medDataObject = new MedDataObject(json.originalName, json.name, json.type, json.parentID, json.path, json.childrenIDs)
    medDataObject.id = json.id
    medDataObject.lastModified = json.lastModified
    medDataObject.created = json.created
    medDataObject.dataLoaded = json.dataLoaded
    medDataObject.data = json.data
    return medDataObject
  }
  /**
   * Creates an array of `MedDataObject` instances based on the properties of the provided array of JSON objects.
   * @param {Array} jsonList - The array of JSON objects to create the `MedDataObject` instances from.
   * @returns {Array} - An array of `MedDataObject` instances.
   */
  static fromJSONList(jsonList) {
    let medDataObjectList = []
    for (let json of jsonList) {
      medDataObjectList.push(MedDataObject.fromJSON(json))
    }
    return medDataObjectList
  }
  /**
   * Modifies the properties of the provided `dataObject` instance with the provided `name`, `type`, `parentID`, `path`, and `childrenIDs`. It also updates the `lastModified` property to the current date and time.
   * @param {MedDataObject} dataObject - The `MedDataObject` instance to modify.
   * @param {string} name - The new name for the `MedDataObject` instance.
   * @param {string} type - The new type for the `MedDataObject` instance.
   * @param {Array} parentID - The new parent IDs for the `MedDataObject` instance.
   * @param {string} path - The new path for the `MedDataObject` instance.
   * @param {Array} childrenIDs - The new children IDs for the `MedDataObject` instance.
   */
  static modifyDataObject(dataObject, name, type, parentID, path, childrenIDs) {
    dataObject.name = name
    dataObject.type = type
    dataObject.parentID = parentID
    dataObject.path = path
    dataObject.childrenIDs = childrenIDs
    dataObject.lastModified = Date(Date.now())
  }

  /**
   * This function saves the modified data in the format specified in the config and at the location specified in the config
   * @param event - event
   * @param data - data to be saved
   * @returns void
   */
  static async saveDatasetToDisk({ data = undefined, df = undefined, filePath = undefined, extension = undefined }) {
    // eslint-disable-next-line no-undef
    const dfd = require("danfojs")
    if (filePath === undefined || filePath === null || filePath === "") {
      toast.error("No file path specified")
      return
    }
    if (extension === undefined || extension === null || extension === "") {
      toast.error("No file extension specified")
      return
    }
    if (df === undefined && data !== undefined) {
      df = new dfd.DataFrame(data)
    } else if (df === undefined && data === undefined) {
      toast.error("No data to save")
      return
    } else if (df !== undefined && data === undefined) {
      // No operation
    }
    if (extension === "csv") {
      try {
        dfd.toCSV(df, { filePath: filePath })
      } catch (e) {
        // No operation
      } finally {
        toast.success("Data saved successfully", filePath)
      }
    } else if (extension === "json") {
      try {
        dfd.toJSON(df, { filePath: filePath })
      } catch (e) {
        // No operation
      } finally {
        toast.success("Data saved successfully", filePath)
      }
    } else if (extension === "xlsx") {
      try {
        dfd.toExcel(df, { filePath: filePath })
      } catch (e) {
        // No operation
      } finally {
        toast.success("Data saved successfully", filePath)
      }
    }
  }
  /**
   * Saves the provided `dataObject` instance to the file system.
   * @param {MedDataObject} dataObject - The `MedDataObject` instance to save.
   * @README - This function is not implemented yet. Acts as a placeholder for future development.
   */
  static saveDataObject() {}

  /**
   * Changes the name and path of the `MedDataObject` instance to the provided `newName`.
   * @param {string} newName - The new name for the `MedDataObject` instance.
   * @returns {MedDataObject} - The modified `MedDataObject` instance.
   */
  rename(newName) {
    this.name = newName
    let separator = getPathSeparator()
    console.log("separator: ", separator)
    let newPath = splitStringAtTheLastSeparator(this.path, separator)[0] + separator + newName

    if (this.type === "folder") {
      this.extension = ""
      this.nameWithoutExtension = newName
    } else {
      this.nameWithoutExtension = splitStringAtTheLastSeparator(this.name, ".")[0]
    }
    this.path = newPath
    this.lastModified = Date(Date.now())
    return this
  }

  /**
   * Returns the columns' tags of the `MedDataObject` instance and the tags dictionary (if any).
   * @returns {Object, Object} - The columns' tags of the `MedDataObject` instance and the tags dictionary (if any).
   */
  getColumnsTag() {
    if (this.metadata.columnsTag === undefined) {
      this.metadata.columnsTag = {}
    }
    if (this.metadata.tagsDict === undefined) {
      this.metadata.tagsDict = {}
    }
    return { columnsTag: this.metadata.columnsTag, tagsDict: this.metadata.tagsDict }
  }

  /**
   * Changes the type of the `MedDataObject` instance to the provided `type`.
   * @param {string} type - The new type for the `MedDataObject` instance.
   */
  changeType(type) {
    this.type = type
    this.lastModified = Date(Date.now())
  }

  /**
   * Changes the parent IDs of the `MedDataObject` instance to the provided `parentID`.
   * @param {Array} parentID - The new parent IDs for the `MedDataObject` instance.
   */
  changeParentID(parentID) {
    this.parentID = parentID
    this.lastModified = Date(Date.now())
  }

  /**
   * Changes the path of the `MedDataObject` instance to the provided `path`.
   * @param {string} path - The new path for the `MedDataObject` instance.
   */
  changePath(path) {
    this.path = path
    this.lastModified = Date(Date.now())
  }

  /**
   * Changes the children IDs of the `MedDataObject` instance to the provided `childrenIDs`.
   * @param {Array} childrenIDs - The new children IDs for the `MedDataObject` instance.
   */
  changeChildrenIDs(childrenIDs) {
    this.childrenIDs = childrenIDs
    this.lastModified = Date(Date.now())
  }

  /**
   * Adds the provided `childID` to the children IDs of the `MedDataObject` instance.
   * @param {string} childID - The ID of the child to add.
   */
  addChildID(childID) {
    this.childrenIDs.push(childID)
    this.lastModified = Date(Date.now())
  }

  /**
   * Removes the provided `childID` from the children IDs of the `MedDataObject` instance.
   * @param {string} childID - The ID of the child to remove.
   */
  removeChildID(childID) {
    this.childrenIDs = this.childrenIDs.filter((id) => id !== childID)
    this.lastModified = Date(Date.now())
  }

  /**
   * Adds the provided `path` to the virtual path of the `MedDataObject` instance.
   * @param {string} path - The virtual path to add.
   */
  addVirtualPath(path) {
    this.virtualPath.push(path)
    this.lastModified = Date(Date.now())
  }

  /**
   * Removes the provided `path` from the virtual path of the `MedDataObject` instance.
   * @param {string} path - The virtual path to remove.
   */
  removeVirtualPath(path) {
    this.virtualPath = this.virtualPath.filter((p) => p !== path)
    this.lastModified = Date(Date.now())
  }

  /**
   * Sets the virtual path of the `MedDataObject` instance to the provided `pathArray`.
   * @param {Array} pathArray - The new virtual path for the `MedDataObject` instance.
   */
  setVirtualPath(pathArray) {
    this.virtualPath = pathArray
    this.lastModified = Date(Date.now())
  }

  /**
   * Save the data of the `MedDataObject` instance to the file associated with it.
   */
  async saveData(df = undefined) {
    MedDataObject.saveDatasetToDisk({ data: this.data, df: df, filePath: this.path, extension: this.extension })
  }

  /**
   * GetsTheColumnsOfTheDataObjectIfItIsATable
   * @returns {Array} - The columns of the data object if it is a table.
   */
  async getColumnsOfTheDataObjectIfItIsATable(filePath = undefined) {
    console.log("this: ", this)
    !filePath && (filePath = this.path)
    let newColumns = []
    if (this.dataLoaded && this.data.$columns) {
      newColumns = this.data.$columns
    } else if (this.metadata.columns) {
      newColumns = await this.metadata.columns
    } else {
      const data = await this.loadDataFromDisk(this.path)
      console.log("data: ", data)
      if (data.$columns) {
        newColumns = data.$columns
        this.metadata.columns = newColumns
        return this.automaticTaggingOfColumns(data.$columns)
      }
    }
    return this.automaticTaggingOfColumns(newColumns)
  }

  /**
   * GetsTheColumnsOfTheDataObjectIfItIsATable
   * @returns {Array} - The columns of the data object if it is a table.
   */
  async getColumns(path) {
    let newColumns = []
    console.log("path: eefef ", path)
    const data = await MedDataObject.loadTableFromDisk(path)
    console.log("data-*--------------------: ", data)
    if (data.$columns) {
      newColumns = data.$columns
      this.metadata.columns = newColumns
    }
    return this.automaticTaggingOfColumns(newColumns)
  }

  /**
   * @param {string} filePath - The path to the file to load.
   * @returns {Promise} - A promise that resolves to the data loaded from the file.
   */
  async loadDataFromDisk(filePath = undefined) {
    if (!filePath) {
      filePath = this.path
    }
    console.log("filePath: ", filePath)
    // eslint-disable-next-line no-undef
    const Path = require("path")
    let extension = Path.extname(filePath).slice(1)
    console.log("extension: ", extension)
    let data = undefined
    // eslint-disable-next-line no-undef
    const dfd = require("danfojs")
    if (extension === "xlsx") {
      data = await dfd.readExcel(filePath)
    } else if (extension === "csv") {
      data = await dfd.readCSV(filePath)
    } else if (extension === "json") {
      data = await dfd.readJSON(filePath)
    }

    return data
  }

  /**
   * Checks every columns if they are prefixed with some tags (split by _|_) and add the tags to the metadata
   * @param {Array} columns - The columns of the data object.
   * @returns {Array} - The columns of the data object with the tags added to the metadata.
   */
  automaticTaggingOfColumns(columns) {
    let newColumns = []
    let setOfColumns = new Set()
    for (let column of columns) {
      let tags = column.split("_|_")
      if (tags.length > 1) {
        if (this.metadata.columnsTag === undefined) {
          this.metadata.columnsTag = {}
        }
        if (this.metadata.tagsDict === undefined) {
          this.metadata.tagsDict = {}
        }
        let columnName = tags.pop()

        if (setOfColumns.has(columnName)) {
          let newColumnName = this.returnNameNotInSet(columnName, setOfColumns)
          columnName = newColumnName
        }
        if (this.metadata.columnsTag[columnName] === undefined) {
          this.metadata.columnsTag[columnName] = tags
        }
        for (let tag of tags) {
          if (tag !== "") {
            if (!this.metadata.columnsTag[columnName].includes(tag)) {
              this.metadata.columnsTag[columnName].push(tag)
            }
          }
        }
        // this.metadata.columnsTag[columnName] = tags
        for (let tag of tags) {
          if (tag !== "") {
            if (this.metadata.tagsDict[tag] === undefined || this.metadata.tagsDict[tag] === null) {
              this.metadata.tagsDict[tag] = { color: "generateRandomColor()", fontColor: "white" }
            }
          }
        }
        setOfColumns.add(columnName)
        newColumns.push(columnName)
      } else {
        setOfColumns.add(column)
        newColumns.push(column)
      }
    }
    this.metadata.columns = newColumns
    this.renameColumnsWithoutTags()
    return newColumns
  }

  /**
   * Iteratively search for a new name by increasing the index added to the name until a name not present in the set of names is found
   * @param {string} name - The name to check.
   * @param {Set} setOfNames - The set of names to check against.
   * @returns {string} - The new name.
   */
  returnNameNotInSet(name, setOfNames) {
    let nameFound = false
    let index = 1
    let nameToReturn = name
    while (!nameFound) {
      if (setOfNames.has(nameToReturn)) {
        nameToReturn = name + "_(" + index++ + ")"
        index++
      } else {
        nameFound = true
      }
    }
    return nameToReturn
  }

  /**
   * if this.data is a DanfoJS DataFrame, rename the columns without the tags
   * @returns {void}
   */
  renameColumnsWithoutTags() {
    if (this.data !== undefined && this.data !== null) {
      if (this.data.$columns) {
        let columnsRenaming = {}
        this.data.$columns.forEach((column, index) => {
          if (column.includes("_|_")) {
            // Handle the case where the column name is already present in the columns renaming dictionary
            if (columnsRenaming[column] === undefined) {
              columnsRenaming[column] = this.metadata.columns[index]
            } else {
              toast.warning("Duplicate column name found (while removing column names): " + column)
            }
          }
        })
        this.data.rename(columnsRenaming, { inplace: true })
      }
    }
  }

  /**
   * Export the tags into each column name
   */
  exportTagsToColumns() {
    let newColumns = []
    for (let column of this.columns) {
      let tags = this.metadata.tags[column]
      if (tags !== undefined) {
        let newColumnName = tags.join("_|_") + "_|_" + column
        newColumns.push(newColumnName)
      } else {
        newColumns.push(column)
      }
    }
    this.metadata.columns = newColumns
    return newColumns
  }

  /**
   * Set the data of the `MedDataObject` instance and sets the metadata accordingly.
   * @description - This function is called when the user loads a file into the workspace.
   *  - The columns are extracted and the tags are added to the metadata.
   */
  setData(data) {
    this.dataLoaded = true
    this.lastModified = Date(Date.now())
    if (data.$columns) {
      this.data = data
      this.metadata.columns = this.automaticTaggingOfColumns(data.$columns)
    }
  }

  /**
   * Unloads the data from the `MedDataObject` instance.
   */
  unloadData() {
    this.data = null
    this.dataLoaded = false
    this.lastModified = Date(Date.now())
  }

  /**
   * Adds the provided `modification` to the data modification queue of the `MedDataObject` instance.
   * @param {Object} modification - The data modification to add to the queue.
   */
  addDataModification(modification) {
    this.dataModificationQueue.push(modification)
    this.lastModified = Date(Date.now())
  }

  /**
   * Removes the provided `modification` from the data modification queue of the `MedDataObject` instance.
   * @param {Object} modification - The data modification to remove from the queue.
   */
  removeDataModification(modification) {
    this.dataModificationQueue = this.dataModificationQueue.filter((m) => m !== modification)
    this.lastModified = Date(Date.now())
  }

  /**
   * Sets the data modification queue of the `MedDataObject` instance to the provided `modificationQueue`.
   * @param {Array} modificationQueue - The new data modification queue for the `MedDataObject` instance.
   */
  setDataModificationQueue(modificationQueue) {
    this.dataModificationQueue = modificationQueue
    this.lastModified = Date(Date.now())
  }

  /**
   * Clears the data modification queue of the `MedDataObject` instance.
   */
  clearDataModificationQueue() {
    this.dataModificationQueue = []
    this.lastModified = Date(Date.now())
  }

  /**
   *
   * @param {string} type The type of the step to add: refer to the dataStepsUtils.jsx
   * @param {Object} execSettings The settings of the step to add: refer to the dataStepsUtils.jsx
   */
  addStep(type, execSettings) {
    !this.steps && (this.steps = [])
    this.steps.push({ type: type, execSettings: execSettings })
    this.lastModified = Date(Date.now())
  }

  /**
   *
   * @returns {Array} - The steps of the `MedDataObject` instance.
   */
  getSteps() {
    return this.steps
  }

  /**
   * Applies all the data modifications in the data modification queue of the `MedDataObject` instance to its data.
   */
  applyDataModifications() {
    for (let modification of this.dataModificationQueue) {
      modification.apply(this.data)
    }
    this.lastModified = Date(Date.now())
  }

  /**
   * Returns the UUID of the `MedDataObject` instance.
   * @returns {string} - The UUID of the `MedDataObject` instance.
   */
  getUUID() {
    return this._UUID
  }

  /**
   * Sets the UUID of the `MedDataObject` instance to the provided `newUUID`.
   */
  setUUID(newUUID) {
    this._UUID = newUUID
  }

  /**
   * Sets the type of the `MedDataObject` instance to the provided `type`.
   * @param {string} type - The new type for the `MedDataObject` instance.
   */
  setType(type) {
    this.type = type
  }

  /**
   * Returns the type of the `MedDataObject` instance.
   * @returns {string} - The type of the `MedDataObject` instance.
   */
  getType() {
    return this.type
  }

  /**
   * Sets the children IDs of the `MedDataObject` instance to the provided `childrenIDs`.
   * @param {Array<string>} childrenIDs
   */
  setChildrenIDs(childrenIDs) {
    this.childrenIDs = childrenIDs
  }

  /**
   * Returns the children IDs of the `MedDataObject` instance.
   * @returns {Array<string>} - The children IDs of the `MedDataObject` instance.
   */
  getChildrenIDs() {
    return this.childrenIDs
  }

  /**
   * Sets the accepted file types for the `MedDataObject` instance to the provided `acceptedFileTypes`.
   * @param {Array<string>} acceptedFileTypes - The new accepted file types for the `MedDataObject` instance.
   */
  setAcceptedFileTypes(acceptedFileTypes) {
    this.acceptedFileTypes = acceptedFileTypes
  }
}

/**
 * Represents a data modification to be applied to a `MedDataObject` instance.
 */
// eslint-disable-next-line no-unused-vars
class DataModification {
  /**
   * Creates a new `DataModification` instance with the provided `type` and `value`.
   * @param {string} type - The type of the data modification.
   * @param {string} value - The value of the data modification.
   */
  constructor(type, value) {
    this.type = type
    this.value = value
  }

  /**
   * Applies the data modification to the provided `data`.
   * @param {Object} data - The data to apply the modification to.
   */
  apply(data) {
    switch (this.type) {
      case "append":
        data.append(this.value)
        break
      case "prepend":
        data.prepend(this.value)
        break
      case "insert":
        data.insert(this.value)
        break
      case "replace":
        data.replace(this.value)
        break
      case "delete":
        data.delete(this.value)
        break
      default:
        break
    }
  }
}

/**
 * Splits the provided `string` at the last occurrence of the provided `separator`.
 * @param {string} string - The string to split.
 * @param {string} separator - The separator to split the string at.
 * @returns {Array} - An array containing the first elements of the split string and the last element of the split string.
 */
function splitStringAtTheLastSeparator(string, separator) {
  let splitString = string.split(separator)
  let lastElement = splitString.pop()
  let firstElements = splitString.join(separator)
  return [firstElements, lastElement]
}
/**
 * Returns the path separator based on the operating system.
 * @returns {string} - The path separator.
 */
function getPathSeparator() {
  // eslint-disable-next-line no-undef
  let process = require("process")
  if (process.platform === "win32") {
    return "\\"
  } else if (typeof process !== "undefined" && process.platform !== "win32") {
    return "/"
  }
}

/**
 * This function evaluates if a name is present in an array.
 * @param {string} name - The name to check.
 * @param {Array} array - The array to check against.
 * @returns {Boolean} - `true` if the name is in the array, `false` otherwise.
 */
function boolNameInArray(name, array) {
  let nameInArray = false
  array.includes(name) ? (nameInArray = true) : (nameInArray = false)
  return nameInArray
}
