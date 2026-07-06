import React, { useContext, useEffect, useState } from "react"
import { toast } from "react-toastify"

import Input from "../learning/input"
import { requestBackend } from "../../utilities/requests"
import { PageInfosContext } from "../mainPages/moduleBasics/pageInfosContext"
import { WorkspaceContext } from "../workspace/workspaceContext"
import { ErrorRequestContext } from "../generalPurpose/errorRequestContext"
import ProgressBarRequests from "../generalPurpose/progressBarRequests"

import { listDeployments } from "./med3paDB"
import { PageHeader, StepBar, Card, Badge, SUCCESS_BTN, GHOST_BTN } from "./med3paUI"

const ROUTING_STYLE = {
  accept: { text: "Accept prediction", bg: "#EAF3DE", color: "#3B6D11" },
  caution: { text: "Caution / review", bg: "#FAEEDA", color: "#854F0B" },
  flag: { text: "Flag for human audit", bg: "#FAECE7", color: "#993C1D" }
}

/**
 * @description Deployment page: apply a deployed MED3pa model (base model + IPC/APC
 * confidence + DR threshold) to new data, either a workspace dataset (batch) or a
 * single manually-entered patient. Predictions are routed accept/caution/flag.
 *
 * @param {Function} goToPage navigate inside the MED3pa module
 * @param {Number} refreshKey bumped by the container to reload the deployment list
 */
export default function DeploymentPage({ goToPage, refreshKey = 0 }) {
  const { pageId } = useContext(PageInfosContext)
  const { port } = useContext(WorkspaceContext)
  const { setError } = useContext(ErrorRequestContext)

  const [deployments, setDeployments] = useState([])
  const [deploymentName, setDeploymentName] = useState("")
  const [tab, setTab] = useState("batch") // "batch" | "manual"
  const [chosenDataset, setChosenDataset] = useState(null)
  const [datasetHasWarning, setDatasetHasWarning] = useState({ state: false, tooltip: "" })
  const [idColumn, setIdColumn] = useState("")
  const [manualValues, setManualValues] = useState({})
  const [predictions, setPredictions] = useState([])
  const [isUpdating, setIsUpdating] = useState(false)
  const [progressValue, setProgressValue] = useState({ now: 0, currentLabel: "" })

  useEffect(() => {
    listDeployments()
      .then((d) => {
        setDeployments(d)
        if (d.length > 0 && !deploymentName) setDeploymentName(d[0].name)
      })
      .catch((e) => console.error("med3pa listDeployments", e))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey])

  const deployment = deployments.find((d) => d.name === deploymentName) || null

  const applyModel = (params) => {
    setIsUpdating(true)
    requestBackend(
      port,
      "med3pa/apply_model/" + pageId,
      { pageId: pageId, med3pa_apply_params: { deployment_name: deploymentName, ...params } },
      (jsonResponse) => {
        setIsUpdating(false)
        if (jsonResponse.error) {
          if (typeof jsonResponse.error == "string") jsonResponse.error = JSON.parse(jsonResponse.error)
          setError(jsonResponse.error)
        } else {
          const rows = jsonResponse.predictions || []
          setPredictions((prev) => [...rows, ...prev])
          toast.success(`${rows.length} prediction(s) computed`)
          if (params.input_mode === "manual") setManualValues({})
        }
      },
      (error) => {
        setIsUpdating(false)
        toast.error("Model application failed", error)
      }
    )
  }

  const runBatch = () => {
    if (!deployment) return toast.warn("Select a deployed model first")
    if (!chosenDataset?.id) return toast.warn("Select a dataset")
    applyModel({ input_mode: "dataset", dataset: chosenDataset, patient_id_column: idColumn || null })
  }

  const runManual = () => {
    if (!deployment) return toast.warn("Select a deployed model first")
    const missing = (deployment.columns || []).filter((c) => manualValues[c] === undefined || manualValues[c] === "")
    if (missing.length > 0) return toast.warn(`Missing values: ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? "…" : ""}`)
    applyModel({ input_mode: "manual", patient: manualValues })
  }

  const exportCsv = () => {
    if (predictions.length === 0) return
    const header = ["patient_id", "base_prob", "prediction", "ipc", "apc", "mpc", "profile", "routing"]
    const lines = [header.join(",")]
    predictions.forEach((p) => {
      const profile = (p.profile_path || []).filter((s) => s !== "*").join(" & ") || "All population"
      lines.push([p.patient_id, p.base_prob?.toFixed(4), p.prediction, p.ipc?.toFixed(4), p.apc?.toFixed(4), p.mpc?.toFixed(4), `"${profile}"`, p.routing].join(","))
    })
    const blob = new Blob([lines.join("\n")], { type: "text/csv" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `med3pa_predictions_${deploymentName || "export"}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const tabBtn = (key, label) => (
    <button
      onClick={() => setTab(key)}
      style={{
        padding: "6px 14px",
        fontSize: 12,
        border: "1px solid #E9ECEF",
        borderBottom: "none",
        borderRadius: "6px 6px 0 0",
        cursor: "pointer",
        background: tab === key ? "#0F6E56" : "#F8F9FA",
        color: tab === key ? "#fff" : "#495057",
        fontWeight: tab === key ? 600 : 400
      }}
    >
      {label}
    </button>
  )

  return (
    <div style={{ fontFamily: "sans-serif", padding: "1rem" }}>
      <PageHeader title="Run live inference pipeline" subtitle="Base model predictions verified by MED3pa confidence at the deployed declaration rate" />
      <StepBar activeStep={2} />

      <div style={{ display: "grid", gridTemplateColumns: "2fr 3fr", gap: 16, marginBottom: 16 }}>
        {/* Pipeline configuration */}
        <Card title="⚡ Pipeline configuration">
          <label style={{ fontSize: 12, color: "#6C757D", display: "block", marginBottom: 4 }}>Deployed model</label>
          <select value={deploymentName} onChange={(e) => setDeploymentName(e.target.value)} style={{ height: 32, width: "100%", fontSize: 13, marginBottom: 10 }}>
            <option value="">— select a deployed model —</option>
            {deployments.map((d) => (
              <option key={d.name} value={d.name}>
                {d.name} (DR = {d.dr_threshold}%)
              </option>
            ))}
          </select>
          {deployment ? (
            <div style={{ fontSize: 12, color: "#495057", background: "#F8F9FA", borderRadius: 6, padding: 10 }}>
              <div>
                <b>Session:</b> {deployment.session_name}
              </div>
              <div>
                <b>Base model:</b> {deployment.base_model_name ?? "—"}
              </div>
              <div>
                <b>Declaration rate:</b> {deployment.dr_threshold}% · <b>min confidence:</b> {deployment.min_confidence_level?.toFixed(3) ?? "—"}
              </div>
              <div>
                <b>MPC strategy:</b> {deployment.mpc_strategy}
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: "#6C757D" }}>
              No deployed models yet. Create one from the{" "}
              <a style={{ color: "#185FA5", cursor: "pointer" }} onClick={() => goToPage("analysis")}>
                Analysis Workspace
              </a>
              .
            </div>
          )}
        </Card>

        {/* Data input */}
        <Card title="📝 Patient data input">
          <div style={{ display: "flex", gap: 4 }}>
            {tabBtn("batch", "Batch processing (dataset)")}
            {tabBtn("manual", "Single patient (manual entry)")}
          </div>
          <div style={{ border: "1px solid #E9ECEF", borderRadius: "0 6px 6px 6px", padding: 12, background: "#F8F9FA" }}>
            {tab === "batch" ? (
              <>
                <p style={{ fontSize: 12, color: "#495057", marginTop: 0 }}>Select a workspace dataset containing new patients for batch inference.</p>
                <Input
                  name="Choose dataset"
                  settingInfos={{ type: "data-input", tooltip: "" }}
                  currentValue={chosenDataset?.id}
                  onInputChange={(data) => setChosenDataset(data.value)}
                  setHasWarning={setDatasetHasWarning}
                />
                <label style={{ fontSize: 11, color: "#6C757D", display: "block", margin: "8px 0 2px" }}>Patient ID column (optional)</label>
                <input
                  type="text"
                  placeholder="e.g. patient_id — generated if empty"
                  style={{ width: "100%", boxSizing: "border-box", height: 28, marginBottom: 10 }}
                  value={idColumn}
                  onChange={(e) => setIdColumn(e.target.value)}
                />
                <button style={SUCCESS_BTN} onClick={runBatch} disabled={isUpdating}>
                  ▶ Apply model
                </button>
              </>
            ) : (
              <>
                {deployment && (deployment.columns || []).length > 0 ? (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 10 }}>
                      {deployment.columns.map((col) => (
                        <div key={col}>
                          <label style={{ fontSize: 10, fontWeight: 600, color: "#495057", display: "block" }}>{col}</label>
                          <input
                            type="number"
                            step="any"
                            style={{ width: "100%", boxSizing: "border-box", height: 26 }}
                            value={manualValues[col] ?? ""}
                            onChange={(e) => setManualValues((v) => ({ ...v, [col]: e.target.value }))}
                          />
                        </div>
                      ))}
                    </div>
                    <button style={SUCCESS_BTN} onClick={runManual} disabled={isUpdating}>
                      ▶ Apply model
                    </button>{" "}
                    <button style={GHOST_BTN} onClick={() => setManualValues({})}>
                      Clear fields
                    </button>
                  </>
                ) : (
                  <div style={{ fontSize: 12, color: "#6C757D" }}>Select a deployed model to get its input fields.</div>
                )}
              </>
            )}
          </div>
          {isUpdating && (
            <ProgressBarRequests
              isUpdating={isUpdating}
              setIsUpdating={setIsUpdating}
              progress={progressValue}
              setProgress={setProgressValue}
              requestTopic={"med3pa/progress/" + pageId}
            />
          )}
        </Card>
      </div>

      {/* Predictions table */}
      <Card
        title={
          <span>
            Model predictions
            {predictions.length > 0 && (
              <button style={{ ...GHOST_BTN, padding: "3px 10px", fontSize: 11, float: "right" }} onClick={exportCsv}>
                Export to CSV
              </button>
            )}
          </span>
        }
      >
        {predictions.length === 0 ? (
          <div style={{ fontSize: 12, color: "#6C757D" }}>No predictions in this run yet. Apply the model on a dataset or a manually-entered patient.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#6C757D", fontSize: 11 }}>
                <th style={{ padding: 6 }}>Patient ID</th>
                <th style={{ padding: 6 }}>Base model risk</th>
                <th style={{ padding: 6 }}>MED3pa trust (MPC)</th>
                <th style={{ padding: 6 }}>Profile</th>
                <th style={{ padding: 6, textAlign: "right" }}>Routing status</th>
              </tr>
            </thead>
            <tbody>
              {predictions.map((p, i) => {
                const style = ROUTING_STYLE[p.routing] || ROUTING_STYLE.flag
                const profile = (p.profile_path || []).filter((s) => s !== "*").join(" & ") || "All population"
                return (
                  <tr key={i} style={{ borderTop: "1px solid #E9ECEF" }}>
                    <td style={{ padding: 6, fontWeight: 600 }}>{p.patient_id}</td>
                    <td style={{ padding: 6, color: p.prediction === 1 ? "#993C1D" : "#3B6D11" }}>
                      {(p.base_prob * 100).toFixed(0)}% {p.prediction === 1 ? "Positive" : "Negative"}
                    </td>
                    <td style={{ padding: 6 }}>
                      {p.mpc?.toFixed(2)} {p.mpc >= p.threshold ? "(above threshold)" : "(below threshold)"}
                    </td>
                    <td style={{ padding: 6, color: "#495057" }}>{profile}</td>
                    <td style={{ padding: 6, textAlign: "right" }}>
                      <Badge text={style.text} bg={style.bg} color={style.color} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
