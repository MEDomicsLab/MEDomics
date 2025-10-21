import * as fs from "fs-extra"
import decompress from "decompress"
import { promises as fsPromises } from "fs"
import zipper from "zip-local"

import { createFolderSync, loadJsonPath } from "./fileManagementUtils.js"
import { toast } from "react-toastify"
import Path from "path"

const IS_FILE = 0
const IS_FOLDER = 1

/**
 *
 * @param {string} path /path/to/file.extension
 * @param {*} customActions async function to do custom actions on the folder before zipping it
 *
 * @example
 * async function UseCreateZip() {
 *   await createZipFileSync("C:/Users/username/Desktop/folderToZip.extension",
 *    async (path) => {
 *      // do custom actions in the folder while it is unzipped
 *    }
 *   )
 * }
 */
export const createZipFileSync = async (path, customActions) => {
  if (!path.includes(".")) {
    toast.error("Please provide a path with a file extension")
    return
  } else {
    let zipFile = new CustomZipFile(path)
    await zipFile.createZipSync(path, customActions)
  }
}

/**
 *
 * @param {*} path /path/to/file.extension
 * @param {*} customActions async function to do custom actions on the unzipped folder before deleting it
 *
 * @example
 * async function UseModifyZip() {
 *  await modifyZipFileSync("C:/Users/username/Desktop/folderToZip.extension",
 *    async (path) => {
 *      // do custom actions in the folder while it is unzipped
 *    }
 *  )
 * }
 */
export const modifyZipFileSync = async (path, customActions) => {
  if (!path) {
    throw new Error("The path is null.")
  }
  if (!path.includes(".")) {
    toast.error("Please provide a path with a file extension")
    return
  } else {
    // check if file exists

    if (fs.existsSync(path)) {
      let zipFile = new CustomZipFile(path)
      try {
        return await zipFile.interactZipSync(path, customActions)
      } catch (err) {
        toast.error("The file is not a zip file: " + path)
        return null
      }
      // return await zipFile.interactZipSync(path, customActions)
    } else {
      toast.error("The file does not exist: " + path)
      return null
    }
  }
}

/**
 *
 * @param {String} path /path/to/file.extension
 * @returns {Promise<Object>} An object containing the content of the zip file in json format
 */
export const customZipFile2Object = (path) => {
  return new Promise((resolve, reject) => {
    if (!path.includes(".")) {
      console.error("Please provide a path with a file extension")
      reject()
    } else {
      // check if file exists
      if (fs.existsSync(path)) {
        let zipFile = new CustomZipFile(path)
        zipFile
          .toObject()
          .then((content) => {
            resolve(content)
          })
          .catch((err) => {
            console.error("an error occured while converting the zip file to an object")
            reject(err)
          })
      } else {
        toast.error("The file does not exist: " + path)
        reject()
      }
    }
  })
}

/**
 * @class CustomZipFile
 * @description
 * This class allows to create a zip file with a custom extension
 */
export default class CustomZipFile {
  constructor(path) {
    this.isOpen = false
    if (path.includes(".")) {
      this.fileExtension = "." + path.split(".")[1]
      this._cwd = path.split(".")[0]
    } else {
      this.fileExtension = ""
      this._cwd = ""
    }
  }

  /**
   *
   * @returns {Promise<Object>} An object containing the content of the zip file in json format
   */
  toObject() {
    return new Promise((resolve, reject) => {
      this.interactZipSync("default", (folderPath) => {
        return new Promise((resolve2, reject2) => {
          this.openContentToObject(folderPath)
            .then((content) => {
              resolve2(content)
            })
            .catch((err) => {
              reject2(err)
            })
        })
      })
        .then((content) => {
          resolve(content)
        })
        .catch((err) => {
          reject(err)
        })
    })
  }

  /**
   *
   * @param {String} folderPath The path of the folder to open
   * @returns {Promise<Object>} An object containing the content of the folder in json format
   */
  openContentToObject(folderPath) {
    return new Promise((resolve, reject) => {
      const readDirRecursive = (folderPath) => {
        return new Promise((resolve2, reject2) => {
          try {
            let subContent = {}
            console.log("folderPath", folderPath)
            let files = fs.readdirSync(folderPath)
            console.log("files", files)
            if (files) {
              files.forEach((element) => {
                console.log("element", element, CustomZipFile.getPathType(Path.join(folderPath, element)))
                if (CustomZipFile.getPathType(Path.join(folderPath, element)) == IS_FILE) {
                  if (element.split(".")[1] == "json") {
                    subContent[element.split(".")[0]] = loadJsonPath(Path.join(folderPath, element))
                  } else {
                    subContent[element.split(".")[0]] = element
                  }
                } else if (CustomZipFile.getPathType(Path.join(folderPath, element)) == IS_FOLDER) {
                  subContent[element] = {}
                  readDirRecursive(Path.join(folderPath, element)).then((subSubContent) => {
                    subContent[element] = subSubContent
                  })
                }
              })
            } else {
              console.log("No files found")
            }
            resolve2(subContent)
          } catch (err) {
            reject2(err)
          }
        })
      }
      readDirRecursive(folderPath)
        .then((content) => {
          resolve(content)
          console.log("content", content)
        })
        .catch((err) => {
          reject(err)
        })
    })
  }

  /**
   *
   * @param {String} path The path to check
   * @returns {Number} 0 if the path is a file, 1 if it is a folder
   */
  static getPathType(path) {
    if (path.includes(".")) {
      return IS_FILE
    } else {
      return IS_FOLDER
    }
  }

  /**
   * Creates a zip file from a folder
   * @param {string} path path of the folder to zip
   * @param {function} customActions custom actions to do on the folder before zipping it
   * @returns {Promise} path of the zip file created with the custom extension
   *
   * @example
   * async function UseCreateZip() {
   *    const customZipFile = new CustomZipFile("C:/Users/username/Desktop/folderToZip.extension")
   *    await customZipFile.createZipSync(null,
   *        async (path) => {
   *          // do custom actions in the folder while it is unzipped
   *        }
   *    )
   * }
   */
  createZipSync(
    path = "default",
    customActions = () => {
      return new Promise((resolve) => {
        console.log("No default custom actions")
        resolve()
      })
    }
  ) {
    try {
      // get the file extension from the path
      this.handleInputPath(path)
      console.log("createZipSync", this._cwd, this.fileExtension)

      return new Promise((resolve) => {
        // create an empty folder (temporary)
        createFolderSync(this._cwd).then(async () => {
          // add custom file/folder inside
          console.log("CUSTOM ACTIONS ")
          await customActions(this._cwd)
          await this.zipDirectory(this._cwd)
          resolve(this._cwd + this.fileExtension)
        })
      })
    } catch (err) {
      console.log(err)
    }
  }

  /**
   * Adds content to a zip file already existing
   * @param {string} path - path of the zip file to unzip
   * @param {function} customActions - custom actions to do on the unzipped folder before deleting it
   * @returns {void}
   */
  interactZipSync(
    path = "default",
    customActions = () => {
      console.log("No default custom actions")
      return null
    }
  ) {
    try {
      // get the file extension from the path
      this.handleInputPath(path)
      return new Promise((resolve, reject) => {
        try {
          // create an empty folder (temporary)
          fsPromises.mkdir(this._cwd, { recursive: true }).then(() => {
            // unzip the folder
            let extensionPath = this._cwd + this.fileExtension
            this.unzipDirectory(extensionPath, this._cwd)
              .then(async () => {
                customActions(this._cwd)
                  .then((returnValue) => {
                    this.zipDirectoryPromise(this._cwd)
                      .then(() => {
                        resolve(returnValue)
                      })
                      .catch((err) => {
                        reject(err)
                      })
                  })
                  .catch((err) => {
                    reject(err)
                  })
              })
              .catch((err) => {
                reject(err)
              })
          })
        } catch (err) {
          console.log(err)
          reject(err)
        }
      })
    } catch (err) {
      console.log(err)
    }
  }

  /**
   *
   * @param {string} inputPath - path of the zip file to unzip
   */
  handleInputPath(inputPath) {
    if (inputPath) {
      if (inputPath.includes(".")) {
        const inputFileExtension = "." + inputPath.split(".")[1]
        if (this.fileExtension !== "") {
          if (inputFileExtension !== this.fileExtension) {
            throw new Error(`The file extension was supposed to be ${this.fileExtension} but it was ${inputFileExtension}.`)
          }
        } else {
          this.fileExtension = inputFileExtension
        }
        this._cwd = inputPath.split(".")[0]
      } else if (inputPath !== "default") {
        this._cwd = inputPath
      } else {
        if (this._cwd === "") {
          throw new Error("The path is empty. Please provide a path.")
        }
      }
    }
  }

  /**
   * @param {String} sourceDir /some/folder/to/compress
   * @returns {Promise}
   */
  async zipDirectory(sourceDir) {
    try {
      let zipPath = sourceDir + ".zip"
      if (fs.existsSync(sourceDir)) {
        await zipper.sync.zip(sourceDir).compress().save(zipPath)
        await this.convertExtension(zipPath)
      } else {
        console.log("sourceDir does not exist")
      }
    } catch (err) {
      console.error(err)
    }
  }

  /**
   * Zip directory promise
   * @param {String} sourceDir /some/folder/to/compress
   * @returns {Promise}
   */
  zipDirectoryPromise(sourceDir) {
    return new Promise((resolve, reject) => {
      // Use the async method to zip the folder and convert the extension of the zip file
      if (fs.existsSync(sourceDir)) {
        zipper.zip(sourceDir, (err, zipped) => {
          if (!err) {
            zipped.save(sourceDir + ".zip", (error) => {
              if (error) {
                reject(error)
              } else {
                this.convertExtensionPromise(sourceDir + ".zip").then(() => {
                  resolve()
                })
              }
            })
          }
        })
      } else {
        toast.error("The folder does not exist: " + sourceDir)
      }
    })
  }

  /**
   *
   * @param {String} sourceDir /path/to/file.zip
   * @param {String} outPath /path/to/extracted/folder
   * @returns {Promise}
   */
  unzipDirectory(zipPath, folderPath) {
    return new Promise((resolve, reject) => {
      decompress(zipPath, folderPath)
        .then((files) => {
          resolve(files)
        })
        .catch((err) => {
          reject(err)
        })
    })
  }

  /**
   * Convert extension asynchronously
   * @param {String} zipPath /path/to/file.zip
   * @returns {Promise}
   */
  convertExtensionPromise(zipPath) {
    let extensionPath = zipPath.replace(".zip", this.fileExtension)
    let folderPath = zipPath.replace(".zip", "")

    return new Promise((resolve, reject) => {
      try {
        // rename the zip file to have the custom extension
        if (fs.existsSync(zipPath)) {
          fs.renameSync(zipPath, extensionPath)
        }
        if (fs.existsSync(folderPath)) {
          fs.rmdirSync(
            folderPath,
            {
              recursive: true
            },
            (error) => {
              if (error) {
                console.log({ ERROR: error })
              } else {
                resolve(extensionPath)
              }
            }
          )
        }
        resolve()
      } catch (err) {
        reject(err)
      }
    })
  }

  /**
   *
   * @param {String} zipPath /path/to/file.zip
   * @returns
   */
  convertExtension(zipPath) {
    let extensionPath = zipPath.replace(".zip", this.fileExtension)
    let folderPath = zipPath.replace(".zip", "")

    return new Promise((resolve, reject) => {
      try {
        // rename the zip file to have the custom extension

        if (fs.existsSync(extensionPath)) {
          fs.unlinkSync(extensionPath)
        }
        fs.renameSync(zipPath, extensionPath)
        if (fs.existsSync(folderPath)) {
          fs.rmdirSync(
            folderPath,
            {
              recursive: true
            },
            (error) => {
              if (error) {
                console.log({ ERROR: error })
              } else {
                resolve(extensionPath)
              }
            }
          )
        }
        resolve()
      } catch (err) {
        reject(err)
      }
    })
  }
}
