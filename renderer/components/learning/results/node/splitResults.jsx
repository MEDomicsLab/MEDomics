import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'


const renderDataTableFromStringifiedDF = (jsonString) => {
  try {
    if (!jsonString) {
      return (
        <div className="p-message p-message-error m-2 p-4">
          No data available to display.
        </div>
      )
    }
    // Parse the JSON string
    const jsonData = JSON.parse(jsonString)
    
    // Convert the object format to array format
    const tableData = Object.keys(jsonData).reduce((acc, key) => {
      Object.values(jsonData[key]).forEach((val, idx) => {
        if (!acc[idx]) acc[idx] = {}
        acc[idx][key] = val
      })
      return acc
    }, [])
    
    // Generate columns dynamically with proper formatting
    const columns = Object.keys(jsonData).map((field) => ({
      field,
      header: field.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim(),
      body: (rowData) => {
        const value = rowData[field]
        if (typeof value === 'number') {
          return Number.isInteger(value) ? value : value.toFixed(2)
        }
        return value
      },
      sortable: true,
      style: { 
        textAlign: typeof tableData[0]?.[field] === 'number' ? 'right' : 'left',
        minWidth: '120px'
      }
    }))
    
    return (
      <DataTable
        value={tableData}
        scrollable
        scrollHeight="400px"
        showGridlines
        stripedRows
        size="small"
        className="p-datatable-sm"
        paginator={tableData.length > 10}
        rows={10}
        rowsPerPageOptions={[5, 10, 25]}
      >
        {columns.map((col, i) => (
          <Column
            key={i}
            field={col.field}
            header={col.header}
            body={col.body}
            style={col.style}
            sortable={col.sortable}
          />
        ))}
      </DataTable>
    )
  } catch (error) {
    console.error("Error rendering data table:", error)
    return (
      <div className="p-message p-message-error">
        Error displaying data: {error.message}
      </div>
    )
  }
}

const SplitResults = ({ selectedResults }) => (
  <div className="p-card p-mt-2">
    <div className="p-card-body">
      {renderDataTableFromStringifiedDF(selectedResults.data.stats_df)}
    </div>
  </div>
)

export default SplitResults