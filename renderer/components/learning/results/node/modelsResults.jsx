import { useState, useEffect } from "react"
import Parameters from "../utilities/parameters"
import DataTable from "../../../dataTypeVisualisation/dataTableWrapper"
import { Column } from "primereact/column"
import ExtraMetrics from "../utilities/extraMetrics"

/**
 *
 * @param {Object} selectedResults The selected results
 * @returns {JSX.Element} The ModelsResults component
 */
const ModelsResults = ({ selectedResults }) => {
  const [models, setModels] = useState([])
  const [allModelsData, setAllModelsData] = useState([])
  const [expandedRows, setExpandedRows] = useState([])
  const [selectedRows, setSelectedRows] = useState([])

  // When the selected results change, update the models
  useEffect(() => {
    let models = []
    if (selectedResults.logs) {
      Object.keys(selectedResults.logs).forEach((modelName) => {
        models.push({
          name: modelName,
          metrics: selectedResults.logs[modelName].metrics,
          params: selectedResults.logs[modelName].params
        })
      })
    }
    setModels(models)
  }, [selectedResults])

  // when the models change, update the data to display in the table
  useEffect(() => {
    let allModelsData = []
    if (models.length > 0) {
      models.forEach((model) => {
        if (!model.metrics) return
        let modifiedRow = { ...model.metrics }
        modifiedRow["Parameters"] = model.params
        modifiedRow["OverallMetrics"] = selectedResults?.data?.overall_metrics
        modifiedRow = Object.assign({ Name: model.name }, modifiedRow)
        allModelsData.push(modifiedRow)
      })
    }
    allModelsData.length > 0 && setAllModelsData(allModelsData)
  }, [models])

  const rowExpansionTemplate = (rowData) => {
    return (
      <div className="container">
        {rowData.OverallMetrics && 
        <div style={{alignContent: "center", marginBottom: "1rem", fontWeight: "bold" }}>
          <h6>Extra Statistics:</h6>
          <ExtraMetrics 
            metrics={rowData.OverallMetrics}
            tableProps={{
              size: "small",
              style: { width: "100%" }
            }}
          />
        </div>
        }
        <div style={{alignContent: "center", marginBottom: "1rem", fontWeight: "bold" }}>
          <h6>Model Parameters:</h6>
          <Parameters
            params={rowData.Parameters}
            tableProps={{
              size: "small",
              style: { width: "100%" }
            }}
            columnNames={["Parameter", "Value"]}
          />
        </div>
      </div>
    )
  }

  /**
   * @param {Object} data data to display in the table
   * @returns {JSX.Element} A JSX element containing the columns of the data table according to primereact specifications
   */
  const getColumnsFromData = (data) => {
    if (data.length > 0) {
      let toReturn = [<Column key="first key" expander={true} style={{ width: "5rem" }} />]
      Object.keys(data[0]).map((key) => {
        if (key != "Parameters" && key != "OverallMetrics") {
          let sortableOpt = key != "Name" ? { sortable: true } : {}
          toReturn.push(<Column key={key} field={key} header={key} {...sortableOpt} />)
        }
      })
      return toReturn
    }
    return <></>
  }

  return (
    <>
      <DataTable
        data={allModelsData}
        customGetColumnsFromData={getColumnsFromData}
        tablePropsData={{
          scrollable: true,
          scrollHeight: "65vh",
          rowExpansionTemplate: rowExpansionTemplate,
          onRowToggle: (e) => setExpandedRows(e.data),
          expandedRows: expandedRows,
          size: "small",
          selectionMode: "multiple",
          selection: selectedRows,
          onSelectionChange: (e) => setSelectedRows(e.value)
        }}
      />
    </>
  )
}

export default ModelsResults
