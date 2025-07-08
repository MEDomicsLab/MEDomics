import React, { useEffect, useRef } from "react"
import Drawflow from "drawflow"
import "drawflow/dist/drawflow.min.css"

const ServerClientFlow = ({ connectedClients, isAggregating, runningClients, finished, currentRound }) => {
  const drawflowRef = useRef(null)
  const editorRef = useRef(null)
  const nodeIdsRef = useRef({ serverId: null })

  // Inject CSS for spinner animation (once)
  useEffect(() => {
    const style = document.createElement("style")
    style.innerHTML = `
      @keyframes drawflow-spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      .drawflow-spinner {
        border: 2px solid #198754;
        border-top: 2px solid transparent;
        border-radius: 50%;
        width: 12px;
        height: 12px;
        animation: drawflow-spin 0.6s linear infinite;
        margin-right: 8px;
      }
    `
    document.head.appendChild(style)
    return () => document.head.removeChild(style)
  }, [])

  // Initialize editor once
  useEffect(() => {
    const editor = new Drawflow(drawflowRef.current)
    editor.reroute = true
    editor.start()
    editorRef.current = editor
    return () => editor.clear()
  }, [])

  // Helper: Create server node
  const createServerNode = (editor) => {
    const iconHtml = isAggregating && !finished ? `<div class="drawflow-spinner"></div>` : `<span style="margin-right: 8px;">🖥️</span>`

    const serverBgColor = isAggregating && !finished ? "#d1e7dd" : "#f8f9fa"

    // Calculate server Y as middle of clients
    const totalClients = connectedClients.length
    const serverY = totalClients > 0 ? 100 + ((totalClients - 1) * 120) / 2 : 200 // Fallback default Y if no clients

    const serverId = editor.addNode(
      "Server",
      1,
      0,
      500, // X: Right side
      serverY,
      "server",
      {},
      `
      <div style="
        display: flex;
        align-items: center;
        padding: 10px 12px;
        border-radius: 8px;
        background-color: ${serverBgColor};
        box-shadow: 0 2px 6px rgba(0,0,0,0.1);
        font-family: Arial, sans-serif;
        color: #212529;
        min-width: 150px;
      ">
        ${iconHtml}
        <span>Run Server</span>
      </div>
    `
    )

    nodeIdsRef.current.serverId = serverId
  }

  // Helper: Create client nodes
  const createClientNodes = (editor) => {
    connectedClients.forEach((client, index) => {
      const clientId = String(client.id)

      const x = 100 // All clients left-aligned horizontally
      const y = 100 + index * 120 // Vertical spacing between clients

      const iconHtml = !finished && !isAggregating ? `<div class="drawflow-spinner"></div>` : `<span style="margin-right: 8px;">💻</span>`

      const clientBgColor = !finished && !isAggregating ? "#d1e7dd" : "#f8f9fa"

      const clientNodeId = editor.addNode(
        `Client_${clientId}`,
        0,
        1,
        x,
        y,
        "client",
        {},
        `
        <div style="
          display: flex;
          align-items: center;
          padding: 10px 12px;
          border-radius: 8px;
          background-color: ${clientBgColor};
          box-shadow: 0 2px 6px rgba(0,0,0,0.1);
          font-family: Arial, sans-serif;
          color: #212529;
          min-width: 120px;
        ">
          ${iconHtml}
          <span>${client.hostname || `Client ${clientId.slice(0, 4)}`}</span>
        </div>
      `
      )

      nodeIdsRef.current[clientId] = clientNodeId

      // Connect client → server
      editor.addConnection(clientNodeId, nodeIdsRef.current.serverId, "output_1", "input_1")
    })
  }

  // Full redraw on connectedClients or isAggregating change
  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return

    editor.clear()
    nodeIdsRef.current = { serverId: null }

    createServerNode(editor)
    createClientNodes(editor)

    console.log("==================== running clients", runningClients)
  }, [connectedClients, isAggregating, runningClients])

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: "8px", background: "#fafafa", marginTop: "20px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "10px 15px",
          borderBottom: "1px solid #ccc",
          backgroundColor: "#fff",
          borderTopLeftRadius: "8px",
          borderTopRightRadius: "8px",
          fontFamily: "Arial, sans-serif"
        }}
      >
        {/* Left: Current round and log */}
        <div>
          <div style={{ fontWeight: "bold", fontSize: "16px" }}>Round: {currentRound}</div>
          <div style={{ fontSize: "14px", color: "#6c757d" }}>{isAggregating ? "🔄 Server is aggregating updates" : "🚀 Server sent model → Clients training → Clients sending updates"}</div>
        </div>

        {/* Right: Legend */}
        <div style={{ textAlign: "right", fontSize: "12px" }}>
          {/* <div style={{ fontWeight: "bold", marginBottom: "4px" }}>Legend:</div> */}
          <div className="badge text-dark border me-1">
            <span
              style={{
                display: "inline-block",
                width: "12px",
                height: "12px",
                marginRight: "4px",
                border: "2px solid #198754",
                borderTop: "2px solid transparent",
                borderRadius: "50%",
                animation: "drawflow-spin 0.6s linear infinite"
              }}
            ></span>{" "}
            Running
          </div>
          <div className="badge text-dark border me-1">
            <span
              style={{
                display: "inline-block",
                width: "12px",
                height: "12px",
                marginRight: "4px",
                backgroundColor: "#ccc",
                borderRadius: "50%"
              }}
            ></span>{" "}
            Rest
          </div>
        </div>
      </div>
      <div
        ref={drawflowRef}
        id="drawflow"
        style={{
          width: "100%",
          height: "500px"
        }}
      ></div>
    </div>
  )
}

export default ServerClientFlow
