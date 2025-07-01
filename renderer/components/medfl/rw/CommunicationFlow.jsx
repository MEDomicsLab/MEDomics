import React, { useEffect, useRef } from "react"
import Drawflow from "drawflow"
import "drawflow/dist/drawflow.min.css"

const ServerClientFlow = ({ connectedClients, isAggregating, runningClients, finished }) => {
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
          <span>${client.name || `Client ${clientId.slice(0, 4)}`}</span>
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
    <div
      ref={drawflowRef}
      id="drawflow"
      style={{
        width: "100%",
        height: "500px",
        border: "1px solid #ddd",
        borderRadius: "8px",
        background: "#fafafa"
      }}
    ></div>
  )
}

export default ServerClientFlow
