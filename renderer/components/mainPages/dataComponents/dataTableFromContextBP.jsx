import React, { useContext, useState, useEffect } from "react"
import { DataContext } from "../../workspace/dataContext"
import { DataTableWrapperBPClass } from "../../dataTypeVisualisation/dataTableWrapperBPClass"
import * as dfd from "../../../utilities/danfo.js"
import { toast } from "react-toastify"
import fs from "fs"
import Papa from "papaparse"

/**
 * @description - This component is the dataset selector component that will show the datasets available in the workspace
 * @returns the dataset selector component
 * @param {Object} props - The props object
 *  @param {Object} props.keepOnlyFolder - The only parent folder to keep in the dataset selector
 */
const DataTableFromContextBP = (MedDataObject, tablePropsData) => {
  console.log("MedDataObject", MedDataObject)
  const { globalData, setGlobalData } = useContext(DataContext) // We get the global data from the context to retrieve the directory tree of the workspace, thus retrieving the data files
  let datasetObject = MedDataObject["MedDataObject"]
  const [isLoaded, setIsLoaded] = useState(MedDataObject.isLoaded ? MedDataObject.isLoaded : false)

  const [dataset, setDataset] = useState(MedDataObject.isLoaded ? MedDataObject.isLoaded : false)

  useEffect(() => {
    if (datasetObject !== undefined && datasetObject !== null) {
      if (isLoaded) {
        console.log("was already loaded")
      } else {
        if (globalData !== undefined) {
          let extension = datasetObject.extension
          console.log("extension", extension)
          if (extension == "csv") {
            let csvPath = datasetObject.path
            fs.readFile(csvPath, "utf8", (err, data) => {
              if (err) {
                console.error("Error reading file:", err)
              } else {
                console.log("File read successfully")
                let array = []
                Papa.parse(data, {
                  step: function (row) {
                    array.push(row.data)
                  }
                })
                let columns = array.shift()
                let df = new dfd.DataFrame(array, { columns: columns })
                let dfJSON = dfd.toJSON(df)
                setDataset(dfJSON)
                let globalDataCopy = { ...globalData }
                globalDataCopy[datasetObject.getUUID()].data = dfJSON
                globalDataCopy[datasetObject.getUUID()].isLoaded = true
                setGlobalData(globalDataCopy)
                setIsLoaded(true)
              }
            })
          } else if (extension == "xlsx") {
            toast.error("XLSX data not supported yet")
          } else if (extension == "json") {
            let jsonPath = datasetObject.path
            fs.readFile(jsonPath, "utf8", (err, data) => {
              if (err) {
                console.error("Error reading file:", err)
              } else {
                console.log("File read successfully")
                let result = JSON.parse(data)

                let df = new dfd.DataFrame(result)
                let dfJSON = dfd.toJSON(df)
                setDataset(dfJSON)
                let globalDataCopy = { ...globalData }
                globalDataCopy[datasetObject.getUUID()].data = dfJSON
                globalDataCopy[datasetObject.getUUID()].isLoaded = true
                setGlobalData(globalDataCopy)
                setIsLoaded(true)
              }
            })
          } else {
            toast.error("File type not supported")
          }
        }
      }
    }
  }, [isLoaded, datasetObject])

  useEffect(() => {
    console.log("dataset", dataset)
  }, [dataset])

  return <>{dataset && <DataTableWrapperBPClass data={dataset} tablePropsData={tablePropsData} />}</>
}

export default DataTableFromContextBP
