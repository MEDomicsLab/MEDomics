import { randomUUID } from "crypto"
import { Button } from "primereact/button"
import { Dropdown } from "primereact/dropdown"
import { Message } from "primereact/message"
import { MultiSelect } from "primereact/multiselect"
import React, { useContext, useEffect, useState } from "react"
import { toast } from "react-toastify"
import { requestBackend } from "../../../utilities/requests"
import { insertMEDDataObjectIfNotExists } from "../../mongoDB/mongoDBUtils"
import { ServerConnectionContext } from "../../serverConnection/connectionContext"
import { DataContext } from "../../workspace/dataContext"
import { MEDDataObject } from "../../workspace/NewMedDataObject"
import { getCollectionColumns } from "../../mongoDB/mongoDBUtils" // Updated import

/**
 * @description MergeToolsDB component
 * This component provides tools to merge two collections in a database.
 * @param {[collections]} - Array of collections
 * @param {currentCollection} - Current collection
 */
const MergeToolsDB = ({ currentCollection }) => {
  const { globalData } = useContext(DataContext)
  const [selectedCollections, setSelectedCollections] = useState([currentCollection])
  const [selectedColumns, setSelectedColumns] = useState([])
  const [collectionColumns, setCollectionColumns] = useState([])
  const [selectedMergeType, setSelectedMergeType] = useState("")
  const [options, setOptions] = useState([])
  const [loading, setLoading] = useState(false)
  const { port } = useContext(ServerConnectionContext)
  const mergeTypes = [
    { value: "left", label: "Left" },
    { value: "right", label: "Right" },
    { value: "inner", label: "Inner" },
    { value: "outer", label: "Outer" },
    { value: "cross", label: "Cross" }
  ]

  // This useEffect is used to fetch the collections and columns from the database to display in the MultiSelect dropdowns
  useEffect(() => {
    const fetchData = async () => {
      try {
        const allEntries = Object.values(globalData)
        const csvEntries = allEntries.filter((entry) => entry.type === "csv")
        const newOptions = csvEntries.map(({ id, name }) => ({
          label: name,
          value: id
        }))
        setOptions(newOptions)

        if (selectedCollections.length === 2) {
          const columns1 = await getCollectionColumns(selectedCollections[0])
          const columns2 = await getCollectionColumns(selectedCollections[1])
          const matchingColumns = columns1.filter((column) => columns2.includes(column) && column !== "_id")
          setCollectionColumns(matchingColumns)
          if (matchingColumns.length === 0) {
            setSelectedColumns([])
          }
        }
      } catch (error) {
        console.error("Failed to fetch collection data:", error)
        toast.error("Failed to fetch collection data.")
      }
    }
    fetchData()
  }, [globalData, selectedCollections])

  // This function is called when the user selects a collection in the MultiSelect dropdown
  const handleSelectChange = (newSelection) => {
    if (newSelection.length < selectedCollections.length) {
      setCollectionColumns([])
    }
    if (!newSelection.includes(currentCollection)) {
      newSelection.push(currentCollection)
    }
    if (newSelection.length > 2) {
      const lastSelected = newSelection.find((item) => item !== currentCollection)
      setSelectedCollections([currentCollection, lastSelected])
    } else {
      setSelectedCollections(newSelection)
    }
  }

  /**
   * This function is called when the user clicks on the merge button
   * It is used to merge the datasets, create a new dataset and update the workspace
   */
  const merge = async (selectedMergeType) => {
    if (!selectedMergeType) {
      toast.warn("Please select a merge type.")
      return
    }

    const id = randomUUID()
    const object = new MEDDataObject({
      id: id,
      name: globalData[selectedCollections[0]].name.replace(".csv", "") + "_" + globalData[selectedCollections[1]].name.replace(".csv", "") + "_" + selectedMergeType + ".csv",
      type: "csv",
      parentID: globalData[selectedCollections[0]].parentID,
      childrenIDs: [],
      inWorkspace: false
    })

    let jsonToSend = {}
    jsonToSend = {
      newCollectionName: id,
      mergeType: selectedMergeType,
      columns: selectedColumns,
      collection1: globalData[selectedCollections[0]].id,
      collection2: globalData[selectedCollections[1]].id
    }

    // Change loading state
    setLoading(true)

    // Send the request to the backend
    requestBackend(
      port,
      "/input/merge_datasets_DB/",
      jsonToSend,
      async (jsonResponse) => {
        console.log("jsonResponse", jsonResponse)
        setLoading(false)
        if (jsonResponse.error) {
          if (jsonResponse.error.message) {
            console.error(jsonResponse.error.message)
            toast.error(jsonResponse.error.message)
          } else {
            console.error(jsonResponse.error)
            toast.error(jsonResponse.error)
          }
        } else {
          await insertMEDDataObjectIfNotExists(object)
          MEDDataObject.updateWorkspaceDataObject()
          toast.success("Datasets merged successfully.")
        }
      },
      (error) => {
        setLoading(false)
        console.log(error)
        toast.error("Error merging data " + error)
      }
    )
  }

  return (
    <>
      <div style={{ textAlign: "center", marginBottom: "10px" }}>
        <Message
          severity="info"
          text={"The Merge Tools enable you to merge two collections in a database. You can select the collections to merge, the columns to merge on, and the type of merge to perform."}
        />
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: "5px"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", margin: "5px" }}>
          <MultiSelect value={selectedCollections} options={options} filter onChange={(e) => handleSelectChange(e.value)} placeholder={"Select Collections"} style={{ width: "200px", marginRight: "10px" }} />
          <MultiSelect
            filter
            value={selectedColumns}
            options={collectionColumns}
            onChange={(e) => setSelectedColumns(e.value)}
            placeholder="Select Columns"
            style={{ width: "200px", marginRight: "10px" }}
            disabled={selectedMergeType === "cross"}
          />
          <Dropdown value={selectedMergeType} options={mergeTypes} onChange={(e) => setSelectedMergeType(e.value)} placeholder="Select Merge Type" style={{ width: "200px", marginRight: "10px" }} />
          <Button
            icon={"pi pi-check"}
            onClick={() => merge(selectedMergeType)}
            className="p-button-success"
            style={{
              width: "100px",
              marginRight: "10px"
            }}
            loading={loading}
            tooltip="Merge"
            tooltipOptions={{ position: "top" }}
            disabled={selectedCollections.length !== 2 || selectedColumns.length === 0 || !selectedMergeType}
          />
        </div>
      </div>
    </>
  )
}

export default MergeToolsDB
