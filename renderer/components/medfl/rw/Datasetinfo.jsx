import React from "react"
import { FaFileCsv, FaDatabase, FaTable, FaCheckCircle, FaTimesCircle } from "react-icons/fa"

/**
 * Props:
 *  data = {
 *    path, exists, file_size_bytes, modified_time,
 *    n_rows, n_cols, columns: string[],
 *    head: Array<Record<string, any>>,
 *    null_counts: Record<string, number>,
 *    numeric_summary: Record<string, Record<string, number>>
 *  }
 */
const DatasetInfo = ({ data, resumed = false }) => {
  if (!data) return null

  const { path, exists, file_size_bytes, modified_time, n_rows, n_cols, columns = [], head = [], null_counts = {}, numeric_summary = {}, engine } = data

  const formatFileSize = (bytes) => {
    if (bytes == null) return "-"
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  // Collect all stat keys that appear anywhere in numeric_summary
  const statKeys = Array.from(
    new Set(
      Object.values(numeric_summary)
        .flatMap((stats) => Object.keys(stats || {}))
        .sort()
    )
  )

  const cardStyle = {
    borderRadius: "7px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
    overflow: "hidden",
    border: "0px"
  }

  const sectionTitleStyle = {
    marginTop: 20,
    marginBottom: 8,
    display: "flex",
    alignItems: "center",
    gap: 10
  }

  const pillStyle = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600
  }

  return (
    <div className="container-fluid" style={{ padding: 16 }}>
      <div className="card" style={cardStyle}>
        <div className="card-body">
          <h4 className="card-title d-flex align-items-center" style={{ gap: 10 }}>
            <FaFileCsv style={{ color: "#28a745" }} />
            Dataset Information
          </h4>

          {/* Meta table */}
          <div className="table-responsive" style={{ marginTop: 12 }}>
            <table className="table table-bordered table-sm mb-0">
              <tbody>
                <tr>
                  <th style={{ width: 180 }}>Path</th>
                  <td className="text-monospace">{path || "-"}</td>
                </tr>
                <tr>
                  <th>Status</th>
                  <td>
                    {exists ? (
                      <span
                        style={{
                          ...pillStyle,
                          background: "rgba(40,167,69,0.1)",
                          color: "#28a745"
                        }}
                      >
                        <FaCheckCircle />
                        Exists
                      </span>
                    ) : (
                      <span
                        style={{
                          ...pillStyle,
                          background: "rgba(220,53,69,0.1)",
                          color: "#dc3545"
                        }}
                      >
                        <FaTimesCircle />
                        Missing
                      </span>
                    )}
                  </td>
                </tr>
                <tr>
                  <th>File Size</th>
                  <td>{formatFileSize(file_size_bytes)}</td>
                </tr>
                <tr>
                  <th>Last Modified</th>
                  <td>{modified_time || "-"}</td>
                </tr>
                <tr>
                  <th>Shape</th>
                  <td className="d-flex align-items-center" style={{ gap: 8 }}>
                    <FaDatabase />
                    {n_rows ?? "-"} rows × {n_cols ?? "-"} cols
                    {engine && (
                      <span className="ml-2 text-muted" style={{ fontSize: 12 }}>
                        ({engine})
                      </span>
                    )}
                  </td>
                </tr>
                <tr>
                  <th>Columns</th>
                  <td>{columns.length ? columns.join(", ") : "-"}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {!resumed && (
            <>
              {/* Head preview */}
              <h5 style={sectionTitleStyle}>
                <FaTable />
                First 5 Rows
              </h5>
              <div className="table-responsive">
                <table className="table table-striped table-bordered table-hover table-sm">
                  <thead className="thead-light">
                    <tr>
                      {columns.map((col) => (
                        <th key={col}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {head.length ? (
                      head.map((row, idx) => (
                        <tr key={idx}>
                          {columns.map((col) => (
                            <td key={col}>{row && row[col] !== undefined && row[col] !== null ? String(row[col]) : ""}</td>
                          ))}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={columns.length} className="text-center text-muted">
                          No preview data
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Null counts */}
              <h5 style={sectionTitleStyle}>Null Counts</h5>
              <div className="table-responsive">
                <table className="table table-bordered table-sm mb-0">
                  <thead className="thead-light">
                    <tr>
                      <th>Column</th>
                      <th className="text-right">Nulls</th>
                    </tr>
                  </thead>
                  <tbody>
                    {columns.map((c) => (
                      <tr key={c}>
                        <td>{c}</td>
                        <td className="text-right">{null_counts?.[c] ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Numeric summary */}
              <h5 style={sectionTitleStyle}>Numeric Summary</h5>
              <div className="table-responsive">
                <table className="table table-bordered table-sm">
                  <thead className="thead-light">
                    <tr>
                      <th>Column</th>
                      {statKeys.map((k) => (
                        <th key={k} className="text-right">
                          {k}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(numeric_summary).map((col) => (
                      <tr key={col}>
                        <td>{col}</td>
                        {statKeys.map((k) => {
                          const v = numeric_summary[col]?.[k]
                          const num = typeof v === "number" ? (Math.abs(v) >= 1000 ? v.toFixed(0) : v.toString().includes(".") ? v.toFixed(6).replace(/\.?0+$/, "") : v) : (v ?? "-")
                          return (
                            <td key={k} className="text-right">
                              {num}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                    {!Object.keys(numeric_summary).length && (
                      <tr>
                        <td colSpan={1 + statKeys.length} className="text-center text-muted">
                          No numeric summary available
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default DatasetInfo
