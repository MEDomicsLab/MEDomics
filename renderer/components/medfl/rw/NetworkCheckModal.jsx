import React, { useContext, useEffect } from "react"
import { Modal, Button, ListGroup } from "react-bootstrap"
import { FaApple, FaChartBar, FaDatabase, FaLaptop, FaLink, FaLinux, FaServer, FaWindows } from "react-icons/fa"
import { AiOutlineDatabase } from "react-icons/ai"
import { MdComputer } from "react-icons/md"
import { requestBackend } from "../../../utilities/requests"
import Col from "react-bootstrap/Col"
import Nav from "react-bootstrap/Nav"
import Row from "react-bootstrap/Row"
import Tab from "react-bootstrap/Tab"
import { WorkspaceContext } from "../../workspace/workspaceContext"
import { PageInfosContext } from "../../mainPages/moduleBasics/pageInfosContext"
import ServerSpecs from "./ServerSpecs"
import ClientDetails from "./ClientDetails"
import ClientConnectionPanel from "./ConnectedClients"
import DatasetInfo from "./Datasetinfo"
import ConnectedWSAgents from "./ConnectedWSAgents"
import DatasetOverview from "./DatasetsOverview"
import { FlowFunctionsContext } from "../../flow/context/flowFunctionsContext"

export default function NetworkCheckModal({ show, onHide, setNetworkChecked, networkChecked }) {
  const { port } = useContext(WorkspaceContext)
  const { pageId } = useContext(PageInfosContext)
  const { groupNodeId } = useContext(FlowFunctionsContext)

  const currentGroupId = groupNodeId?.id || "__default__"

  const [waitingForServer, setWaitingForServer] = React.useState(false)
  const [waitingForClients, setWaitingForClients] = React.useState(false)
  const [serverRunning, setServerRunning] = React.useState(false)
  const [finished, setFinished] = React.useState(false)

  // ===== Grouped states =====
  // Agents grouped by groupNodeId
  const [wsAgentsByGroup, setWSAgentsByGroup] = React.useState({}) // { [groupId]: Agent[] }
  const [selectedAgentsByGroup, setSelectedAgentsByGroup] = React.useState({}) // { [groupId]: { [agentId]: bool } }
  // Dataset stats grouped by groupNodeId, then agent
  const [datasetStatsByGroup, setDatasetStatsByGroup] = React.useState({}) // { [groupId]: { [agentId]: stats } }

  // Legacy/other state you might use elsewhere
  const [connectedClients, setConnectedClients] = React.useState([])
  const [clientProperties, setClientProperties] = React.useState({})
  const [serverPID, setServerPageId] = React.useState(null)

  // Derived controls (per current group)
  const [minAvailableClients, setMinAvailableClients] = React.useState(0)
  const [canRun, setCanRun] = React.useState(false)

  // ---- utils ----
  const renderOsIcon = (os = "") => {
    const osLower = String(os || "").toLowerCase()
    if (osLower.includes("windows")) return <FaWindows />
    if (osLower.includes("mac") || osLower.includes("darwin")) return <FaApple />
    if (osLower.includes("linux")) return <FaLinux />
    return <FaLaptop className="text-secondary" />
  }

  // Normalize backend response into { [groupId]: Agent[] }
  // Accepts:
  //  - Array<string>                      -> assumes current group, tries to parse OS from suffix
  //  - Array<{id, groupNodeId, os?}>     -> ideal
  //  - { [groupId]: string[] | Agent[] } -> already grouped
  const normalizeAgentsByGroup = (raw, fallbackGroup = "__default__") => {
    const byGroup = {}

    const push = (g, a) => {
      const gid = g || fallbackGroup
      if (!byGroup[gid]) byGroup[gid] = []
      byGroup[gid].push({
        id: a.id,
        groupNodeId: gid,
        os: a.os || ""
      })
    }

    if (Array.isArray(raw)) {
      raw.forEach((item) => {
        if (typeof item === "string") {
          const parts = item.split("-")
          const os = parts[parts.length - 1]
          push(fallbackGroup, { id: item, os })
        } else if (item && typeof item === "object") {
          const g = item.groupNodeId || fallbackGroup
          push(g, { id: item.id, os: item.os })
        }
      })
    } else if (raw && typeof raw === "object") {
      Object.entries(raw).forEach(([g, arr]) => {
        if (Array.isArray(arr)) {
          arr.forEach((item) => {
            if (typeof item === "string") {
              const parts = item.split("-")
              const os = parts[parts.length - 1]
              push(g, { id: item, os })
            } else if (item && typeof item === "object") {
              push(g, { id: item.id, os: item.os })
            }
          })
        }
      })
    }

    return byGroup
  }

  // keep selection keys in sync with latest agents
  const syncSelections = (byGroup) => {
    setSelectedAgentsByGroup((prev) => {
      const next = { ...prev }
      Object.entries(byGroup).forEach(([g, agents]) => {
        const prevSel = prev[g] || {}
        const fresh = {}
        agents.forEach((a) => (fresh[a.id] = !!prevSel[a.id]))
        next[g] = fresh
      })
      return next
    })
  }

  // ---- load agents (grouped) ----
  const getWSAgents = () => {
    requestBackend(
      port,
      "/medfl/rw/ws/agents/" + pageId,
      {},
      (json) => {
        let payload = json || []
        if (typeof payload === "string") {
          try {
            payload = JSON.parse(payload)
          } catch {
            payload = []
          }
        }
        const grouped = normalizeAgentsByGroup(payload, currentGroupId)
        setWSAgentsByGroup(grouped)
        syncSelections(grouped)

        const currentAgents = grouped[currentGroupId] || []
        const selCount = Object.values(selectedAgentsByGroup[currentGroupId] || {}).filter(Boolean).length
        setMinAvailableClients(selCount)
        setCanRun(currentAgents.length > 0 && selCount > 0)
        // Optional: clear dataset stats for agents no longer in the group
        setDatasetStatsByGroup((prev) => {
          const curStats = prev[currentGroupId] || {}
          const keep = {}
          currentAgents.forEach((a) => {
            if (curStats[a.id]) keep[a.id] = curStats[a.id]
          })
          return { ...prev, [currentGroupId]: keep }
        })
      },
      (err) => console.error(err)
    )
  }

  // initial fetch or when group changes
  useEffect(() => {
    getWSAgents()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentGroupId])

  // recompute canRun when selections change (per current group)
  useEffect(() => {
    const groupSel = selectedAgentsByGroup[currentGroupId] || {}
    const selCount = Object.values(groupSel).filter(Boolean).length
    setMinAvailableClients(selCount)
    const agents = wsAgentsByGroup[currentGroupId] || []
    setCanRun(agents.length > 0 && selCount > 0)
  }, [selectedAgentsByGroup, wsAgentsByGroup, currentGroupId])

  // gather stats only for selected agents in the current group
  const getDataAgentStats = () => {
    const groupSel = selectedAgentsByGroup[currentGroupId] || {}
    const checkedIds = Object.entries(groupSel)
      .filter(([, v]) => v)
      .map(([k]) => k)

    checkedIds.forEach((agentId) => {
      requestBackend(
        port,
        "/medfl/rw/ws/stats/" + pageId,
        { id: agentId },
        (res) => {
          if (res?.error) {
            console.error("getDataAgentStats error:", res.error)
          } else {
            setDatasetStatsByGroup((prev) => ({
              ...prev,
              [currentGroupId]: {
                ...(prev[currentGroupId] || {}),
                [agentId]: res
              }
            }))
          }
        },
        (err) => console.error(err)
      )
    })
  }

  const stopServer = () => {
    if (!serverPID) return
    requestBackend(
      port,
      "/medfl/rw/stop-server/" + pageId,
      { pid: serverPID },
      (json) => {
        if (json?.error) console.error("stopServer error:", json.error)
        setServerRunning(false)
        setServerPageId(null)
        setWaitingForClients(false)
        setConnectedClients([])
        setFinished(false)
        setClientProperties({})
      },
      (err) => console.error(err)
    )
  }

  // convenience getters for UI
  const currentAgents = wsAgentsByGroup[currentGroupId] || []
  const currentSelection = selectedAgentsByGroup[currentGroupId] || {}
  const currentDatasetStats = datasetStatsByGroup[currentGroupId] || {}

  return (
    <div>
      <Modal show={show} onHide={onHide} size="xl" aria-labelledby="contained-modal-title-vcenter" centered className="modal-settings-chooser">
        <Modal.Header closeButton>
          <Modal.Title id="contained-modal-title-vcenter">🧠 Federated Learning Network Check</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {/* Current Group */}
          <div className="mb-2">
            <small className="text-muted">Current groupNodeId:</small>
            <div className="fw-bold">{currentGroupId}</div>
          </div>

          {/* Info Box */}
          <div
            style={{
              background: "#f0f4ff",
              border: "1px solid #b3c6ff",
              borderRadius: "6px",
              padding: "1rem",
              marginBottom: "2rem",
              color: "#2c3e50"
            }}
          >
            <strong>Info:</strong> Ensure each network group has its clients online, with compatible datasets and sufficient hardware resources before launching.
          </div>

          {!serverRunning ? (
            <ListGroup variant="flush" className="mb-4">
              <ListGroup.Item className="d-flex align-items-center">
                <FaLink className="me-2 text-primary" />
                <strong>Connected Clients (by group):</strong>&nbsp; You’re viewing <code>{currentGroupId}</code>.
              </ListGroup.Item>
              <ListGroup.Item className="d-flex align-items-center">
                <AiOutlineDatabase className="me-2 text-success" />
                <strong>Dataset Configuration</strong>
              </ListGroup.Item>
              <ListGroup.Item className="d-flex align-items-center">
                <FaChartBar className="me-2 text-info" />
                <strong>Dataset Statistics</strong>
              </ListGroup.Item>
              <ListGroup.Item className="d-flex align-items-center">
                <MdComputer className="me-2 text-warning" />
                <strong>Hardware Resources</strong>
              </ListGroup.Item>

              {/* Per-group WS Agents with selection */}
              <ConnectedWSAgents
                groupId={currentGroupId}
                agents={currentAgents}
                selectedMap={currentSelection}
                setSelectedAgentsByGroup={setSelectedAgentsByGroup}
                setMinAvailableClients={setMinAvailableClients}
                setCanRun={setCanRun}
                getWSAgents={getWSAgents}
                renderOsIcon={renderOsIcon}
              />
            </ListGroup>
          ) : (
            <>
              <ClientConnectionPanel connectedClients={connectedClients} minAvailableClients={minAvailableClients} />
              <Tab.Container id="left-tabs-example" defaultActiveKey="first">
                <Row>
                  <Col sm={3}>
                    <Nav variant="pills" className="flex-column" style={{ maxWidth: "150px" }}>
                      <Nav.Item>
                        <Nav.Link eventKey="first" className="d-flex gap-2 align-items-center">
                          <FaServer size={18} /> Server
                        </Nav.Link>
                      </Nav.Item>
                      <Nav.Item>
                        <Nav.Link eventKey="fourth" className="d-flex gap-2 align-items-center">
                          <FaDatabase size={18} /> Datasets
                        </Nav.Link>
                      </Nav.Item>
                    </Nav>
                  </Col>
                  <Col sm={9}>
                    <Tab.Content>
                      <Tab.Pane eventKey="first">
                        <ServerSpecs />
                      </Tab.Pane>
                      <Tab.Pane eventKey="fourth">
                        <ClientDetails clientProperties={clientProperties} />
                      </Tab.Pane>
                    </Tab.Content>
                  </Col>
                </Row>
              </Tab.Container>
            </>
          )}

          {/* Group-aware Dataset Stats Tabs */}
          {currentDatasetStats && Object.keys(currentDatasetStats).length > 0 && (
            <Tab.Container defaultActiveKey="__overview__">
              <Nav variant="pills">
                <Nav.Item>
                  <Nav.Link eventKey="__overview__">Overview</Nav.Link>
                </Nav.Item>
                {Object.keys(currentDatasetStats).map((agentId) => (
                  <Nav.Item key={agentId}>
                    <Nav.Link eventKey={agentId}>
                      {renderOsIcon(agentId.split("-").slice(-1)[0])}
                      <span style={{ fontFamily: "monospace" }}> {agentId}</span>
                    </Nav.Link>
                  </Nav.Item>
                ))}
              </Nav>

              <Tab.Content>
                <Tab.Pane eventKey="__overview__">
                  <DatasetOverview datasetStats={currentDatasetStats} />
                </Tab.Pane>

                {Object.entries(currentDatasetStats).map(([agentId, data]) => (
                  <Tab.Pane eventKey={agentId} key={agentId}>
                    <DatasetInfo data={data} agent={agentId} />
                  </Tab.Pane>
                ))}
              </Tab.Content>
            </Tab.Container>
          )}
        </Modal.Body>

        <Modal.Footer>
          <Button
            variant="primary"
            onClick={getDataAgentStats}
            disabled={!minAvailableClients || waitingForServer || !canRun}
            title={(wsAgentsByGroup[currentGroupId] || []).length === 0 ? "No machines in this group" : !canRun ? "Select at least one machine" : "Launch Check"}
          >
            Launch Check
          </Button>

          {Object.keys(currentDatasetStats).length > 0 && (
            <Button
              variant="success"
              onClick={() => {
                setNetworkChecked({ ...networkChecked, [currentGroupId]: true })
                console.log("Network checked for group:", networkChecked)
               
              }}
            >
              Validate Network
            </Button>
          )}
          {/* 
          {finished ? (
            <Button variant="success" onClick={() => setNetworkChecked(true)}>
              Validate Network
            </Button>
          ) : serverRunning ? (
            <Button variant="danger" onClick={stopServer} disabled={waitingForServer}>
              Stop Server
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={runServer}
              disabled={!minAvailableClients || minAvailableClients == 0 || waitingForServer || (wsAgentsByGroup[currentGroupId] || []).length === 0 || !someSelected}
              title={(wsAgentsByGroup[currentGroupId] || []).length === 0 ? "No machines available" : !someSelected ? "Select at least one machine" : "Launch Check"}
            >
              Launch Check
            </Button>
          )} 
          */}
        </Modal.Footer>
      </Modal>
    </div>
  )
}
