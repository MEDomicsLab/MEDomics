/* eslint-disable no-unused-vars */
import React, { useEffect, useState, useContext } from "react"
import { Message } from "primereact/message"
import { MultiSelect } from "primereact/multiselect"
import { Dropdown } from "primereact/dropdown"
import { Button } from "primereact/button"
import { DataTable } from "primereact/datatable"
import { Column } from "primereact/column"
import { toast } from "react-toastify"
import { ServerConnectionContext } from "../../../serverConnection/connectionContext"
import { requestBackend } from "../../../../utilities/requests"
import { Checkbox } from "primereact/checkbox"
import { InputText } from "primereact/inputtext"
import { DataContext } from "../../../workspace/dataContext"
import { randomUUID } from "crypto"
import { MEDDataObject } from "../../../workspace/NewMedDataObject"
import { insertMEDDataObjectIfNotExists, getCollectionColumns } from "../../../mongoDB/mongoDBUtils"

/**
 * Component that renders the Spearman feature reduction creation tool
 */
const SpearmanDB = ({ currentCollection }) => {
  const [selectedColumns, setSelectedColumns] = useState([])
  const [columns, setColumns] = useState([])
  const [selectedTarget, setSelectedTarget] = useState("")
  const [correlations, setCorrelations] = useState([])
  const [selectedSpearmanRows, setSelectedSpearmanRows] = useState([])
  const [keepUnselectedColumns, setKeepUnselectedColumns] = useState(false)
  const [keepTarget, setKeepTarget] = useState(false)
  const { port } = useContext(ServerConnectionContext)
  const [newCollectionName, setNewCollectionName] = useState("")
  const { globalData } = useContext(DataContext)
  const [loadingCompute, setLoadingCompute] = useState(false)
  const [loading, setLoading] = useState(false)
  const correlationsColumns = [
    { field: "index", header: "Column Name" },
    { field: "value", header: "Correlation with target" }
  ]

  // Fetch the columns of the current collection without fetching the whole dataset
  useEffect(() => {
    const fetchData = async () => {
      const columns = await getCollectionColumns(currentCollection)
      if (columns && columns.length > 0) {
        setColumns(columns)
      }
    }
    fetchData()
  }, [currentCollection])

  // Reset the correlations when the selected columns change
  useEffect(() => {
    setCorrelations([])
  }, [selectedColumns])

  // Reset the selected spearman rows when the correlations change
  useEffect(() => {
    setSelectedSpearmanRows([])
  }, [correlations])

  // Call the server to compute eigenvalues from the selected columns on (backend)
  const computeCorrelations = () => {
    let jsonToSend = {}
    jsonToSend = {
      columns: selectedColumns,
      target: selectedTarget,
      collection: currentCollection,
    }

    setLoadingCompute(true)

    requestBackend(
      port,
      "/input/compute_correlationsDB/",
      jsonToSend,
      (jsonResponse) => {
        setLoadingCompute(false)
        console.log("received results:", jsonResponse)
        if (!jsonResponse.error) {
          setLoadingCompute(false)
          let data = jsonResponse["correlations"]
          setCorrelations(
            Object.keys(data).map((key) => ({
              index: key,
              value: data[key]
            }))
          )
          toast.success("Computation successful")
        } else {
          toast.error(`Computation failed: ${jsonResponse.error.message}`)
        }
      },
      function (err) {
        setLoadingCompute(false)
        console.error(err)
        toast.error(`Computation failed: ${err}`)
      }
    )
  }

  // Call the server to compute the spearman correlation
  const computeSpearman = async (overwrite) => {
    const id = randomUUID()

    const object = new MEDDataObject({
      id: id,
      name: newCollectionName + "_reduced_spearman" + ".csv",
      type: "csv",
      parentID: globalData[currentCollection].parentID,
      childrenIDs: [],
      inWorkspace: false
    })

    // Check if object already exists
    for (const item of Object.keys(globalData)) {
      if (globalData[item].name && globalData[item].name === object.name) {
        toast.error(`A subset with the name ${object.name} already exists.`)
        return
      }
    }

    let jsonToSend = {}
    jsonToSend = {
      selectedColumns: selectedColumns,
      target: selectedTarget,
      selectedSpearmanRows: selectedSpearmanRows,
      keepUnselectedColumns: keepUnselectedColumns,
      keepTarget: keepTarget,
      collection: currentCollection,
      newCollectionName: id,
      overwrite: overwrite
    }

    // Send the request to the backend
    setLoading(true)
    requestBackend(
      port,
      "/input/compute_spearmanDB/",
      jsonToSend,
      async (jsonResponse) => {
        setLoading(false)
        console.log("received results:", jsonResponse)
        if (jsonResponse.error) {
          setLoading(false)
          if (jsonResponse.error.message) {
            console.error(jsonResponse.error.message)
            toast.error(jsonResponse.error.message)
          } else {
            console.error(jsonResponse.error)
            toast.error(jsonResponse.error)
          }
        } else {
          if (!overwrite) {
            await insertMEDDataObjectIfNotExists(object)
            MEDDataObject.updateWorkspaceDataObject()
          } else {
            MEDDataObject.updateWorkspaceDataObject()
          }
          toast.success("Spearman applied successfully")
        }
      },
      (error) => {
        setLoading(false)
        console.log(error)
        toast.error("Error computing Spearman correlation" + error)
      }
    )
  }

  return (
    <>
      <div className="margin-top-15 center">
        <div className="margin-top-15 center">
          <Message text="The Spearman tool enables you to compute correlations between columns in your data and a specified target. It also allows you to select columns to keep in your dataset based on the computed correlations." />
        </div>
        <hr></hr>
        <hr />
        <b>Select the columns you want to apply Spearman on (without target)</b>
        <div className="margin-top-15">
          <MultiSelect
            value={selectedColumns}
            options={columns.filter((col) => col !== "_id")}
            onChange={(e) => setSelectedColumns(e.value)}
            placeholder="Select columns"
            style={{ marginTop: "10px", maxWidth: "900px" }}
            display="chip"
            filter
          />
          <hr></hr>
        </div>
        <div className="margin-top-15">
          <b>Select the target column</b>
          <div className="margin-top-15">
            {selectedColumns.length > 0 ? (
              <Dropdown value={selectedTarget} options={columns.filter((col) => col !== "_id")} onChange={(event) => setSelectedTarget(event.value)} placeholder="Select column" />
            ) : (
              <Dropdown placeholder="No columns to show" disabled />
            )}
          </div>
        </div>
        <div className="margin-top-15 center">
          <Button disabled={selectedColumns.length < 1 || !selectedTarget} onClick={computeCorrelations} loading={loadingCompute}>
            Compute correlations
          </Button>
        </div>
        <hr></hr>
        <div className="margin-top-15 center">
          <b>Select columns to keep</b>
          <div className="margin-top-15 maxwidth-80 mx-auto">
            <DataTable value={correlations} size={"small"} selectionMode="checkbox" selection={selectedSpearmanRows} onSelectionChange={(e) => setSelectedSpearmanRows(e.value)} paginator rows={6}>
              <Column selectionMode="multiple"></Column>
              {correlationsColumns.map((col) => (
                <Column key={col.field} field={col.field} header={col.header} />
              ))}
            </DataTable>
          </div>
        </div>
        <hr></hr>
        <div className="margin-top-15 center">
          <b>Set your dataset options</b>
        </div>
        <div className="margin-top-15 flex-container-wrap">
          <div>
            Merge unselected columns in the result dataset &nbsp;
            <Checkbox onChange={(e) => setKeepUnselectedColumns(e.checked)} checked={keepUnselectedColumns}></Checkbox>
          </div>
          <div>
            Keep target in dataset &nbsp;
            <Checkbox onChange={(e) => setKeepTarget(e.checked)} checked={keepTarget}></Checkbox>
          </div>
        </div>
        <hr></hr>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", marginTop: "1rem" }}>
          <Button
            className="p-button-danger"
            label="Overwrite"
            style={{ margin: "5px", fontSize: "1rem", padding: "6px 10px" }}
            onClick={() => computeSpearman(true)}
            tooltip="Overwrite current collection with spearman results"
            tooltipOptions={{ position: "top" }}
            loading={loading}
          />
          <InputText value={newCollectionName} onChange={(e) => setNewCollectionName(e.target.value)} placeholder="New name" style={{ margin: "5px", fontSize: "1rem", width: "205px" }} />
          <Button
            icon="pi pi-plus"
            style={{ margin: "5px", fontSize: "1rem", padding: "6px 10px", width: "100px", marginTop: "0.25rem" }}
            onClick={() => computeSpearman(false)}
            tooltip="Create new collection with spearman results"
            tooltipOptions={{ position: "top" }}
            loading={loading}
          />
        </div>
      </div>
    </>
  )
}

export default SpearmanDB
