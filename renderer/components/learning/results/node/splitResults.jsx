import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import { Accordion, AccordionTab } from 'primereact/accordion'

const SplitResults = ({ selectedResults }) => {
  const generateSplitTable = (data) => {
    try {
      // Parse the JSON string
      const jsonData = JSON.parse(data.stats_df)
      
      // Extract fold numbers and metrics
      const foldNumbers = Object.values(jsonData.Fold || {})
      const metrics = Object.keys(jsonData).filter(key => key !== 'Fold')
      
      // Prepare columns - first column for metric names
      const columns = [
        {
          field: 'metric',
          header: 'Metric',
          body: (rowData) => <strong>{rowData.metric}</strong>,
          style: { minWidth: '150px' }
        },
        ...foldNumbers.map(fold => ({
          field: `fold_${fold}`,
          header: `Fold ${fold}`,
          body: (rowData) => (
            <span className={typeof rowData[`fold_${fold}`] === 'number' ? 
                  'numeric-value' : ''}>
              {typeof rowData[`fold_${fold}`] === 'number' ? 
               rowData[`fold_${fold}`].toFixed(2) : 
               rowData[`fold_${fold}`]}
            </span>
          ),
          style: { textAlign: 'center', minWidth: '120px' }
        }))
      ]
      
      // Prepare table data
      const tableData = metrics.map(metric => {
        const row = { metric }
        foldNumbers.forEach((fold, idx) => {
          row[`fold_${fold}`] = jsonData[metric][idx]
        })
        return row
      })
      
      // Optional: Add summary row
      const summaryRow = { metric: 'Average' }
      foldNumbers.forEach(fold => {
        const values = tableData.map(row => row[`fold_${fold}`]).filter(Number.isFinite)
        summaryRow[`fold_${fold}`] = values.length ? 
          values.reduce((a, b) => a + b, 0) / values.length : '-'
      })
      tableData.push(summaryRow)

      return (
        <DataTable
          value={tableData}
          scrollable
          scrollHeight="400px"
          showGridlines
          stripedRows
          size="small"
          className="p-datatable-sm"
        >
          {columns.map((col, i) => (
            <Column
              key={i}
              field={col.field}
              header={col.header}
              body={col.body}
              style={col.style}
              sortable
            />
          ))}
        </DataTable>
      )
    } catch (error) {
      console.error("Error generating table:", error)
      return (
        <div className="p-message p-message-error">
          Error displaying data: {error.message}
        </div>
      )
    }
  }

  return (
    <Accordion multiple>
      <AccordionTab header="Splitting Results">
        <div className="p-card p-mt-2">
          <div className="p-card-body">
            {generateSplitTable(selectedResults.data)}
          </div>
        </div>
      </AccordionTab>
    </Accordion>
  )
}

export default SplitResults