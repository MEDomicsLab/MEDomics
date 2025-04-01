import { Card } from "primereact/card"
import { Dropdown } from "primereact/dropdown"
import { Panel } from "primereact/panel"
import { useContext, useEffect, useState } from "react"
import MEDprofilesPrepareData from "../input/MEDprofiles/MEDprofilesPrepareData"
import ModulePage from "../mainPages/moduleBasics/modulePage"
import { DataContext } from "../workspace/dataContext"
import BasicToolsDB from "./inputToolsDB/basicToolsDB"
import DropDuplicatesToolsDB from "./inputToolsDB/dropDuplicatesToolsDB"
import FeatureReductionToolsDB from "./inputToolsDB/featureReductionToolsDB/featureReductionToolsDB"
import GroupingTaggingToolsDB from "./inputToolsDB/groupingTaggingToolsDB"
import HoldoutSetCreationToolsDB from "./inputToolsDB/holdoutSetCreationToolsDB"
import MergeToolsDB from "./inputToolsDB/mergeToolsDB"
import SimpleCleaningToolsDB from "./inputToolsDB/simpleCleaningToolsDB"
import SubsetCreationToolsDB from "./inputToolsDB/subsetCreationToolsDB"
import TransformColumnToolsDB from "./inputToolsDB/transformColumnToolsDB"
import { getCollectionData } from "./utils"
import { shell } from "electron"
/**
 * @description
 * This component provides calls all the other components to build the input tools.
 * @param {Object} props
 * @param {Object} props.data - Data object
 * @param {Object[]} props.exportOptions - Export options
 * @param {Function} props.refreshData - Function to refresh the data
 * @param {Object[]} props.columns - Columns
 * @param {Function} props.transformData - Function to transform the data
 * @param {Object[]} props.innerData - Inner data
 * @param {Object} props.lastEdit - Last edit
 */
const InputToolsComponent = ({ data, exportOptions, refreshData, columns, transformData, innerData, lastEdit }) => {
  const { globalData } = useContext(DataContext) // We get the global data from the context
  const [altData, setAltData] = useState(data)
  const [altColumns, setAltColumns] = useState(columns)
  const panelContainerStyle = {
    height: "100%",
    overflow: "auto"
  }
  exportOptions = [
    {
      label: "CSV",
      command: () => {
        // handleExport is undefined here @MahdiAll99
        // eslint-disable-next-line no-undef
        handleExport("CSV")
      }
    },
    {
      label: "JSON",
      command: () => {
        // handleExport is undefined here @MahdiAll99
        // eslint-disable-next-line no-undef
        handleExport("JSON")
      }
    }
  ]

  // Fetch data from MongoDB on component mount
  useEffect(() => {
    if (altData && altData.id && !innerData) {
      getCollectionData(altData.id)
        .then((fetchedData) => {
          console.log("Fetched data:", fetchedData)
          let collData = fetchedData.map((item) => {
            let keys = Object.keys(item)
            let values = Object.values(item)
            let dataObject = {}
            for (let i = 0; i < keys.length; i++) {
              dataObject[keys[i]] = keys[i] === "_id" ? item[keys[i]].toString() : values[i]
            }
            return dataObject
          })
          if (collData && collData.length > 0 && !columns) {
            const allKeys = new Set()
            collData.forEach((item) => {
              Object.keys(item).forEach((key) => allKeys.add(key))
            })
            const keys = Array.from(allKeys).filter((key) => key !== "_id")
            columns = keys.map((key) => ({ field: key, header: key }))
            setAltColumns(columns)
          }
        })
        .catch((error) => {
          console.error("Failed to fetch data:", error)
        })
    } else {
      console.warn("Invalid data prop:", altData)
    }
  }, [altData])

  const selectedCSVFiles = Object.values(globalData).filter((item) => item.type === "csv")

  return (
    <div style={panelContainerStyle}>
      <div style={{ textAlign: "center", marginTop: "20px", marginBottom: "20px" }}>
        <h1>Database Input Tools</h1>
        <div style={{ textAlign: "center", marginBottom: "20px", maxWidth: "800px", margin: "0 auto" }}>
        <p>
          This module provides essential tools for preprocessing and structuring datasets 
          before machine learning. It allows users to clean, transform, and organize data efficiently.
        </p>
        <p className="gitbook-link">
          📖 Learn how to use these tools in our
          <u
            onClick={() => shell.openExternal("https://medomics-udes.gitbook.io/medomicslab-docs/tutorials/design/input-module")}
            style={{ color: "#0056b3", textDecoration: "none", cursor: "pointer" }}
          > documentation. 🔗
          </u>
        </p>

      </div>

      </div>
      {!data ? (
        <Card
          className="cute-box"
          title="Select a CSV to get started"
          style={{
            marginTop: "10px",
            backgroundColor: "#cfcfcfa4"
          }}
        >
          <Dropdown
            filter
            style={{ maxWidth: "300px" }}
            value={altData}
            onChange={(e) => setAltData(e.value)}
            options={selectedCSVFiles}
            optionLabel="name"
            className="w-full md:w-14rem margintop8px"
            display="chip"
            placeholder="Select CSV files"
          />
        </Card>
      ) : null}
      {!altData ? (
        <></>
      ) : (
        <>
          <Panel header="Basic Tools" toggleable collapsed={true}>
            <BasicToolsDB exportOptions={exportOptions} refreshData={refreshData} currentCollection={!altData ? null : altData.id} />
          </Panel>
          <Panel header="Drop Duplicates Tools" toggleable collapsed={true}>
            <DropDuplicatesToolsDB exportOptions={exportOptions} currentCollection={!altData ? null : altData.id} />
          </Panel>
          <Panel header="Transform Column Tools" toggleable collapsed={true}>
            <TransformColumnToolsDB columns={columns} transformData={transformData} currentCollection={!altData ? null : altData.id} refreshData={refreshData} />
          </Panel>
          <Panel header="Merge Tools" toggleable collapsed={true}>
            <MergeToolsDB refreshData={refreshData} currentCollection={!altData ? null : altData.id} />
          </Panel>
          <Panel header="Simple Cleaning Tools" toggleable collapsed={true}>
            <SimpleCleaningToolsDB refreshData={refreshData} lastEdit={lastEdit} data={altData} columns={altColumns} currentCollection={!altData ? null : altData.id} />
          </Panel>
          <Panel header="Holdout Set Creation Tools" toggleable collapsed={true}>
            <HoldoutSetCreationToolsDB refreshData={refreshData} data={altData} currentCollection={!altData ? null : altData.id} />
          </Panel>
          <Panel header="Sample | Row Grouping Tools" toggleable collapsed={true}>
            <SubsetCreationToolsDB currentCollection={!altData ? null : altData.id} data={altData} refreshData={refreshData} />
          </Panel>
          <Panel header="Feature | Column Tagging Tools" toggleable collapsed={true}>
            <GroupingTaggingToolsDB refreshData={refreshData} />
          </Panel>
          <Panel header="Feature Reduction Tools" toggleable collapsed={true}>
            <FeatureReductionToolsDB data={altData} refreshData={refreshData} />
          </Panel>
          <Panel header="MEDprofiles" toggleable collapsed={true}>
            <ModulePage>
              <MEDprofilesPrepareData />
            </ModulePage>
          </Panel>
        </>
      )}
    </div>
  )
}

export default InputToolsComponent
