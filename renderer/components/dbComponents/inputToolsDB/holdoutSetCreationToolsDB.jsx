/* eslint-disable no-unused-vars */
import { randomUUID } from "crypto"
import { ipcRenderer } from "electron"
import { Button } from "primereact/button"
import { Checkbox } from "primereact/checkbox"
import { confirmDialog } from "primereact/confirmdialog"
import { Dropdown } from "primereact/dropdown"
import { InputNumber } from "primereact/inputnumber"
import { InputText } from "primereact/inputtext"
import { Message } from "primereact/message"
import { MultiSelect } from "primereact/multiselect"
import { Slider } from "primereact/slider"
import React, { useContext, useEffect, useState } from "react"
import { toast } from "react-toastify"
import { requestBackend } from "../../../utilities/requests"
import { insertMEDDataObjectIfNotExists } from "../../mongoDB/mongoDBUtils"
import { ServerConnectionContext } from "../../serverConnection/connectionContext"
import { MEDDataObject } from "../../workspace/NewMedDataObject"
import { DataContext } from "../../workspace/dataContext"
import { getCollectionColumns } from "../../mongoDB/mongoDBUtils"

/**
 * @description
 * This component provides tools to create a holdout set from a dataset.
 * @param {string} props.currentCollection - Current collection
 *
 */
const HoldoutSetCreationToolsDB = ({ currentCollection }) => {
  const [shuffle, setShuffle] = useState(false)
  const [stratify, setStratify] = useState(false)
  const [selectedColumns, setSelectedColumns] = useState([])
  const [columns, setColumns] = useState([])
  const [seed, setSeed] = useState(54288)
  const [holdoutSetSize, setHoldoutSetSize] = useState(20)
  const [cleaningOption, setCleaningOption] = useState("drop")
  const cleaningOptions = ["drop", "random fill", "mean fill", "median fill", "mode fill", "bfill", "ffill"]
  const [loading, setLoading] = useState(false)
  const { globalData } = useContext(DataContext)
  const [newCollectionName, setNewCollectionName] = globalData[currentCollection] ? useState(globalData[currentCollection].name.split(".csv")[0]) : useState("")
  const { port } = useContext(ServerConnectionContext)

  // Fetch the columns of the current collection without fetching the whole dataset
  useEffect(() => {
    const fetchData = async () => {
      const collectionColumns = await getCollectionColumns(currentCollection)
      if (collectionColumns && collectionColumns.length > 0) {
        setColumns(collectionColumns)
      }
    }
    fetchData()
  }, [currentCollection])

  useEffect(() => {
    ipcRenderer.invoke("get-settings").then((receivedSettings) => {
      console.log("received settings", receivedSettings)
      if (receivedSettings?.seed) {
        setSeed(receivedSettings?.seed)
      }
    })
  }, [])

  /**
   * Function to create the holdout set, send the request to the backend
   */
  const createHoldoutSet = async () => {
    let collectionName = newCollectionName + ".csv"
    const id = randomUUID()
    const id2 = randomUUID()
    const object = new MEDDataObject({
      id: id,
      name: "Learning_" + collectionName,
      type: "csv",
      parentID: globalData[currentCollection].parentID,
      childrenIDs: [],
      inWorkspace: false
    })

    const object2 = new MEDDataObject({
      id: id2,
      name: "Holdout_" + collectionName,
      type: "csv",
      parentID: globalData[currentCollection].parentID,
      childrenIDs: [],
      inWorkspace: false
    })

    let JSONToSend = {}
    JSONToSend = {
      collectionName: globalData[currentCollection].id,
      name: id,
      name2: id2,
      holdoutSetSize: holdoutSetSize,
      shuffle: shuffle,
      stratify: stratify,
      columnsToStratifyWith: selectedColumns,
      nanMethod: cleaningOption,
      randomState: seed
    }

    // Check if the collection already exists
    let exists = false
    for (const item of Object.keys(globalData)) {
      if (globalData[item].name && globalData[item].name === object.name) {
        exists = true
        break
      }
    }

    // If the collection already exists, ask the user if they want to overwrite it
    let overwriteConfirmation = true
    if (exists) {
      overwriteConfirmation = await new Promise((resolve) => {
        confirmDialog({
          closable: false,
          message: `A dataset with the name "${collectionName}" already exists in the database. Do you want to overwrite it?`,
          header: "Confirmation",
          icon: "pi pi-exclamation-triangle",
          accept: () => resolve(true),
          reject: () => resolve(false)
        })
      })
    }
    if (!overwriteConfirmation) {
      return
    }

    // Change loading state
    setLoading(true)

    // Send the request to the backend
    requestBackend(
      port,
      "/input/create_holdout_set_DB/",
      JSONToSend,
      async (jsonResponse) => {
        setLoading(false)
        console.log("jsonResponse", jsonResponse)
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
          await insertMEDDataObjectIfNotExists(object2)
          MEDDataObject.updateWorkspaceDataObject()
          toast.success("Holdout set created successfully")
        }
      },
      (error) => {
        setLoading(false)
        console.log(error)
        toast.error("Error cleaning data:" + error)
      }
    )
  }

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "5px"
      }}
    >
      <div style={{ textAlign: "center", marginBottom: "10px" }}>
        <Message
          className="margin-top-15 margin-bottom-15 center"
          content={
            <div>
              <i className="pi pi-info-circle" />
              &nbsp; The Holdout Set Creation tool serves as a visual representation of the{" "}
              <i>
                <b>
                  <a href="https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.train_test_split.html" target="_blank">
                    scikit-learn Python package's model_selection train_test_split function
                  </a>
                </b>
              </i>
              . This tool will create a folder containing your holdout and learning sets.
            </div>
          }
        />
        <Message className="margin-top-15 margin-bottom-15 center" severity="success" text={`Current collection: ${globalData[currentCollection].name}`} style={{ marginTop: "10px" }} />
        <div style={{ marginTop: "10px", justifyContent: "center", alignItems: "center" }}>
          <div style={{ marginTop: "10px", display: "flex", justifyContent: "center", alignItems: "center" }}>
            <Checkbox
              inputId="shuffle"
              checked={shuffle}
              onChange={(e) => {
                setShuffle(e.checked)
                if (!e.checked) {
                  setSelectedColumns([])
                  setStratify(false)
                }
              }}
              style={{ marginLeft: "30px" }}
            />
            <label htmlFor="shuffle" style={{ marginLeft: "8px" }}>
              Shuffle
            </label>
            <Checkbox
              inputId="stratify"
              checked={stratify}
              onChange={(e) => {
                setStratify(e.checked)
                if (!e.checked) {
                  setSelectedColumns([])
                }
              }}
              disabled={!shuffle}
              style={{ marginLeft: "30px" }}
            />
            <label htmlFor="stratify" style={{ marginLeft: "8px" }}>
              Stratify
            </label>
            <MultiSelect
              value={selectedColumns}
              options={columns.filter((col) => col !== "_id")}
              onChange={(e) => setSelectedColumns(e.value)}
              filter
              placeholder="Select Columns"
              disabled={!(shuffle && stratify)}
              style={{ marginLeft: "30px", marginTop: "10px" }}
            />
          </div>
          <div style={{ marginTop: "10px", display: "flex", justifyContent: "center", alignItems: "center" }}>
            <InputNumber
              value={seed}
              inputId="seed"
              onChange={(e) => {
                setSeed(e.value)
              }}
              mode="decimal"
              showButtons
              min={0}
              max={100000}
              size={6}
              tooltip="Seed for random number generation."
              tooltipOptions={{ position: "top" }}
              style={{ marginRight: "1em", flex: "1 1 auto", width: "1px" }}
            />
            <Slider
              className="custom-slider holdout-slider"
              value={holdoutSetSize}
              style={{ marginRight: "1em", flex: "2 1 auto" }}
              onChange={(e) => {
                setHoldoutSetSize(e.value)
              }}
            />
            <InputNumber
              prefix="% "
              inputId="minmax-buttons"
              value={holdoutSetSize}
              onValueChange={(e) => {
                setHoldoutSetSize(e.value)
              }}
              mode="decimal"
              showButtons
              min={0}
              max={100}
              size={5}
              tooltip="Holdout set size (%)."
              tooltipOptions={{ position: "top" }}
              style={{ flex: "1 1 auto", width: "1px" }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
            <Dropdown
              value={cleaningOption}
              options={cleaningOptions}
              onChange={(e) => setCleaningOption(e.value)}
              tooltip="Empty cells cleaning method. Only applies to the stratified columns."
              tooltipOptions={{ position: "top" }}
              style={{ margin: "10px" }}
            />
            <div className="p-inputgroup w-full md:w-30rem" style={{ margin: "10px", fontSize: "1rem", width: "230px", marginTop: "5px" }}>
              <InputText value={newCollectionName} onChange={(e) => setNewCollectionName(e.target.value)} placeholder={newCollectionName} />
              <span className="p-inputgroup-addon">.csv</span>
            </div>
            <Button
              icon="pi pi-plus"
              style={{ margin: "10px" }}
              onClick={() => {
                createHoldoutSet()
              }}
              loading={loading}
              tooltip="Create holdout set"
              tooltipOptions={{ position: "top" }}
              disabled={newCollectionName === ""}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default HoldoutSetCreationToolsDB
