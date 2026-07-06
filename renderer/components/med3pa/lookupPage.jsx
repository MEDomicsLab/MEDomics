import React, { useEffect, useState } from "react"
import { listPatients } from "./med3paDB"
import { PageHeader, Card, Badge, PRIMARY_BTN } from "./med3paUI"

const RECOMMENDATION = {
  accept: { text: "Accept", bg: "#EAF3DE", color: "#3B6D11" },
  caution: { text: "Caution", bg: "#FAEEDA", color: "#854F0B" },
  flag: { text: "Reject (manual review)", bg: "#FAECE7", color: "#993C1D" }
}

/**
 * @description Patient Lookup page: search across all patients scanned by deployed
 * models and open a patient's full dashboard.
 *
 * @param {Function} openPatient callback(patientRecord) → navigates to the detail page
 * @param {Number} refreshKey bumped by the container to reload
 */
export default function LookupPage({ openPatient, refreshKey = 0 }) {
  const [query, setQuery] = useState("")
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(false)

  const search = (q) => {
    setLoading(true)
    listPatients(q || null)
      .then(setPatients)
      .catch((e) => console.error("med3pa listPatients", e))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    search(query)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey])

  return (
    <div style={{ fontFamily: "sans-serif", padding: "1rem" }}>
      <PageHeader title="Patient lookup" subtitle="Query individual clinical predictions from deployed models" />

      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Enter Patient ID (e.g. PT-0042)"
          style={{ width: 300, height: 34, boxSizing: "border-box" }}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search(query)}
        />
        <button style={PRIMARY_BTN} onClick={() => search(query)}>
          Search
        </button>
      </div>

      {loading && <div style={{ fontSize: 12, color: "#6C757D" }}>Searching…</div>}
      {!loading && patients.length === 0 && (
        <div style={{ fontSize: 13, color: "#6C757D" }}>
          {query ? `No patient matching '${query}'.` : "No patients scanned yet — apply a deployed model on the Deployment page first."}
        </div>
      )}

      {patients.map((p, i) => {
        const rec = RECOMMENDATION[p.routing] || RECOMMENDATION.flag
        const profile = (p.profile_path || []).filter((s) => s !== "*").join(" & ") || "All population"
        return (
          <div
            key={`${p.patient_id}-${i}`}
            onClick={() => openPatient(p)}
            style={{ cursor: "pointer", marginBottom: 10 }}
            onMouseEnter={(e) => (e.currentTarget.firstChild.style.borderColor = "#185FA5")}
            onMouseLeave={(e) => (e.currentTarget.firstChild.style.borderColor = "#E9ECEF")}
          >
            <Card>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 18, fontWeight: 600 }}>{p.patient_id}</span>
                <span style={{ fontSize: 11, color: "#6C757D" }}>
                  {p.deployment_name} · {p.created_at ? new Date(p.created_at).toLocaleString() : ""}
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 11, color: "#6C757D" }}>Base model prediction</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: p.prediction === 1 ? "#993C1D" : "#3B6D11" }}>
                    {(p.base_prob * 100).toFixed(0)}% {p.prediction === 1 ? "Positive" : "Negative"}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "#6C757D" }}>MPC confidence</div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{p.mpc?.toFixed(2)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "#6C757D" }}>Action recommendation</div>
                  <Badge text={rec.text} bg={rec.bg} color={rec.color} />
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span style={{ color: "#495057" }}>Profile: {profile}</span>
                <span style={{ color: "#185FA5", fontWeight: 600 }}>View full dashboard →</span>
              </div>
            </Card>
          </div>
        )
      })}
    </div>
  )
}
