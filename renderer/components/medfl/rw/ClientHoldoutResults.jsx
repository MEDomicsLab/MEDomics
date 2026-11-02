import React, { useMemo, useState } from "react"
import ReactECharts from "echarts-for-react"
import { Card } from "react-bootstrap"
import { DataTable } from "primereact/datatable"
import { Column } from "primereact/column"
import { Tag } from "primereact/tag"
import { SelectButton } from "primereact/selectbutton"
import { Message } from "primereact/message"
import { ConfusionMatrix } from "../HoldoutResults"

const format = (value, digits = 3) => (value === null || value === undefined || !Number.isFinite(Number(value)) ? "-" : Number(value).toFixed(digits))

// metrics of the table and the chart, with the definition shown on hover
const METRICS = [
  { key: "auc", label: "AUC", tooltip: "Area under the ROC curve: probability that a positive case gets a higher score than a negative case" },
  { key: "sensitivity", label: "Sensitivity", tooltip: "TP / (TP + FN): share of the positive cases detected" },
  { key: "specificity", label: "Specificity", tooltip: "TN / (TN + FP): share of the negative cases correctly rejected" },
  { key: "f1", label: "F1", tooltip: "2·TP / (2·TP + FP + FN): balance between precision and sensitivity" },
  { key: "accuracy", label: "Accuracy", tooltip: "(TP + TN) / all rows" }
]

// below this number of positive (or negative) cases, the client metrics are unstable
const SMALL_CLASS = 10

const STATUS = {
  completed: { label: "Completed", severity: "success" },
  missing: { label: "No holdout file", severity: "warning" },
  skipped: { label: "Skipped", severity: "warning" },
  failed: { label: "Failed", severity: "danger" }
}

const POOLED_ID = "__pooled__"

const prevalence = (rows, positives) => (rows ? ` (${Math.round((100 * positives) / rows)}%)` : "")

/**
 * One row per client: the completed ones with their metrics, then the excluded ones with their reason
 */
const buildRows = (result) => [
  ...(result.clients || []).map((client) => ({
    id: client.client_id,
    status: "completed",
    rows: client.dataset?.rows,
    positives: client.dataset?.positives,
    metrics: client.metrics || {},
    confusion_matrix: client.confusion_matrix
  })),
  ...(result.missing_clients || []).map((client) => ({ id: client.client_id, status: "missing", reason: client.error || "No holdout file on this client" })),
  ...(result.skipped_clients || []).map((client) => ({
    id: client.client_id,
    status: "skipped",
    rows: client.rows,
    reason: client.reason || `Fewer than ${result.minimum_samples} usable rows`
  })),
  ...(result.failed_clients || []).map((client) => ({ id: client.client_id, status: "failed", reason: client.error }))
].map((row, index) => ({ ...row, key: `${row.status}-${row.id}-${index}` }))

/**
 * Metric value of a client and its difference with the pooled value
 */
const MetricCell = ({ row, metric, pooled }) => {
  if (row.id === POOLED_ID) return <b>{format(pooled[metric.key])}</b>
  if (row.status !== "completed") return null
  const value = row.metrics[metric.key]
  const reference = pooled[metric.key]
  const difference = Number.isFinite(value) && Number.isFinite(reference) ? value - reference : null
  return (
    <span className="text-nowrap">
      {format(value)}
      {difference !== null && Math.abs(difference) >= 0.0005 ? (
        <small className={`ms-2 ${difference > 0 ? "text-success" : "text-danger"}`}>
          {difference > 0 ? "+" : "−"}
          {format(Math.abs(difference), 3)}
        </small>
      ) : null}
    </span>
  )
}

/**
 * Dot plot of one metric across the clients, with the pooled value as reference.
 * The dot size grows with the number of holdout rows of the client.
 */
const ClientDotPlot = ({ rows, metric, pooledValue }) => {
  const option = useMemo(() => {
    const points = rows.filter((row) => Number.isFinite(row.metrics[metric.key]))
    const maxRows = Math.max(1, ...points.map((row) => row.rows || 0))
    return {
      grid: { left: 140, right: 60, top: 50, bottom: 45 },
      tooltip: {
        trigger: "item",
        // the dashed pooled line also has a tooltip, without a client
        formatter: (params) => {
          if (params.componentType === "markLine") return `Pooled ${metric.label}: ${format(pooledValue)}`
          const row = points[params.dataIndex]
          if (!row) return ""
          return `<b>${row.id}</b><br/>${metric.label}: ${format(row.metrics[metric.key])}<br/>Rows: ${row.rows}${prevalence(row.rows, row.positives)} positive`
        }
      },
      xAxis: { type: "value", name: metric.label, nameLocation: "middle", nameGap: 28, min: (range) => Math.max(0, Math.floor((range.min - 0.05) * 10) / 10), max: 1 },
      yAxis: { type: "category", data: points.map((row) => row.id), inverse: true, axisTick: { show: false } },
      series: [
        // thin stem from the client name to its dot (lollipop chart)
        {
          type: "bar",
          data: points.map((row) => [row.metrics[metric.key], row.id]),
          barWidth: 2,
          itemStyle: { color: "#cbd5e1" },
          silent: true,
          z: 1
        },
        {
          type: "scatter",
          z: 2,
          data: points.map((row) => ({
            value: [row.metrics[metric.key], row.id],
            symbolSize: 10 + 22 * Math.sqrt((row.rows || 0) / maxRows)
          })),
          itemStyle: { color: "#3b82f6", opacity: 0.8 },
          markLine: Number.isFinite(pooledValue)
            ? {
                symbol: "none",
                lineStyle: { type: "dashed", color: "#374151", width: 2 },
                // badge above the line (the y axis is inverted: its start is at the top)
                label: {
                  formatter: `Pooled ${metric.label}: ${format(pooledValue)}`,
                  position: "start",
                  distance: 6,
                  color: "#ffffff",
                  backgroundColor: "#374151",
                  fontSize: 13,
                  fontWeight: "bold",
                  padding: [4, 8],
                  borderRadius: 4
                },
                data: [{ xAxis: pooledValue }]
              }
            : undefined
        }
      ]
    }
  }, [rows, metric, pooledValue])

  return <ReactECharts option={option} style={{ height: Math.max(180, 60 + 45 * rows.length) }} notMerge />
}

/**
 * Results by client of the federated holdout test: table compared with the pooled results, or dot plot of one metric
 * @param {Object} result federated holdout result (status "completed")
 */
export default function ClientHoldoutResults({ result }) {
  const [view, setView] = useState("Table")
  const [chartMetric, setChartMetric] = useState("auc")
  const [expandedRows, setExpandedRows] = useState(null)

  const rows = useMemo(() => buildRows(result), [result])
  const completedRows = rows.filter((row) => row.status === "completed")
  const pooled = result.pooled.metrics || {}
  const pooledRow = { id: POOLED_ID, key: POOLED_ID, rows: result.pooled.dataset?.rows, positives: result.pooled.dataset?.positives }
  const metric = METRICS.find((item) => item.key === chartMetric)

  const clientTemplate = (row) => {
    if (row.id === POOLED_ID) return <b>★ Pooled ({result.participating_clients} clients)</b>
    const smallClass = row.status === "completed" && (row.positives < SMALL_CLASS || row.rows - row.positives < SMALL_CLASS)
    return (
      <span className={row.status === "completed" ? "" : "text-muted"}>
        {row.id || "Unknown client"}
        {smallClass ? (
          <i
            className="pi pi-exclamation-triangle text-warning ms-2"
            title={`Only ${Math.min(row.positives, row.rows - row.positives)} ${row.positives < row.rows - row.positives ? "positive" : "negative"} case(s): the metrics of this client are unstable`}
          />
        ) : null}
      </span>
    )
  }

  const statusTemplate = (row) => (row.id === POOLED_ID ? null : <Tag value={STATUS[row.status].label} severity={STATUS[row.status].severity} />)

  const rowsTemplate = (row) => (row.rows === undefined ? "-" : row.status === "completed" || row.id === POOLED_ID ? `${row.rows}${prevalence(row.rows, row.positives)}` : row.rows)

  const expansionTemplate = (row) => (
    <div className="row p-2">
      <div className="col-12 col-lg-6">
        <ConfusionMatrix matrix={row.confusion_matrix} />
      </div>
      <div className="col-12 col-lg-6 text-muted">
        PPV (precision) <b>{format(row.metrics.ppv)}</b> · NPV <b>{format(row.metrics.npv)}</b> · Accuracy <b>{format(row.metrics.accuracy)}</b>
        <div className="small mt-2">
          {row.rows} holdout rows, {row.positives} positive and {row.rows - row.positives} negative. Differences are relative to the pooled results.
        </div>
      </div>
    </div>
  )

  const header = (label, tooltip) => <span title={tooltip}>{label}</span>

  return (
    <Card className="mb-3">
      <Card.Header className="d-flex flex-wrap align-items-center justify-content-between gap-2">
        <span>Results by client</span>
        <div className="d-flex flex-wrap align-items-center gap-2">
          {view === "Chart" && <SelectButton value={chartMetric} onChange={(e) => e.value && setChartMetric(e.value)} options={METRICS.map((item) => ({ label: item.label, value: item.key }))} />}
          <SelectButton value={view} onChange={(e) => e.value && setView(e.value)} options={["Table", "Chart"]} />
        </div>
      </Card.Header>
      <Card.Body>
        {!result.clients ? (
          <Message severity="info" className="w-100 mb-3" text="The per-client results were not sent: turn on 'Include client results' in the Federated Holdout node to see them." />
        ) : null}

        {view === "Table" ? (
          <>
            <DataTable
              value={rows}
              frozenValue={[pooledRow]}
              dataKey="key"
              size="small"
              sortMode="single"
              removableSort
              expandedRows={expandedRows}
              onRowToggle={(e) => setExpandedRows(e.data)}
              rowExpansionTemplate={expansionTemplate}
              rowClassName={(row) => (row.id === POOLED_ID ? "bg-light" : "")}
            >
              <Column expander={(row) => row.status === "completed" && !!row.confusion_matrix} style={{ width: "3rem" }} />
              <Column header="Client" body={clientTemplate} field="id" sortable />
              <Column header="Status" body={statusTemplate} field="status" sortable />
              <Column header={header("Rows (positive %)", "Usable holdout rows and share of positive cases")} body={rowsTemplate} field="rows" sortable />
              {METRICS.map((item) => (
                <Column
                  key={item.key}
                  header={header(item.label, item.tooltip)}
                  body={(row) => (row.status && row.status !== "completed" ? (item.key === "auc" ? <span className="text-muted small">{row.reason}</span> : null) : <MetricCell row={row} metric={item} pooled={pooled} />)}
                  field={`metrics.${item.key}`}
                  sortable
                />
              ))}
            </DataTable>
            <div className="text-muted small mt-2">
              Coloured values are the difference with the pooled results. <i className="pi pi-exclamation-triangle text-warning" /> marks clients with fewer than {SMALL_CLASS} positive or
              negative cases. Click a row arrow for its confusion matrix.
            </div>
          </>
        ) : completedRows.length ? (
          <>
            <ClientDotPlot rows={completedRows} metric={metric} pooledValue={pooled[metric.key]} />
            <div className="text-muted small">Each dot is a client, its size grows with the number of holdout rows. The dashed line is the pooled value.</div>
          </>
        ) : (
          <Message severity="info" className="w-100" text="No per-client metrics to plot." />
        )}
      </Card.Body>
    </Card>
  )
}
