import React, { useEffect, useMemo, useState } from "react"
import { Dialog } from "primereact/dialog"
import { getSession, listDeployments } from "./med3paDB"
import { layoutTree, nodeIdsOnPath, getProfilesAt, getLostProfileIds, getSamplesRatios, profilesById, getMetricNames } from "./med3paResultsUtils"
import MdrCurvesChart from "./mdrCurvesChart"
import ApcTreeChart from "./apcTreeChart"
import { PageHeader, Card, Kpi, MetricBar, PRIMARY_BTN } from "./med3paUI"

const BANNER = {
  accept: { bg: "#EAF3DE", color: "#3B6D11", icon: "✓", title: "Accept — reliable prediction", sub: "Confidence clears the declaration-rate threshold and the patient is not in a flagged profile." },
  caution: { bg: "#FAEEDA", color: "#854F0B", icon: "⚠", title: "Caution — weak profile", sub: "Individual confidence clears the threshold, but this patient belongs to a profile the base model handles poorly. Interpret with care." },
  flag: { bg: "#FAECE7", color: "#993C1D", icon: "⛔", title: "Reject — low confidence", sub: "Predicted confidence is below the declaration-rate threshold; withhold the base model prediction and review manually." }
}

/**
 * @description Patient Detail dashboard: recommendation banner, confidence decomposition
 * (IPC/APC/MPC vs the deployment threshold), base model output, the MDR curves with the
 * patient's confidence position, and the APC tree with the patient's profile highlighted.
 *
 * @param {Object} patient the med3pa_patients record opened from the Lookup page
 * @param {Function} goBack navigate back to the lookup page
 */
export default function PatientDetailPage({ patient, goBack }) {
  const [session, setSession] = useState(null)
  const [deployment, setDeployment] = useState(null)
  const [treeFullscreen, setTreeFullscreen] = useState(false)

  useEffect(() => {
    if (!patient) return
    getSession(patient.session_name)
      .then(setSession)
      .catch((e) => console.error("med3pa getSession", e))
    listDeployments()
      .then((ds) => setDeployment(ds.find((d) => d.name === patient.deployment_name) || null))
      .catch((e) => console.error("med3pa listDeployments", e))
  }, [patient])

  const drThreshold = deployment?.dr_threshold ?? 100
  const treeLayout = useMemo(() => (session ? layoutTree(session.tree) : { nodes: [] }), [session])
  const highlightIds = useMemo(() => nodeIdsOnPath(treeLayout.nodes, patient?.profile_path), [treeLayout, patient])

  const profilesMap = useMemo(() => {
    if (!session) return {}
    const ratios = getSamplesRatios(session.profiles)
    if (ratios.length === 0) return {}
    return profilesById(getProfilesAt(session.profiles, ratios[0], drThreshold))
  }, [session, drThreshold])
  const lostIds = useMemo(() => {
    if (!session) return new Set()
    const ratios = getSamplesRatios(session.profiles)
    if (ratios.length === 0) return new Set()
    return getLostProfileIds(session.lost_profiles, ratios[0], drThreshold)
  }, [session, drThreshold])

  // DR position of the patient: the LOWEST declaration rate at which this patient is
  // still declared (patient.mpc >= min_confidence_level).
  const patientDr = useMemo(() => {
    if (!session || !patient) return null
    let best = null
    Object.entries(session.metrics_by_dr || {}).forEach(([dr, entry]) => {
      const min = entry?.min_confidence_level
      if (min !== null && min !== undefined && patient.mpc >= min) {
        const d = parseInt(dr)
        if (best === null || d < best) best = d
      }
    })
    return best
  }, [session, patient])

  if (!patient) {
    return (
      <div style={{ fontFamily: "sans-serif", padding: "1rem", color: "#6C757D", fontSize: 13 }}>
        No patient selected. Open one from the Patient Lookup page.
      </div>
    )
  }

  const banner = BANNER[patient.routing] || BANNER.flag
  const profileLabel = (patient.profile_path || []).filter((s) => s !== "*").join(" & ") || "All population"

  // Shared by the inline chart and the expanded dialog so the two cannot drift.
  const treeProps = {
    tree: session?.tree,
    profilesMap: profilesMap,
    lostIds: lostIds,
    colorMetric: "Mean confidence level",
    colorScheme: "confidence",
    displayMetrics: [],
    highlightIds: highlightIds
  }

  return (
    <div style={{ fontFamily: "sans-serif", padding: "1rem" }}>
      <a style={{ color: "#185FA5", cursor: "pointer", fontSize: 13 }} onClick={goBack}>
        ← Back to lookup
      </a>
      <PageHeader title={patient.patient_id} subtitle={`Scanned by '${patient.deployment_name}' on ${patient.created_at ? new Date(patient.created_at).toLocaleString() : "—"}`} />

      {/* Recommendation banner */}
      <div style={{ background: banner.bg, borderRadius: 8, padding: "12px 16px", display: "flex", gap: 14, alignItems: "center", marginBottom: 16 }}>
        <span style={{ fontSize: 24, color: banner.color }}>{banner.icon}</span>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: banner.color }}>{banner.title}</div>
          <div style={{ fontSize: 12, color: banner.color }}>{banner.sub}</div>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
        <Kpi title="Deployed model" value={patient.deployment_name} sub={`Declaration rate: ${drThreshold}%`} />
        <Kpi
          title="MPC confidence"
          value={patient.mpc?.toFixed(2)}
          sub={`${patient.mpc >= patient.threshold ? "Above" : "Below"} DR threshold (${patient.threshold?.toFixed(2)})`}
          subColor={patient.mpc >= patient.threshold ? "#0F6E56" : "#993C1D"}
        />
        <Kpi title="APC profile membership" value={profileLabel} sub={patientDr !== null ? `Declared down to DR ≈ ${patientDr}%` : ""} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        {/* Confidence decomposition */}
        <Card title="🔎 Confidence decomposition" subtitle={`MPC combines IPC and APC · compared to the deployment threshold (${patient.threshold?.toFixed(2)})`}>
          <MetricBar label="IPC" desc="Individualized" value={patient.ipc} color="#378ADD" />
          <MetricBar label="APC" desc="Profile-level" value={patient.apc} color="#1D9E75" />
          <MetricBar label="MPC" desc="Mixed" value={patient.mpc} color="#185FA5" />
          <div style={{ fontSize: 11, color: "#6C757D", fontStyle: "italic" }}>Declaration-rate confidence threshold: {patient.threshold?.toFixed(2)}</div>
        </Card>

        {/* Base model output */}
        <Card title="🩺 Base model output" subtitle="Predicted probability for the positive class">
          <div style={{ fontSize: 40, fontWeight: 700, color: patient.prediction === 1 ? "#993C1D" : "#3B6D11" }}>{(patient.base_prob * 100).toFixed(0)}%</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: patient.prediction === 1 ? "#993C1D" : "#3B6D11", marginBottom: 8 }}>
            predicted outcome
          </div>
          <div style={{ background: "#E9ECEF", borderRadius: 6, height: 12 }}>
            <div style={{ background: patient.prediction === 1 ? "#993C1D" : "#3B6D11", borderRadius: 6, height: 12, width: `${patient.base_prob * 100}%` }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#ADB5BD", marginTop: 3 }}>
            <span>0%</span>
            <span>decision threshold 50%</span>
            <span>100%</span>
          </div>
        </Card>
      </div>

      {/* MDR + tree */}
      {session && (
        <Card
          title={
            <span>
              🌿 APC profile tree — patient&apos;s profile highlighted{" "}
              <button
                style={{ ...PRIMARY_BTN, padding: "2px 8px", fontSize: 12, float: "right" }}
                title="Expand tree"
                onClick={() => setTreeFullscreen(true)}
              >
                ⤢
              </button>
            </span>
          }
          subtitle="The chart marks the deployed DR and the highest DR at which this patient would still be declared; the highlighted path is the patient's profile chain."
          style={{ marginBottom: 16 }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "2fr 3fr", gap: 12 }}>
            <MdrCurvesChart
              metricsByDr={session.metrics_by_dr}
              visibleMetrics={getMetricNames(session.metrics_by_dr).slice(0, 3)}
              currentDr={drThreshold}
              extraMarker={patientDr !== null ? { value: patientDr, label: "patient", color: "#8E5BB5" } : null}
              height={320}
            />
            <ApcTreeChart {...treeProps} height={320} />
          </div>
        </Card>
      )}

      {/* Expanded tree — same chart, given the whole window. The inline copy is
          squeezed into part of a split row, which makes deep trees unreadable. */}
      <Dialog header="🌿 APC profile tree — expanded" visible={treeFullscreen} maximized onHide={() => setTreeFullscreen(false)}>
        {session && (
          <>
            <div style={{ fontSize: 12, color: "#6C757D", marginBottom: 8 }}>
              Highlighted path: <b>{profileLabel}</b> · drag to pan, ctrl/⌘ + wheel to zoom
            </div>
            <ApcTreeChart
              {...treeProps}
              height={Math.max(500, typeof window !== "undefined" ? window.innerHeight - 220 : 600)}
            />
          </>
        )}
      </Dialog>

      {/* Clinical data */}
      <Card title="📋 Clinical data" style={{ marginBottom: 20 }}>
        {patient.data && Object.keys(patient.data).length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            {Object.entries(patient.data).map(([k, v]) => (
              <div key={k} style={{ background: "#F8F9FA", borderRadius: 6, padding: "6px 10px" }}>
                <div style={{ fontSize: 10, color: "#6C757D" }}>{k}</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{v === null || v === undefined ? "—" : String(v)}</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: "#6C757D" }}>No clinical data recorded for this patient.</div>
        )}
      </Card>
    </div>
  )
}
