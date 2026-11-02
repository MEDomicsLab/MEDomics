/* eslint-disable react-hooks/rules-of-hooks */

// components/.../DatasetOverview.jsx
import React, { useMemo, useEffect, useRef, useContext } from "react"
import { Badge } from "react-bootstrap"
import { FaCheckCircle, FaTimesCircle } from "react-icons/fa"
import { useMEDflContext } from "../../workspace/medflContext"
import { FlowFunctionsContext } from "../../flow/context/flowFunctionsContext"

/**
 * datasetStats shape (per agent):
 * {
 *   path, exists, file_size_bytes, modified_time,
 *   n_rows, n_cols, columns: string[],
 *   head, null_counts, numeric_summary, engine
 *   holdout: same shape, stats of the holdout file (absent with older agents)
 * }
 * holdoutFileName: holdout file looked for on each agent
 * holdoutRequired: the flow has a Federated Holdout node (a missing holdout file is then an error, else a warning)
 */
export default function DatasetOverview({ datasetStats = {}, holdoutFileName = "holdout.csv", holdoutRequired = false }) {
  const { updateColumnsIntersectionFromNetworkCheck, columnsIntersectionFromNetworkCheck } = useMEDflContext()
  const { groupNodeId } = useContext(FlowFunctionsContext)

  const agents = useMemo(() => Object.keys(datasetStats), [datasetStats])
  if (!agents.length) return null

  // Helpers
  const toSet = (arr = []) => new Set((arr || []).map(String))
  const equalSets = (a, b) => a.size === b.size && [...a].every((v) => b.has(v))

  // Compute everything once per datasetStats change
  const computed = useMemo(() => {
    const existsByAgent = Object.fromEntries(agents.map((a) => [a, !!datasetStats[a]?.exists]))
    const rowsByAgent = Object.fromEntries(agents.map((a) => [a, datasetStats[a]?.n_rows ?? null]))
    const colsByAgent = Object.fromEntries(agents.map((a) => [a, datasetStats[a]?.n_cols ?? null]))
    const columnsByAgent = Object.fromEntries(agents.map((a) => [a, datasetStats[a]?.columns || []]))
    const engineByAgent = Object.fromEntries(agents.map((a) => [a, datasetStats[a]?.engine || "-"]))

    const allExist = agents.every((a) => existsByAgent[a])

    // pick first agent that actually has columns as reference
    const refAgent = agents.find((a) => (columnsByAgent[a] || []).length) || agents[0]
    const refColsSet = toSet(columnsByAgent[refAgent])

    const sameColumnsEverywhere = agents.every((a) => equalSets(refColsSet, toSet(columnsByAgent[a])))

    const unionCols = new Set()
    const interCols = new Set(refColsSet)
    agents.forEach((a) => {
      const s = toSet(columnsByAgent[a])
      s.forEach((c) => unionCols.add(c))
      ;[...interCols].forEach((c) => {
        if (!s.has(c)) interCols.delete(c)
      })
    })

    const diffByAgent = Object.fromEntries(
      agents.map((a) => {
        const s = toSet(columnsByAgent[a])
        const missing = [...refColsSet].filter((c) => !s.has(c))
        const extra = [...s].filter((c) => !refColsSet.has(c))
        return [a, { missing, extra }]
      })
    )

    const engineSet = new Set(agents.map((a) => engineByAgent[a]))
    const sameEngineEverywhere = engineSet.size === 1

    const rowSet = new Set(agents.map((a) => rowsByAgent[a] ?? "NA"))
    const colSet = new Set(agents.map((a) => colsByAgent[a] ?? "NA"))
    const sameRows = rowSet.size === 1
    const sameCols = colSet.size === 1

    // Holdout file of each agent: checked (the agent sent its stats), exists, and the dataset columns it lacks
    const holdoutByAgent = Object.fromEntries(
      agents.map((a) => {
        const holdout = datasetStats[a]?.holdout
        const holdoutCols = toSet(holdout?.columns)
        return [
          a,
          {
            checked: !!holdout,
            exists: !!holdout?.exists,
            rows: holdout?.n_rows ?? null,
            error: holdout?.error,
            missingColumns: holdout?.exists ? (columnsByAgent[a] || []).map(String).filter((c) => !holdoutCols.has(c)) : []
          }
        ]
      })
    )
    const holdoutMissingCount = agents.filter((a) => !holdoutByAgent[a].exists).length
    const holdoutColumnsOk = agents.every((a) => !holdoutByAgent[a].missingColumns.length)

    // Normalized intersection for downstream consumers: [{label, name}]
    const interArray = [...interCols].map((c) => ({ label: String(c), name: String(c) }))

    return {
      existsByAgent,
      rowsByAgent,
      colsByAgent,
      columnsByAgent,
      engineByAgent,
      allExist,
      refAgent,
      refColsSet,
      sameColumnsEverywhere,
      interCols,
      unionCols,
      diffByAgent,
      sameEngineEverywhere,
      sameRows,
      sameCols,
      holdoutByAgent,
      holdoutMissingCount,
      holdoutColumnsOk,
      interArray
    }
  }, [datasetStats, agents])

  // Guarded context update (avoid maximum update depth)
  const lastHashRef = useRef("")
  const interHash = useMemo(() => JSON.stringify(computed.interArray), [computed.interArray])

  useEffect(() => {
    if (lastHashRef.current !== interHash) {
      lastHashRef.current = interHash
      updateColumnsIntersectionFromNetworkCheck({ ...columnsIntersectionFromNetworkCheck, [groupNodeId.id]: computed.interArray })
    }
  }, [interHash, computed.interArray, updateColumnsIntersectionFromNetworkCheck])

  const {
    existsByAgent,
    rowsByAgent,
    colsByAgent,
    engineByAgent,
    allExist,
    refAgent,
    sameColumnsEverywhere,
    interCols,
    unionCols,
    diffByAgent,
    sameEngineEverywhere,
    sameRows,
    sameCols,
    holdoutByAgent,
    holdoutMissingCount,
    holdoutColumnsOk
  } = computed

  const holdoutBadge = (holdout) => {
    if (!holdout.checked) return <Badge bg="secondary">Not checked</Badge>
    if (!holdout.exists) return <Badge bg={holdoutRequired ? "danger" : "warning"}>Missing</Badge>
    return <Badge bg={holdout.missingColumns.length ? "warning" : "success"}>Exists</Badge>
  }

  const Pill = ({ ok, text, warning = false }) => (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        marginRight: 8,
        background: warning ? "rgba(167, 133, 40, 0.1)" : ok ? "rgba(40,167,69,0.1)" : "rgba(220,53,69,0.1)",
        color: warning ? "#ee932bff" : ok ? "#28a745" : "#dc3545"
      }}
    >
      {ok ? <FaCheckCircle /> : <FaTimesCircle />} {text}
    </span>
  )

  return (
    <div className="container-fluid" style={{ padding: 16 }}>
      <div className="card" style={{ borderRadius: 7, boxShadow: "0 2px 8px rgba(0,0,0,0.08)", border: 0 }}>
        <div className="card-body">
          <h4 className="card-title" style={{ display: "flex", gap: 10, alignItems: "center" }}>
            Dataset Overview
            <Badge bg="secondary">{agents.length} agent(s)</Badge>
          </h4>

          {/* Summary pills */}
          <div style={{ marginTop: 8, marginBottom: 16 }}>
            <Pill ok={allExist} text={allExist ? "All datasets exist" : "Some datasets missing"} />
            <Pill ok={sameColumnsEverywhere} text={sameColumnsEverywhere ? "Columns identical across agents" : "Columns differ across agents"} />
            <Pill ok={sameEngineEverywhere} text={sameEngineEverywhere ? "Same engine" : "Different engines"} warning={!sameEngineEverywhere} />
            <Pill ok={sameRows} text={sameRows ? "Same #rows" : "Different #rows"} warning={!sameRows} />
            <Pill ok={sameCols} text={sameCols ? "Same #cols" : "Different #cols"} warning={!sameCols} />
            <Pill
              ok={!holdoutMissingCount}
              text={!holdoutMissingCount ? `All ${holdoutFileName} files exist` : `${holdoutMissingCount} ${holdoutFileName} file(s) missing`}
              warning={!!holdoutMissingCount && !holdoutRequired}
            />
            {!holdoutColumnsOk && <Pill ok={false} text="Some holdout files lack dataset columns" warning />}
          </div>

          {/* Columns union / intersection */}
          <div className="row">
            <div className="col-md-6">
              <h6>Columns (Intersection) — {interCols.size}</h6>
              <div className="small text-monospace" style={{ whiteSpace: "pre-wrap" }}>
                {[...interCols].join(", ") || "-"}
              </div>
            </div>
            <div className="col-md-6">
              <h6>Columns (Union) — {unionCols.size}</h6>
              <div className="small text-monospace" style={{ whiteSpace: "pre-wrap" }}>
                {[...unionCols].join(", ") || "-"}
              </div>
            </div>
          </div>

          {/* Per-agent summary table */}
          <h5 style={{ marginTop: 20 }}>Per-Agent Summary</h5>
          <div className="table-responsive">
            <table className="table table-bordered table-sm mb-0">
              <thead className="thead-light">
                <tr>
                  <th>Agent</th>
                  <th>Status</th>
                  <th>Rows</th>
                  <th>Cols</th>
                  <th>Engine</th>
                  <th>Missing vs {refAgent}</th>
                  <th>Extra vs {refAgent}</th>
                  <th>Holdout ({holdoutFileName})</th>
                  <th>Holdout rows</th>
                  <th>Holdout missing columns</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((a) => (
                  <tr key={a}>
                    <td className="text-monospace">{a}</td>
                    <td>{existsByAgent[a] ? <Badge bg="success">Exists</Badge> : <Badge bg="danger">Missing</Badge>}</td>
                    <td className="text-end">{rowsByAgent[a] ?? "-"}</td>
                    <td className="text-end">{colsByAgent[a] ?? "-"}</td>
                    <td>{engineByAgent[a]}</td>
                    <td className="small">{(computed.diffByAgent[a].missing.length && computed.diffByAgent[a].missing.join(", ")) || "-"}</td>
                    <td className="small">{(computed.diffByAgent[a].extra.length && computed.diffByAgent[a].extra.join(", ")) || "-"}</td>
                    <td title={holdoutByAgent[a].error || (!holdoutByAgent[a].checked ? "This agent did not return holdout stats (older agent version?)" : "")}>{holdoutBadge(holdoutByAgent[a])}</td>
                    <td className="text-end">{holdoutByAgent[a].rows ?? "-"}</td>
                    <td className="small">{holdoutByAgent[a].missingColumns.join(", ") || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {holdoutMissingCount > 0 && (
            <div className={`alert ${holdoutRequired ? "alert-danger" : "alert-warning"} mt-3 mb-0`}>
              <strong>Holdout:</strong> {holdoutMissingCount} agent(s) have no {holdoutFileName} in their data folder (next to dataset.csv).{" "}
              {holdoutRequired ? "They will be reported as missing in the federated holdout test." : "It is only needed for the federated holdout test (Federated Holdout node)."}
            </div>
          )}

          {!holdoutColumnsOk && (
            <div className="alert alert-warning mt-3 mb-0">
              <strong>Holdout columns:</strong> some holdout files lack columns of their agent dataset. The holdout test fails on a client whose holdout file lacks a training feature or the target.
            </div>
          )}

          {!sameColumnsEverywhere && (
            <div className="alert alert-warning mt-3 mb-0">
              <strong>Note:</strong> Column sets differ across agents. Consider aligning schemas before launching training.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
