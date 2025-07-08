import React, { useContext, useState, useEffect } from "react"
import { Row, Col } from "react-bootstrap"
import { DataContext } from "../workspace/dataContext"
import { Button } from "primereact/button"
import { Dropdown } from "primereact/dropdown"
import MedDataObject from "../workspace/medDataObject"
import { InputText } from "primereact/inputtext"
import { InputNumber } from "primereact/inputnumber"
import { DataTable } from "primereact/datatable"
import { Column } from "@blueprintjs/table"
import { toast } from "react-toastify"
import { FilterMatchMode, FilterOperator } from "primereact/api"
import { MultiSelect } from "primereact/multiselect"
import { Utils as danfoUtils } from "danfojs"
import SaveDataset from "../generalPurpose/saveDataset"
import { cleanDataset, getColumnDataType, getData, getColumnOptions, getParentIDfolderPath, handleSelectedDatasetChange, updateListOfDatasets, updateTheColumnsTypes } from "./simpleToolsUtils"

const dfd = require("danfojs")
const dfdUtils = new danfoUtils()

/**
 * Component that renders the subset creation tool
 */
const SubsetCreationTool = () => {
  const { globalData } = useContext(DataContext) // The global data object
  const [listOfDatasets, setListOfDatasets] = useState([]) // The list of datasets
  const [selectedDataset, setSelectedDataset] = useState(null) // The selected dataset
  const [newDatasetName, setNewDatasetName] = useState("") // The name of the new dataset
  const [newDatasetExtension, setNewDatasetExtension] = useState("csv") // The extension of the new dataset
  const [selectedDatasetColumns, setSelectedDatasetColumns] = useState([]) // The columns infos of the selected dataset
  const opTab = React.useRef(null)
  const [dataset, setDataset] = useState(null) // The dataset to drop
  const [globalFilterValue, setGlobalFilterValue] = useState("") // The global filter value
  const [filters, setFilters] = useState({}) // The filters
  const [filteredData, setFilteredData] = useState([]) // The filtered data
  const [df, setDf] = useState(null) // The dataframe
  const [columnTypes, setColumnTypes] = useState({}) // The column types

  const filterDisplay = "menu"

  /**
   * Hook that is called when the global data object is updated to update the list of datasets
   */
  useEffect(() => {
    updateListOfDatasets(globalData, selectedDataset, setListOfDatasets, setSelectedDataset)
  }, [globalData])

  /**
   * This function initializes the filters
   * @returns {Void}
   */
  const initFilters = () => {
    let newFilters = {}
    newFilters["global"] = { value: "", matchMode: "contains" }

    Object.keys(columnTypes).forEach((column) => {
      if (columnTypes[column] === "category") {
        newFilters[column] = { value: "", matchMode: FilterMatchMode.IN }
      } else if (columnTypes[column] === "int32" || columnTypes[column] === "float32") {
        newFilters[column] = { operator: FilterOperator.AND, constraints: [{ value: "", matchMode: FilterMatchMode.EQUALS }] }
      } else if (columnTypes[column] === "string") {
        newFilters[column] = { operator: FilterOperator.AND, constraints: [{ value: "", matchMode: FilterMatchMode.STARTS_WITH }] }
      }
    })

    setFilters(newFilters)
  }

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
      })
      setNewDatasetExtension(selectedDataset.extension)
      setNewDatasetName(selectedDataset.nameWithoutExtension + "_filtered")
    } else {
      setDf(null)
      setDataset(null)
      setSelectedDatasetColumns([])
      setNewDatasetExtension("csv")
      setNewDatasetName("")
      setFilteredData([])
    }
  }, [selectedDataset])

  /**
   * To save the filtered dataset
   * @param {Boolean} overwrite - True if the dataset should be overwritten, false otherwise
   */
  const saveFilteredDataset = (overwrite = false) => {
    if (filteredData.length !== dataset.length && filteredData && filteredData.length > 0) {
      if (overwrite) {
        MedDataObject.saveDatasetToDisk({ data: filteredData, filePath: selectedDataset.path, extension: selectedDataset.extension })
        setSelectedDataset(null)
      } else {
        MedDataObject.saveDatasetToDisk({
          data: filteredData,
          filePath: getParentIDfolderPath(selectedDataset, globalData) + newDatasetName + "." + newDatasetExtension,
          extension: newDatasetExtension
        })
      }
      MedDataObject.updateWorkspaceDataObject()
    } else {
      // As create/overwrite button are disabled while filtered data is null, the only error to throw here is when filteredData.length == dataset.length
      toast.error("No filter applied")
    }
  }

  const clearFilter = () => {
    setGlobalFilterValue("")
    initFilters()
    setFilteredData(dataset)
  }

  useEffect(() => {
    let newFilters = { ...filters }
    if (globalFilterValue.length !== 0) {
      newFilters["global"].value = globalFilterValue
    }
    setFilters(newFilters)
  }, [globalFilterValue])

  const renderHeader = () => {
    return (
      <div className="table-header" style={{ display: "flex", justifyContent: "space-between" }}>
        <Button icon="pi pi-filter-slash" className="p-mr-2" outlined label="Clear" onClick={clearFilter} />
        <span className="p-input-icon-left">
          <i className="pi pi-search" />
          <InputText
            type="search"
            onChange={(e) => {
              setGlobalFilterValue(e.target.value)
            }}
            placeholder="Global Search"
          />
        </span>
      </div>
    )
  }

  const header = renderHeader()

  /**
   * This hook is used to update the column types
   */
  useEffect(() => {
    updateTheColumnsTypes(df, setColumnTypes)
  }, [df])

  /**
   * The filters are initialized when the column types are updated
   */
  useEffect(() => {
    initFilters()
  }, [columnTypes])

  /**
   * This function is used to render the category filter template
   * @param {Object} options - The options
   * @returns {Object} - The filter template
   */
  const categoryFilterTemplate = (options) => {
    let onChangeFunc = (e) => {
      options.filterCallback(e.value)
    }
    if (filterDisplay === "row") {
      onChangeFunc = (e) => {
        options.filterApplyCallback(e.value)
      }
    }

    let colData = df.$getColumnData(options.field).$data
    let uniqueValues = dfdUtils.unique(colData)
    let newOptions = []
    uniqueValues.forEach((value) => {
      newOptions.push({ name: value, value: value })
    })
    return (
      <MultiSelect value={options.value} options={newOptions} onChange={onChangeFunc} optionLabel="name" placeholder={`Search by ${options.field}`} className="p-column-filter" maxSelectedLabels={1} />
    )
  }

  /**
   * This function is used to render the number filter template
   * @param {Object} options - The options
   * @returns {Object} - The filter template
   */
  const numberFilterTemplate = (options) => {
    let onChangeFunc = (e) => {
      options.filterCallback(e.value, options.index)
    }
    if (filterDisplay === "row") {
      onChangeFunc = (e) => {
        options.filterApplyCallback(e.value, options.index)
      }
    }
    return <InputNumber value={options.value} onChange={onChangeFunc} placeholder={`Search by ${options.field}`} locale="en-US" />
  }

  /**
   * This function is used to render the string filter template
   * @param {Object} options - The options
   * @returns {Object} - The filter template
   */
  const stringFilterTemplate = (options) => {
    let onChangeFunc = (e) => {
      options.filterCallback(e.target.value, options.index)
    }
    if (filterDisplay === "row") {
      onChangeFunc = (e) => {
        options.filterApplyCallback(e.target.value, options.field)
      }
    }
    return <InputText type="search" value={options.value} placeholder={`Search by ${options.field}`} onChange={onChangeFunc} />
  }

  /**
   * This function is used to render the filter template
   * @param {number} index - The index of the column
   * @returns {Object} - The filter template
   */
  const filterTemplateRenderer = (index) => {
    let columnType = columnTypes[selectedDatasetColumns[index]]
    if (columnType === "category") {
      return categoryFilterTemplate
    } else if (columnType === "int32" || columnType === "float32") {
      return numberFilterTemplate
    } else if (columnType === "string") {
      return stringFilterTemplate
    }
  }

  /**
   * This function is used to capitalize the first letter of a string
   * @param {string} string - The string to capitalize
   * @returns {string} - The capitalized string
   */
  function capitalizeFirstLetter(string) {
    return string[0].toUpperCase() + string.slice(1)
  }

  return (
    <>
      <Row className="simple-cleaning-set">
        <Col>
          <h6>Select the dataset you want to clean</h6>
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
              onValueChange={(e) => {
                setFilteredData(e)
              }}
              filterDisplay={filterDisplay}
              size={"small"}
              header={header}
              paginator={true}
              filters={filters}
              value={dataset ? dataset : null}
              globalFilterFields={selectedDatasetColumns}
              rows={5}
              rowsPerPageOptions={[5, 10, 25, 50]}
              className="p-datatable-striped p-datatable-gridlines"
              removableSort={true}
            >
              {selectedDatasetColumns.length > 0 &&
                selectedDatasetColumns.map((column, index) => (
                  <Column
                    key={column}
                    {...getColumnOptions(column, columnTypes)}
                    dataType={getColumnDataType(column, columnTypes)}
                    field={String(column)}
                    sortable
                    filterPlaceholder={`Search by ${column}`}
                    filterElement={filterTemplateRenderer(index)}
                    filter
                    header={capitalizeFirstLetter(column)}
                    style={{ minWidth: "5rem" }}
                  ></Column>
                ))}
            </DataTable>
          </Row>
          <Row className={"card"} style={{ display: "flex", justifyContent: "space-evenly", flexDirection: "row", marginTop: "0.5rem", backgroundColor: "transparent", padding: "0.5rem" }}>
            <h6>
              Rows selected : <b>{filteredData.length}</b>&nbsp; of &nbsp;
              <b>{dataset ? dataset.length : 0}</b>
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

export default SubsetCreationTool
