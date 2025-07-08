import React, { useContext, useState, useEffect } from "react"
import { Row, Col } from "react-bootstrap"
import { DataContext } from "../workspace/dataContext"
import { Dropdown } from "primereact/dropdown"
import MedDataObject from "../workspace/medDataObject"
import { DataTable } from "primereact/datatable"
import { Column } from "@blueprintjs/table"
import { toast } from "react-toastify"
import { MultiSelect } from "primereact/multiselect"
import SaveDataset from "../generalPurpose/saveDataset"
import {
  cleanDataset,
  generateHeader,
  getColumnDataType,
  getData,
  getColumnOptions,
  getParentIDfolderPath,
  handleSelectedDatasetChange,
  updateListOfDatasets,
  updateTheColumnsTypes
} from "./simpleToolsUtils"

const dfd = require("danfojs")

/**
 * Component that renders the delete columns tool
 */
const DeleteColumnsTool = () => {
  const { globalData } = useContext(DataContext) // The global data object
  const [listOfDatasets, setListOfDatasets] = useState([]) // The list of datasets
  const [selectedDataset, setSelectedDataset] = useState(null) // The selected dataset

  const [newDatasetName, setNewDatasetName] = useState("") // The name of the new dataset
  const [newDatasetExtension, setNewDatasetExtension] = useState("csv") // The extension of the new dataset

  const [selectedDatasetColumns, setSelectedDatasetColumns] = useState([]) // The columns infos of the selected dataset
  const opTab = React.useRef(null)
  const [dataset, setDataset] = useState(null) // The dataset to drop
  const [df, setDf] = useState(null) // The dataframe
  const [columnTypes, setColumnTypes] = useState({}) // The column types
  const [selectedColumns, setSelectedColumns] = useState([]) // The selected columns
  const [selectedColumnsOptions, setSelectedColumnsOptions] = useState([]) // The selected columns options
  const [visibleColumns, setVisibleColumns] = useState([])

  /**
   * Hook that is called when the global data object is updated to update the list of datasets
   */
  useEffect(() => {
    updateListOfDatasets(globalData, selectedDataset, setListOfDatasets, setSelectedDataset)
  }, [globalData])

  /**
   * Hook that is called when the selected dataset is updated to update the columns infos
   */
  useEffect(() => {
    if (selectedDataset) {
      getData(selectedDataset).then((data) => {
        data = cleanDataset(data)

        let columns = data.columns
        setDf(data)
        let jsonData = dfd.toJSON(data)
        setDataset(jsonData)
        setSelectedDatasetColumns(columns)
        let newSelectedColumns = []
        columns.forEach((column) => {
          newSelectedColumns.push({ name: column, value: column })
        })
        setSelectedColumnsOptions(columns)
        setSelectedColumns(newSelectedColumns)
        setVisibleColumns(newSelectedColumns)
      })
      setNewDatasetExtension(selectedDataset.extension)
      setNewDatasetName(selectedDataset.nameWithoutExtension + "_deleted_cols")
    } else {
      setDf(null)
      setDataset(null)
      setSelectedDatasetColumns([])
      setSelectedColumnsOptions([])
      setSelectedColumns([])
      setVisibleColumns([])
      setNewDatasetExtension("csv")
      setNewDatasetName("")
    }
  }, [selectedDataset])

  /**
   * To save the filtered dataset
   * @param {Boolean} overwrite - True if the dataset should be overwritten, false otherwise
   */
  const saveFilteredDataset = (overwrite = false) => {
    // Get the columns to drop
    // Compare the selected columns with the visible columns [a, b, c, d] [a, c] => [b, d]
    let columnsToDrop = selectedColumns.filter((col) => !visibleColumns.some((vCol) => vCol.name === col.name)).map((col) => col.name)
    let newData = df.drop({ columns: columnsToDrop })
    if (newData.length !== dataset.length && newData !== null && newData !== undefined && newData.length !== 0) {
      if (overwrite) {
        MedDataObject.saveDatasetToDisk({
          df: newData,
          filePath: selectedDataset.path,
          extension: selectedDataset.extension
        })
        setSelectedDataset(null)
      } else {
        MedDataObject.saveDatasetToDisk({
          df: newData,
          filePath: getParentIDfolderPath(selectedDataset, globalData) + newDatasetName + "." + newDatasetExtension,
          extension: newDatasetExtension
        })
      }
      MedDataObject.updateWorkspaceDataObject()
    } else {
      // As create/overwrite button are disabled while filtered data is null, the only error to throw here is when filteredData.length == dataset.length
      toast.error("No columns to delete")
    }
  }

  const renderHeader = () => {
    return (
      <div className="table-header" style={{ display: "flex", justifyContent: "flex-start", alignItems: "center" }}>
        {/* Add a label for the multiselect : Toggle columns */}
        <label htmlFor="toggleColumns" className="p-checkbox-label" style={{ marginLeft: "0.5rem" }}>
          Select the columns to keep: &nbsp;
        </label>
        {/* Add the multiselect to select the columns to display */}
        <MultiSelect
          value={selectedColumnsOptions}
          options={selectedColumns}
          onChange={(e) => {
            let newSelectedColumns = e.value.map((value) => {
              return { name: value, value: value }
            })
            let orderedSelectedColumns = selectedColumns.filter((col) => newSelectedColumns.some((sCol) => sCol.value === col.value))
            setVisibleColumns(orderedSelectedColumns)
            setSelectedColumnsOptions(e.value)
          }}
          optionLabel="name"
          placeholder="Select columns to display"
          display="chip"
          style={{ maxWidth: "50%" }}
        />
      </div>
    )
  }

  /**
   * This hook is used to update the column types
   */
  useEffect(() => {
    updateTheColumnsTypes(df, setColumnTypes)
  }, [df])

  return (
    <>
      <Row className="simple-cleaning-set">
        <Col>
          <h6>Select the dataset</h6>
          {/* Dropdown to select the first dataset */}
          <Dropdown
            options={listOfDatasets}
            optionLabel="name"
            optionValue="key"
            className="w-100"
            value={selectedDataset ? selectedDataset.getUUID() : null}
            onChange={(e) => handleSelectedDatasetChange(e, setSelectedDataset, globalData)}
          ></Dropdown>

          <Row style={{ display: "flex", justifyContent: "space-evenly", flexDirection: "row", marginTop: "0.5rem" }}>
            <DataTable
              ref={opTab}
              size={"small"}
              header={renderHeader()}
              paginator={true}
              value={dataset ? dataset : null}
              globalFilterFields={selectedDatasetColumns}
              rows={5}
              rowsPerPageOptions={[5, 10, 25, 50]}
              className="p-datatable-striped p-datatable-gridlines"
              removableSort={true}
            >
              {selectedDatasetColumns.length > 0 &&
                visibleColumns.map((column) => (
                  <Column
                    key={column.name + "index"}
                    {...getColumnOptions(column.name, columnTypes)}
                    dataType={getColumnDataType(column.name, columnTypes)}
                    field={String(column.name)}
                    header={generateHeader(column.name, selectedColumnsOptions)}
                    style={{ minWidth: "5rem" }}
                  ></Column>
                ))}
            </DataTable>
          </Row>
          <Row
            className={"card"}
            style={{
              display: "flex",
              justifyContent: "space-evenly",
              flexDirection: "row",
              marginTop: "0.5rem",
              backgroundColor: "transparent",
              padding: "0.5rem"
            }}
          >
            <h6>
              Columns selected : <b>{visibleColumns.length}</b>&nbsp; of &nbsp;
              <b>{selectedColumns ? selectedColumns.length : 0}</b>
            </h6>
          </Row>
          <SaveDataset
            newDatasetName={newDatasetName}
            newDatasetExtension={newDatasetExtension}
            selectedDataset={selectedDataset}
            setNewDatasetName={setNewDatasetName}
            setNewDatasetExtension={setNewDatasetExtension}
            functionToExecute={saveFilteredDataset}
          />
        </Col>
      </Row>
    </>
  )
}

export default DeleteColumnsTool
