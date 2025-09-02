// ClientLogs.tsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react"
import { Tabs, Tab, Button, Spinner, Form } from "react-bootstrap"
import { requestBackend } from "../../../utilities/requests"
import { FaFileAlt } from "react-icons/fa"

function stripAnsi(s) {
  return s.replace(/\u001b\[[0-9;]*m/g, "")
}

export default function ClientLogs({ clients, pageId, port }) {
  const [activeKey, setActiveKey] = useState(() => clients[0]?.id ?? "")
  const [linesByClient, setLinesByClient] = useState(() => Object.fromEntries(clients.map((c) => [c.id, c.lines ?? 200])))
  const [stateByClient, setStateByClient] = useState({})

  // Track which clients we've auto-loaded already (prevents duplicates in Strict Mode)
  const loadedOnceRef = useRef(new Set())

  const setClientState = useCallback((id, patch) => {
    setStateByClient((prev) => ({
      ...prev,
      [id]: { loading: false, ...(prev[id] ?? {}), ...patch }
    }))
  }, [])

  const getLogs = useCallback(
    (clientId, opts) => {
      const current = stateByClient[clientId]
      if (current?.loading) return // guard: already fetching

      const lines = opts?.lines ?? linesByClient[clientId] ?? 200
      setClientState(clientId, { loading: true, error: undefined })

      requestBackend(
        port,
        `/medfl/rw/ws/logs/${pageId}`,
        { id: clientId, lines },
        (json) => {
          try {
            const raw = json
            const parsed = typeof raw === "string" ? JSON.parse(raw) : raw
            console.log("Logs for", clientId, parsed)
            const cleanText = stripAnsi(parsed?.text ?? "")
            setClientState(clientId, {
              loading: false,
              error: parsed?.error,
              text: cleanText,
              path: parsed?.path,
              sizeBytes: parsed?.size_bytes,
              lines: parsed?.lines,
              lastLoadedAt: new Date().toLocaleString()
            })
          } catch (e) {
            setClientState(clientId, {
              loading: false,
              error: `Parse error: ${e?.message || e}`
            })
          }
        },
        (err) => {
          setClientState(clientId, {
            loading: false,
            error: (err && (err.message || String(err))) || "Request failed"
          })
        }
      )
    },
    // IMPORTANT: do NOT depend on stateByClient here (would recreate getLogs each time)
    [linesByClient, pageId, port, setClientState]
  )

  // Auto-load only when the active tab changes, and only once per tab
  useEffect(() => {
    if (!activeKey) return
    if (loadedOnceRef.current.has(activeKey)) return
    loadedOnceRef.current.add(activeKey)
    getLogs(activeKey)
  }, [activeKey, getLogs])

  const tabs = useMemo(
    () =>
      clients.map((c) => {
        const st = stateByClient[c.id]
        return (
          <Tab key={c.id} eventKey={c.id} title={c.label ?? c.id}>
            <div className="d-flex align-items-center gap-2 my-3">
              <Form.Label className="mb-0">Tail lines</Form.Label>
              <Form.Control
                style={{ width: 110 }}
                size="sm"
                type="number"
                min={50}
                step={50}
                value={linesByClient[c.id] ?? 200}
                onChange={(e) => {
                  const v = Math.max(1, Number(e.target.value) || 200)
                  setLinesByClient((prev) => ({ ...prev, [c.id]: v }))
                }}
              />
              <Button variant="primary" size="sm" onClick={() => getLogs(c.id, { lines: linesByClient[c.id] })} disabled={!!st?.loading}>
                {st?.loading ? (
                  <>
                    <Spinner animation="border" size="sm" className="me-2" />
                    Loading…
                  </>
                ) : (
                  "Refresh"
                )}
              </Button>
              {st?.lastLoadedAt && <small className="text-muted ms-2">Last loaded: {st.lastLoadedAt}</small>}
            </div>

            {st?.error && <div className="alert alert-danger py-2">{st.error}</div>}

            <div className="mb-2 small text-muted">
              {st?.path ? <span>Path: {st.path} • </span> : null}
              {typeof st?.sizeBytes === "number" ? <span>Size: {st.sizeBytes} B • </span> : null}
              {typeof st?.lines === "number" ? <span>Showing last {st.lines} lines</span> : null}
            </div>

            <pre
              style={{
                background: "#0b0d12",
                color: "#e6e6e6",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
                fontSize: 12.5,
                padding: "12px 14px",
                borderRadius: 8,
                maxHeight: 520,
                overflow: "auto",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word"
              }}
            >
              {st?.text || "— no logs —"}
            </pre>
          </Tab>
        )
      }),
    [clients, getLogs, linesByClient, stateByClient]
  )

  if (!clients.length) {
    return <div className="text-muted">No clients registered.</div>
  }

  return (
    <>
      <div className="h5 mb-2 rounded p-2 s border d-flex align-items-center gap-2">
        <FaFileAlt /> <>Clients logs</>
      </div>
      <Tabs id="client-logs-tabs" activeKey={activeKey} onSelect={(k) => k && setActiveKey(k)} className="mb-3" mountOnEnter unmountOnExit={false}>
        {tabs}
      </Tabs>
    </>
  )
}
