import MedDataObject from "../workspace/medDataObject"

const dfd = require("danfojs")

/**
 * Clean the dataset
 * @param {DanfoJS.DataFrame} data - The data
 * @returns {DanfoJS.DataFrame} - The cleaned dataset
 */
const cleanDataset = (data) => {
  if (data === null || data === undefined) {
    return null
  }

  let newData = {}
  let cleanedColumnNames = []
  data.columns.forEach((column) => {
    cleanedColumnNames.push(cleanString(column))
  })

  data.getColumnData.forEach((column, index) => {
    let newColumn = []
    column.forEach((value) => {
      if (typeof value === "string") {
        value = value.replace(/\s+/g, " ")
        value = value.replace(/^[ '"]+|[ '"]+$|( ){2,}/g, "$1")
      }
      newColumn.push(value)
    })
    newData[cleanedColumnNames[index]] = newColumn
  })
  let df = new dfd.DataFrame(newData)
  return df
}

/**
 * This function is used to clean a string
 * @param {string} string - The string to clean
 * @returns the cleaned string
 * @summary This function is used to clean a string from spaces and quotes
 */
const cleanString = (string) => {
  if (string.includes(" ") || string.includes('"')) {
    string = string.replaceAll(" ", "")
    string = string.replaceAll('"', "")
  }
  return string
}

/**
 * Generates a header element for a selected column.
 * @param {string} string - The name of the column.
 * @param {string[]} selectedColumnsOptions - An array of selected column names.
 * @returns {React.ReactNode} - The generated header element.
 */
function generateHeader(string, selectedColumnsOptions) {
  let style = selectedColumnsOptions.includes(string) ? { display: "flex", alignSelf: "center" } : { display: "flex", alignSelf: "center", color: "var(--text-color-secondary)" }
  let header = (
    <div className="flex align-items-center" style={style}>
      {/* <label htmlFor={string} className="p-checkbox-label" style={{ marginLeft: "0.5rem" }}> */}
      {string[0].toUpperCase() + string.slice(1)}
      {/* </label> */}
    </div>
  )

  return header
}

/**
 * Get the data type of a column based on the column's name and its corresponding types.
 * @param {string} column - The name of the column.
 * @param {Object} columnTypes - An object containing column names as keys and their data types as values.
 * @returns {string} - The data type of the column ("numeric", "text", "category", "boolean").
 */
function getColumnDataType(column, columnTypes) {
  if (columnTypes[column] === "int32" || columnTypes[column] === "float32") {
    return "numeric"
  } else if (columnTypes[column] === "string") {
    return "text"
  } else if (columnTypes[column] === "category") {
    return "category"
  } else if (columnTypes[column] === "bool") {
    return "boolean"
  }
}

/**
 * To get the data
 * @returns {Promise} - The promise of the data
 */
const getData = (selectedDataset) => {
  return new Promise((resolve) => {
    let data = selectedDataset.loadDataFromDisk()
    resolve(data)
  })
}

/**
 * Get the options configuration for a column based on its data type.
 * @param {string} column - The name of the column.
 * @param {Object} columnTypes - An object containing column names as keys and their data types as values.
 * @returns {Object} - An object containing options configuration for the column.
 */
const getColumnOptions = (column, columnTypes) => {
  let optionsToReturn = { showFilterMatchModes: true, showFilterMenu: true }
  if (columnTypes[column] === "category") {
    optionsToReturn.showFilterMatchModes = false
    optionsToReturn.showFilterMenu = true
  }
  return optionsToReturn
}

/**
 * To get the parent ID folder path
 * @param {Object} dataset - The dataset
 * @param {DataContext} globalData - The DataContext
 * @returns {String} - The parent ID folder path with a trailing separator
 */
const getParentIDfolderPath = (dataset, globalData) => {
  let parentID = dataset.parentID
  let parentPath = globalData[parentID].path
  let separator = MedDataObject.getPathSeparator()
  return parentPath + separator
}

/**
 * To handle the change in the selected dataset, and update the columns options
 * @param {Object} e - The event object
 * @returns {Void}
 */
const handleSelectedDatasetChange = async (e, setSelectedDataset, globalData) => {
  setSelectedDataset(globalData[e.target.value])
}

/**
 * Update the list of datasets based on the global data and selected dataset.
 * @param {Object} globalData - An object containing global data with dataset information.
 * @param {Object} selectedDataset - The currently selected dataset.
 * @param {Function} setListOfDatasets - A function to update the list of datasets.
 * @param {Function} setSelectedDataset - A function to set the selected dataset.
 * @returns {void}
 */
const updateListOfDatasets = (globalData, selectedDataset, setListOfDatasets, setSelectedDataset) => {
  let newDatasetList = []
  let isSelectedDatasetInList = false
  Object.keys(globalData).forEach((key) => {
    if (globalData[key].extension === "csv") {
      newDatasetList.push({ name: globalData[key].name, nameWithoutExtension: globalData[key].nameWithoutExtension, object: globalData[key], key: key })
      if (selectedDataset && selectedDataset.name == globalData[key].name) {
        isSelectedDatasetInList = true
      }
    }
  })
  setListOfDatasets(newDatasetList)
  if (!isSelectedDatasetInList) {
    setSelectedDataset(null)
  }
}

/**
 * Update the column types based on the DataFrame and set the updated column types.
 * @param {Object} df - The DataFrame object containing data and column information.
 * @param {Function} setColumnTypes - A function to set the updated column types.
 * @returns {void}
 */
const updateTheColumnsTypes = (df, setColumnTypes) => {
  if (df !== null && df !== undefined) {
    let newColumnTypes = {}
    df.ctypes.$data.forEach((type, index) => {
      if (df.nUnique(0).$data[index] < 10) {
        // If the number of unique values is less than 10, then it is a category
        type = "category"
      }
      newColumnTypes[df.columns[index]] = type
    })
    setColumnTypes(newColumnTypes)
  }
}

export { cleanDataset, cleanString, generateHeader, getColumnDataType, getData, getColumnOptions, getParentIDfolderPath, handleSelectedDatasetChange, updateListOfDatasets, updateTheColumnsTypes }
