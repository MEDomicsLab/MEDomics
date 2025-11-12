import React, { useEffect, useState } from "react"
import { DataTable } from "primereact/datatable"
import { Column } from "primereact/column"

/**
 *
 * @param {Object} metrics The metrics to display in nested format
 * @param {Object} tableProps The props to pass to the DataTable component
 * @returns {JSX.Element} The ExtraMetrics component
 *
 * @description
 * This component displays metrics organized in a nested key-value structure
 * with mean, std, min, max for each metric
 */
const ExtraMetrics = ({ metrics, tableProps }) => {
  const [data, setData] = useState([])
  const [selectedRows, setSelectedRows] = useState([])

  useEffect(() => {
    if (metrics) {
      let dataList = []
      Object.keys(metrics).forEach((metricName) => {
        const metricData = metrics[metricName]
        
        // Check if it's a nested metric object with statistics
        if (typeof metricData === 'object' && metricData !== null && !Array.isArray(metricData) && 'mean' in metricData) {
          dataList.push({
            metric: metricName,
            mean: metricData.mean,
            std: metricData.std,
            min: metricData.min,
            max: metricData.max
          })
        }
      })
      setData(dataList)
    } else {
      setData([])
    }
  }, [metrics])

  return (
    <>
      <DataTable 
        value={data} 
        stripedRows 
        {...tableProps} 
        selectionMode="multiple" 
        selection={selectedRows} 
        onSelectionChange={(e) => setSelectedRows(e.value)}
        dataKey="metric"
      >
        <Column field="metric" header="Metric" />
        <Column field="mean" header="Mean" />
        <Column field="std" header="Std" />
        <Column field="min" header="Min" />
        <Column field="max" header="Max" />
      </DataTable>
    </>
  )
}

export default ExtraMetrics