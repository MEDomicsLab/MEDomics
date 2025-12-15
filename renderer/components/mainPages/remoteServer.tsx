import React from "react"
import { useTunnel } from "../tunnel/TunnelContext"
import { ipcRenderer } from "electron"

const StatusPill = ({ label, value }: { label: string; value: string }) => {
  const color = value === "running" || value === "forwarding" ? "#22c55e" : value === "error" ? "#ef4444" : value === "timeout" ? "#f59e0b" : "#64748b"
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
      <span style={{ fontWeight: 600, minWidth: 90 }}>{label}:</span>
      <span style={{ background: color, color: "white", borderRadius: 8, padding: "2px 8px", fontSize: 12, textTransform: "capitalize" }}>{value || "unknown"}</span>
    </div>
  )
}

export default function RemoteServerPage() {
  const tunnel = useTunnel() as any
  const {
    host,
    username,
    serverStartedRemotely,
    expressStatus,
    goStatus,
    mongoStatus,
    localExpressPort,
    remoteExpressPort,
    localGoPort,
    remoteGoPort,
    localDBPort,
    remoteDBPort,
    expressLogPath,
  } = tunnel

  const [log, setLog] = React.useState<string>("")
  const [streaming, setStreaming] = React.useState<boolean>(false)
  const logRef = React.useRef<HTMLDivElement>(null)

  const appendLog = React.useCallback((chunk: string) => {
    setLog((prev) => {
      const next = prev + chunk
      // Keep last ~5000 lines to avoid memory growth
      const lines = next.split(/\r?\n/)
      const max = 5000
      return lines.length > max ? lines.slice(lines.length - max).join("\n") : next
    })
  }, [])

  React.useEffect(() => {
    const onData = (_e: any, data: string) => appendLog(data)
    const onState = (_e: any, s: { streaming?: boolean }) => setStreaming(!!s?.streaming)
    ipcRenderer.on('remoteServerLog:data', onData)
    ipcRenderer.on('remoteServerLog:state', onState)
    return () => {
      ipcRenderer.removeListener('remoteServerLog:data', onData)
      ipcRenderer.removeListener('remoteServerLog:state', onState)
    }
  }, [appendLog])

  React.useEffect(() => {
    // Auto-start log streaming when server started remotely and we have a path
    if (serverStartedRemotely && expressLogPath) {
      ipcRenderer.invoke('startRemoteServerLogStream')
    }
    return () => {
      ipcRenderer.invoke('stopRemoteServerLogStream')
    }
  }, [serverStartedRemotely, expressLogPath])

  React.useEffect(() => {
    // autoscroll to bottom on new data
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [log])

  return (
    <div style={{ padding: 12, fontFamily: "Inter, Segoe UI, Arial, sans-serif", fontSize: 13 }}>
      <div style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 18 }}>🖥️</span>
        <h3 style={{ margin: 0 }}>Remote Server</h3>
      </div>

      <div style={{ marginBottom: 12, color: "#334155" }}>
        <div><b>Host:</b> {host || "-"}</div>
        <div><b>User:</b> {username || "-"}</div>
        <div><b>Started Via App:</b> {serverStartedRemotely ? "Yes" : "No"}</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <h4 style={{ margin: "4px 0 8px", fontSize: 14 }}>Statuses</h4>
          <StatusPill label="Express" value={expressStatus || "unknown"} />
          <StatusPill label="GO" value={goStatus || "unknown"} />
          <StatusPill label="Mongo" value={mongoStatus || "unknown"} />
        </div>
        <div>
          <h4 style={{ margin: "4px 0 8px", fontSize: 14 }}>Ports</h4>
          <div style={{ marginBottom: 6 }}>
            <b>Express:</b> {localExpressPort ?? "-"} → {remoteExpressPort ?? "-"}
          </div>
          <div style={{ marginBottom: 6 }}>
            <b>GO:</b> {localGoPort ?? "-"} → {remoteGoPort ?? "-"}
          </div>
          <div style={{ marginBottom: 6 }}>
            <b>Mongo:</b> {localDBPort ?? "-"} → {remoteDBPort ?? "-"}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        <h4 style={{ margin: 0, fontSize: 14 }}>Live Output</h4>
        <span style={{ fontSize: 12, color: '#64748b' }}>{expressLogPath ? `(${expressLogPath})` : ''}</span>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: streaming ? '#22c55e' : '#64748b' }}>{streaming ? 'streaming' : 'idle'}</span>
        <button onClick={() => setLog("")} style={{ border: '1px solid #cbd5e1', background: '#f8fafc', borderRadius: 6, padding: '2px 8px', cursor: 'pointer' }}>Clear</button>
      </div>
      <div ref={logRef} style={{ marginTop: 8, height: 260, overflow: 'auto', background: '#0b1020', color: '#e2e8f0', borderRadius: 8, padding: 10, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontSize: 12, lineHeight: 1.45 }}>
        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{log || 'No output yet.'}</pre>
      </div>
    </div>
  )
}
