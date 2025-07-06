import { toast } from "react-toastify"
import process from "process"

const fs = require("fs")
const Path = require("path")
const { parse } = require("csv-parse")
// Replace danfojs imports with local implementation
const dfd = require("../utilities/danfo.js")
// Using the same implementation for both browser and Node environments
const dfdNode = require("../utilities/danfo.js")
var Papa = require("papaparse")
import { ipcRenderer } from "electron"

/**
 *
 * @param {string} path path to the file
 * @description This function takes a path, tells the main process to get the local path and returns the local path
 * @returns {Promise} Promise that resolves to the file content
 */
const toLocalPath = (path) => {
  return new Promise((resolve) => {
    ipcRenderer.send("get-file-path", path)
    ipcRenderer.on("get-file-path-reply", (event, filePath) => {
      resolve(`local://${filePath}`)
    })
  })
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
   * Creates a folder in the file system if it does not exist.
   * @param {string} path - The path of the folder to create.
   */
function createFolderFromPath(path) {
  if (!fs.existsSync(path)) {
    let test = fs.mkdirSync(path, { recursive: true })
    console.log("fileManagement createFolderFromPath Folder created at ", test)
  }
}

/**
 *
 * @param {Object} exportObj object to be exported
 * @param {String} exportName name of the exported file
 *
 * @description
 * This function takes an object and a name and downloads the object as a json file
 * It create a temporary anchor element to ask the user where to download the file
 */
const downloadFile = (exportObj, exportName) => {
  var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObj, null, 2))
  var downloadAnchorNode = document.createElement("a")
  downloadAnchorNode.setAttribute("href", dataStr)
  downloadAnchorNode.setAttribute("download", exportName)
  document.body.appendChild(downloadAnchorNode) // required for firefox
  downloadAnchorNode.click()
  downloadAnchorNode.remove()
}


/**
 * @description Fake download, only copy the file from the source to a destination set by the user in the dialog
 * @param {String} source Path to the file to be downloaded
 * @returns {Promise} Promise that resolves to the file content
 */
const downloadFilePath = (source) => {
  return new Promise((resolve) => {
    ipcRenderer.invoke("appCopyFile", source).then((destination) => {
      resolve(destination)
    }
    )})
}

/**
 *
 * @param {Object} exportObj object to be exported
 * @param {String} exportName name of the exported file
 *
 * @description
 * This function takes an object and a name and downloads the object as a json file
 * It create a temporary anchor element to ask the user where to download the file
 */
const downloadPath = (path) => {
  // var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObj, null, 2))
  loadFileFromPathSync(path).then((data) => {
    var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2))
    var downloadAnchorNode = document.createElement("a")
    downloadAnchorNode.setAttribute("href", dataStr)
    downloadAnchorNode.setAttribute("download", Path.split("/").pop().split("\\").pop())
    document.body.appendChild(downloadAnchorNode) // required for firefox
    downloadAnchorNode.click()
    downloadAnchorNode.remove()
  })
}

/**
 *
 * @param {string} path path to the file
 * @returns {Promise} Promise that resolves to the file content
 */
const loadFileFromPathSync = (path) => {
  return new Promise((resolve) => {
    fs.readFile(path, "utf8", (err, data) => {
      if (err) {
        console.error("Error reading file:", err)
      } else {
        console.log("File read successfully", data)
        let parseFile = JSON.parse(data)
        resolve(parseFile)
      }
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
 */
const writeFile = (exportObj, path, name, extension) => {
  extension ? (extension = extension.replace(".", "")).toLowerCase() : (extension = "json")
  const cwd = process.cwd()
  let cwdSlashType = cwd.includes("/") ? "/" : "\\"
  console.log("writing json file: " + path + cwdSlashType + name + "." + extension)
  fs.writeFile(path + cwdSlashType + name + "." + extension, JSON.stringify(exportObj, null, 2), function (err) {
    if (err) {
      return console.log(err)
    }
    console.log("The file was saved!")
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
 */
const writeJson = (exportObj, path, name, extension = "json") => {
  extension = extension.replace(".", "").toLowerCase()
  let writePath = Path.join(path, name + "." + extension)
  console.log("writing json file:", writePath)
  fs.writeFile(writePath, JSON.stringify(exportObj, null, 2), function (err) {
    if (err) {
      return console.log(err)
    }
    console.log("The file was saved!")
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
 */
const writeJsonSync = (exportObj, path, name, extension = "json") => {
  return new Promise((resolve, reject) => {
    try {
      extension = extension.replace(".", "").toLowerCase()
      let writePath = Path.join(path, name + "." + extension)
      console.log("writing json file:", writePath)
      fs.writeFile(writePath, JSON.stringify(exportObj, null, 2), function (err) {
        if (err) {
          return console.log(err)
        }
        console.log("The file was saved!")
        resolve(writePath)
      })
    } catch (error) {
      toast.error("Error writing file: " + path + "\n" + error + "\n")
      reject(error)
    }
  })
}

/**
 *
 * @description
 * This function opens a file dialog and returns the selected json file
 */
const loadJson = () => {
  let jsonFile
  let input = document.createElement("input")
  input.type = "file"
  input.onchange = function () {
    var reader = new FileReader()
    reader.onload = onReaderLoad
    reader.readAsText(event.target.files[0])
  }
  function onReaderLoad(event) {
    jsonFile = JSON.parse(event.target.result)
    console.log(jsonFile)

    return jsonFile
  }
  input.click()
}

/**
 *
 * @returns {Promise} Promise that resolves to the selected json file
 *
 * @description
 * This function opens a file dialog and returns the selected json file
 */
const loadJsonSync = () => {
  return new Promise((resolve) => {
    let input = document.createElement("input")
    input.type = "file"
    input.onchange = function () {
      var reader = new FileReader()
      reader.onload = function (event) {
        const jsonFile = JSON.parse(event.target.result)
        console.log(jsonFile)
        resolve(jsonFile) // Resolve the Promise with the parsed JSON object
      }
      reader.readAsText(event.target.files[0])
    }
    input.click()
  })
}

/**
 * @param {String} path
 * @returns {Object} json object
 * @description
 * This function takes a path and returns the json object
 */
const loadJsonPath = (absPath) => {
  const fs = require("fs")
  if (absPath == "") {
    console.log("path empty")
    return null
  }
  try {
    console.log("reading json file: " + absPath)
    const data = fs.readFileSync(absPath)
    const jsonData = JSON.parse(data)
    return jsonData
  } catch (error) {
    console.log("error reading json file: " + absPath + "\n" + error + "\n")
    return null
  }
}

/**
 * @param {String} path
 * @returns {Object} json object
 * @description
 * This function takes a path and returns the json object
 */
const loadCSVPath = (absPath, whenLoaded) => {
  const data = []
  console.log("reading csv file: " + absPath)
  try {
    fs.createReadStream(absPath)
      .pipe(
        parse({
          delimiter: ",",
          columns: true,
          ltrim: true
        })
      )
      .on("data", function (row) {
        // This will push the object row into the array
        data.push(row)
      })
      .on("error", function (error) {
        console.log(error.message)
      })
      .on("end", function () {
        whenLoaded(data)
      })
  } catch (error) {
    toast.warn("Having trouble reading the CSV file, trying another method...")
  }
}

/**
 * @description This function loads a CSV file from a given path
 * @param {String} path Path to the CSV file
 * @param {Function} whenLoaded Callback function that will be called when the CSV file is loaded
 * @returns {void}
 */
const loadCSVFromPath = (path, whenLoaded) => {
  let csvPath = path
  dfdNode
    .readCSV(csvPath)
    .then((df) => {
      if (df.$columns[df.$columns.length - 1] == "__parsed_extra" && df.$dtypes[df.$dtypes.length - 2] == "string") {
        let lastCol = df.$columns[df.$columns.length - 1]
        let beforeLastCol = df.$columns[df.$columns.length - 2]
        df.addColumn(
          beforeLastCol,
          df[beforeLastCol].apply((val, i) => (df.$data[i] && df.$data[i][df.$columns.length - 1] ? val + df.$data[i][df.$columns.length - 1] : val)),
          { inplace: true }
        )
        df.drop({ columns: [lastCol], inplace: true })
      }
      let dfJSON = dfd.toJSON(df)
      whenLoaded(dfJSON)
    })
    .catch((err) => {
      console.log(err)
    })
}

/**
 * Check if the last rows of the dataframe are empty or undefined, and if so, remove them
 * @param {Object} df dataframe
 * @param {Number} numberOfRowToCheck number of rows to check
 * @returns {Array} array of index to drop
 */
const removeEmptyRows = (df, numberOfRowToCheck) => {
  let dfLastRows = df.tail(numberOfRowToCheck)
  let dfColumnCount = df.$columns.length
  let indexToDrop = []
  let rowCounts = dfLastRows.count()
  rowCounts.values.forEach((rowCount, index) => {
    if (rowCount <= 1) {
      indexToDrop.push(rowCounts.$index[index])
    }
  })
  return { index: indexToDrop, inplace: true }
}

/**
 * @param {string} path_ path to the file
 * @param {string} folderName name of the folder to create
 */
function createFolder(path_, folderName) {
  // Creates a folder in the working directory
  const folderPath = Path.join(path_, folderName)

  fs.mkdir(folderPath, { recursive: true }, (err) => {
    if (err) {
      console.error(err)
      return
    }

    console.log("Folder created successfully!")
  })
}

/**
 *
 * @param {string} pathToCreate string path to create
 * @returns {Promise} Promise that resolves to the path created
 */
const createFolderSync = (pathToCreate) => {
  const fsPromises = require("fs").promises
  return new Promise((resolve) => {
    fsPromises
      .mkdir(pathToCreate, { recursive: true })
      .then(function () {
        console.log("directory created successfully")
        resolve(pathToCreate)
      })
      .catch(function () {
        console.error("failed to create directory")
      })
  })
}

/**
 * @description This function loads a JSON file from a given path
 * @param {String} path Path to the JSON file
 * @param {Function} whenLoaded Callback function that will be called when the JSON file is loaded
 * @returns {void}
 */
const loadJSONFromPath = (path, whenLoaded) => {
  let jsonPath = path
  fs.readFile(jsonPath, "utf8", (err, data) => {
    if (err) {
      console.error("Error reading file:", err)
    } else {
      console.log("File read successfully")
      let result = JSON.parse(data)
      let df = new dfd.DataFrame(result)
      df.drop(removeEmptyRows(df, 5))
      let dfJSON = dfd.toJSON(df)
      console.log("DFJSON", dfJSON)
      whenLoaded(dfJSON)
    }
  })
}

/**
 * @description This function loads a XLSX file from a given path
 * @param {String} path Path to the XLSX file
 * @param {Function} whenLoaded Callback function that will be called when the XLSX file is loaded
 * @returns {void}
 */
const loadXLSXFromPath = async (filePath, whenLoaded) => {
  let jsonPath = filePath
  let finalPath = Path.join(jsonPath)
  console.log("path", finalPath)
  let df = await dfdNode.readExcel(jsonPath)
  console.log("File read successfully")
  df.drop(removeEmptyRows(df, 5))
  let dfJSON = dfd.toJSON(df)
  whenLoaded(dfJSON)
}

/**
 * @description This Object get the reading method from the file extension
 */
const getFileReadingMethodFromExtension = {
  json: (path) => loadJsonPath(path),
  csv: (path, whenLoaded) => loadCSVPath(path, whenLoaded),
  xlsx: (path, whenLoaded) => loadXLSXFromPath(path, whenLoaded)
}

export {
  getPathSeparator,
  splitStringAtTheLastSeparator,
  createFolderFromPath,
  toLocalPath,
  downloadFile,
  downloadPath,
  downloadFilePath,
  loadFileFromPathSync,
  writeFile,
  writeJson,
  writeJsonSync,
  loadJson,
  loadJsonSync,
  loadJsonPath,
  loadCSVPath,
  loadCSVFromPath,
  createFolder,
  createFolderSync,
  loadJSONFromPath,
  loadXLSXFromPath,
  getFileReadingMethodFromExtension
}
