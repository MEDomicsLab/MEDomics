import React, { useEffect, useState } from "react"
import { DataTable } from "primereact/datatable"
import { Column } from "primereact/column"

/**
 *
 * @param {Object} params The parameters to display
 * @param {Object} tableProps The props to pass to the DataTable component
 * @param {Array} columnNames The column names for the DataTable component
 * @returns {JSX.Element} The Parameters component
 *
 * @description
 * This component is an adaptation of the DataTable component to display parameters organised in a key-value pair table
 */
const Parameters = ({ params, tableProps, columnNames }) => {
  const [data, setData] = useState([])
  const [selectedRows, setSelectedRows] = useState([])

  const isEmptyOrNull = (value) => {
    // Check specifically for null or undefined
    if (value == null) { // Using loose equality (==) checks for both null and undefined
      return true
    }

    // Check if the value is an object (but not null, which typeof also calls "object")
    if (typeof value === 'object') {
      // A robust check for an empty object: ensure its constructor is Object and it has no own properties
      return Object.keys(value).length === 0 && value.constructor === Object
    }

    // Other non-object, non-null values (like strings, numbers, booleans)
    // are not considered "empty objects" or "null" by this definition.
    return false
  }

  useEffect(() => {
    if (params) {
      let dataList = []
      Object.keys(params).forEach((key) => {
        // skip null or undefined values
        if (isEmptyOrNull(params[key])) {
          dataList.push({
            param: key,
            Value: "null"
          })
        } else {
          let value = params[key]
          // For array values
          if (Array.isArray(value)) {
            value = JSON.stringify(value)
          }
          dataList.push({
            param: key,
            Value: value != null ? value : "null"
          })
        }
      })
      setData(dataList)
    }
  }, [params])

  return (
    <>
      <DataTable value={data} stripedRows {...tableProps} selectionMode="multiple" selection={selectedRows} onSelectionChange={(e) => setSelectedRows(e.value)}>
        <Column field="param" header={columnNames[0]} />
        <Column field="Value" header={columnNames[1]} />
      </DataTable>
    </>
  )
}

export default Parameters
