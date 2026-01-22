/* eslint-disable no-unused-vars */
import { randomUUID } from "crypto"
import { FilterMatchMode, FilterOperator } from "primereact/api"
import { Button } from "primereact/button"
import { Card } from "primereact/card"
import { Checkbox } from "primereact/checkbox"
import { Column } from "primereact/column"
import { confirmDialog } from "primereact/confirmdialog"
import { DataTable } from "primereact/datatable"
import { InputText } from "primereact/inputtext"
import { Message } from "primereact/message"
import React, { useContext, useEffect, useState } from "react"
import { Row } from "react-bootstrap"
import { toast } from "react-toastify"
import { requestBackend } from "../../../utilities/requests"
import { connectToMongoDB, insertMEDDataObjectIfNotExists } from "../../mongoDB/mongoDBUtils"
import { ServerConnectionContext } from "../../serverConnection/connectionContext"
import { MEDDataObject } from "../../workspace/NewMedDataObject"
import { DataContext } from "../../workspace/dataContext"
import { getCollectionColumnTypes, getCollectionData, getCollectionDataCount, getCollectionDataFilterd } from "../utils"

const SubsetCreationToolsDB = ({ currentCollection }) => {
  const [lazyParams, setLazyParams] = useState({
    first: 0,
    rows: 10,
    page: 1,
    sortField: null,
    sortOrder: null,
    filters: {},
  })
  const [data, setData] = useState([])
  const [columns, setColumns] = useState([])
  const [columnTypes, setColumnTypes] = useState({})
  const [totalCount, setTotalCount] = useState(0)
  const [currentCount, setCurrentCount] = useState(0)
  const [filters, setFilters] = useState({})
  const [query, setQuery] = useState({})
  const [sortCriteria, setSortCriteria] = useState({})
  const [newCollectionName, setNewCollectionName] = useState("")
  const [filteredData, setFilteredData] = useState([])
  const [loadingData, setLoadingData] = useState(false)
  const [loadingButtonOverwrite, setLoadingButtonOverwrite] = useState(false)
  const [loadingButtonNewCollection, setLoadingButtonNewCollection] = useState(false)
  const [groupName, setGroupName] = useState("")
  const [isGroupNameEnabled, setIsGroupNameEnabled] = useState(false)
  const [showInfoBox, setShowInfoBox] = useState(false)
  const [loading, setLoading] = useState(false)

  const { globalData } = useContext(DataContext)
  const { port } = useContext(ServerConnectionContext)
  const filterDisplay = "menu"

  // Manage events from DataTable
  const onPage = (event) => {
    setLazyParams(event)
    fetchLazyData(event)
  }

  const onSort = (event) => {
    setLazyParams(event)
    fetchLazyData(event)
  }

  const onFilter = async (event) => {
    setLazyParams(event)
    setFilters(event.filters)
    fetchLazyData(event)
  }

  // Initialize filters dynamically
  const initFiltersDynamically = (columns, columnTypes) => {
    return columns.reduce((acc, col) => {
      const type = columnTypes[col.field]
      if (type.some((v) => ["string", "date"].includes(v))) {
        acc[col.field] = { operator: FilterOperator.AND, constraints: [{ value: "", matchMode: FilterMatchMode.STARTS_WITH }] }
      } else if (type.some((v) => ["number", "integer", "float", "int32"].includes(v))) {
        acc[col.field] = { operator: FilterOperator.AND, constraints: [{ value: "", matchMode: FilterMatchMode.EQUALS }] }
      }
      return acc
    }, {})
  }

  // Fetch data from the database
  const fetchData = async () => {
    setLoadingData(true)
    try {
      const db = await connectToMongoDB()
      const collection = db.collection(currentCollection)
      const count = await collection.countDocuments()
      setTotalCount(count)
      setCurrentCount(count)

      const [collectionData, collectionColumnTypes] = await Promise.all([
        getCollectionData(currentCollection, lazyParams.first, lazyParams.rows),
        getCollectionColumnTypes(currentCollection),
      ])

      const columns = Object.keys(collectionData[0] || {})
        .filter((key) => key !== "_id")
        .map((key) => ({
          field: key,
          header: key.charAt(0).toUpperCase() + key.slice(1),
        }))

      setData(collectionData)
      setFilteredData(collectionData)
      setColumns(columns)
      setColumnTypes(collectionColumnTypes)
      setFilters(initFiltersDynamically(columns, collectionColumnTypes))
      setSortCriteria({})
      setQuery({})
    } catch (error) {
      setLoadingData(false)
      console.error("Failed to fetch data:", error)
      toast.error("Failed to fetch data")
    } finally {
      setLoadingData(false)
    }
  }

  // Fetch lazy data with filters and sorting
  const fetchLazyData = async (event = {}) => {
    setLoadingData(true)
    try {
      const sortCriteria = event.sortField ? { [event.sortField]: event.sortOrder === 1 ? 1 : -1 } : {}
      setSortCriteria(sortCriteria)

      const query = event.filters ? convertFiltersToQuery(event.filters) : {}
      setQuery(query)

      const [collectionData, dataCount] = await Promise.all([
        getCollectionDataFilterd(currentCollection, query, event.first, event.rows, sortCriteria),
        getCollectionDataCount(currentCollection, query),
      ])

      setData(collectionData)
      setFilteredData(collectionData)
      setCurrentCount(dataCount)
    } catch (error) {
      setLoadingData(false)
      console.error("Failed to fetch lazy data:", error)
      toast.error("Failed to fetch lazy data")
    } finally {
      setLoadingData(false)
    }
  }

  // Convert filters to MongoDB query
  const convertFiltersToQuery = (filters) => {
    let query = {}
    for (const [field, filter] of Object.entries(filters || {})) {
      if (filter.constraints && filter.constraints.length > 0) {
        const conditions = filter.constraints
          .map(({ matchMode, value }) => {
            if (value === null || value === "") return null

            const parsedValue = isNaN(value) ? value : Number(value)

            switch (matchMode) {
              case "equals":
                return { $eq: [{ $toString: `$${field}` }, { $toString: parsedValue }] }
              case "notEquals":
                return { $ne: [{ $toString: `$${field}` }, { $toString: parsedValue }] }
              case "contains":
                return { $regexMatch: { input: { $toString: `$${field}` }, regex: value, options: "i" } }
              case "notContains":
                return { $not: { $regexMatch: { input: { $toString: `$${field}` }, regex: value, options: "i" } } }
              case "startsWith":
                return { $regexMatch: { input: { $toString: `$${field}` }, regex: `^${value}`, options: "i" } }
              case "endsWith":
                return { $regexMatch: { input: { $toString: `$${field}` }, regex: `${value}$`, options: "i" } }
              default:
                return null
            }
          })
          .filter(Boolean)

        if (conditions.length > 0) {
          query.$expr = query.$expr || { $and: [] }
          query.$expr.$and.push(...conditions)
        }
      }
    }
    return query
  }

  // Overwrite collection with filtered data
  const overwriteCollection = async () => {
    setLoadingButtonOverwrite(true)
    let finalData = filteredData
    try {
      // Get latest filtered data
      if (query){
        try {
          finalData = sortCriteria ? 
            await getCollectionDataFilterd(currentCollection, query, null, null, sortCriteria) : 
            await getCollectionDataFilterd(currentCollection, query)
        } catch (error) {
          toast.error("Failed to get filtered data")
          console.error("Failed to get filtered data:", error)
          return
        }
      }
      const db = await connectToMongoDB()
      const collection = db.collection(currentCollection)
      await collection.deleteMany({})
      await batchInsert(collection, finalData)
      toast.success(`${globalData[currentCollection].name} overwritten with filtered data.`)
    } catch (error) {
      setLoadingButtonOverwrite(false)
      console.error("Failed to overwrite collection:", error)
      toast.error("Failed to overwrite collection")
    } finally {
      setLoadingButtonOverwrite(false)
    }
  }

  // Create new collection subset
  const createNewCollectionSubset = async (newCollectionName) => {
    setLoadingButtonNewCollection(true)
    let finalData = filteredData
    const collectionName = newCollectionName + ".csv"
    const id = randomUUID()
    const object = new MEDDataObject({
      id: id,
      name: collectionName,
      type: "csv",
      parentID: globalData[currentCollection].parentID,
      childrenIDs: [],
      inWorkspace: false,
    })

    // Check if the collection already exists
    const existsId = Object.keys(globalData).find((item) => globalData[item].name === collectionName)

    // If the collection already exists, ask the user if they want to overwrite it
    let overwriteConfirmation = true
    if (existsId) {
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
      if (!overwriteConfirmation) {
        setLoadingButtonNewCollection(false)
        return
      }
    }
    // Get filtered data
    if (query){
      try {
        finalData = sortCriteria ? 
          await getCollectionDataFilterd(currentCollection, query, null, null, sortCriteria) : 
          await getCollectionDataFilterd(currentCollection, query)
      } catch (error) {
        toast.error("Failed to get filtered data")
        console.error("Failed to get filtered data:", error)
        return
      }
    }
    
    // Update the existing or the new collection
    try {        
      const db = await connectToMongoDB()
      let collection = null
      if (existsId) {
        collection = db.collection(existsId)
        await collection.deleteMany({})
      } else {
        collection = db.collection(id)
      }
      await batchInsert(collection, finalData)
      finalData = null
      if (!existsId) await insertMEDDataObjectIfNotExists(object)
      MEDDataObject.updateWorkspaceDataObject()
      toast.success(`Subset ${collectionName} updated with new data.`)
      setLoadingButtonNewCollection(false)
      return
    } catch (error) {
      toast.error("Failed update the data")
      console.error("Failed to update the data:", error)
      setLoadingButtonNewCollection(false)
      return
    }
  }

  // Batch insert data
  const batchInsert = async (collection, data) => {
    for (let i = 0; i < data.length; i += 1000) {
      await collection.insertMany(data.slice(i, i + 1000))
    }
  }

  // Create group with selected rows
  async function createGroup(groupName) {
    // Check if filteredData is empty
    if (filteredData.length === 0) {
      toast.error("No rows selected.")
      return
    }
    let jsonToSend = {}
    jsonToSend = {
      collectionName: currentCollection,
      groupName: groupName,
      query: query,
      sortCriteria: sortCriteria,
    }
    console.log("create_group_DB jsonToSend", jsonToSend)
    setLoading(true)
    requestBackend(
      port,
      "/input/create_group_DB/",
      jsonToSend,
      async (jsonResponse) => {
        console.log("jsonResponse", jsonResponse)
        setLoading(false)
        if (jsonResponse.error) {
          if (jsonResponse.error.message) {
            console.error(jsonResponse.error.message)
            toast.error(jsonResponse.error.message)
          } else {
            console.error(jsonResponse.error)
            toast.error(jsonResponse.error)
          }
        } else {
          toast.success("Group created successfully.")
        }
      },
      (error) => {
        console.error("Failed to create group:", error)
        setLoading(false)
        toast.error("Failed to create group")
      }
    )
  }

  // Fetch data on collection change
  useEffect(() => {
    fetchData()
  }, [currentCollection])

  return (
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "5px" }}>
      <Message
        className="margin-top-15 margin-bottom-15 center"
        severity="info"
        text="The Subset Creation tool enables the creation of a subset of rows from a dataset by applying filters to columns."
      />
      <Message style={{ marginBottom: "15px" }} severity="success" text={`Current Collection: ${globalData[currentCollection].name}`} />
      <Card style={{ width: "900px" }}>
        <DataTable
          value={data}
          className="p-datatable-striped p-datatable-gridlines"
          paginator
          lazy
          totalRecords={currentCount ? currentCount : totalCount}
          first={lazyParams.first}
          rows={10}
          size={"small"}
          loading={loadingData}
          removableSort={true}
          filters={filters}
          filterDisplay={filterDisplay}
          globalFilterFields={columns.map((col) => col.field)}
          onPage={onPage}
          onSort={onSort}
          onFilter={onFilter}
          sortField={lazyParams.sortField}
          sortOrder={lazyParams.sortOrder}
          onValueChange={(e) => setFilteredData(e)}
        >
          {columns.map((col) => (
            <Column
              key={col.field}
              field={col.field}
              header={col.header}
              sortable
              filter
              filterPlaceholder={`Search by ${col.header}`}
              filterField={col.field}
            />
          ))}
        </DataTable>
      </Card>

      <Row className={"card"} style={{ display: "flex", justifyContent: "space-evenly", flexDirection: "row", marginTop: "0.5rem", backgroundColor: "transparent", padding: "0.5rem" }}>
        <h6>
          Rows count : <b>{currentCount || filteredData.length}</b>&nbsp; of &nbsp;
          <b>{totalCount || data.length}</b>
        </h6>
      </Row>
      {showInfoBox && (
        <Message
            style={{ marginBottom: "15px", marginTop: "2rem", textAlign: "justify" }}
            severity="info"
            text="Enabling this will add a tag to the selected rows in the dataset."
            icon="pi pi-info-circle"
            iconpos="left"
            iconstyle={{ fontSize: "2rem" }}
        />
      )}
      <div style={{display: "flex", alignItems: "center", marginTop: "1rem"}}>
        <Checkbox
            inputId="groupNameCheckbox"
            checked={isGroupNameEnabled}
            onChange={(e) => {
              setIsGroupNameEnabled(e.checked);
              setShowInfoBox(e.checked);
              if (!e.checked) {
                setGroupName("");
              }
            }}
            style={{marginRight: "0.5rem"}}
            tooltip={"Enable to create a group with the selected rows"}
              tooltipOptions={{position: "top"}}
        />
        <InputText
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Group Name"
            style={{margin: "5px", fontSize: "1rem", padding: "6px 10px"}}
            disabled={!isGroupNameEnabled}
        />
        <Button
            label="Create Group"
            onClick={() => {createGroup(groupName)}}
            style={{ marginLeft: "0.5rem", fontSize: "1rem", padding: "6px 10px" }}
            disabled={!isGroupNameEnabled || !groupName}
            loading={loading}
        />
      </div>
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", marginTop: "1rem" }}>
        <Button
          className="p-button-danger"
          label="Overwrite"
          style={{ margin: "5px", fontSize: "1rem", padding: "6px 10px" }}
          onClick={overwriteCollection}
          tooltip="Overwrite current collection with filtered data"
          tooltipOptions={{ position: "top" }}
          loading={loadingButtonOverwrite}
        />
        <div className="p-inputgroup w-full md:w-30rem" style={{ margin: "10px", fontSize: "1rem", width: "230px", marginTop: "5px" }}>
          <InputText value={newCollectionName} onChange={(e) => setNewCollectionName(e.target.value)} placeholder="New subset name" />
          <span className="p-inputgroup-addon">.csv</span>
        </div>
        <Button
          loading={loadingButtonNewCollection}
          disabled={!newCollectionName}
          icon="pi pi-plus"
          onClick={() => createNewCollectionSubset(newCollectionName)}
          tooltip="Create subset"
          tooltipOptions={{ position: "top" }}
        />
      </div>
    </div>
  )
}

export default SubsetCreationToolsDB
