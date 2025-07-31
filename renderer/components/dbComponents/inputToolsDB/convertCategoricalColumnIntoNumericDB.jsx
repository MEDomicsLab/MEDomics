import React, { useState, useEffect, useContext } from "react"
import { Message } from "primereact/message"
import { DataTable } from "primereact/datatable"
import { Column } from "primereact/column"
import { Button } from "primereact/button"
import { toast } from "react-toastify"
import { connectToMongoDB } from "../../mongoDB/mongoDBUtils"
import { DataContext } from "../../workspace/dataContext"
import { Card } from "primereact/card"
import { Slider } from "primereact/slider"
import { InputNumber } from "primereact/inputnumber"
import { requestBackend } from "../../../utilities/requests"
import { ServerConnectionContext } from "../../serverConnection/connectionContext"
import { Tooltip } from 'primereact/tooltip'

const ConvertCategoricalColumnIntoNumericDB = ({ currentCollection }) => {
  const { globalData } = useContext(DataContext)
  const [data, setData] = useState([])
  const [columns, setColumns] = useState([])
  const [categoricalColumns, setCategoricalColumns] = useState([])
  const [loadingData, setLoadingData] = useState(false)
  const [loadingOW, setLoadingOW] = useState(false)
  const [loadingAP, setLoadingAP] = useState(false)
  const [originalData, setOriginalData] = useState([])
  const [modifiedColumns, setModifiedColumns] = useState([])
  const [highlightedColumns, setHighlightedColumns] = useState([])
  const [previousData, setPreviousData] = useState(null)
  const [previousColumns, setPreviousColumns] = useState(null)
  const [categoricalThreshold, setCategoricalThreshold] = useState(20)
  const [categoricalThresholdPercentage, setCategoricalThresholdPercentage] = useState("20%")
  const [allKeys, setAllKeys] = useState([])
  const [cleanedDocuments, setCleanedDocuments] = useState([])
  const { port } = useContext(ServerConnectionContext)
  const [removedColumns, setRemovedColumns] = useState([])

  const fetchData = async () => {
    setLoadingData(true)
    if (!currentCollection) {
      toast.warn("No collection selected.")
      return
    }

    try {
      const db = await connectToMongoDB()
      const collection = db.collection(globalData[currentCollection].id)

      const documents = await collection.find({}).limit(10).toArray()
      // Clean all the data
      const cleanedDocuments = cleanData(documents)

      setData(cleanedDocuments)
      // Stock the original data
      setOriginalData(cleanedDocuments)

      const allKeys = Object.keys(cleanedDocuments[0] || {}).filter((key) => key !== "_id")
      const columnStructure = allKeys.map((key) => ({
        field: key,
        header: key.charAt(0).toUpperCase() + key.slice(1)
      }))

      setColumns(columnStructure)
      setAllKeys(allKeys)
      setCleanedDocuments(cleanedDocuments)
      // Detect categorical columns
      identifyCategoricalColumns(allKeys, cleanedDocuments)
    } catch (error) {
      console.error("Error fetching data:", error)
      toast.error("An error occurred while fetching data.")
    } finally {
      setLoadingData(false)
    }
  }

  // Convert complex object into strings
  const cleanData = (documents) => {
    return documents.map((doc) => {
      const cleanedDoc = { ...doc }

      Object.keys(cleanedDoc).forEach((key) => {
        if (typeof cleanedDoc[key] === "object" && cleanedDoc[key] !== null) {
          cleanedDoc[key] = JSON.stringify(cleanedDoc[key])
        }
      })

      return cleanedDoc
    })
  }

  const markColumnAsModified = (column) => {
    // Mark the column as modified
    setModifiedColumns((prev) => [...new Set([...prev, column])])
  }

  const isDataModified = () => {
    // Compare both data to dectect any modification
    return JSON.stringify(data) !== JSON.stringify(originalData)
  }

  // Identify categorical columns
  const identifyCategoricalColumns = (allKeys, documents) => {
    const detectedColumns = allKeys.filter((key) => {
      const uniqueValues = [...new Set(documents.filter((doc) => doc[key]).map((doc) => doc[key]))]
      // Categorical threshold represent the minimum number of different value a column must have to be consider categorical
      return uniqueValues.length <= categoricalThreshold && uniqueValues.some((val) => isNaN(parseFloat(val)))
    })
    // Identify already encoded columns
    const alreadyEncodedColumn = allKeys.filter((key) => allKeys.some((col) => col.startsWith(`${key}__`)))

    setCategoricalColumns(detectedColumns.filter((col) => !alreadyEncodedColumn.includes(col)))
  }

  const oneHotEncodeColumn = (data, column) => {
    const uniqueValues = [...new Set(data.map((row) => row[column]))]

    return data.map((row) => {
      const encodedRow = { ...row }

      uniqueValues.forEach((value) => {
        const newColumnName = `${column}__${value}`
        encodedRow[newColumnName] = row[column] === value ? 1 : 0
      })

      return encodedRow
    })
  }

  const convertColumnToOneHot = async (column) => {
    try {
      setPreviousData([...data])
      setPreviousColumns([...columns])

      const removeColumn = modifiedColumns.includes(column)
      const encodedData = oneHotEncodeColumn(data, column, removeColumn)

      const uniqueValues = [...new Set(data.filter((row) => row[column]).map((row) => row[column]))]
      const newColumns = uniqueValues.map((value) => ({
        field: `${column}__${value}`,
        header: `${column}__${value}`
      }))

      setColumns((prevColumns) => [...prevColumns.filter((col) => col.field !== column), ...newColumns])

      setData(encodedData)
      setHighlightedColumns(newColumns.map((col) => col.field))

      setRemovedColumns((prev) => [...prev, column])

      markColumnAsModified(column)

      toast.success(`Column "${column}" has been one-hot encoded.`)
    } catch (error) {
      console.error("Error during One-Hot Encoding:", error)
      toast.error("An error occurred while encoding the column.")
    }
  }

  const undoChanges = () => {
    if (previousData && previousColumns) {
      // Restorve previous data
      setData(previousData)
      // Restore previous column
      setColumns(previousColumns)
      // Reset highlighted column to null
      setHighlightedColumns([])
      setModifiedColumns([])
      toast.info("Changes have been undone.")
    } else {
      toast.warn("No changes to undo.")
    }
  }

  const overwriteEncodedDataToDB = async () => {
    try {
      if (!globalData || !currentCollection || !data.length) {
        throw new Error("Missing database configuration or data")
      }

      const cleanedData = data.map((row) => {
        let newRow = { ...row }

        modifiedColumns.forEach((col) => {
          delete newRow[col]
        })

        return newRow
      })

      const requestBody = {
        collectionName: globalData[currentCollection]?.id,
        data: cleanedData
      }

      setLoadingOW(true)
      requestBackend(
        port,
        "/input/overwrite_encoded_data",
        requestBody,
        (response) => {
          setLoadingOW(false)
          if (response?.status === "success") {
            toast.success("Encoded data has been overwritten in the database!")
            setModifiedColumns([])
            setHighlightedColumns([])
            fetchData()
          } else {
            throw new Error("Failed to overwrite data")
          }
        },
        (error) => {
          setLoadingOW(false)
          console.error("Error from backend:", error)
        }
      )
    } catch (error) {
      setLoadingOW(false)
      console.error("Error overwriting encoded data:", error)
      toast.error("An unexpected error occurred.")
    }
  }

  const appendEncodedDataToDB = () => {
    try {
      if (!globalData || !currentCollection || !data.length) {
        throw new Error("Missing database configuration or data")
      }

      const restoredData = data.map((row) => {
        let restoredRow = { ...row }

        if (modifiedColumns.length > 0) {
          removedColumns.forEach((col) => {
            if (!(col in restoredRow)) {
              const originalValue = originalData.find((origRow) => origRow._id === row._id)?.[col]

              if (originalValue !== undefined) {
                restoredRow[col] = originalValue
              }
            }
          })
        }

        return restoredRow
      })

      const requestBody = {
        collectionName: globalData[currentCollection]?.id,
        data: restoredData
      }

      setLoadingAP(true)
      requestBackend(
        port,
        "/input/append_encoded_data",
        requestBody,
        (response) => {
          setLoadingAP(false)
          if (response?.status === "success") {
            toast.success("Encoded data has been appended to the database!")
            setModifiedColumns([])
            setHighlightedColumns([])
            fetchData()
          } else {
            throw new Error("Failed to append data")
          }
        },
        (error) => {
          setLoadingAP(false)
          console.error("Error from backend:", error)
        }
      )
    } catch (error) {
      setLoadingAP(false)
      console.error("Error appending encoded data:", error)
      toast.error("An unexpected error occurred.")
    }
  }

  useEffect(() => {
    fetchData()
    setAllKeys([])
  }, [currentCollection])

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: "5px"
      }}
    >
      {loadingData && <Message severity="info" text="Loading..." style={{ marginBottom: "15px" }} />}
      <Tooltip
      target=".experimental-tag"
      content="This tool is experimental and mostly intended for visual exploration. We recommand using the Learning Module for validated pipelines."
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

      <Message severity="info" text="This tool identifies categorical columns in your dataset and converts them to numeric using One-Hot Encoding." style={{ marginBottom: "15px" }} />
      <Message severity="success" text={`Current Collection: ${globalData[currentCollection]?.name || "None"}`} style={{ marginBottom: "15px" }} />
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
          value={categoricalThreshold}
          onChange={(e) => {
            setCategoricalThreshold(e.value)
            setCategoricalThresholdPercentage(`${e.value}%`)
            identifyCategoricalColumns(allKeys, cleanedDocuments)
          }}
          style={{ width: "70%", marginLeft: "10px", marginRight: "10px" }}
          min={1}
          max={100}
        />
        <InputNumber
          value={categoricalThresholdPercentage.replace("%", "")}
          onValueChange={(e) => {
            setCategoricalThreshold(e.value)
            setCategoricalThresholdPercentage(`${e.value}%`)
            identifyCategoricalColumns(allKeys, cleanedDocuments)
          }}
          mode="decimal"
          min={1}
          max={100}
          useGrouping={false}
          showButtons
          style={{ width: "80px", marginLeft: "10px" }}
        />
      </div>
      {data.length > 0 && (
        <Card style={{ width: "900px" }}>
          <DataTable value={data} paginator rows={5} rowsPerPageOptions={[5, 10]} className="p-datatable-gridlines">
            {columns.map((col) => (
              <Column
                key={col.field}
                field={col.field}
                header={col.header}
                sortable
                style={{
                  // Red if categorical and NOT already encoded
                  background: categoricalColumns.includes(col.field) ? "red" : "inherit",
                  // Red if highlighted
                  color: highlightedColumns.includes(col.field) ? "red" : "inherit"
                }}
                bodyStyle={{
                  // Red for modified cells
                  color: highlightedColumns.includes(col.field) ? "red" : "inherit",
                  // Red for highlighted cell if not already encoded
                  background: categoricalColumns.includes(col.field) ? "red" : "inherit"
                }}
              />
            ))}
          </DataTable>
        </Card>
      )}
      {categoricalColumns.length === 0 && (
        <Message severity="warn" text="No categorical columns detected." style={{ marginTop: "15px" }} />
      )}
      {categoricalColumns.length > 0 && (
        <div style={{ marginTop: "20px" }}>
          <h4>Categorical Columns</h4>
          <ul
            style={{
              display: "flex",
              alignItems: "center",
              marginBottom: "10px"
            }}
          >
            {modifiedColumns.length == 0 && (
              <span>
                {" "}
                {categoricalColumns
                  .map((col, index) => (
                    <li key={index} style={{ marginBottom: "10px" }}>
                      <span style={{ marginRight: "10px" }}>Convert Categorical Column into Numeric :</span>
                      <Button label={col} onClick={() => convertColumnToOneHot(col)} style={{ marginLeft: "10px", marginTop: "5px", display: "inline-block" }} />
                    </li>
                  ))}
              </span>
            )}
          </ul>
        </div>
      )}
      {modifiedColumns.length > 0 && <Button label={`Undo Changes:  ${modifiedColumns}`} className="p-button-danger" onClick={undoChanges} style={{ marginTop: "20px", marginRight: "10px" }} />}
      {isDataModified() && <Button label="Overwrite Current Dataset" className="p-button-success" loading={loadingOW} onClick={overwriteEncodedDataToDB} style={{ marginTop: "20px" }} />}{" "}
      {isDataModified() && <Button label="Append New Columns to Dataset" className="p-button-success" loading={loadingAP} onClick={appendEncodedDataToDB} style={{ marginTop: "20px" }} />}{" "}
    </div>
  )
}

export default ConvertCategoricalColumnIntoNumericDB