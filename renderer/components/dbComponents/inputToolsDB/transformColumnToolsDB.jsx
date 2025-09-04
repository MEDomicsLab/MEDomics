/* eslint-disable no-unused-vars */
import React, { useContext, useEffect, useState } from "react"
import { MultiSelect } from "primereact/multiselect"
import { SplitButton } from "primereact/splitbutton"
import { Button } from "primereact/button"
import { Message } from "primereact/message"
import { toast } from "react-toastify"
import { saveAs } from "file-saver"
import { getCollectionColumns } from "../../mongoDB/mongoDBUtils"
import { ServerConnectionContext } from "../../serverConnection/connectionContext"
import { requestBackend } from "../../../utilities/requests"

/**
 * @description
 * This component provides tools to transform columns in a dataset.
 * @param {Object} props
 * @param {string} props.currentCollection - Current collection
 * @param {Function} props.refreshData - Function to refresh the data
 */
const TransformColumnToolsDB = ({ currentCollection }) => {
  const [isHovered, setIsHovered] = useState(false)
  const [selectedColumns, setSelectedColumns] = useState([])
  const [columns, setColumns] = useState([])
  const [fileName, setFileName] = useState("Choose File")
  const [loading, setLoading] = useState(false)
  const [loadingDelButton, setLoadingDelButton] = useState(false)
  const { port } = useContext(ServerConnectionContext)
  const customFileUpload = {
    padding: "6px 12px",
    cursor: "pointer",
    backgroundColor: isHovered ? "grey" : "darkgrey",
    color: "white",
    border: "none",
    borderRadius: "4px"
  }

  // Fetch columns without fetching the whole collection
  useEffect(() => {
    const fetchColumns = async () => {
      const columns = await getCollectionColumns(currentCollection)
      const filteredColumns = columns.filter((col) => col !== "_id")
      setColumns(filteredColumns)
    }
    fetchColumns()
  }, [currentCollection])

  // Handle exporting selected columns
  const handleExportColumns = async () => {
    if (selectedColumns.length === 0) {
      toast.warn("No columns selected for export")
      return
    }
    const blob = new Blob([selectedColumns.join(",")], { type: "text/csv;charset=utf-8" })
    saveAs(blob, "columns.csv")
  }

  // Handle deleting selected columns
  const handleDeleteColumns = async () => {
    let jsonToSend = {}
    jsonToSend["collection"] = currentCollection
    jsonToSend["columns"] = selectedColumns

    setLoadingDelButton(true)
    const response = await requestBackend(
      port,
      "/input/delete_columns/",
      jsonToSend,
      async (response) => {
        setLoadingDelButton(false)
        toast.success("Columns deleted successfully")
        setSelectedColumns([])
      },
      (error) => {
        setLoadingDelButton(false)
        console.error("Failed to delete columns:", error)
      }
    )
  }

  const transformData = async (type, collection) => {
    let jsonToSend = {}
    jsonToSend["collection"] = collection
    jsonToSend["columns"] = selectedColumns
    jsonToSend["type"] = type

    setLoading(true)

    const response = await requestBackend(
      port,
      "/input/transform_columns/",
      jsonToSend,
      async (response) => {
        setLoading(false)
        toast.success("Columns transformed successfully")
      },
      (error) => {
        setLoading(false)
        console.error("Failed to transform columns:", error)
      }
    )
  }

  return (
    <>
      <div style={{ textAlign: "center", marginBottom: "10px" }}>
        
        <Message
          severity="info"
          text="The Encode Column Tools provide functionalities to alter dataset columns. This includes converting selected columns to binary, replacing empty cells with zeros, and facilitating the import and export of column lists."
        />
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
        <MultiSelect
          value={selectedColumns}
          options={columns}
          display="chip"
          onChange={(e) => {
            setSelectedColumns(e.value)
          }}
          filter
          placeholder="Select Columns"
          style={{ marginRight: "5px", width: "200px" }}
        />
        <SplitButton
          label="Transform"
          model={[
            {
              label: "Binary",
              command: () => {
                if (selectedColumns.length > 0) {
                  transformData("Binary", currentCollection)
                } else {
                  toast.warn("No columns selected for transformation")
                }
              }
            },
            {
              label: "Non-empty",
              command: () => {
                if (selectedColumns.length > 0) {
                  transformData("Non-empty", currentCollection)
                } else {
                  toast.warn("No columns selected for transformation")
                }
              }
            }
          ]}
          loading={loading}
          className="p-button-success"
          style={{
            width: "auto",
            marginRight: "5px"
          }}
          tooltip="Transform selected columns"
          tooltipOptions={{ position: "top" }}
        />
        <Button
          icon="pi pi-file-export"
          onClick={handleExportColumns}
          className="p-button-success"
          style={{
            width: "50px",
            marginRight: "2px"
          }}
          tooltip="Export selected columns"
          tooltipOptions={{ position: "top" }}
        />
        <Button
          icon="pi pi-trash"
          onClick={handleDeleteColumns}
          className="p-button-danger"
          style={{
            width: "50px",
            marginRight: "2px"
          }}
          loading={loadingDelButton}
          tooltip="Delete selected columns"
          tooltipOptions={{ position: "top" }}
        />
      </div>
    </>
  )
}

export default TransformColumnToolsDB
