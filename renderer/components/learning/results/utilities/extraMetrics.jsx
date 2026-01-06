import React, { useEffect, useState } from "react"
import { DataTable } from "primereact/datatable"
import { Column } from "primereact/column"

/**
 * @param {Object} metrics The metrics to display in nested format
 * @param {Object} tableProps The props to pass to the DataTable component
 * @returns {JSX.Element} The ExtraMetrics component
 *
 * @description
 * This component displays metrics organized with statistical measures (mean, std, min, max) as rows
 * and each metric as columns
 */
const ExtraMetrics = ({ metrics, tableProps }) => {
  const [data, setData] = useState([])
  const [selectedRows, setSelectedRows] = useState([])

  useEffect(() => {
    if (metrics) {
      // Get all metric names that have statistical properties
      const metricNames = Object.keys(metrics).filter(metricName => {
        const metricData = metrics[metricName]
        return typeof metricData === 'object' && 
               metricData !== null && 
               !Array.isArray(metricData) && 
               'mean' in metricData
      })
      
      // Define the statistical measures that will become rows
      const statTypes = ['mean', 'median', 'std', 'min', 'max']
      
      // Transform data: each stat type becomes a row with metrics as columns
      const transformedData = statTypes.map(stat => {
        const row = { stat: stat }
        metricNames.forEach(metricName => {
          row[metricName] = metrics[metricName][stat]
        })
        return row
      })
      
      setData(transformedData)
    } else {
      setData([])
    }
  }, [metrics])

  // Get metric names for dynamic columns
  const metricNames = metrics ? Object.keys(metrics).filter(metricName => {
    const metricData = metrics[metricName]
    return typeof metricData === 'object' && 
           metricData !== null && 
           !Array.isArray(metricData) && 
           'mean' in metricData
  }) : []

  return (
    <DataTable 
      value={data} 
      stripedRows 
      {...tableProps} 
      selectionMode="multiple" 
      selection={selectedRows} 
      onSelectionChange={(e) => setSelectedRows(e.value)}
      dataKey="stat"
    >
      <Column 
        field="stat" 
        header="Stat" 
        style={{ width: '260px' }} // Custom width for the first column
      />
      {metricNames.map(metricName => (
        <Column 
          key={metricName} 
          field={metricName} 
          header={metricName} 
        />
      ))}
    </DataTable>
  )
}

export default ExtraMetrics