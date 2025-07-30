/* eslint-disable no-unused-vars */
import { randomUUID } from "crypto"
import { Button } from "primereact/button"
import { Column } from "primereact/column"
import { confirmDialog } from "primereact/confirmdialog"
import { DataTable } from "primereact/datatable"
import { Dropdown } from "primereact/dropdown"
import { InputNumber } from "primereact/inputnumber"
import { InputText } from "primereact/inputtext"
import { Message } from "primereact/message"
import { OverlayPanel } from "primereact/overlaypanel"
import { SelectButton } from "primereact/selectbutton"
import { Slider } from "primereact/slider"
import React, { useContext, useEffect, useRef, useState } from "react"
import { toast } from "react-toastify"
import { requestBackend } from "../../../utilities/requests"
import { insertMEDDataObjectIfNotExists } from "../../mongoDB/mongoDBUtils"
import { ServerConnectionContext } from "../../serverConnection/connectionContext"
import { DataContext } from "../../workspace/dataContext"
import { MEDDataObject } from "../../workspace/NewMedDataObject"
import { Tooltip } from 'primereact/tooltip';
        

/**
 * @description
 * This component provides simple cleaning tools to handle missing values within a dataset.
 * @param {string} props.currentCollection - Current collection
 */
const SimpleCleaningToolsDB = ({ currentCollection }) => {
  const [tableData, setTableData] = useState([])
  const [rowData, setRowData] = useState([])
  const [columnThreshold, setColumnThreshold] = useState(100)
  const [rowThreshold, setRowThreshold] = useState(100)
  const [columnPercentage, setColumnPercentage] = useState("100%")
  const [rowPercentage, setRowPercentage] = useState("100%")
  const [hoveredButton, setHoveredButton] = useState(null)
  const [columnsToClean, setColumnsToClean] = useState([])
  const [rowsToClean, setRowsToClean] = useState([])
  const [newCollectionName, setNewCollectionName] = useState("")
  const [cleanType, setCleanType] = useState("columns")
  const [loading, setLoading] = useState(false)
  const [loadingDB, setLoadingDB] = useState(false)
  const op = useRef(null)
  const [cleaningOption, setCleaningOption] = useState("drop")
  const cleaningOptions = ["drop", "random fill", "mean fill", "median fill", "mode fill", "bfill", "ffill"]
  const [startWith, setStartWith] = useState("Columns")
  const { port } = useContext(ServerConnectionContext)
  const { globalData } = useContext(DataContext)

  // Function that calls the backend to get the missing values data for the column and row
  useEffect(() => {
    async function fetchData() {
      let jsonToSend = {}
      jsonToSend["collectionName"] = currentCollection

      setLoadingDB(true)

      const response = await requestBackend(
        port,
        "/input/get_row_column_missing_values/",
        jsonToSend,
        async (response) => {
          setLoadingDB(false)
          const columnsData = response.columnsData
          const rowData = response.rowData
          setTableData(columnsData)
          setRowData(rowData)
        },
        (error) => {
          setLoadingDB(false)
          console.error("Failed to fetch missing values data:", error)
        }
      )
    }
    fetchData()
  }, [currentCollection])

  // Sets the columns to drop depending on the threshold
  const handleCleanColumns = () => {
    const columnsBelowThreshold = tableData
      .filter((columnData) => {
        const percentage = parseFloat(columnData.percentage)
        return percentage >= columnThreshold
      })
      .map((columnData) => columnData.column)

    setColumnsToClean(columnsBelowThreshold)
  }

  // Sets the rows to drop depending on the threshold
  const handleCleanRows = () => {
    const rowsBelowThreshold = rowData
      .filter((row) => {
        const percentage = parseFloat(row.percentage)
        return percentage >= rowThreshold
      })
      .map((row) => row.rowIndex)

    setRowsToClean(rowsBelowThreshold)
  }

  const cleanAll = (overwrite) => {
    clean("all", overwrite)
  }
  const cleanRowsOrColumns = (overwrite) => {
    clean(cleanType, overwrite)
  }

  const clean = async (type, overwrite) => {
    // Check if the collection already exists
    let collectionName = newCollectionName + ".csv"
    let exists = false
    for (const item of Object.keys(globalData)) {
      if (globalData[item].name && globalData[item].name === collectionName) {
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

    // If the collection does not exist, create a new one
    const id = randomUUID()
    const object = new MEDDataObject({
      id: id,
      name: collectionName,
      type: "csv",
      parentID: globalData[currentCollection].parentID,
      childrenIDs: [],
      inWorkspace: false
    })

    let jsonToSend = {}
    if (type == "all") {
      jsonToSend = {
        type: type,
        cleanMethod: cleaningOption,
        overwrite: overwrite,
        collectionName: globalData[currentCollection].id,
        rowThreshold: rowThreshold,
        columnThreshold: columnThreshold,
        rowsToClean: rowsToClean,
        columnsToClean: columnsToClean,
        newDatasetName: id,
        startWith: startWith
      }
    } else {
      jsonToSend = {
        type: type,
        cleanMethod: cleaningOption,
        overwrite: overwrite,
        collectionName: globalData[currentCollection].id,
        rowThreshold: rowThreshold,
        columnThreshold: columnThreshold,
        rowsToClean: rowsToClean,
        columnsToClean: columnsToClean,
        newDatasetName: id
      }
    }
    setLoading(true)
    requestBackend(
      port,
      "/input/cleanDB/",
      jsonToSend,
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
          MEDDataObject.updateWorkspaceDataObject()
          toast.success("Data cleaned successfully.")
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
    <>
      <Tooltip target=".experimental-tag" content="This tool is experimental and mostly intended for result visualization. We recommend using the Learning Module for validated preprocessing workflows." />

      <div className="experimental-tag" style={{ textAlign: "right", marginBottom: "-5px" }}>
        <span
          style={{
            background: "#fff3cd",
            padding: "3px 8px",
            borderRadius: "10px",
            border: "1px solid #ffeeba",
            fontSize: "0.75rem",
            color: "#856404",
            display: "inline-block"
          }}
        >
          Experimental tool
        </span>
      </div>

      <div style={{ textAlign: "center", marginBottom: "10px" }}>
        <Message
          severity="info"
          text={
            "The Simple Cleaning tool assists in handling missing values within your datasets, whether by rows, columns, or both. It provides various methods such as dropping missing values or filling them in."
          }
        />
        <Message style={{ marginTop: "10px" }} severity="success" text={`Current Collection: ${globalData[currentCollection].name}`} />
      </div>
      <div>
        <DataTable
          paginator
          rows={5}
          className="p-datatable-striped p-datatable-gridlines"
          value={tableData}
          readOnly
          loading={loadingDB}
          rowClassName={(rowData) => (columnsToClean.includes(rowData.column) ? "highlight-row" : "")}
        >
          <Column field="column" header={`Columns (${tableData.length})`} sortable></Column>
          <Column field="numEmpty" header="Number of empty" sortable></Column>
          <Column field="percentage" header="% of empty" sortable></Column>
        </DataTable>
        <div style={{ marginTop: "20px" }}>
          <DataTable
            paginator
            rows={5}
            className="p-datatable-striped p-datatable-gridlines"
            value={rowData}
            readOnly
            loading={loadingDB}
            rowClassName={(rowData) => (columnsToClean.includes(rowData.column) ? "highlight-row" : "")}
          >
            <Column field="rowIndex" header={`Row index (${rowData.length})`} sortable></Column>
            <Column field="numEmpty" header="Number of empty" sortable></Column>
            <Column field="percentage" header="% of empty" sortable></Column>
          </DataTable>
        </div>
        <div style={{ marginTop: "20px", display: "flex", justifyContent: "center" }}>
          <Dropdown value={cleaningOption} options={cleaningOptions} onChange={(e) => setCleaningOption(e.value)} placeholder="Select a Cleaning Option" />
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "space-between",
            border: "1px solid grey",
            borderRadius: "5px",
            marginTop: "20px",
            backgroundColor: "lightgrey"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", width: "100%", marginTop: "10px" }}>
            <p style={{ marginLeft: "10px", color: "black" }}>Column threshold of maximum empty values (%) ({columnsToClean.length})</p>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              width: "100%",
              marginBottom: "20px",
              marginLeft: "10px",
              marginRight: "10px"
            }}
          >
            <Slider
              value={columnThreshold}
              onChange={(e) => {
                setColumnThreshold(e.value)
                setColumnPercentage(`${e.value}%`)
              }}
              onSlideEnd={handleCleanColumns}
              style={{ width: "70%", marginLeft: "10px", marginRight: "10px" }}
            />
            <InputNumber
              value={columnPercentage.replace("%", "")}
              onValueChange={(e) => {
                setColumnPercentage(`${e.value}%`)
                setColumnThreshold(e.value)
                handleCleanColumns()
              }}
              mode="decimal"
              min={0}
              max={100}
              useGrouping={false}
              showButtons
            />
            <Button
              icon="pi pi-trash"
              style={{
                backgroundColor: hoveredButton === "column_button" ? "#d32f2f" : "grey",
                color: "white",
                border: "none",
                marginLeft: "10px",
                width: "50px"
              }}
              onMouseEnter={() => setHoveredButton("column_button")}
              onMouseLeave={() => setHoveredButton(null)}
              onClick={(e) => {
                setCleanType("columns")
                op.current.toggle(e)
              }}
              tooltip="Clean Columns"
              tooltipOptions={{ position: "top" }}
            />
          </div>
          <Message
            style={{
              marginBottom: "10px"
            }}
            severity={columnsToClean.length === 0 ? "error" : "success"}
            text={columnsToClean.length === 0 ? "No columns will be cleaned" : `Columns that will be cleaned: ${columnsToClean.join(", ")}`}
          />
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "space-between",
            border: "1px solid grey",
            borderRadius: "5px",
            marginTop: "20px",
            backgroundColor: "lightgrey"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", width: "100%", marginTop: "10px" }}>
            <p style={{ marginLeft: "10px", color: "black" }}>Row threshold of maximum empty values (%) ({rowsToClean.length})</p>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              width: "100%",
              marginBottom: "20px",
              marginLeft: "10px",
              marginRight: "10px"
            }}
          >
            <Slider
              value={rowThreshold}
              onChange={(e) => {
                setRowThreshold(e.value)
                setRowPercentage(`${e.value}%`)
              }}
              onSlideEnd={handleCleanRows}
              style={{ width: "70%", marginLeft: "10px", marginRight: "10px" }}
            />
            <InputNumber
              value={rowPercentage.replace("%", "")}
              onValueChange={(e) => {
                setRowPercentage(`${e.value}%`)
                setRowThreshold(e.value)
                handleCleanRows()
              }}
              mode="decimal"
              min={0}
              max={100}
              useGrouping={false}
              showButtons
            />
            <Button
              icon="pi pi-trash"
              style={{
                backgroundColor: hoveredButton === "row_button" ? "#d32f2f" : "grey",
                color: "white",
                border: "none",
                marginLeft: "10px",
                width: "50px"
              }}
              onMouseEnter={() => setHoveredButton("row_button")}
              onMouseLeave={() => setHoveredButton(null)}
              onClick={(e) => {
                setCleanType("rows")
                op.current.toggle(e)
              }}
              tooltip="Clean Rows"
              tooltipOptions={{ position: "top" }}
            />
          </div>
          <Message
            style={{
              marginBottom: "10px"
            }}
            severity={rowsToClean.length === 0 ? "error" : "success"}
            text={rowsToClean.length === 0 ? "No rows will be cleaned" : `Rows that will be cleaned: ${rowsToClean.join(", ")}`}
          />
        </div>
      </div>
      <div style={{ textAlign: "center", marginTop: "20px" }}>
        <Message severity="info" text={"Create a new clean dataset by cleaning the selected columns and rows."} />
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", marginTop: "20px" }}>
          <SelectButton
            value={startWith}
            options={["Columns", "Rows"]}
            onChange={(e) => setStartWith(e.value)}
            tooltip="This will determine whether to begin clearing with columns or rows."
            tooltipOptions={{ position: "top" }}
          />
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
        <div className="p-inputgroup w-full md:w-30rem" style={{ margin: "5px", fontSize: "1rem", width: "205px", marginTop: "20px" }}>
          <InputText value={newCollectionName} onChange={(e) => setNewCollectionName(e.target.value)} placeholder="New clean dataset name" />
          <span className="p-inputgroup-addon">.csv</span>
        </div>
        <Button
          icon="pi pi-plus"
          style={{ margin: "5px", fontSize: "1rem", padding: "6px 10px", width: "150px", height: "50px", marginTop: "20px" }}
          loading={loading}
          onClick={() => cleanAll(false)}
          tooltip="Create Clean Dataset"
          tooltipOptions={{ position: "top" }}
        />
      </div>
      <OverlayPanel ref={op} showCloseIcon={true} dismissable={true} style={{ width: "430px", padding: "10px" }} onHide={() => setNewCollectionName("")}>
        <h4 style={{ fontSize: "0.8rem", margin: "10px 0" }}>
          Do you want to <b>overwrite</b> the dataset or <b>create a new one</b> ?
        </h4>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <Button className="p-button-danger" label="Overwrite" style={{ margin: "5px", fontSize: "0.8rem", padding: "6px 10px" }} onClick={() => cleanRowsOrColumns(true)} />
          <div className="p-inputgroup w-full md:w-30rem" style={{ margin: "5px", fontSize: "0.8rem" }}>
            <InputText value={newCollectionName} onChange={(e) => setNewCollectionName(e.target.value)} placeholder="New collection name" />
            <span className="p-inputgroup-addon">.csv</span>
          </div>
          <Button label="Create New" loading={loading} style={{ margin: "5px", fontSize: "0.8rem", padding: "6px 10px" }} onClick={() => cleanRowsOrColumns(false)} />
        </div>
      </OverlayPanel>
    </>
  )
}

export default SimpleCleaningToolsDB
