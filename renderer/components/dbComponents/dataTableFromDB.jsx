import { randomUUID } from "crypto"
import { saveAs } from "file-saver"
import { ObjectId } from "mongodb"
import { Button } from "primereact/button"
import { Chip } from "primereact/chip"
import { Column } from "primereact/column"
import { confirmDialog } from "primereact/confirmdialog"
import { DataTable } from "primereact/datatable"
import { Dialog } from "primereact/dialog"
import { InputText } from "primereact/inputtext"
import { Message } from "primereact/message"
import { Skeleton } from "primereact/skeleton"
import React, { useEffect, useState } from "react"
import { toast } from "react-toastify"
import { connectToMongoDB, getCollectionTags, insertMEDDataObjectIfNotExists } from "../mongoDB/mongoDBUtils"
import { MEDDataObject } from "../workspace/NewMedDataObject"
import InputToolsComponent from "./InputToolsComponent"
import { collectionExists, getCollectionData } from "./utils"

/**
 * DataTableFromDB component
 * This component renders a DataTable from MongoDB data.
 * @param data - MongoDB data
 * @param tablePropsData - DataTable props
 * @param tablePropsColumn - Column props
 * @param isReadOnly - Read-only mode
 */
const DataTableFromDB = ({ data, tablePropsData, tablePropsColumn, isReadOnly }) => {
  const [innerData, setInnerData] = useState([])
  const [columns, setColumns] = useState([])
  const [collectionSize, setCollectionSize] = useState(0)
  const [hoveredButton, setHoveredButton] = useState(null)
  const [hoveredTag, setHoveredTag] = useState({ field: null, index: null })
  const [lastEdit, setLastEdit] = useState(Date.now())
  const [viewData, setViewData] = useState([])
  const [viewMode, setViewMode] = useState(false)
  const [viewName, setViewName] = useState("")
  const [viewCount, setViewCount] = useState(0)
  const [userSetViewName, setUserSetViewName] = useState("")
  const [rowToDelete, setRowToDelete] = useState(null)
  const [columnToDelete, setColumnToDelete] = useState(null)
  const [rowTags, setRowTags] = useState([])
  const [lastPipeline, setLastPipeline] = useState([])
  const [loadingData, setLoadingData] = useState(true)
  const [lazyParams, setLazyParams] = useState({ first: 0, rows: 10 })
  const [viewLazyParams, setViewLazyParams] = useState({ first: 0, rows: 10 })
  const items = Array.from({ length: 7 }, (v, i) => i) //  Fake items for the skeleton upload
  const forbiddenCharacters = /[\\."$*<>:|?]/
  const exportOptions = [
    {
      label: "CSV",
      command: () => {
        handleExport("CSV")
      }
    },
    {
      label: "JSON",
      command: () => {
        handleExport("JSON")
      }
    }
  ]
  const buttonStyle = (id) => ({
    borderRadius: "10px",
    backgroundColor: hoveredButton === id ? "#d32f2f" : "#cccccc",
    color: "white",
    border: "none",
    padding: "2px",
    opacity: isReadOnly ? 0.5 : 1,
    cursor: isReadOnly ? "not-allowed" : "pointer"
  })

  const dataTableStyle = {
    height: "100%",
    overflow: "auto"
  }

  const fetchRowTags = async () => {
    const db = await connectToMongoDB();
    const tags = await db.collection('row_tags').find({}).toArray();
    setRowTags(tags);
    console.log(tags)
  };

  // Fetch the row tags when the component mounts
  useEffect(() => {
    fetchRowTags();
  }, []);

  // Fetch data from MongoDB on component mount
  useEffect(() => {
    const getData = async () => {
      // Get total count of documents in the collection
      const db = await connectToMongoDB()
      const collection = db.collection(data.id)
      const count = await collection.countDocuments()
      setCollectionSize(count)
      console.log("Fetching data with:", data)
      let collectionName = data.extension === "view" ? data.name : data.id
      getCollectionData(collectionName, lazyParams.first, lazyParams.rows)
        .then((fetchedData) => {
          console.log("Fetched data:", fetchedData)
          let collData = fetchedData.map((item) => {
            let keys = Object.keys(item)
            let values = Object.values(item)
            let dataObject = {}
            for (let i = 0; i < keys.length; i++) {
              dataObject[keys[i]] = keys[i] === "_id" ? item[keys[i]].toString() : values[i];
            }
            return dataObject
          })
          setInnerData(collData)
        })
        .catch((error) => {
          console.error("Failed to fetch data:", error)
        })
        .finally(() => {
          // Set loading to false after data has been fetched (whether successful or failed)
          setLoadingData(false)
        })
    }
    if (data && data.id) {
      getData()
    } else {
      console.warn("Invalid data prop:", data);
    }
  }, [data, lazyParams])


  // Update columns when innerData changes
  useEffect(() => {
    console.log("innerData updated:", innerData)
    if (innerData.length > 0) {
      const allKeys = new Set()
      innerData.forEach((item) => {
        Object.keys(item).forEach((key) => allKeys.add(key))
      })
      const keys = Array.from(allKeys).filter((key) => key !== "_id")
      const newColumns = keys.map((key) => ({ field: key, header: key }))
      // Check if any column name has an empty space
      let hasEmptySpace = newColumns.filter((column) => column.field.includes(" "))
      hasEmptySpace = hasEmptySpace.map((column) => column.field)
      if (hasEmptySpace.length > 0) {
        toast.warn("Warning: column names should not contain empty spaces. Check console for more details.")
        console.warn("The following column names contain empty spaces:", hasEmptySpace, " This will cause issues for machine learning modules.")
      }
      setColumns(newColumns)
    }
  }, [innerData])

  // Monitor innerData changes and updated loading state
  useEffect(() => {
    if (innerData.length > 0) {
      setLoadingData(false)
    }
  })

  // Log columns when updated
  useEffect(() => {
    console.log("columns updated:", columns)
  }, [columns])

  // Get columns from data
  const getColumnsFromData = (data) => {
    if (data.length > 0) {
      return Object.keys(data[0])
        .filter((key) => key !== "_id")
        .map((key) => <Column key={key} field={key} header={key} {...tablePropsColumn} />)
    }
    return null
  }

  // Update data in MongoDB
  const updateDatabaseData = async (collectionName, id, field, newValue) => {
    try {
      setLoadingData(true)
      const db = await connectToMongoDB()
      const collection = db.collection(collectionName)
      console.log(`Updating document with _id: ${id}, setting ${field} to ${newValue}`)
      const result = await collection.updateOne({ _id: new ObjectId(id) }, { $set: { [field]: newValue } })
      console.log("Update result:", result)
      if (result.modifiedCount === 0) {
        console.error("No documents were updated")
      }
      setLoadingData(false)
    } catch (error) {
      console.error("Error updating data:", error)
      setLoadingData(false)
    }
  }

  // Delete data from MongoDB
  const deleteDatabaseData = async (collectionName, id) => {
    try {
      setLoadingData(true)
      const db = await connectToMongoDB()
      const collection = db.collection(collectionName)
      console.log(`Deleting document with _id: ${id}`)
      const result = await collection.deleteOne({ _id: new ObjectId(id) })
      console.log("Delete result:", result)
      if (result.deletedCount === 0) {
        console.error("No documents were deleted")
      } else {
        setInnerData(innerData.filter((item) => item._id !== id))
      }
      setLoadingData(false)
    } catch (error) {
      console.error("Error deleting data:", error)
      setLoadingData(false)
    }
  }

  // Insert data into MongoDB
  const insertDatabaseData = async (collectionName, data) => {
    try {
      setLoadingData(true)
      const db = await connectToMongoDB()
      const collection = db.collection(collectionName)
      console.log(`Inserting document: ${JSON.stringify(data)}`)
      const result = await collection.insertOne(data)
      console.log("Insert result:", result)
      setLoadingData(false)
      return result.insertedId.toString()
    } catch (error) {
      console.error("Error inserting data:", error)
      setLoadingData(false)
    }
  }

  // Handle cell edit completion
  const onCellEditComplete = (e) => {
    setLoadingData(true)
    let { rowData, newValue, field } = e
    if (newValue === "" || newValue === null) {
      newValue = null
    } else if (!isNaN(newValue)) {
      if (Number.isInteger(parseFloat(newValue))) {
        newValue = parseInt(newValue)
      } else {
        newValue = parseFloat(newValue)
      }
    }
    rowData[field] = newValue
    if (!rowData._id) {
      console.log("Calling insertDatabaseData with:", {
        Filename: data.name,
        collectionName: data.id,
        data: rowData
      })
      insertDatabaseData(data.path, data.id, rowData)
        .then((id) => {
          console.log("Database inserted successfully")
          rowData._id = id
          setInnerData([...innerData])
        })
        .catch((error) => {
          console.error("Failed to insert database:", error)
        })
    } else {
      console.log("Calling updateDatabaseData with:", {
        Filename: data.name,
        collectionName: data.id,
        id: rowData._id,
        field,
        newValue
      })
      updateDatabaseData(data.path, data.id, rowData._id, field, newValue)
        .then(() => {
          console.log("Database updated successfully")
          setLastEdit(Date.now())
        })
        .catch((error) => {
          console.error("Failed to update database:", error)
        })
    }
    setLoadingData(false)
  }

  // Handle row deletion
  const onDeleteRow = (rowData) => {
    setLoadingData(true)
    const { _id } = rowData
    console.log("Deleting row with _id:", _id)
    deleteDatabaseData(data.path, data.id, _id)
      .then(() => {
        console.log("Row deleted successfully")
      })
      .catch((error) => {
        console.error("Failed to delete row:", error)
      })
    setLoadingData(false)
  }

  // Handle column deletion
  const onDeleteColumn = async (field) => {
    setLoadingData(true)
    setColumns(columns.filter((column) => column.field !== field))
    setInnerData(
      innerData.map((row) => {
        // eslint-disable-next-line no-unused-vars
        const { [field]: _, ...rest } = row
        return rest
      })
    )
    try {
      const db = await connectToMongoDB()
      const collection = db.collection(data.id)
      console.log(`Deleting field ${field} from all documents`)
      const result = await collection.updateMany({}, { $unset: { [field]: "" } })
      console.log("Delete column result:", result)
      if (result.modifiedCount === 0) {
        console.error("No documents were updated")
      }
    } catch (error) {
      console.error("Error deleting column:", error)
    }
    setLoadingData(false)
  }

  // Text editor for cell editing
  const textEditor = (options) => {
    return <InputText type="text" value={options.value} onChange={(e) => options.editorCallback(e.target.value)} onKeyDown={(e) => e.stopPropagation()} style={{ width: "100%" }} />
  }

  // Refresh data from MongoDB
  const refreshData = async () => {
    if (data && data.id) {
      setLoadingData(true)
      getCollectionData(data.id, lazyParams.first, lazyParams.rows)
        .then((fetchedData) => {
          let collData = fetchedData.map((item) => {
            let keys = Object.keys(item)
            let values = Object.values(item)
            let dataObject = {}
            for (let i = 0; i < keys.length; i++) {
              dataObject[keys[i]] = keys[i] === "_id" ? item[keys[i]].toString() : values[i]
            }
            return dataObject
          })
          setInnerData(collData)
        })
        .catch((error) => {
          console.error("Failed to fetch data:", error)
        })
      setLoadingData(false)
    } else {
      console.warn("Invalid data prop:", data)
    }
    // Refresh row tags
    const db = await connectToMongoDB()
    const tags = await db.collection('row_tags').find({}).toArray()
    setRowTags(tags)
  }

  // Export data to CSV or JSON
  function handleExport(format) {
    setLoadingData(true)
    if (format === "CSV") {
      const headers = columns.map((column) => column.field)
      const csvData = [headers.join(",")]
      csvData.push(
        ...innerData.map((row) => {
          let csvRow = ""
          for (const [, value] of Object.entries(row)) {
            csvRow += value + ","
          }
          return csvRow.slice(0, -1)
        })
      )
      const csvString = csvData.join("\n")
      const blob = new Blob([csvString], { type: "text/csv;charset=utf-8" })
      saveAs(blob, data.uuid + ".csv")
    } else if (format === "JSON") {
      const jsonBlob = new Blob([JSON.stringify(innerData)], { type: "application/json" })
      saveAs(jsonBlob, data.uuid + ".json")
    } else {
      toast.warn("Please select a format to export")
    }
    setLoadingData(false)
  }

  // Function to generate a random UUID
  const usePersistentUUID = () => {
    const [id, setId] = useState("")
    useEffect(() => {
      let uuid = localStorage.getItem("myUUID")
      if (!uuid) {
        uuid = "column_tags"
        localStorage.setItem("myUUID", uuid)
      }
      setId(uuid)
    }, [])
    return id
  }

  const tagId = usePersistentUUID()
  const [columnNameToTagsMap, setColumnNameToTagsMap] = useState({})

  useEffect(() => {
    setColumnNameToTagsMap({})

    async function fetchData() {
      console.log("tagId", tagId)
      const exists = await collectionExists(tagId)
      if (exists) {
        let tagCollData = await getCollectionTags(data.id)
        tagCollData = await tagCollData.toArray()
        const map = createColumnNameToTagsMap(tagCollData)
        setColumnNameToTagsMap(map)
      }
    }

    fetchData()
  }, [tagId])

  // Function to create a map of column names to tags
  function createColumnNameToTagsMap(tagCollData) {
    const map = {}
    tagCollData.forEach((item) => {
      map[item.column_name] = item.tags.join(", ")
    })
    return map
  }

  // Function to retrieve tags for a given column name
  function getColumnTags(columnName) {
    const tags = columnNameToTagsMap[columnName]
    return tags ? tags.split(", ") : []
  }

  // Backend to delete a tag from a column
  const DeleteTagFromColumn = async (tag) => {
    // Connect to db
    const db = await connectToMongoDB()
    const tagsCollection = await db.collection(tagId)
    const listTags = await tagsCollection.find({"column_name": hoveredTag.field, "collection_id": data.id}).toArray()
    const tagToDelete = listTags.find((item) => item.tags.includes(tag))
    if (!tagToDelete) {
      console.error("Tag not found in column")
      toast.error("Failed to delete tag.")
      return
    }

    const result = await tagsCollection.updateOne(
      { "column_name": hoveredTag.field, "collection_id": data.id },
      { $pull: { tags: tag } }
    )
    if (result.modifiedCount === 0) {
      console.error("No documents were updated")
      toast.error("Failed to delete row tag.")
    } else {
      console.log("Row tag deleted successfully")
      toast.success("Row tag deleted successfully.")
      const updatedMap = { ...columnNameToTagsMap }
      const tags = updatedMap[hoveredTag.field]
      const updatedTags = tags.split(", ").filter((t) => t !== tag)
      updatedMap[hoveredTag.field] = updatedTags.join(", ")
      setColumnNameToTagsMap(updatedMap)
    }
    return
  }

  const [tagColorMap, setTagColorMap] = useState(() => {
    const savedMap = localStorage.getItem("tagColorMap")
    return savedMap ? JSON.parse(savedMap) : {}
  })

  // Function to generate a new color for a tag
  function generateColor() {
    const r = Math.floor(Math.random() * (255 - 150 + 1)) + 150
    const g = Math.floor(Math.random() * (255 - 150 + 1)) + 150
    const b = Math.floor(Math.random() * (255 - 150 + 1)) + 150
    const newColor = `rgb(${r}, ${g}, ${b})`
    return newColor
  }

  function getColorForTag(tag) {
    if (tagColorMap[tag]) {
      return tagColorMap[tag]
    } else {
      const newColor = generateColor()
      const updatedMap = { ...tagColorMap, [tag]: newColor }
      setTagColorMap(updatedMap)
      localStorage.setItem("tagColorMap", JSON.stringify(updatedMap))
      return newColor
    }
  }

  /**
   * @description Function to show a preview of the changes made to the data (row deletion)
   * @param {Object} rowData - The row data
   * @returns {void}
   */
  const viewRowDeletion = async (rowData) => {
    // Connect to mongoDB and get the current collection
    const db = await connectToMongoDB()

    // Find row index
    let rowIndex = innerData.findIndex((row) => row._id === rowData._id) + 1

    // Create a view
    let view = "DeletingRow_" + rowIndex + "_" + data.name

    // Drop the view if it exists (optional)
    await db.command({ drop: view }).catch(() => {
      console.warn("View does not exist")
    })

    // Create a view with aggregation pipeline
    let pipeline = [{ $match: { _id: { $ne: ObjectId.createFromHexString(rowData._id) } } }]
    await db.createCollection(view, {
      viewOn: data.id, // The source collection
      pipeline: pipeline
    })
    setLastPipeline(pipeline) // Save the pipeline for future use

    // Fetch the data from the view
    getCollectionData(view, viewLazyParams.first, viewLazyParams.rows)
      .then((fetchedData) => {
        let collData = fetchedData.map((item) => {
          let keys = Object.keys(item)
          let values = Object.values(item)
          let dataObject = {}
          for (let i = 0; i < keys.length; i++) {
            dataObject[keys[i]] = keys[i] === "_id" ? item[keys[i]].toString() : values[i]
          }
          return dataObject
        })
        setViewData(collData)
      })
      .catch((error) => {
        console.error("Failed to fetch data:", error)
      })

    // Set the state to display the updated preview data
    setViewName(view)
    setRowToDelete(rowData)
    setColumnToDelete(null)
    setViewMode(true)
  }

  /**
   * @description Function to show a preview of the changes made to the data (column deletion)
   * @param {Object} colName - The column name to delete
   * @returns {void}
   */
  const viewColumnDeletion = async (colName) => {
    // Connect to mongoDB and get the current collection
    const db = await connectToMongoDB()

    // Create a view
    let view = "DeletingColumn_" + colName + "_" + data.name

    // Drop the view if it exists (optional)
    await db.command({ drop: view }).catch(() => {
      console.warn("View does not exist")
    })

    // Create a view with aggregation pipeline
    let pepeline = [
      {
        $unset: [colName]
      }
    ]
    await db.createCollection(view, {
      viewOn: data.id, // The source collection
      pipeline: pepeline
    })
    setLastPipeline(pepeline) // Save the pipeline for future use

    // Fetch the data from the view
    getCollectionData(view, viewLazyParams.first, viewLazyParams.rows)
      .then((fetchedData) => {
        let collData = fetchedData.map((item) => {
          let keys = Object.keys(item)
          let values = Object.values(item)
          let dataObject = {}
          for (let i = 0; i < keys.length; i++) {
            dataObject[keys[i]] = keys[i] === "_id" ? item[keys[i]].toString() : values[i]
          }
          return dataObject
        })
        setViewData(collData)
      })
      .catch((error) => {
        console.error("Failed to fetch data:", error)
      })

    // Update view information
    setViewName(view)
    setRowToDelete(null)
    setColumnToDelete(colName)
    setViewMode(true)
    setViewCount(collectionSize - 1)
  }

  // track changes of view
  useEffect(() => {
    if (viewName){
      console.log("View name is:", viewName)

      // Fetch new data
      getCollectionData(viewName, viewLazyParams.first, viewLazyParams.rows)
        .then((fetchedData) => {
          let collData = fetchedData.map((item) => {
            let keys = Object.keys(item)
            let values = Object.values(item)
            let dataObject = {}
            for (let i = 0; i < keys.length; i++) {
              dataObject[keys[i]] = keys[i] === "_id" ? item[keys[i]].toString() : values[i]
            }
            return dataObject
          })
          setViewData(collData)
        })
        .catch((error) => {
          console.error("Failed to fetch data:", error)
        })
    }
  }
  , [viewLazyParams])

  /**
   * @description Function to confirm the deletion of a row or column
   * @returns {void}
   */
  const onConfirmDeletion = async () => {
    // Check if eveything is set
    if (rowToDelete && columnToDelete) {
      console.error("Both row and column to delete are set")
      return
    }
    if (rowToDelete) {
      onDeleteRow(rowToDelete)
      toast.success("Row deleted successfully.")
    } else if (columnToDelete) {
      onDeleteColumn(columnToDelete)
      toast.success("Column deleted successfully.")
    }
    setViewMode(false)
  }

  /**
   * @description Function to save the view and add it to the database
   */
  const saveView = async () => {
    // Connect to mongoDB
    const db = await connectToMongoDB()

    // Check if the view already exists
    let overwriteConfirmation = true
    const viewExists = await db.listCollections({ name: userSetViewName + ".csv" }).hasNext()
    // Show a confirmation dialog to overwrite it
    if (viewExists) {
      overwriteConfirmation = await new Promise((resolve) => {
        confirmDialog({
          closable: false,
          message: `A view with the name "${userSetViewName}" already exists in the database. Do you want to overwrite it?`,
          header: "Confirmation",
          icon: "pi pi-exclamation-triangle",
          accept: () => resolve(true),
          reject: () => resolve(false)
        })
      })
    }
    if (!overwriteConfirmation) {
      return
    } else {
      // drop the old view
      await db.command({ drop: userSetViewName + ".csv" }).catch(() => {
        console.warn(`View ${userSetViewName} does not exist`)
      })
    }

    // Drop the old view
    console.log("Dropping view", viewName)
    await db.command({ drop: viewName }).catch(() => {
      console.warn(`View ${viewName} does not exist`)
    })

    // Create view using the last used pipeline
    let view = userSetViewName + ".csv"
    await db.createCollection(view, {
      viewOn: data.id, // The source collection
      pipeline: lastPipeline
    })

    // Insert the view into the MEDDataObject collection
    // Get data parent ID
    const collection = db.collection("medDataObjects")
    const existingObjectByAttributes = await collection.findOne({ id: data.id })
    if (!existingObjectByAttributes) {
      toast.error("Cannot create a view: Data not found in collection")
      console.error("Cannot create a view: Data id not found. ID of the data variable ", data.id, " not found in the database")
      return
    }
    // Create a new MEDDataObject
    const viewObject = new MEDDataObject({
      id: randomUUID(),
      name: view,
      type: "view",
      parentID: existingObjectByAttributes.parentID,
      childrenIDs: [],
      inWorkspace: false
    })
    await insertMEDDataObjectIfNotExists(viewObject)
    MEDDataObject.updateWorkspaceDataObject()

    // Drop the old view
    await db.command({ drop: viewName }).catch(() => {
      console.warn(`View ${viewName} does not exist`)
    })

    // Hide the panel
    toast.success("View saved successfully!")
    setUserSetViewName("")
    setViewMode(false)
  }

  /**
   * @description Function to cancel the changes made to the data
   */
  const onCancelChanges = async () => {
    // Hide the panel and reset the state
    setViewMode(false)
    setUserSetViewName("")
    setViewData([])
    setViewName("")
    setRowToDelete(null)
    setColumnToDelete(null)
    setViewCount(0)
    // Delete the view
    const db = await connectToMongoDB()
    await db.command({ drop: viewName }).catch(() => {
      console.warn(`View ${viewName} does not exist`)
    })
  }

  // Remember to use useEffect to update local storage when tagColorMap changes
  useEffect(() => {
    localStorage.setItem("tagColorMap", JSON.stringify(tagColorMap))
  }, [tagColorMap])

  async function DeleteTagFromRow(group, id) {
    console.log("Deleting tag from row:", group)
    console.log("Row ID:", id)
    console.log("data", data)

    // Connect to db and delete the tag
    const db = await connectToMongoDB()
    const tagsCollection = await db.collection("row_tags")
    const result = await tagsCollection.updateOne(
        { "data._id": new ObjectId(id) },
        { $pull: { "data.$.groupNames": group } }
    )
    if (result.modifiedCount === 0) {
      console.error("No documents were updated")
      toast.error("Failed to delete row tag.")
    } else {
      console.log("Row tag deleted successfully")
      toast.success("Row tag deleted successfully.")
      refreshData()
    }
    return
  }

  const renderDeleteIconRowTags = (rowData) => {
    let groupNames = new Set(); // Use a Set to ensure uniqueness

    // Loop through each tag to find the group names for the current rowData
    try{
      rowTags.forEach(tag => {
        tag.data.forEach(item => {
          if (item?._id?.toString() === rowData?._id?.toString()) { 
            item.groupNames.forEach(groupName => groupNames.add(groupName)); 
          }
        });
      });
    } catch (error) {
      console.error("Error fetching row tags:", error, " Try creating a new workspace.");
    }

    // Convert the Set back to an array
    const uniqueGroupNames = Array.from(groupNames);

    return (
        <div style={{display: "flex", flexDirection: "row", gap: "5px", alignItems: "center"}}>
          <Button
              icon="pi pi-trash"
              style={buttonStyle(rowData._id)}
              onClick={() => viewRowDeletion(rowData)}
              onMouseEnter={() => setHoveredButton(rowData._id)}
              onMouseLeave={() => setHoveredButton(null)}
          />
          {uniqueGroupNames.length > 0 && (
              <div style={{
                width: "2px",
                height: "24px",
                backgroundColor: "lightgrey",
                margin: "0 10px",
                borderRadius: "2px"
              }}></div>
          )}
          {uniqueGroupNames.map((group, index) => (
              <div
                  key={index}
                  onMouseEnter={() => setHoveredTag({field: rowData._id, index})}
                  onMouseLeave={() => setHoveredTag({field: null, index: null})}
                  style={{position: "relative", display: "inline-block"}}
              >
                <div
                    style={{
                      position: "absolute",
                      top: "0",
                      right: "0",
                      background: "rgba(255, 0, 0, 1)",
                      borderRadius: "50%",
                      width: "16px",
                      height: "16px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      opacity: hoveredTag.field === rowData._id && hoveredTag.index === index ? 1 : 0,
                      transition: "opacity 0.2s, transform 0.2s",
                      transform: hoveredTag.field === rowData._id && hoveredTag.index === index ? "scale(1.2)" : "scale(1)",
                      color: "black"
                    }}
                    onClick={() => DeleteTagFromRow(group, rowData._id)}
                >
                  x
                </div>
                <Chip
                    label={group}
                    style={{
                      backgroundColor: getColorForTag(group),
                      fontSize: "0.75rem",
                      padding: "0px 8px",
                      margin: "2px",
                      border: "0.5px solid black"
                    }}
                />
              </div>
          ))}
        </div>
    );
  };

  return (
      <>
        <Dialog visible={viewMode} header="Preview changes" style={{ width: "80%", height: "80%" }} modal={true} onHide={() => onCancelChanges()}>
        <DataTable
          className="p-datatable-striped p-datatable-gridlines"
          lazy
          value={viewData}
          first={viewLazyParams.first}
          totalRecords={viewCount}
          onPage={(e) => setViewLazyParams({ first: e.first, rows: e.rows })}
          scrollable
          height={"100%"}
          width={"100%"}
          paginator
          rows={viewLazyParams.rows ? viewLazyParams.rows : 10}
          rowsPerPageOptions={[5, 10, 15, 20]}
          emptyMessage="Loading content..."
          {...tablePropsData}
          /*Confirm & cancel buttons*/
          footer={
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                height: "100%",
                gap: "40px"
              }}
            >
              {/* First Column with Confirm and Cancel buttons */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <Button label="Confirm changes" severity="success" rounded text raised icon="pi pi-check" onClick={onConfirmDeletion} />
                <Button label="Cancel changes" severity="danger" rounded text raised icon="pi pi-times" onClick={onCancelChanges} />
              </div>

              {/* Second Column with View Name Input and Save as View button */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div className="p-inputgroup w-full md:w-30rem">
                  <InputText
                    className={forbiddenCharacters.test(userSetViewName) ? "p-invalid" : ""}
                    placeholder="Enter view name"
                    suffix="test"
                    style={{ width: "300px" }}
                    value={userSetViewName}
                    onChange={(e) => setUserSetViewName(e.target.value)}
                  />
                  <span className="p-inputgroup-addon">.csv</span>
                  {forbiddenCharacters.test(userSetViewName) && <Message severity="error" text="Character not allowed" />}
                </div>
                <Button label="Save as a view" disabled={!userSetViewName || forbiddenCharacters.test(userSetViewName)} severity="info" rounded text raised icon="pi pi-eye" onClick={saveView} />
              </div>
            </div>
          }
        >
          {getColumnsFromData(viewData)}
        </DataTable>
      </Dialog>
      {innerData.length === 0 ? (
        loadingData ? (
          <DataTable header={"Loading content..."} value={items} className="p-datatable-striped">
            <Column header="" style={{ width: "20%" }} body={<Skeleton />}></Column>
            <Column header="" style={{ width: "20%" }} body={<Skeleton />}></Column>
            <Column header="" style={{ width: "20%" }} body={<Skeleton />}></Column>
            <Column header="" style={{ width: "20%" }} body={<Skeleton />}></Column>
            <Column header="" style={{ width: "20%" }} body={<Skeleton />}></Column>
          </DataTable>
        ) : (
          <p style={{ color: "red", fontSize: "20px", textAlign: "center", margin: "30px" }}>No data found in {data.name}</p>
        )
      ) : (
        <div style={dataTableStyle}>
          <DataTable
            className="p-datatable-striped p-datatable-gridlines"
            lazy
            first={lazyParams.first}
            value={innerData}
            totalRecords={collectionSize}
            editMode={!isReadOnly ? "cell" : undefined}
            size="small"
            scrollable
            height={"100%"}
            width={"100%"}
            paginator
            rowsPerPageOptions={[5, 10, 15, 20]}
            rows={lazyParams.rows ? lazyParams.rows : 10}
            onPage={(e) => setLazyParams({ first: e.first, rows: e.rows })}
            {...tablePropsData}
          >
            {!isReadOnly && (
                <Column
                    body={renderDeleteIconRowTags}
                />
            )}
            {columns.length > 0
              ? columns.map((col) => (
                  <Column
                    key={col.field}
                    field={col.field}
                    header={
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                        {!isReadOnly && (
                          <Button
                            icon="pi pi-trash"
                            style={buttonStyle(col.field)}
                            onClick={() => viewColumnDeletion(col.field)}
                            onMouseEnter={() => setHoveredButton(col.field)}
                            onMouseLeave={() => setHoveredButton(null)}
                          />
                        )}
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center"
                          }}
                        >
                          <span>{col.header}</span>
                          <div
                            style={{
                              fontSize: "0.75rem",
                              color: "#777",
                              display: "flex",
                              flexWrap: "wrap",
                              gap: "4px"
                            }}
                          >
                            {Array.isArray(getColumnTags(col.field))
                              ? getColumnTags(col.field).map((tag, index) => (
                                  <div
                                    key={index}
                                    onMouseEnter={() =>
                                      setHoveredTag({
                                        field: col.field,
                                        index
                                      })
                                    }
                                    onMouseLeave={() =>
                                      setHoveredTag({
                                        field: null,
                                        index: null
                                      })
                                    }
                                    style={{ position: "relative", display: "inline-block" }}
                                  >
                                    <div
                                      style={{
                                        position: "absolute",
                                        top: "0",
                                        right: "0",
                                        background: "rgba(255, 0, 0, 1)",
                                        borderRadius: "50%",
                                        width: "16px",
                                        height: "16px",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        cursor: "pointer",
                                        opacity: hoveredTag.field === col.field && hoveredTag.index === index ? 1 : 0,
                                        transition: "opacity 0.2s, transform 0.2s",
                                        transform: hoveredTag.field === col.field && hoveredTag.index === index ? "scale(1.2)" : "scale(1)",
                                        color: "black"
                                      }}
                                      onClick={() => DeleteTagFromColumn(tag)}
                                    >
                                      x
                                    </div>
                                    <Chip
                                      label={tag}
                                      style={{
                                        backgroundColor: getColorForTag(tag),
                                        fontSize: "0.75rem",
                                        padding: "0px 8px",
                                        margin: "2px",
                                        border: "0.5px solid black"
                                      }}
                                    />
                                  </div>
                                ))
                              : ""}
                          </div>
                        </div>
                      </div>
                    }
                    editor={!isReadOnly ? (options) => textEditor(options) : undefined}
                    onCellEditComplete={!isReadOnly ? onCellEditComplete : undefined}
                  />
                ))
              : getColumnsFromData(innerData)}
          </DataTable>
        </div>
      )}
      <Dialog header="Input Tools" style={{ width: "80%", height: "80%" }} modal={true}>
        <InputToolsComponent data={data} exportOptions={exportOptions} refreshData={refreshData} columns={columns} innerData={innerData} lastEdit={lastEdit} />
      </Dialog>
    </>
  )
}

export default DataTableFromDB
