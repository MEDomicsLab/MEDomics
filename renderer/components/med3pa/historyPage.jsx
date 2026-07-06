import React, { useEffect, useState } from "react"
import { listSessions } from "./med3paDB"
import { PageHeader, Card } from "./med3paUI"

/**
 * @description Session History page: log of saved MED3pa analysis sessions.
 *
 * @param {Function} openSession callback(sessionName) → opens the Analysis Workspace on that session
 * @param {Number} refreshKey bumped by the container to reload
 */
export default function HistoryPage({ openSession, refreshKey = 0 }) {
  const [sessions, setSessions] = useState([])

  useEffect(() => {
    listSessions()
      .then(setSessions)
      .catch((e) => console.error("med3pa listSessions", e))
  }, [refreshKey])

  return (
    <div style={{ fontFamily: "sans-serif", padding: "1rem" }}>
      <PageHeader title="Session history" subtitle="Log of previous analysis executions" />
      <Card>
        {sessions.length === 0 ? (
          <div style={{ fontSize: 12, color: "#6C757D" }}>No sessions saved yet.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#6C757D", fontSize: 11 }}>
                <th style={{ padding: 6 }}>Date</th>
                <th style={{ padding: 6 }}>Session</th>
                <th style={{ padding: 6 }}>Base model</th>
                <th style={{ padding: 6 }}>Dataset</th>
                <th style={{ padding: 6 }}>Target</th>
                <th style={{ padding: 6 }}>Patients</th>
                <th style={{ padding: 6 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.name} style={{ borderTop: "1px solid #E9ECEF", cursor: "pointer" }} onClick={() => openSession(s.name)}>
                  <td style={{ padding: 6 }}>{s.created_at ? new Date(s.created_at).toLocaleString() : "—"}</td>
                  <td style={{ padding: 6, fontWeight: 600, color: "#185FA5" }}>{s.name}</td>
                  <td style={{ padding: 6 }}>{s.base_model?.name ?? "—"}</td>
                  <td style={{ padding: 6 }}>{s.dataset?.name ?? "—"}</td>
                  <td style={{ padding: 6 }}>{s.target_column ?? "—"}</td>
                  <td style={{ padding: 6 }}>{s.dataset_size?.toLocaleString() ?? "—"}</td>
                  <td style={{ padding: 6, fontWeight: 600, color: s.status === "completed" ? "#3B6D11" : "#993C1D" }}>{s.status ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
