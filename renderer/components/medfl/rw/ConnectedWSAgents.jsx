import React, { useEffect } from "react"
import { Button, ListGroup, Alert, Form } from "react-bootstrap"
import { FaLaptop } from "react-icons/fa"
import { FiRefreshCw } from "react-icons/fi"

/**
 * Props:
 *  - groupId: string
 *  - agents: Array<{ id: string, groupNodeId: string, os?: string }>
 *  - selectedMap: { [agentId]: boolean }  // selection for THIS group
 *  - setSelectedAgentsByGroup: fn(updater)
 *  - setMinAvailableClients: fn(number)
 *  - setCanRun: fn(boolean)
 *  - getWSAgents: fn()
 *  - renderOsIcon: fn(os) => JSX
 */
export default function ConnectedWSAgents({ groupId, agents = [], selectedMap = {}, setSelectedAgentsByGroup, setMinAvailableClients, setCanRun, getWSAgents, renderOsIcon = () => null }) {
  const allSelected = agents.length > 0 && agents.every((a) => selectedMap[a.id])
  const someSelected = agents.some((a) => selectedMap[a.id])

  const updateGroupSelection = (nextForGroup) => {
    setSelectedAgentsByGroup((prev) => ({
      ...prev,
      [groupId]: nextForGroup
    }))
  }

  const toggleAgent = (agentId) => {
    const next = { ...(selectedMap || {}), [agentId]: !selectedMap[agentId] }
    updateGroupSelection(next)
    const count = Object.values(next).filter(Boolean).length
    setMinAvailableClients(count)
  }

  const toggleSelectAll = () => {
    if (allSelected) {
      const cleared = {}
      agents.forEach((a) => (cleared[a.id] = false))
      updateGroupSelection(cleared)
      setMinAvailableClients(0)
    } else {
      const filled = {}
      agents.forEach((a) => (filled[a.id] = true))
      updateGroupSelection(filled)
      setMinAvailableClients(agents.length)
    }
  }

  useEffect(() => {
    const count = Object.values(selectedMap || {}).filter(Boolean).length
    setMinAvailableClients(count)
    setCanRun(agents.length > 0 && count > 0)
  }, [agents, selectedMap])

  return (
    <div
      className="d-flex flex-column gap-2 mt-3 p-3 rounded shadow-sm"
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: "6px",
        color: "#2c3e50"
      }}
    >
      {!someSelected && (
        <span className="alert-warning alert rounded" style={{ color: "red", fontWeight: 500, fontSize: "0.95em" }}>
          Select some Clients in <code>{groupId}</code>
        </span>
      )}

      <div className="d-flex justify-content-between align-items-center">
        <div className="d-flex align-items-center gap-2">
          <FaLaptop size={18} />
          <strong>Available Clients — Group: {groupId}</strong>
        </div>
        <div className="d-flex align-items-center gap-3">
          <Form.Check
            type="checkbox"
            id={`select-all-${groupId}`}
            label="Select all"
            checked={allSelected}
            ref={(el) => {
              if (el) el.indeterminate = !allSelected && someSelected
            }}
            onChange={toggleSelectAll}
          />
          <Button size="sm" variant="" onClick={getWSAgents} title="Refresh">
            <FiRefreshCw className="ms-1" />
          </Button>
        </div>
      </div>

      {!agents || agents.length === 0 ? (
        <Alert variant="light" className="mt-2 mb-0">
          No machines connected in this group.
        </Alert>
      ) : (
        <ListGroup className="mt-2">
          {agents.map((a) => (
            <ListGroup.Item key={a.id} className={`d-flex align-items-center justify-content-between ${!!selectedMap[a.id] ? "border bg-light" : ""}`}>
              <div className="d-flex align-items-center" style={{ gap: ".6rem" }}>
                {renderOsIcon(a.os)}
                <span style={{ fontFamily: "monospace" }}>{a.id}</span>
              </div>
              <Form.Check type="checkbox" id={`chk-${groupId}-${a.id}`} checked={!!selectedMap[a.id]} onChange={() => toggleAgent(a.id)} label="Use" />
            </ListGroup.Item>
          ))}
        </ListGroup>
      )}
    </div>
  )
}
