import React, { useEffect, useState } from "react"
import { getOverviewStats, getRecentActivity } from "./med3paDB"
import { PageHeader, Card, Kpi } from "./med3paUI"

/**
 * @description Overview dashboard: live KPIs (sessions, deployments, patients scanned)
 * and a recent-activity feed, all read from the MED3pa MongoDB collections.
 *
 * @param {Number} refreshKey bumped by the container to reload the stats
 */
export default function OverviewPage({ refreshKey = 0 }) {
  const [stats, setStats] = useState({ sessions: 0, deployments: 0, patients: 0 })
  const [activity, setActivity] = useState([])

  useEffect(() => {
    getOverviewStats()
      .then(setStats)
      .catch((e) => console.error("med3pa getOverviewStats", e))
    getRecentActivity()
      .then(setActivity)
      .catch((e) => console.error("med3pa getRecentActivity", e))
  }, [refreshKey])

  return (
    <div style={{ fontFamily: "sans-serif", padding: "1rem" }}>
      <PageHeader title="Workspace overview" subtitle="System status and recent activity" />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
        <Kpi title="Active model deployments" value={stats.deployments} sub={stats.deployments > 0 ? "Ready for inference" : "None deployed yet"} subColor={stats.deployments > 0 ? "#0F6E56" : "#6C757D"} />
        <Kpi title="Total patients scanned" value={stats.patients.toLocaleString()} sub="Across all deployments" />
        <Kpi title="Analysis sessions" value={stats.sessions} sub="Saved MED3pa experiments" />
      </div>

      <Card title="Recent activity">
        {activity.length === 0 ? (
          <div style={{ fontSize: 12, color: "#6C757D" }}>No activity yet — start by running an analysis from the Configuration page.</div>
        ) : (
          activity.map((a, i) => (
            <div key={i} style={{ padding: "8px 0", borderTop: i > 0 ? "1px solid #F1F3F5" : "none" }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{a.title}</div>
              <div style={{ fontSize: 12, color: "#495057" }}>{a.description}</div>
              <div style={{ fontSize: 11, color: "#ADB5BD" }}>{a.date ? new Date(a.date).toLocaleString() : ""}</div>
            </div>
          ))
        )}
      </Card>
    </div>
  )
}
