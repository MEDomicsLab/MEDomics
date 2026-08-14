import React, { useEffect, useMemo, useState } from "react"
import { Dialog } from "primereact/dialog"
import { toast } from "react-toastify"

import { listSessions, getSession, createDeployment } from "./med3paDB"
import {
  getMetricNames,
  getMetricsEntryAt,
  bestDrForMetric,
  getSamplesRatios,
  getProfilesAt,
  getLostProfileIds,
  getLowerEndPopulation,
  getProfileDisappearances,
  profilesById
} from "./med3paResultsUtils"
import MdrCurvesChart from "./mdrCurvesChart"
import ApcTreeChart, { profileValue } from "./apcTreeChart"
import { PageHeader, StepBar, Card, Kpi, Collapsible, MetricBar, PRIMARY_BTN, SUCCESS_BTN } from "./med3paUI"

const CONFIDENCE_COLOR_METRICS = ["Mean confidence level"]

/**
 * @description Analysis Workspace page: load a saved session and explore the MED3pa
 * results — MDR curves, declaration-rate threshold, APC profile tree — then create
 * a deployable model at the chosen DR.
 *
 * @param {Function} goToPage navigate inside the MED3pa module
 * @param {String|null} initialSessionName session preselected after a fresh analysis run
 * @param {Number} refreshKey bumped by the container to reload the session list
 */
export default function AnalysisPage({ goToPage, initialSessionName = null, refreshKey = 0 }) {
  const [sessions, setSessions] = useState([])
  const [sessionName, setSessionName] = useState(initialSessionName || "")
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(false)

  const [currentDr, setCurrentDr] = useState(90)
  const [kpiMetric, setKpiMetric] = useState(null)
  const [visibleMetrics, setVisibleMetrics] = useState([])
  const [samplesRatio, setSamplesRatio] = useState(null)
  const [colorMetric, setColorMetric] = useState("Mean confidence level")
  const [displayMetrics, setDisplayMetrics] = useState([])
  const [nodeDialog, setNodeDialog] = useState(null) // {node, profile}
  const [treeFullscreen, setTreeFullscreen] = useState(false)
  const [createDialog, setCreateDialog] = useState(false)
  const [deployName, setDeployName] = useState("")

  useEffect(() => {
    listSessions()
      .then(setSessions)
      .catch((e) => console.error("med3pa listSessions", e))
  }, [refreshKey])

  useEffect(() => {
    if (initialSessionName) setSessionName(initialSessionName)
  }, [initialSessionName])

  // Load the full session document when a session is selected
  useEffect(() => {
    if (!sessionName) {
      setSession(null)
      return
    }
    setLoading(true)
    getSession(sessionName)
      .then((doc) => {
        setSession(doc)
        if (doc) {
          const metrics = getMetricNames(doc.metrics_by_dr)
          const defaultMetric = metrics.includes("Auc") ? "Auc" : metrics[0]
          setKpiMetric(defaultMetric)
          setVisibleMetrics(metrics.slice(0, 4))
          const ratios = getSamplesRatios(doc.profiles)
          setSamplesRatio(ratios.length > 0 ? ratios[0] : null)
          setColorMetric("Mean confidence level")
          setDisplayMetrics([])
          const best = bestDrForMetric(doc.metrics_by_dr, defaultMetric)
          if (best) setCurrentDr(best.dr)
        }
      })
      .catch((e) => {
        console.error("med3pa getSession", e)
        toast.error("Could not load session")
      })
      .finally(() => setLoading(false))
  }, [sessionName])

  const metricNames = useMemo(() => (session ? getMetricNames(session.metrics_by_dr) : []), [session])
  const best = useMemo(() => (session && kpiMetric ? bestDrForMetric(session.metrics_by_dr, kpiMetric) : null), [session, kpiMetric])
  const drEntry = useMemo(() => (session ? getMetricsEntryAt(session.metrics_by_dr, currentDr) : null), [session, currentDr])

  const profilesList = useMemo(
    () => (session && samplesRatio !== null ? getProfilesAt(session.profiles, samplesRatio, currentDr) : []),
    [session, samplesRatio, currentDr]
  )
  const profilesMap = useMemo(() => profilesById(profilesList), [profilesList])
  const lostIds = useMemo(
    () => (session && samplesRatio !== null ? getLostProfileIds(session.lost_profiles, samplesRatio, currentDr) : new Set()),
    [session, samplesRatio, currentDr]
  )
  // Same samples ratio as the tree, so a dot on the DR axis marks exactly the point
  // where that profile greys out in the tree beside it.
  const lostMarkers = useMemo(
    () => (session && samplesRatio !== null ? getProfileDisappearances(session.lost_profiles, samplesRatio) : []),
    [session, samplesRatio]
  )

  const treeColorOptions = useMemo(() => {
    const profileMetricNames = new Set()
    profilesList.forEach((p) => Object.keys(p.metrics || {}).forEach((m) => profileMetricNames.add(m)))
    return ["Mean confidence level", ...Array.from(profileMetricNames)]
  }, [profilesList])

  const onKpiMetricChange = (metric) => {
    setKpiMetric(metric)
    if (session) {
      const b = bestDrForMetric(session.metrics_by_dr, metric)
      if (b) setCurrentDr(b.dr)
    }
  }

  const onCreateModel = async () => {
    if (!deployName.trim()) {
      toast.warn("Give the deployed model a name")
      return
    }
    try {
      await createDeployment({
        name: deployName.trim(),
        session_name: session.name,
        dr_threshold: Math.round(currentDr),
        min_confidence_level: drEntry?.min_confidence_level ?? null,
        base_model_id: session.base_model?.id ?? null,
        base_model_name: session.base_model?.name ?? null,
        mpc_strategy: session.config?.mpc_strategy ?? "minimum",
        columns: session.columns ?? []
      })
      toast.success(`Model '${deployName.trim()}' deployed at DR = ${Math.round(currentDr)}%`)
      setCreateDialog(false)
      goToPage("deployment")
    } catch (e) {
      console.error("med3pa createDeployment", e)
      toast.error("Could not create the deployment")
    }
  }

  const setDrClamped = (v) => setCurrentDr(Math.max(0, Math.min(100, v)))

  const treeControls = (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center", marginBottom: 8 }}>
      <span style={{ fontSize: 11, color: "#6C757D" }}>
        Color by{" "}
        <select value={colorMetric} onChange={(e) => setColorMetric(e.target.value)} style={{ height: 26, fontSize: 12 }}>
          {treeColorOptions.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </span>
      {session && getSamplesRatios(session.profiles).length > 1 && (
        <span style={{ fontSize: 11, color: "#6C757D" }}>
          Min samples ratio{" "}
          <select value={samplesRatio ?? ""} onChange={(e) => setSamplesRatio(e.target.value)} style={{ height: 26, fontSize: 12 }}>
            {getSamplesRatios(session.profiles).map((r) => (
              <option key={r} value={r}>
                {r}%
              </option>
            ))}
          </select>
        </span>
      )}
      <span style={{ fontSize: 11, color: "#6C757D", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        Show on nodes:
        {metricNames.map((m) => (
          <label key={m} style={{ display: "flex", alignItems: "center", gap: 3, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={displayMetrics.includes(m)}
              onChange={(e) => setDisplayMetrics((d) => (e.target.checked ? [...d, m] : d.filter((x) => x !== m)))}
            />
            {m}
          </label>
        ))}
      </span>
    </div>
  )

  return (
    <div style={{ fontFamily: "sans-serif", padding: "1rem" }}>
      <PageHeader
        title="Analysis workspace"
        subtitle="Review MED3pa results and pick a declaration-rate threshold"
        right={
          <button style={PRIMARY_BTN} disabled={!session} onClick={() => setCreateDialog(true)}>
            ▶ Create Model
          </button>
        }
      />
      <StepBar activeStep={1} />

      {/* Session selection */}
      <Card title="📂 Session" subtitle="Select a saved session to load its results" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <select value={sessionName} onChange={(e) => setSessionName(e.target.value)} style={{ height: 32, minWidth: 280, fontSize: 13 }}>
            <option value="">— select a session —</option>
            {sessions.map((s) => (
              <option key={s.name} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>
          <span style={{ fontSize: 11, color: session ? "#0F6E56" : "#6C757D" }}>
            {loading ? "Loading…" : session ? `✔ Loaded: ${session.name} (${new Date(session.created_at).toLocaleString()})` : "No session loaded"}
          </span>
        </div>
        {session && (
          <div style={{ marginTop: 10 }}>
            <Collapsible title="⚙ Saved configuration" accentColor="#212529">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                {[
                  ["Base model", session.base_model?.name],
                  ["Dataset", session.dataset?.name],
                  ["Target column", session.target_column],
                  ["IPC type", session.config?.ipc?.ipc_type],
                  ["IPC n_estimators", session.config?.ipc?.n_estimators],
                  ["IPC max_depth", session.config?.ipc?.max_depth],
                  ["IPC min_samples_split", session.config?.ipc?.min_samples_split],
                  ["IPC confidence metric", session.config?.ipc?.confidence_metric],
                  ["APC tree depth", session.config?.apc?.tree_max_depth],
                  ["APC min_samples_leaf", session.config?.apc?.min_leading_samples],
                  ["APC ccp_alpha", session.config?.apc?.ccp_alpha],
                  ["MPC strategy", session.config?.mpc_strategy]
                ].map(([label, value]) => (
                  <div key={label}>
                    <div style={{ fontSize: 10, color: "#6C757D" }}>{label}</div>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{value !== null && value !== undefined && value !== "" ? String(value) : "—"}</div>
                  </div>
                ))}
              </div>
            </Collapsible>
          </div>
        )}
      </Card>

      {session && (
        <>
          {/* KPI cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
            <Kpi title="Patients analyzed" value={session.dataset_size?.toLocaleString() ?? "—"} sub={`Evaluation set · ${session.dataset?.name ?? ""}`} />
            <Kpi
              title="Suggested declaration rate"
              value={best ? `${best.dr}%` : "—"}
              sub={best ? `▲ Optimal DR for ${kpiMetric}` : ""}
              subColor="#0F6E56"
            />
            <Kpi
              title="Improvement at optimal DR"
              value={best ? `${best.improvement >= 0 ? "+" : ""}${(best.improvement * 100).toFixed(1)}%` : "—"}
              sub={best ? `${kpiMetric}: ${best.baseline?.toFixed(3)} → ${best.value?.toFixed(3)}` : ""}
              subColor="#0F6E56"
            >
              <select value={kpiMetric ?? ""} onChange={(e) => onKpiMetricChange(e.target.value)} style={{ height: 24, fontSize: 11, marginBottom: 4 }}>
                {metricNames.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </Kpi>
          </div>

          {/* DR threshold slider */}
          <Card style={{ marginBottom: 16, background: "#F8F9FA" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: "#185FA5" }}>🎯 Active Declaration Rate (DR) threshold: {Math.round(currentDr)}%</span>
              <input
                type="number"
                min={0}
                max={100}
                value={Math.round(currentDr)}
                onChange={(e) => setDrClamped(parseInt(e.target.value) || 0)}
                style={{ width: 64, height: 26, textAlign: "center" }}
              />
              {drEntry && (
                <span style={{ fontSize: 11, color: "#6C757D" }}>
                  min confidence: {drEntry.min_confidence_level?.toFixed(3) ?? "—"} · population kept:{" "}
                  {((getLowerEndPopulation(session?.metrics_by_dr, Math.round(currentDr)) ?? drEntry.population_percentage ?? 0) * 100).toFixed(1)}%
                </span>
              )}
            </div>
            <input type="range" min={0} max={100} step={1} value={currentDr} onChange={(e) => setDrClamped(parseInt(e.target.value))} style={{ width: "100%" }} />
          </Card>

          {/* Charts row */}
          <div style={{ display: "grid", gridTemplateColumns: "140px 1fr 1fr", gap: 12, marginBottom: 16 }}>
            <Card title="Show metrics" style={{ padding: "10px 12px" }}>
              {metricNames.map((m) => (
                <label key={m} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, marginBottom: 4, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={visibleMetrics.includes(m)}
                    onChange={(e) => setVisibleMetrics((v) => (e.target.checked ? [...v, m] : v.filter((x) => x !== m)))}
                  />
                  {m}
                </label>
              ))}
            </Card>
            <Card title="📈 Metrics by declaration rate" subtitle="Dots on the DR axis mark where each profile drops out of the tree · hover for details">
              <MdrCurvesChart
                metricsByDr={session.metrics_by_dr}
                visibleMetrics={visibleMetrics}
                currentDr={currentDr}
                lostMarkers={lostMarkers}
                height={320}
              />
            </Card>
            <Card
              title={
                <span>
                  🌿 APC profile tree{" "}
                  <button style={{ ...PRIMARY_BTN, padding: "2px 8px", fontSize: 12, float: "right" }} onClick={() => setTreeFullscreen(true)}>
                    ⤢
                  </button>
                </span>
              }
              subtitle="Profiles fade out when lost below the active DR · click a node for details"
            >
              {treeControls}
              <ApcTreeChart
                tree={session.tree}
                profilesMap={profilesMap}
                lostIds={lostIds}
                colorMetric={colorMetric}
                colorScheme={CONFIDENCE_COLOR_METRICS.includes(colorMetric) ? "confidence" : "performance"}
                displayMetrics={displayMetrics}
                onNodeClick={(node, profile) => setNodeDialog({ node, profile })}
                height={320}
              />
            </Card>
          </div>
        </>
      )}

      {!session && !loading && (
        <div style={{ color: "#6C757D", fontSize: 13 }}>
          Run an analysis from the Configuration page, or select an existing session above to explore its results.
        </div>
      )}

      {/* Node detail dialog */}
      <Dialog
        header={nodeDialog ? `Node ${nodeDialog.node?.id} · ${nodeDialog.node?.rule}` : ""}
        visible={nodeDialog !== null}
        style={{ width: "560px" }}
        onHide={() => setNodeDialog(null)}
      >
        {nodeDialog && (
          <div>
            <div style={{ fontSize: 12, color: "#495057", marginBottom: 10 }}>
              <b>Profile path:</b> {(nodeDialog.node.path || []).filter((p) => p !== "*").join("  →  ") || "All population (root)"}
            </div>
            {nodeDialog.profile ? (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12, background: "#F8F9FA", borderRadius: 6, padding: 10 }}>
                  {Object.entries(nodeDialog.profile["node information"] || {}).map(([k, v]) => (
                    <div key={k}>
                      <div style={{ fontSize: 10, color: "#6C757D" }}>{k}</div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{typeof v === "number" ? v.toFixed(3) : String(v)}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 13, fontWeight: 500, color: "#BA7517", marginBottom: 6 }}>● Base-model performance within this profile</div>
                {Object.entries(nodeDialog.profile.metrics || {}).map(([m, v]) =>
                  v === null || v === undefined ? null : <MetricBar key={m} label={m} value={v} color="#378ADD" />
                )}
              </>
            ) : (
              <div style={{ fontSize: 12, color: "#6C757D" }}>No profile metrics available for this node at the current DR / samples ratio.</div>
            )}
          </div>
        )}
      </Dialog>

      {/* Fullscreen tree dialog */}
      <Dialog header="🌿 APC profile tree — expanded" visible={treeFullscreen} maximized onHide={() => setTreeFullscreen(false)}>
        {session && (
          <>
            {treeControls}
            <ApcTreeChart
              tree={session.tree}
              profilesMap={profilesMap}
              lostIds={lostIds}
              colorMetric={colorMetric}
              colorScheme={CONFIDENCE_COLOR_METRICS.includes(colorMetric) ? "confidence" : "performance"}
              displayMetrics={displayMetrics}
              onNodeClick={(node, profile) => setNodeDialog({ node, profile })}
              height={Math.max(500, typeof window !== "undefined" ? window.innerHeight - 220 : 600)}
            />
          </>
        )}
      </Dialog>

      {/* Create Model dialog */}
      <Dialog header="Deploy model at the chosen threshold" visible={createDialog} style={{ width: "460px" }} onHide={() => setCreateDialog(false)}>
        {session && (
          <div>
            <div style={{ fontSize: 12, color: "#495057", marginBottom: 12 }}>
              Creates a deployable model from session <b>{session.name}</b> using base model <b>{session.base_model?.name}</b> with a declaration rate of{" "}
              <b>{Math.round(currentDr)}%</b> (minimum confidence {drEntry?.min_confidence_level?.toFixed(3) ?? "—"}). New patients whose confidence falls below
              this threshold will be flagged for human review.
            </div>
            <label style={{ fontSize: 12, color: "#6C757D", display: "block", marginBottom: 4 }}>Deployed model name</label>
            <input
              type="text"
              placeholder="e.g. ICU mortality — conservative"
              style={{ width: "100%", boxSizing: "border-box", height: 30, marginBottom: 14 }}
              value={deployName}
              onChange={(e) => setDeployName(e.target.value)}
            />
            <button style={{ ...SUCCESS_BTN, width: "100%" }} onClick={onCreateModel}>
              ⚡ Create deployment
            </button>
          </div>
        )}
      </Dialog>
    </div>
  )
}
