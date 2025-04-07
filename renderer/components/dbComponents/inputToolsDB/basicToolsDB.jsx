import React, { useContext, useEffect, useState } from "react"
import { InputText } from "primereact/inputtext"
import { Button } from "primereact/button"
import { SplitButton } from "primereact/splitbutton"
import { Message } from "primereact/message"
import { toast } from "react-toastify"
import { connectToMongoDB } from "../../mongoDB/mongoDBUtils"
import { DataContext } from "../../workspace/dataContext"

/**
 * @description
 * This component provides basic tools to add rows and columns to a dataset, and export the dataset.
 * @param {Object} props
 * @param {string} props.currentCollection - Current collection
 */
const BasicToolsDB = ({ collectionSize, currentCollection }) => {
  const [newColumnName, setNewColumnName] = useState("")
  const [numRows, setNumRows] = useState("")
  const [columns, setColumns] = useState([])
  const [innerData, setInnerData] = useState([])
  const [loading, setLoading] = useState(false)
  const { globalData } = useContext(DataContext)

  // Export options with the split button
  const exportOptions = [
    {
      label: "CSV",
      command: () => {
        handleExport("CSV").then((r) => console.log(r))
      }
    },
    {
      label: "JSON",
      command: () => {
        handleExport("JSON").then((r) => console.log(r))
      }
    }
  ]

  // Monitor the current collection and collection size
  useEffect(() => {
    console.log("currentCollection", currentCollection)
    console.log("collectionSize", collectionSize)
  }, [currentCollection, collectionSize])

  /**
   * @description Export the dataset in CSV or JSON format
   * @param format - Format to export the dataset
   */
  const handleExport = async (format) => {
    const db = await connectToMongoDB()
    const collection = db.collection(currentCollection)
    const data = await collection.find({}).toArray()

    if (format === "CSV") {
      const csv = data.map((row) => Object.values(row).join(",")).join("\n")
      const blob = new Blob([csv], { type: "text/csv" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = globalData[currentCollection].name + ".csv"
      a.click()
    }

    if (format === "JSON") {
      const json = JSON.stringify(data, null, 2)
      const blob = new Blob([json], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = globalData[currentCollection].name + ".json"
      a.click()
    }
  }

  /**
   * @description Add a new column to the table
   */
  const handleAddColumn = async () => {
    if (newColumnName !== "") {
      try {
        setLoading(true)
        console.log("currentCollection", currentCollection)
        const db = await connectToMongoDB()
        const collection = db.collection(currentCollection)
        const existingDocument = await collection.findOne({})
        if (existingDocument && newColumnName in existingDocument) {
          toast.warn("Column name already exists, please use a different column name")
          return
        }
        const newColumn = { field: newColumnName, header: newColumnName }
        setColumns([...columns, newColumn])
        const newInnerData = innerData.map((row) => ({ ...row, [newColumn.field]: "" }))
        setInnerData(newInnerData)
        await collection.updateMany({}, { $set: { [newColumnName]: "" } })
        toast.success("Column " + newColumnName + " added successfully")
        setNewColumnName("")
        setLoading(false)
      } catch (error) {
        console.error("Error adding column:", error)
        toast.error("Error adding column")
        setLoading(false)
      }
    } else {
      toast.warn("New column name cannot be empty")
    }
  }

  /**
   * @description Add rows to the table
   */
  const handleAddRow = async () => {
    if (!numRows || isNaN(numRows)) {
      toast.warn("Please enter a valid number for # of rows")
      return
    }
    try {
      setLoading(true)
      const newRows = Array.from({ length: numRows }, () => {
        const newRow = {}
        columns.forEach((col) => (newRow[col.field] = ""))
        return newRow
      })
      const db = await connectToMongoDB()
      const collection = db.collection(currentCollection)
      await collection.insertMany(newRows)
      setInnerData([...innerData, ...newRows])
      toast.success(numRows + " rows added successfully")
      setNumRows("")
      setLoading(false)
    } catch (error) {
      console.error("Error adding rows:", error)
      toast.error("Error adding rows")
      setLoading(false)
    }
  }

  return (
    <>
      <div style={{ textAlign: "center", marginBottom: "10px" }}>
        <Message severity="info" text={"The Basic Tools enable you to add rows and columns to a dataset, and export the dataset"} />
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-around",
          alignItems: "center",
          padding: "2px",
          flexWrap: "wrap"
        }}
      >
        <div style={{ display: "flex", marginLeft: "100px" }}>
          <InputText id="numRows" value={numRows} onChange={(e) => setNumRows(e.target.value)} style={{ width: "100px" }} placeholder="# of Rows" />
          <Button
            icon="pi pi-plus"
            onClick={handleAddRow}
            style={{
              width: "50px"
            }}
            loading={loading}
          />
        </div>
        <div style={{ display: "flex" }}>
          <InputText id="newColumnName" value={newColumnName} style={{ width: "130px" }} onChange={(e) => setNewColumnName(e.target.value)} placeholder="Column Name" />
          <Button
            icon="pi pi-plus"
            onClick={() => handleAddColumn()}
            style={{
              width: "50px"
            }}
            loading={loading}
          />
        </div>
        <SplitButton icon="pi pi-file-export" model={exportOptions} className="p-button-success" style={{ marginRight: "100px" }} tooltip="Export the dataset" tooltipOptions={{ position: "top" }} />
      </div>
    </>
  )
}

export default BasicToolsDB
