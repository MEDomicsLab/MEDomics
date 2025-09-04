import React, { useEffect } from "react"
import { Button, ListGroup, Alert, Form } from "react-bootstrap"
import { FaLaptop } from "react-icons/fa"
import { FiRefreshCw } from "react-icons/fi"

export default function ConnectedWSAgents({ wsAgents = [], selectedAgents, setSelectedAgents, setMinAvailableClients, setCanRun, getWSAgents, renderOsIcon = () => null }) {
  // ✅ Always normalize wsAgents to a safe array
  const agents = Array.isArray(wsAgents) ? wsAgents : []

  const allSelected = agents.length > 0 && agents.every((a) => selectedAgents[a])
  const someSelected = agents.some((a) => selectedAgents[a])

  const toggleAgent = (agent) => {
    const next = { ...selectedAgents, [agent]: !selectedAgents[agent] }
    setSelectedAgents(next)
    setMinAvailableClients(agents.filter((a) => next[a]).length)

    console.log("toggleAgent", selectedAgents, next)
  }

  const toggleSelectAll = () => {
    if (allSelected) {
      // Unselect all
      const cleared = {}
      agents.forEach((a) => (cleared[a] = false))
      setSelectedAgents(cleared)
      setMinAvailableClients(0)
    } else {
      // Select all
      const filled = {}
      agents.forEach((a) => (filled[a] = true))
      setSelectedAgents(filled)
      setMinAvailableClients(agents.length)
    }
  }

  useEffect(() => {
    console.log("wsAgents normalized:", agents)
    setCanRun(agents.length > 0 && someSelected)
  }, [agents, selectedAgents])

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
      <div className="d-flex justify-content-between align-items-center">
        <div className="d-flex align-items-center gap-2">
          <FaLaptop size={18} />
          <strong>Available Clients</strong>
        </div>
        <div className="d-flex align-items-center gap-3">
          <Form.Check
            type="checkbox"
            id="select-all-agents"
            label="Select all"
            checked={allSelected}
            ref={(el) => {
              if (el) el.indeterminate = !allSelected && someSelected
            }}
            onChange={toggleSelectAll}
          />
          <Button size="sm" variant="" onClick={getWSAgents}>
            <FiRefreshCw className="ms-1" />
          </Button>
        </div>
      </div>

      {agents.length === 0 ? (
        <Alert variant="light" className="mt-2 mb-0">
          No machines connected yet.
        </Alert>
      ) : (
        <ListGroup className="mt-2">
          {agents.map((agent) => (
            <ListGroup.Item key={agent} className={`d-flex align-items-center justify-content-between ${!!selectedAgents[agent] ? "border bg-light" : ""}`}>
              <div className="d-flex align-items-center" style={{ gap: ".6rem" }}>
                {renderOsIcon(agent.split("-").pop())}
                <span style={{ fontFamily: "monospace" }}>{agent.split("-").slice(0, -1).join("-")}</span>
              </div>
              <Form.Check type="checkbox" id={`chk-${agent}`} checked={!!selectedAgents[agent]} onChange={() => toggleAgent(agent)} label="Use" />
            </ListGroup.Item>
          ))}
        </ListGroup>
      )}
    </div>
  )
}
