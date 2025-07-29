/* eslint-disable no-unused-vars */
import { useState, useEffect, useContext, useRef } from "react"
import { Button } from "primereact/button"
import { Message } from "primereact/message"
import { MultiSelect } from "primereact/multiselect"
import { Dropdown } from "primereact/dropdown"
import { InputText } from "primereact/inputtext"
import { OverlayPanel } from "primereact/overlaypanel"
import { requestBackend } from "../../../utilities/requests"
import { getCollectionColumns } from "../../mongoDB/mongoDBUtils"
import { ServerConnectionContext } from "../../serverConnection/connectionContext"
import { DataContext } from "../../workspace/dataContext"
import { toast } from "react-toastify"
import { MEDDataObject } from "../../workspace/NewMedDataObject" // ✅ Needed to refresh the workspace

const NormalizeToolsDB = ({ currentCollection }) => {
  const { port } = useContext(ServerConnectionContext)
  const { globalData } = useContext(DataContext)

  const [columns, setColumns] = useState([])
  const [selectedColumns, setSelectedColumns] = useState([])
  const [normalizationMethod, setNormalizationMethod] = useState("minmax")
  const [newDatasetName, setNewDatasetName] = useState("")
  const [loading, setLoading] = useState(false)

  const op = useRef(null)

  const normalizationOptions = [
    { label: "Min-Max", value: "minmax" },
    { label: "Z-Score", value: "zscore" },
    { label: "Robust", value: "robust" }
  ]

  useEffect(() => {
    const fetchColumns = async () => {
      if (currentCollection) {
        try {
          const cols = await getCollectionColumns(currentCollection)
          setColumns(cols)
        } catch (error) {
          toast.error("Error fetching columns")
        }
      }
    }
    fetchColumns()
  }, [currentCollection])

  const handleNormalizeRequest = (overwrite) => {
    if (!newDatasetName) {
      toast.error("Please provide a name for the new normalized dataset")
      return
    }

    if (selectedColumns.length === 0) {
      toast.error("Please select at least one column to normalize")
      return
    }

    const jsonToSend = {
      collection: currentCollection,
      columns: selectedColumns,
      method: normalizationMethod,
      newDatasetName: newDatasetName + ".csv",
      overwrite: overwrite
    }

    console.log("Sending payload******:", jsonToSend)

    setLoading(true)
    requestBackend(
      port,
      "/input/normalizeDB/",
      jsonToSend,
      (jsonResponse) => {
        setLoading(false)
        op.current.hide()
        if (jsonResponse.error) {
          toast.error("Error during normalization")
          return
        }
        toast.success("Normalization applied successfully")

        // ✅ Refresh workspace data to make new dataset appear
        MEDDataObject.updateWorkspaceDataObject()
      },
      (error) => {
        setLoading(false)
        op.current.hide()
        toast.error("Server error during normalization")
      }
    )
  }

  return (
    <div>
      <Message
        text="The normalization tool scales selected numerical columns using a specified method such as Min-Max, Z-Score, or Robust."
        severity="info"
        className="mb-3"
      />

      <div className="mb-3">
        <MultiSelect
          value={selectedColumns}
          options={columns.map((col) => ({ label: col, value: col }))}
          onChange={(e) => setSelectedColumns(e.value)}
          placeholder="Select columns to normalize"
          display="chip"
          style={{ width: "100%" }}
        />
      </div>

      <div className="mb-3">
        <Dropdown
          value={normalizationMethod}
          options={normalizationOptions}
          onChange={(e) => setNormalizationMethod(e.value)}
          placeholder="Select normalization method"
          style={{ width: "250px" }}
        />
      </div>

      <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
        <div className="p-inputgroup w-full md:w-30rem" style={{ margin: "5px", fontSize: "1rem", width: "250px", marginTop: "20px" }}>
          <InputText value={newDatasetName} onChange={(e) => setNewDatasetName(e.target.value)} placeholder="New normalized dataset name" />
          <span className="p-inputgroup-addon">.csv</span>
        </div>
        <Button
          icon="pi pi-plus"
          style={{ margin: "5px", fontSize: "1rem", padding: "6px 10px", width: "150px", height: "50px", marginTop: "20px" }}
          loading={loading}
          onClick={(e) => op.current.toggle(e)}
          tooltip="Normalize columns and save"
          tooltipOptions={{ position: "top" }}
        />
      </div>

      <OverlayPanel ref={op} showCloseIcon={true} dismissable={true} style={{ width: "430px", padding: "10px" }} onHide={() => setNewDatasetName("")}>
        <h4 style={{ fontSize: "0.8rem", margin: "10px 0" }}>
          Do you want to <b>overwrite</b> the dataset or <b>create a new one</b> ?
        </h4>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <Button className="p-button-danger" label="Overwrite" style={{ margin: "5px", fontSize: "0.8rem", padding: "6px 10px" }} onClick={() => handleNormalizeRequest(true)} />
          <div className="p-inputgroup w-full md:w-30rem" style={{ margin: "5px", fontSize: "0.8rem" }}>
            <InputText value={newDatasetName} onChange={(e) => setNewDatasetName(e.target.value)} placeholder="New collection name" />
            <span className="p-inputgroup-addon">.csv</span>
          </div>
          <Button label="Create New" loading={loading} style={{ margin: "5px", fontSize: "0.8rem", padding: "6px 10px" }} onClick={() => handleNormalizeRequest(false)} />
        </div>
      </OverlayPanel>
    </div>
  )
}

export default NormalizeToolsDB
