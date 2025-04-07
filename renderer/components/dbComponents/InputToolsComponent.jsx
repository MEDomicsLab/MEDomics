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
import ConvertCategoricalColumnIntoNumericDB from "./inputToolsDB/convertCategoricalColumnIntoNumericDB"
import GroupingTaggingToolsDB from "./inputToolsDB/groupingTaggingToolsDB"
import HoldoutSetCreationToolsDB from "./inputToolsDB/holdoutSetCreationToolsDB"
import MergeToolsDB from "./inputToolsDB/mergeToolsDB"
import SimpleCleaningToolsDB from "./inputToolsDB/simpleCleaningToolsDB"
import SubsetCreationToolsDB from "./inputToolsDB/subsetCreationToolsDB"
import TransformColumnToolsDB from "./inputToolsDB/transformColumnToolsDB"
import { getCollectionSize } from "../mongoDB/mongoDBUtils.js"

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
const InputToolsComponent = ({ exportOptions }) => {
  const { globalData } = useContext(DataContext) // We get the global data from the context
  const [collectionId, setCollectionId] = useState(null)
  const [collectionSize, setCollectionSize] = useState(0)
  const panelContainerStyle = {
    height: "100%",
    overflow: "auto"
  }

  const selectedCSVFiles = Object.values(globalData).filter((item) => item.type === "csv")

  // console the id of the selected collection
  useEffect(() => {
    console.log("globalData", globalData)
  }, [globalData])

  // console log the collectionId
  useEffect(() => {
    console.log("collectionId", collectionId)
  }, [collectionId])

  useEffect(() => {
    if (collectionId) {
      const fetchCollectionSize = async () => {
        const size = await getCollectionSize(collectionId)
        setCollectionSize(size)
      }
      fetchCollectionSize()
    }
  }, [collectionId])

  useEffect(() => {
    console.log("size", collectionSize)
  }, [collectionSize])

  return (
    <div style={panelContainerStyle}>
      <div style={{ textAlign: "center", marginTop: "20px", marginBottom: "20px" }}>
        <h1>Database Input Tools</h1>
      </div>
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
          value={selectedCSVFiles.find((item) => item.id === collectionId)}
          onChange={(e) => setCollectionId(e.value.id)}
          options={selectedCSVFiles}
          optionLabel="name"
          className="w-full md:w-14rem margintop8px"
          display="chip"
          placeholder="Select CSV files"
        />
      </Card>
      {!collectionId ? (
        <></>
      ) : (
        <>
          <Panel header="Basic Tools" toggleable collapsed={true}>
            <BasicToolsDB collectionSize={collectionSize} currentCollection={!collectionId ? null : collectionId} />
          </Panel>
          <Panel header="Convert Categorical Column Into Numeric" toggleable collapsed={true}>
            <ConvertCategoricalColumnIntoNumericDB exportOptions={exportOptions} currentCollection={!collectionId ? null : collectionId} />
          </Panel>
          <Panel header="Drop Duplicates Tools" toggleable collapsed={true}>
            <DropDuplicatesToolsDB exportOptions={exportOptions} currentCollection={!collectionId ? null : collectionId} />
          </Panel>
          <Panel header="Transform Column Tools" toggleable collapsed={true}>
            <TransformColumnToolsDB currentCollection={!collectionId ? null : collectionId} />
          </Panel>
          <Panel header="Merge Tools" toggleable collapsed={true}>
            <MergeToolsDB currentCollection={!collectionId ? null : collectionId} />
          </Panel>
          <Panel header="Simple Cleaning Tools" toggleable collapsed={true}>
            <SimpleCleaningToolsDB currentCollection={!collectionId ? null : collectionId} />
          </Panel>
          <Panel header="Holdout Set Creation Tools" toggleable collapsed={true}>
            <HoldoutSetCreationToolsDB currentCollection={!collectionId ? null : collectionId} />
          </Panel>
          <Panel header="Sample | Row Grouping Tools" toggleable collapsed={true}>
            <SubsetCreationToolsDB currentCollection={!collectionId ? null : collectionId} />
          </Panel>
          <Panel header="Feature | Column Tagging Tools" toggleable collapsed={true}>
            <GroupingTaggingToolsDB />
          </Panel>
          <Panel header="Feature Reduction Tools" toggleable collapsed={true}>
            <FeatureReductionToolsDB currentCollection={!collectionId ? null : collectionId} />
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
