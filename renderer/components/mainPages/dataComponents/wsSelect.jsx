import React, { useState, useEffect, useContext } from "react"
import { DataContext } from "../../workspace/dataContext"
import { Form } from "react-bootstrap"

/**
 * @typedef {React.FunctionComponent} WsSelect
 * @description This component is used to select a data file from the workspace (DataContext). The data file is then used in the flow.
 * @params props.selectedPath - The path of the selected data file
 * @params props.onChange - The function to call when the selected data file changes
 * @params props.name - The name of the component
 */
const WsSelect = ({ selectedPath, onChange, rootDir, acceptFolder = false, acceptedExtensions = ["all"], disabled }) => {
  const { globalData } = useContext(DataContext) // We get the global data from the context to retrieve the directory tree of the workspace, thus retrieving the data files
  const [datasetList, setDatasetList] = useState([])

  /**
   * @description This useEffect is used to generate the dataset list from the global data context if it's defined
   * @returns {void} calls the generateDatasetListFromDataContext function
   */
  useEffect(() => {
    if (globalData !== undefined) {
      let ids = Object.keys(globalData)

      let datasetListToShow = [{ name: "No selection", id: "", isFolder: false, default: true }]
      ids.forEach((id) => {
        // in this case, we want to show only the files in the selected root directory
        if (rootDir != undefined) {
          if (globalData[globalData[id].parentID]) {
            if (globalData[globalData[id].parentID].name == rootDir) {
              if (!(!acceptFolder && globalData[id].type == "directory")) {
                if (acceptedExtensions.includes("all") || acceptedExtensions.includes(globalData[id].type)) {
                  datasetListToShow.push({ name: globalData[id].name, id: id, isFolder: globalData[id].type == "directory", default: false })
                }
              }
            }
          }
          // else, we want to add any file (or folder) from acceptedExtensions
        } else {
          if (acceptedExtensions.includes(globalData[id].type) || acceptedExtensions.includes("all")) {
            datasetListToShow.push({ name: globalData[id].name, id: id, isFolder: globalData[id].type == "directory", default: false })
          }
        }
      })
      setDatasetList(datasetListToShow)
    }
  }, [globalData])

  return (
    <>
      {
        <Form.Select disabled={disabled} value={selectedPath} onChange={(e) => onChange(e)}>
          {datasetList.map((dataset) => {
            return (
              <option key={dataset.id} value={dataset.id}>
                {dataset.isFolder ? "📁 " : dataset.default ? "❌ " : "📄 "}
                {dataset.name}
              </option>
            )
          })}
        </Form.Select>
      }
    </>
  )
}

export default WsSelect
