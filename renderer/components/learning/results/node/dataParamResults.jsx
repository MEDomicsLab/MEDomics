import Parameters from "../utilities/parameters"
import DataTablePath from "../utilities/dataTablePath"
import DataTable from "../../../dataTypeVisualisation/dataTableWrapper"
import { Accordion, AccordionTab } from "primereact/accordion"

/**
 *
 * @param {Object} selectedResults The selected results
 * @param {String} type The type of the node (Dataset or Clean)
 * @returns {JSX.Element} The DataParamResults component
 */
const DataParamResults = ({ selectedResults, type }) => {

  const generateDataTables = (data) => {
    console.log(data)
    console.log(data.paths[0])
    if (typeof data.paths[0] !== "string") {
      let jsonTable = JSON.parse(data.table)
      console.log(jsonTable)
      return <DataTable
        data={jsonTable}
        tablePropsData={{
          paginator: true,
          rows: 10,
          scrollable: true,
          scrollHeight: "400px",
          size: "small"
        }}
        tablePropsColumn={{
          sortable: true
        }}
      />
    } else {
      return <DataTablePath path={data.paths[0]} />
    }
  }

  return (
    <>
      <Accordion multiple className="data-param-results-accordion">
        <AccordionTab header="Parameters">
          <Parameters
            params={selectedResults.logs.setup.params}
            tableProps={{
              scrollable: true,
              scrollHeight: "400px",
              size: "small"
            }}
            columnNames={["Parameter", "Value"]}
          />
        </AccordionTab>
        {(type!== "clean") && (<AccordionTab header="Data">
          <div className="card">
            {
              generateDataTables(selectedResults.data)
            }
          </div>
        </AccordionTab>)}
      </Accordion>
    </>
  )
}

export default DataParamResults
