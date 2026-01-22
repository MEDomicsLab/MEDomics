import React, { useContext, useState, useEffect } from "react"
import { DataContext } from "../../workspace/dataContext"
import DataTableWrapper from "../../dataTypeVisualisation/dataTableWrapper"
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
const DataTableFromContext = ({ MedDataObject, tablePropsData, tablePropsColumn, isDatasetLoaded, setIsDatasetLoaded }) => {
  const { globalData, setGlobalData, copyGlobalDataSync } = useContext(DataContext) // We get the global data from the context to retrieve the directory tree of the workspace, thus retrieving the data files
  const [isLoaded, setIsLoaded] = useState(MedDataObject.isLoaded ? MedDataObject.isLoaded : false)

  const [dataset, setDataset] = useState(MedDataObject.isLoaded ? MedDataObject.data : false)

  useEffect(() => {
    if (MedDataObject !== undefined && MedDataObject !== null && MedDataObject.getUUID !== undefined) {
      if (isLoaded && MedDataObject.data && isDatasetLoaded != undefined && isDatasetLoaded == true) {
        console.log("was already loaded")
      } else {
        if (globalData !== undefined) {
          let extension = MedDataObject.extension
          if (extension == "csv") {
            let csvPath = MedDataObject.path
            fs.readFile(csvPath, "utf8", (err, data) => {
              if (err) {
                console.error("Error reading file:", err)
              } else {
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
                copyGlobalDataSync().then((globalDataCopy) => {
                  globalDataCopy[MedDataObject.getUUID()].data = dfJSON
                  globalDataCopy[MedDataObject.getUUID()].isLoaded = true
                  setGlobalData(globalDataCopy)
                  setIsLoaded(true)
                  if (setIsDatasetLoaded != undefined) {
                    setIsDatasetLoaded(true)
                  }
                })
              }
            })
          } else if (extension == "xlsx") {
            toast.error("XLSX data not supported yet")
          } else if (extension == "json") {
            toast.error("JSON data not supported yet")
          } else {
            toast.error("File type not supported")
          }
        }
      }
    }
  }, [isLoaded, MedDataObject, isDatasetLoaded])

  return <>{dataset && <DataTableWrapper data={dataset} tablePropsData={tablePropsData} tablePropsColumn={tablePropsColumn} />}</>
}

export default DataTableFromContext
