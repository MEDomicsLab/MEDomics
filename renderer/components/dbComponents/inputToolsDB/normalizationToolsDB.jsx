/* eslint-disable no-unused-vars */
import { useState, useEffect, useContext, useRef } from "react"
import { Button } from "primereact/button"
import { Message } from "primereact/message"
import { MultiSelect } from "primereact/multiselect"
import { Dropdown } from "primereact/dropdown"
import { InputText } from "primereact/inputtext"
import { OverlayPanel } from "primereact/overlaypanel"
import { toast } from "react-toastify"
import { requestBackend } from "../../../utilities/requests"
import { getCollectionColumns } from "../../mongoDB/mongoDBUtils"
import { insertMEDDataObjectIfNotExists } from "../../mongoDB/mongoDBUtils"
import { ServerConnectionContext } from "../../serverConnection/connectionContext"
import { DataContext } from "../../workspace/dataContext"
import { MEDDataObject } from "../../workspace/NewMedDataObject"
import { randomUUID } from "crypto" 
import { Tooltip } from 'primereact/tooltip'
import { InputSwitch } from "primereact/inputswitch";
        

const NormalizeToolsDB = ({ currentCollection }) => {
  const { port } = useContext(ServerConnectionContext)
  const { globalData } = useContext(DataContext)

  const [columns, setColumns] = useState([])
  const [selectedColumns, setSelectedColumns] = useState([])
  const [normalizationMethod, setNormalizationMethod] = useState("minmax")
  const [newDatasetName, setNewDatasetName] = useState("")
  const [loading, setLoading] = useState(false)
  const [keepTags, setKeepTags] = useState(true) // clone tags onto new normalized datasets

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
          setSelectedColumns([])
        } catch (error) {
          toast.error("Error fetching columns")
        }
      }
    }
    fetchColumns()
  }, [currentCollection])

  const handleNormalizeRequest = async (overwrite) => {
    if (!newDatasetName) {
      toast.error("Please provide a name for the new normalized dataset")
      return
    }

    if (selectedColumns.length === 0) {
      toast.error("Please select at least one column to normalize")
      return
    }

    const collectionName = newDatasetName + ".csv"
    let exists = false
    for (const item of Object.keys(globalData)) {
      if (globalData[item].name && globalData[item].name === collectionName) {
        exists = true
        break
      }
    }

    if (exists && !overwrite) {
      toast.error("Dataset already exists. Use overwrite option if you want to replace it.")
      return
    }

    const id = randomUUID()
    const jsonToSend = {
      collection: currentCollection,
      columns: selectedColumns,
      method: normalizationMethod,
      newDatasetName: id,
      overwrite: overwrite,
      keepTags,                            
      tagsCollectionName: "column_tags"   
    }

    if (!exists || !overwrite) {
      const object = new MEDDataObject({
        id: id,
        name: collectionName,
        type: "csv",
        parentID: globalData[currentCollection].parentID,
        childrenIDs: [],
        inWorkspace: false
      })
    
      insertMEDDataObjectIfNotExists(object)
    }    

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
       <Tooltip
        target=".experimental-tag"
        content="This tool is experimental and mostly intended for visual exploration. We recommand using the Learning Module for validated pipelines."
        position="left"
      />

    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "-5px" }}>
      <div
        className="experimental-tag"
        style={{
          background: "#fff3cd",              
          padding: "3px 10px",
          borderRadius: "12px",
          border: "1px solid #ffeeba",        
          fontSize: "0.75rem",
          color: "#856404",                  
          display: "inline-flex",
          alignItems: "center",
          gap: "6px"
        }}
      >
        <i className="pi pi-info-circle" style={{ fontSize: "0.85rem" }}></i>
        Recommended in Learning Module
      </div>
    </div>
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
      
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
        <Dropdown
          value={normalizationMethod}
          options={normalizationOptions}
          onChange={(e) => setNormalizationMethod(e.value)}
          placeholder="Select normalization method"
          style={{ width: "250px", marginRight: "5px" }}
        />
         <span style={{ display: "flex", alignItems: "center", margin: "10px" }}>
              <InputSwitch
                checked={keepTags}
                onChange={(e) => setKeepTags(e.value)}
                 tooltip="Clone column tags from the source dataset onto the new normalized collection."
                tooltipOptions={{ position: "top" }}
              />
              <label style={{ marginLeft: 8 }}>Keep tags</label>
            </span>
        <Button
          icon="pi pi-plus"
          style={{ margin: "5px", fontSize: "1rem", width: "150px", height: "50px" }}
          loading={loading}
          onClick={(e) => op.current.toggle(e)}
          tooltip="Normalize columns and save"
          tooltipOptions={{ position: "top" }}
        />
      </div>

      <OverlayPanel ref={op} showCloseIcon={true} dismissable={true} style={{ width: "430px", padding: "10px" }}>
        <h4 style={{ fontSize: "0.8rem", margin: "10px 0" }}>
          Do you want to <b>overwrite</b> the dataset or <b>create a new one</b>?
        </h4>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <Button className="p-button-danger" loading={loading} label="Overwrite" style={{ width : "200px", margin: "5px", fontSize: "0.8rem", padding: "6px 10px" }} onClick={() => handleNormalizeRequest(true)} />
          <div className="p-inputgroup w-full md:w-30rem" style={{ margin: "5px", fontSize: "0.8rem" }}>
            <InputText value={newDatasetName} onChange={(e) => setNewDatasetName(e.target.value)} placeholder="New collection name"/>
            <span className="p-inputgroup-addon">.csv</span>
          </div>
          <Button label="Create New" loading={loading} style={{ width : "200px", margin: "5px", fontSize: "0.8rem", padding: "6px 10px" }} onClick={() => handleNormalizeRequest(false)} />
        </div>
      </OverlayPanel>
    </div>
  )
}

export default NormalizeToolsDB
