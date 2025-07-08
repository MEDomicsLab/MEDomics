import React, { useState, useEffect, useContext } from "react"
import ModulePage from "./moduleBasics/modulePage"
import dynamic from "next/dynamic"
import { WorkspaceContext } from "../workspace/workspaceContext"
import { requestBackend } from "../../utilities/requests"
import { toast } from "react-toastify"
import { IoReload } from "react-icons/io5"
import { IoClose } from "react-icons/io5"

import ClientsTables from "../medfl/rw/ClientsTables"
import ClientCardinfo from "../medfl/rw/ClientCardinfo"

import { FaAngleRight } from "react-icons/fa"

// SSR‐safe import
const CytoscapeComponent = dynamic(() => import("react-cytoscapejs").then((m) => m.default), { ssr: false })

export default function MEDflClientsPage({ pageId, configPath = "" }) {
  const SERVER_TAG = "tag:server"
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [hovered, setHovered] = useState(null)
  const { port } = useContext(WorkspaceContext)

  useEffect(() => {
    const fetchDevices = () => {
      requestBackend(
        port,
        "/medfl/devices/" + pageId,
        {},
        (json) => {
          if (json.error) toast.error("Error: " + json.error)
          else {
            setDevices(json.devices || [])
            setLoading(false)
          }
        },
        (err) => {
          console.error(err)
          toast.error("Fetch failed")
          setLoading(false)
        }
      )
    }

    // Fetch immediately
    fetchDevices()

    // Set interval every 5 seconds
    const intervalId = setInterval(fetchDevices, 60000)

    // Cleanup on unmount
    return () => clearInterval(intervalId)
  }, [pageId, port, loading])

  // Build nodes + edges
  const serverDevice = devices.find((d) => (d.tags || []).includes(SERVER_TAG))
  const nodes = devices.map((d) => {
    const lastSeen = new Date(d.lastSeen)
    const online = Date.now() - lastSeen.getTime() < 60 * 1000
    const expired = new Date(d.expires) < new Date()

    const isServer = (d.tags || []).includes(SERVER_TAG)

    return {
      data: { id: d.id, label: d.hostname, device: d },
      classes: [isServer ? "server" : "", online ? "online" : "offline", d.updateAvailable ? "needs-update" : "", d.isExternal ? "external" : "internal", expired ? "expired" : ""]
        .filter(Boolean)
        .join(" ")
    }
  })

  // If we have a server, create an edge from it to every other node
  const edges = serverDevice
    ? devices
        .filter((d) => d.id !== serverDevice.id)
        .map((d) => ({
          data: {
            id: `edge-${serverDevice.id}-${d.id}`,
            source: serverDevice.id,
            target: d.id
          }
        }))
    : []

  const elements = [...nodes, ...edges]

  const stylesheet = [
    // Base node
    {
      selector: "node",
      style: {
        shape: "round-rectangle",
        width: "label",
        height: 16,
        padding: "8px 12px",
        "background-color": "#f8f9fa",
        "border-width": 0.5,
        "border-color": "#dee2e6",
        label: "data(label)",
        "text-valign": "center",
        "text-halign": "center",
        "font-family": "Segoe UI, Roboto, sans-serif",
        "font-size": 10,
        "font-weight": "500",
        color: "#2d3436",
        "text-transform": "uppercase",
        "text-max-width": "100px",
        "text-wrap": "wrap"
      }
    },

    // Server styling
    {
      selector: "node.server",
      style: {
        shape: "ellipse",

        "border-color": "#2c6ca8",
        "border-width": 1,
        width: "label",
        height: 32,
        "font-size": 12,

        "background-opacity": 0.5
      }
    },

    // Status indicators
    {
      selector: "node.online",
      style: {
        "background-color": "#27ae60",
        "border-color": "#219653",
        "background-gradient-stop-colors": "#27ae60 #1e8449"
      }
    },
    {
      selector: "node.offline",
      style: {
        "background-color": "#e74c3c",
        "border-color": "#e74c3c",
        "background-gradient-stop-colors": "#e74c3c #d62c1a",
        "background-opacity": 0.5
      }
    },

    // Update available
    {
      selector: "node.needs-update",
      style: {
        "border-style": "dashed",
        "border-color": "#e74c3c",
        "border-width": 1,
        "border-dash-pattern": [4, 2]
      }
    },

    // External nodes
    {
      selector: "node.external",
      style: {
        "background-image": "https://cdn-icons-png.flaticon.com/512/54/54702.png",
        "background-width": "60%",
        "background-height": "60%",
        "background-opacity": 0.4
      }
    },

    // Expired nodes
    {
      selector: "node.expired",
      style: {
        opacity: 0.4,
        "border-color": "#95a5a6"
      }
    },

    // Edges
    {
      selector: "edge",
      style: {
        "curve-style": "bezier",
        "line-color": "#bdc3c7",
        width: 1.5,
        "target-arrow-shape": "triangle",
        "target-arrow-color": "#7f8c8d",
        "arrow-scale": 0.8,
        "line-style": "solid"
      }
    },

    // Hover effects
    {
      selector: "node:active",
      style: {}
    },
    {
      selector: "edge:active",
      style: {
        "line-color": "#3498db",
        "target-arrow-color": "#3498db",
        width: 2
      }
    }
  ]

  const handleCy = (cy) => {
    cy.on("tap", "node", (e) => setSelected(e.target.data("device")))
    cy.on("mouseover", "node", (e) => {
      const { x, y } = e.renderedPosition
      setHovered({ device: e.target.data("device"), x, y })
    })
    cy.on("mouseout", "node", () => setHovered(null))
  }

  const LegendItem = ({ color, border, label, radius = 4 }) => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        marginRight: 16
      }}
    >
      <div
        style={{
          width: 16,
          height: 16,
          backgroundColor: color,
          border,
          marginRight: 4,
          borderRadius: radius
        }}
      />
      <span style={{ fontSize: 12 }}>{label}</span>
    </div>
  )

  return (
    <ModulePage pageId={pageId} configPath={configPath}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, paddingRight: 16 }}>
        <div style={{ fontSize: 34, fontWeight: 600, marginBottom: 16, marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>Manage Network Clients</div>
        <button className="btn btn-primary">
          Run experiment <FaAngleRight size={18} />
        </button>
      </div>
      <div style={{ marginTop: 16, marginBottom: 16, display: "flex", flexWrap: "wrap" }}>
        <LegendItem color="#21965350" border="1px solid #219653" label="Server" radius={10} />
        <LegendItem color="#27ae60" border="1px solid #219653" label="Online client" />
        <LegendItem color="#e74c3c" border="1px dashed #e74c3c" label="Offline / Needs update" />
        <LegendItem color="#f8f9fa" border="0.5px solid #dee2e6" label="Internal client" />
        <LegendItem color="transparent" border="0.5px solid #95a5a6" label="Expired" />
        <LegendItem color="transparent" border="0.5px dashed #e74c3c" label="External (with icon)" />
      </div>
      {loading ? (
        <div style={{ display: "flex", gap: 16 }}>
          <div style={{ width: 700, height: 500, boxShadow: "0 4px 6px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.1)", border: "1px solid #e9ecef", borderRadius: 8 }}></div>
          {selected && (
            <div
              style={{
                width: 460,
                borderRadius: 8,
                boxShadow: "0 4px 6px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.1)",
                border: "1px solid #e9ecef"
              }}
            ></div>
          )}
        </div>
      ) : devices.length === 0 ? (
        <p>No devices found.</p>
      ) : (
        <div>
          <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
            <div
              className=""
              style={{ position: "relative", width: 700, height: 520, boxShadow: "0 4px 6px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.1)", border: "1px solid #e9ecef", borderRadius: 8 }}
            >
              <button
                className="btn"
                onClick={() => {
                  setDevices([])
                  setLoading(true)
                }}
              >
                {" "}
                Reload <IoReload size={15} />
              </button>

              <CytoscapeComponent
                elements={elements}
                stylesheet={stylesheet}
                style={{ width: "100%", height: "90%" }}
                layout={{
                  name: "concentric",
                  concentric: (n) => (n.hasClass("server") ? 100 : 10),
                  levelWidth: () => 1,
                  animate: false
                }}
                cy={handleCy}
              />

              {/* Tooltip */}
              {hovered && (
                <div
                  style={{
                    position: "absolute",
                    left: hovered.x + 10,
                    top: hovered.y - 40,
                    background: "rgba(0,0,0,0.75)",
                    color: "#fff",
                    padding: "4px 8px",
                    borderRadius: 4,
                    pointerEvents: "none",
                    whiteSpace: "pre-wrap",
                    fontSize: 12
                  }}
                >
                  {`${hovered.device.hostname}
OS: ${hovered.device.os}
Last seen: ${new Date(hovered.device.lastSeen).toLocaleTimeString()}`}
                </div>
              )}
            </div>

            {/* Details pane */}
            {selected && <ClientCardinfo device={selected} onClose={() => setSelected(null)} />}
          </div>

          <ClientsTables devices={devices} />
        </div>
      )}
    </ModulePage>
  )
}
