"use client"
import React, { useEffect, useState, useContext, useMemo } from "react"
import { toast } from "react-toastify"
import { IoReload, IoLogOut, IoLogIn } from "react-icons/io5"
import { WorkspaceContext } from "../../workspace/workspaceContext"
import { requestBackend } from "../../../utilities/requests"

const ONLINE_WINDOW_MS = 60 * 1000 // 60s

function Dot({ color = "#9ca3af", title = "" }) {
  return (
    <span
      title={title}
      style={{
        display: "inline-block",
        width: 10,
        height: 10,
        borderRadius: "999px",
        backgroundColor: color,
        boxShadow: "0 0 0 1px rgba(0,0,0,0.08)",
        marginRight: 8
      }}
    />
  )
}

function formatAgo(isoDate) {
  if (!isoDate) return "—"
  const ms = Date.now() - new Date(isoDate).getTime()
  if (ms < 0) return "just now"
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

function getStatus(device) {
  const now = Date.now()
  const lastSeen = device?.lastSeen ? new Date(device.lastSeen).getTime() : 0
  const expired = device?.expires ? new Date(device.expires) < new Date() : false
  const online = lastSeen && now - lastSeen < ONLINE_WINDOW_MS
  const needsUpdate = !!device?.updateAvailable

  // Primary status + color
  if (expired) return { label: "expired", color: "#9ca3af" } // gray
  if (online) return { label: "online", color: "#22c55e" } // green
  if (needsUpdate) return { label: "needs update", color: "#f59e0b" } // amber
  return { label: "offline", color: "#ef4444" } // red
}

export default function SideBarClients({
  refreshMs = 60000, // 60s
  serverTag = "tag:server"
}) {
  const { port } = useContext(WorkspaceContext)

  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)
  const [isDeconnected, setIsDeconnected] = useState(false)
  const [recenttailnets, setRecenttailnets] = useState([{ name: "Tailnet A" }]) // Mocked for now, should come from backend or localStorage

  const fetchDevices = () => {
    requestBackend(
      port,
      `/medfl/devices/ex`,
      {},
      (json) => {
        if (json?.error) {
          toast.error("Error: " + json.error)
        } else {
          setDevices(Array.isArray(json?.devices) ? json.devices : [])
        }
        setLoading(false)
      },
      (err) => {
        console.error(err)
        toast.error("Failed to fetch devices")
        setLoading(false)
      }
    )
  }

  useEffect(() => {
    setLoading(true)
    fetchDevices()
    const id = setInterval(fetchDevices, refreshMs)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [port, refreshMs])

  const sorted = useMemo(() => {
    // Sort: server first, then online, then alphabetically
    const isServer = (d) => (d.tags || []).includes(serverTag)
    const isOnline = (d) => Date.now() - new Date(d.lastSeen || 0).getTime() < ONLINE_WINDOW_MS
    return [...devices].sort((a, b) => {
      if (isServer(a) && !isServer(b)) return -1
      if (!isServer(a) && isServer(b)) return 1
      if (isOnline(a) && !isOnline(b)) return -1
      if (!isOnline(a) && isOnline(b)) return 1
      return (a.hostname || "").localeCompare(b.hostname || "")
    })
  }, [devices, serverTag])

  if (isDeconnected) {
    return (
      <div
        style={{
          border: "1px solid #e9ecef",
          borderRadius: 10,
          boxShadow: "2px 2px 3px -1px rgb(0 0 0 / 20%), 0 1px 1px 0 rgb(0 0 0 / 14%), 0px 0px 3px 2px rgb(0 0 0 / 12%)",
          background: "#0000000d",
          padding: 16,
          fontSize: 14,
          color: "#6b7280"
        }}
      >
        <div>
          <strong style={{ fontSize: 16 }}> Connect to a Tailnet</strong>
          <hr />
        </div>
        You have been disconnected from Tailnet. Please log in again.
        <div className="d-flex w-100 justify-content-between align-items-center mb-2 mt-3">
          <input placeholder="Auth key" style={{ borderRadius: " 8px 0 0 8px" }} className="w-100  p-2 border-0 "></input>
          <button
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "9px",
              border: "1px solid #e5e7eb",
              borderRadius: "0 8px 8px 0",
              cursor: "pointer",
              boxShadow: "inset 0 0 10px rgba(0,0,0,0.1)",
              background: "#00d17aff"
            }}
            onClick={() => {
              setIsDeconnected(false)
            }}
          >
            <IoLogIn />
          </button>
        </div>
        <hr />
        {recenttailnets.length > 0 ? (
          <>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>Or reconnect to a recent Tailnet:</div>
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {recenttailnets.map((t) => (
                <li key={t.name} className="d-flex w-100 justify-content-between align-items-center mb-2">
                  <span className="w-100" style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 220 }}>
                    {" "}
                    {t.name}
                  </span>
                  <button
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "6px",
                      border: "1px solid #e5e7eb",
                      borderRadius: 8,
                      cursor: "pointer",
                      boxShadow: "inset 0 0 10px rgba(0,0,0,0.1)"
                    }}
                    onClick={() => {
                      setIsDeconnected(false)
                    }}
                  >
                    <IoLogIn />
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <div style={{ fontSize: 12, color: "#6b7280" }}>No recent Tailnets found.</div>
        )}
      </div>
    )
  }

  return (
    <div
      style={{
        border: "1px solid #e9ecef",
        borderRadius: 10,
        boxShadow: "2px 2px 3px -1px rgb(0 0 0 / 20%), 0 1px 1px 0 rgb(0 0 0 / 14%), 0px 0px 3px 2px rgb(0 0 0 / 12%)",
        background: "#0000000d"
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid #bcbcbdff"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <strong style={{ fontSize: 16 }}>Tailnet</strong>
          <span style={{ fontSize: 12, color: "#6b7280" }}>{loading ? "Loading…" : `${sorted.length} device${sorted.length === 1 ? "" : "s"}`}</span>
        </div>
        <button
          className="btn"
          onClick={() => {
            setLoading(true)
            fetchDevices()
          }}
          title="Reload"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            cursor: "pointer",
            boxShadow: "inset 0 0 10px rgba(0,0,0,0.1)"
          }}
        >
          <IoReload size={16} />
        </button>
        <button
          className="btn"
          onClick={() => {
            setIsDeconnected(true)
          }}
          title="Disconnect"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            cursor: "pointer",
            boxShadow: "inset 0 0 10px rgba(0,0,0,0.1)"
          }}
        >
          <IoLogOut />
        </button>
      </div>

      {/* Legend */}
      <div
        style={{
          padding: "8px 16px",
          borderBottom: "1px dashed #bcbcbdff",
          display: "flex",
          gap: 5,
          flexWrap: "wrap",
          fontSize: 12,
          color: "#6b7280"
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center" }}>
          <Dot color="#22c55e" /> Online
        </span>
        <span style={{ display: "inline-flex", alignItems: "center" }}>
          <Dot color="#ef4444" /> Offline
        </span>
        <span style={{ display: "inline-flex", alignItems: "center" }}>
          <Dot color="#f59e0b" /> Needs update
        </span>
        <span style={{ display: "inline-flex", alignItems: "center" }}>
          <Dot color="#9ca3af" /> Expired
        </span>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ padding: 16, fontSize: 14, color: "#6b7280" }}>Fetching devices…</div>
      ) : sorted.length === 0 ? (
        <div style={{ padding: 16, fontSize: 14, color: "#6b7280" }}>No devices found.</div>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, maxHeight: 200, overflowY: "auto" }}>
          {sorted.map((d) => {
            const status = getStatus(d)
            const isServer = (d.tags || []).includes(serverTag)
            return (
              <li
                key={d.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 16px",
                  borderBottom: "1px solid #ddddddff"
                }}
              >
                <div style={{ display: "flex", alignItems: "center" }}>
                  <Dot color={status.color} title={status.label} />
                  <div style={{}}>
                    <span style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 120 }}>
                      {d.hostname || d.name || d.id}
                      {isServer ? (
                        <span
                          style={{
                            fontSize: 11,
                            marginLeft: 8,
                            padding: "2px 6px",
                            borderRadius: 999,
                            background: "#eff6ff",
                            color: "#1d4ed8",
                            border: "1px solid #bfdbfe",
                            fontWeight: 600
                          }}
                        >
                          server
                        </span>
                      ) : null}
                    </span>
                    {/* <span style={{ fontSize: 12, color: "#6b7280" }}>
                      {d.os || "unknown OS"} · Last seen {formatAgo(d.lastSeen)}
                      {d.addresses?.length ? ` · ${d.addresses[0]}` : ""}
                    </span> */}
                  </div>
                </div>

                {/* <div style={{ textAlign: "right", minWidth: 160 }}>
                  <div style={{ fontSize: 12, color: "#374151", textTransform: "capitalize" }}>{status.label}</div>
                  <div style={{ fontSize: 11, color: "#6b7280" }}>
                    {d.updateAvailable ? "Update available" : ""}
                    {d.expires ? ` ${d.updateAvailable ? "· " : ""}Expires: ${new Date(d.expires).toLocaleDateString()}` : ""}
                  </div>
                </div> */}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
