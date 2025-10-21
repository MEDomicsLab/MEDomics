import React, { useContext, useEffect } from "react"
import { Modal, Button, ListGroup, Alert, Form } from "react-bootstrap"
import { FaApple, FaChartBar, FaChartLine, FaDatabase, FaLaptop, FaLink, FaLinux, FaNetworkWired, FaServer, FaTable, FaWindows } from "react-icons/fa"
import { AiOutlineDatabase } from "react-icons/ai"
import { MdComputer } from "react-icons/md"
import { requestBackend } from "../../../utilities/requests"
import { ipcRenderer } from "electron"
import Col from "react-bootstrap/Col"
import Nav from "react-bootstrap/Nav"
import Row from "react-bootstrap/Row"
import Tab from "react-bootstrap/Tab"
import { WorkspaceContext } from "../../workspace/workspaceContext"
import { PageInfosContext } from "../../mainPages/moduleBasics/pageInfosContext"
import { IoHardwareChip } from "react-icons/io5"
import ServerSpecs from "./ServerSpecs"
import ClientDetails from "./ClientDetails"
import ClientConnectionPanel from "./ConnectedClients"
import { InputText } from "primereact/inputtext"
import { FaUsersLine } from "react-icons/fa6"
import DatasetInfo from "./Datasetinfo"
import { FiRefreshCw } from "react-icons/fi"
import ConnectedWSAgents from "./ConnectedWSAgents"
import DatasetOverview from "./DatasetsOverview"
import { useMEDflContext } from "../../workspace/medflContext"

export default function NetworkCheckModal({ show, onHide, setNetworkChecked }) {
  const { port } = useContext(WorkspaceContext)


  const { config, pageId, configPath } = useContext(PageInfosContext)

  const [waitingForServer, setWaitingForServer] = React.useState(false)
  const [waitingForClients, setWaitingForClients] = React.useState(false)
  const [serverRunning, setServerRunning] = React.useState(false)
  const [finished, setFinished] = React.useState(false)
  const [connectedClients, setConnectedClients] = React.useState([])
  const [clientProperties, setClientProperties] = React.useState({})
  const [serverPID, setServerPageId] = React.useState(null)
  const [minAvailableClients, setMinAvailableClients] = React.useState(0)

  // WebSocket agents
  const [wsAgents, setWSAgents] = React.useState(null) // e.g., ["DESKTOP-ENI5U7G-windows"]
  const [selectedAgents, setSelectedAgents] = React.useState({}) // { "DESKTOP-...": true }
  const [datasetStats, setDatasetStats] = React.useState({})

  const [canRun, setCanRun] = React.useState(false)

  // Derived state

  const renderOsIcon = (os) => {
    const osLower = os.toLowerCase()
    if (osLower.includes("windows")) return <FaWindows />
    if (osLower.includes("mac") || osLower.includes("darwin")) return <FaApple />
    if (osLower.includes("linux")) return <FaLinux />
    return <FaLaptop className="text-secondary" />
  }

  useEffect(() => {
    !wsAgents && getWSAgents()
  }, [wsAgents])

  const getWSAgents = () => {
    requestBackend(
      port,
      "/medfl/rw/ws/agents/" + pageId,
      {},
      (json) => {
        if (json.error) {
          // toast.error?.("Error: " + json.error)
          console.error("WS Agents error:", json.error)
        } else {
          // The API returns the list in response_message (could be array or JSON string)
          let agents = json || []
          if (typeof agents === "string") {
            try {
              agents = JSON.parse(agents)
            } catch {
              agents = []
            }
          }
          if (!Array.isArray(agents)) agents = []
          setWSAgents(agents)
          // Keep selection in sync (preserve known selections, drop removed items)
          setSelectedAgents((prev) => {
            const next = {}
            agents.forEach((a) => (next[a] = !!prev[a]))
            return next
          })
          console.log("WS Agents set:", agents)
        }
      },
      (err) => {
        console.error(err)
      }
    )
  }


  

  const getDataAgentStats = () => {
    const checkedAgents = wsAgents?.filter((agent) => selectedAgents[agent]) || []

    checkedAgents.forEach((agent) => {
      requestBackend(
        port,
        "/medfl/rw/ws/stats/" + pageId,
        { id: agent },
        (json) => {
          if (json.error) {
            console.error("getDataAgentStats error:", json.error)
          } else {
            console.log("Agent stats:", json)
            setDatasetStats((prev) => ({
              ...prev,
              [agent]: json
            })) // Process and display the stats as needed
          }
        },
        (err) => {
          console.error(err)
        }
      )
    })
  }
  const stopServer = () => {
    serverPID &&
      requestBackend(
        port,
        "/medfl/rw/stop-server/" + pageId,
        { pid: serverPID },
        (json) => {
          if (json.error) {
            // toast.error?.("Error: " + json.error)
            console.error("stopServer error:", json.error)
          } else {
            console.log(json)
            setServerRunning(false)
            setServerPageId(null)
            setWaitingForClients(false)
            setConnectedClients([])
            setFinished(false)
            setClientProperties({})
          }
        },
        (err) => {
          console.error(err)
        }
      )
  }

  return (
    <div>
      <Modal show={show} onHide={onHide} size="xl" aria-labelledby="contained-modal-title-vcenter" centered className="modal-settings-chooser">
        <Modal.Header closeButton>
          <Modal.Title id="contained-modal-title-vcenter">🧠 Federated Learning Network Check</Modal.Title>
        </Modal.Header>

        <Modal.Body>
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
            <strong>Info:</strong> Before launching the federated learning experiment, we need to ensure that all participating clients are ready. This check will help you confirm connection status,
            dataset compatibility, and available hardware resources.
          </div>

          {/* Main Checklist */}
          {!serverRunning ? (
            <ListGroup variant="flush" className="mb-4">
              <ListGroup.Item className="d-flex align-items-center">
                <FaLink className="me-2 text-primary" />
                <strong>Connected Clients:</strong>&nbsp; Verifies which clients are currently online and reachable.
              </ListGroup.Item>
              <ListGroup.Item className="d-flex align-items-center">
                <AiOutlineDatabase className="me-2 text-success" />
                <strong>Dataset Configuration:</strong>&nbsp; Checks label format, class distribution, and input consistency per client.
              </ListGroup.Item>
              <ListGroup.Item className="d-flex align-items-center">
                <FaChartBar className="me-2 text-info" />
                <strong>Dataset Statistics:</strong>&nbsp; Evaluates sample counts, balance, and data variety across clients.
              </ListGroup.Item>
              <ListGroup.Item className="d-flex align-items-center">
                <MdComputer className="me-2 text-warning" />
                <strong>Hardware Resources:</strong>&nbsp; Retrieves system info including CPU, RAM, and GPU availability.
              </ListGroup.Item>

              {/* WS Agents List with checkboxes and computer icon */}
              <ConnectedWSAgents
                wsAgents={wsAgents}
                selectedAgents={selectedAgents}
                setSelectedAgents={setSelectedAgents}
                setMinAvailableClients={setMinAvailableClients}
                getWSAgents={getWSAgents}
                setCanRun={setCanRun}
                renderOsIcon={renderOsIcon}
              ></ConnectedWSAgents>
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
                      <Tab.Pane eventKey="second"></Tab.Pane>
                      <Tab.Pane eventKey="third"></Tab.Pane>
                      <Tab.Pane eventKey="fourth">
                        <ClientDetails clientProperties={clientProperties} />
                      </Tab.Pane>
                    </Tab.Content>
                  </Col>
                </Row>
              </Tab.Container>
            </>
          )}

          {datasetStats && Object.keys(datasetStats).length > 0 && (
            <Tab.Container defaultActiveKey="__overview__">
              <Nav variant="pills">
                <Nav.Item>
                  <Nav.Link eventKey="__overview__">Overview</Nav.Link>
                </Nav.Item>
                {Object.keys(datasetStats).map((agent) => (
                  <Nav.Item key={agent}>
                    <Nav.Link eventKey={agent}>
                      {renderOsIcon(agent.split("-")[agent.split("-").length - 1])}
                      <span style={{ fontFamily: "monospace" }}> {agent}</span>
                    </Nav.Link>
                  </Nav.Item>
                ))}
              </Nav>

              <Tab.Content>
                <Tab.Pane eventKey="__overview__">
                  <DatasetOverview datasetStats={datasetStats} />
                </Tab.Pane>
                {Object.entries(datasetStats).map(([agent, data]) => (
                  <Tab.Pane eventKey={agent} key={agent}>
                    <DatasetInfo data={data} agent={agent} />
                  </Tab.Pane>
                ))}
              </Tab.Content>
            </Tab.Container>
          )}
        </Modal.Body>

        <Modal.Footer>
          <Button variant="primary" onClick={getDataAgentStats} disabled={!minAvailableClients || minAvailableClients == 0 || waitingForServer || !canRun}>
            Launch Check
          </Button>
          {Object.keys(datasetStats).length > 0 && (
            <Button variant="success" onClick={() => setNetworkChecked(true)}>
              Validate Network
            </Button>
          )}
          {/* {finished ? (
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
              disabled={!minAvailableClients || minAvailableClients == 0 || waitingForServer || wsAgents?.length === 0 || !someSelected}
              title={wsAgents?.length === 0 ? "No machines available" : !someSelected ? "Select at least one machine" : "Launch Check"}
            >
              Launch Check
            </Button>
          )} */}
        </Modal.Footer>
      </Modal>
    </div>
  )
}
