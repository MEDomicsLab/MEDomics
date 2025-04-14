import React, { useState, useEffect, useContext } from "react"
import { Message } from "primereact/message"
import { DataTable } from "primereact/datatable"
import { Column } from "primereact/column"
import { Button } from "primereact/button"
import { toast } from "react-toastify"
import { connectToMongoDB } from "../../mongoDB/mongoDBUtils"
import { DataContext } from "../../workspace/dataContext"
import { Card } from "primereact/card"
import { Skeleton } from "primereact/skeleton"
import { ScrollPanel } from "primereact/scrollpanel"
import { requestBackend } from "../../../utilities/requests"
import { ServerConnectionContext } from "../../serverConnection/connectionContext"

const DropDuplicatesToolsDB = ({ currentCollection }) => {
  const { globalData } = useContext(DataContext)
  const [data, setData] = useState([])
  const [columns, setColumns] = useState([])
  const [duplicateColumns, setDuplicateColumns] = useState([])
  const [selectedColumn, setSelectedColumn] = useState(null)
  const [loadingData, setLoadingData] = useState(false)
  const [loadingDuplicates, setLoadingDuplicates] = useState(false)
  const { port } = useContext(ServerConnectionContext)

  const fetchData = async () => {
    setLoadingData(true)
    if (!currentCollection) {
      toast.warn("No collection selected.")
      return
    }

    try {
      const db = await connectToMongoDB()
      const collection = db.collection(currentCollection)

      const documents = await collection.find({}).limit(10).toArray()
      setData(documents)

      const sampleDocument = documents[0]
      if (sampleDocument) {
        const allKeys = Object.keys(sampleDocument).filter((key) => key !== "_id")
        const columnStructure = allKeys.map((key) => ({
          field: key,
          header: key.charAt(0).toUpperCase() + key.slice(1)
        }))
        setColumns(columnStructure)

        findDuplicateColumns(allKeys, collection)
      }
    } catch (error) {
      console.error("Error fetching data:", error)
      toast.error("An error occurred while fetching data.")
    } finally {
      setLoadingData(false)
    }
  }

  // Calls the python backend to detect duplicated columns.
  // Returns duplicated columns for deletion
  const findDuplicateColumns = async () => {
    setLoadingDuplicates(true)

    try {
      const requestBody = {
        collectionName: globalData[currentCollection]?.id
      }

      requestBackend(
        port,
        "/input/find_duplicate_columns_DB",
        requestBody,
        (response) => {
          console.log(" Réponse backend :", response)

          if (response?.duplicates) {
            // Store duplicated columns into a state for future deletion
            setDuplicateColumns(
              response.duplicates.map(([c1, c2]) => ({
                column1: c1,
                column2: c2
              }))
            )
          } else {
            toast.warn("No duplicates found or response format incorrect.")
            console.warn(" Format inattendu :", response)
          }

          setLoadingDuplicates(false)
        },
        (error) => {
          console.log("erreur: ", error)
          toast.error("Error finding duplicate columns.")
          setLoadingDuplicates(false)
        }
      )
    } catch (error) {
      console.error("Unexpected error:", error)
      toast.error("Unexpected error while finding duplicate columns.")
      setLoadingDuplicates(false)
    }
  }

  // Delete selected columns then refresh data to display up to date data form MongoDB
  const handleDeleteColumn = async () => {
    if (!selectedColumn) {
      toast.warn("Please select a column to delete.")
      return
    }

    try {
      const db = await connectToMongoDB()
      const collection = db.collection(globalData[currentCollection].id)

      await collection.updateMany({}, { $unset: { [selectedColumn]: "" } })

      toast.success(`Column "${selectedColumn}" has been deleted.`)
      setSelectedColumn(null)
      await fetchData()
    } catch (error) {
      console.error("Error deleting column:", error)
      toast.error("An error occurred while deleting the column.")
    }
  }

  useEffect(() => {
    fetchData()
  }, [currentCollection])

  useEffect(() => {
    setDuplicateColumns([])
    setSelectedColumn(null)
  }, [])

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
      <Message severity="info" text="This tool identifies duplicate columns in your dataset and allows you to choose one for deletion." style={{ marginBottom: "15px" }} />
      <Message severity="success" text={`Current Collection: ${globalData[currentCollection]?.name || "None"}`} style={{ marginBottom: "15px" }} />
      {data.length > 0 && (
        <Card style={{ width: "900px" }}>
          <DataTable value={data} paginator rows={5} rowsPerPageOptions={[5, 10, 15]} className="p-datatable-gridlines">
            {columns.map((col) => (
              <Column
                key={col.field}
                field={col.field}
                header={col.header}
                sortable
                style={{
                  backgroundColor: col.field === selectedColumn ? "#ee6b6e" : "transparent"
                }} // Highlight the selected column
              />
            ))}
          </DataTable>
        </Card>
      )}
      {loadingDuplicates && (
        <div className="w-full md:w-6 p-3" style={{ width: "900px" }}>
          <h5>Finding duplicate columns...</h5>
          <Skeleton className="mb-2" borderRadius="16px"></Skeleton>
          <Skeleton width="10rem" className="mb-2" borderRadius="16px"></Skeleton>
          <Skeleton width="5rem" borderRadius="16px" className="mb-2"></Skeleton>
        </div>
      )}
      {duplicateColumns.length > 0 && (
        <>
          <h5 style={{ marginTop: "20px" }}>Duplicate Columns</h5>
          <ScrollPanel style={{ width: "100%", height: "300px", marginTop: "20px" }}>
            {duplicateColumns.map((pair, index) => (
              <li key={index} style={{ marginBottom: "10px" }}>
                {pair.column1} and {pair.column2}{" "}
                <Button
                  outlined
                  size="small"
                  label={`Delete ${pair.column2}`}
                  className="p-button-danger"
                  onClick={() => setSelectedColumn(pair.column2)}
                  style={{
                    marginLeft: "10px",
                    marginTop: "5px",
                    display: "inline-block",
                    alignItems: "flex-end"
                  }}
                />
              </li>
            ))}
          </ScrollPanel>
        </>
      )}

      {selectedColumn && (
        <div style={{ marginTop: "20px", textAlign: "center" }}>
          <h5>Selected Column: {selectedColumn}</h5>
          <Button outlined size="small" label="Confirm Delete" icon="pi pi-trash" className="p-button-danger" onClick={handleDeleteColumn} />
        </div>
      )}
    </div>
  )
}

export default DropDuplicatesToolsDB
