import React, { useState, useEffect, useContext } from "react"
import { FiMail, FiPaperclip, FiSend } from "react-icons/fi"
import { Modal, Tabs } from "react-bootstrap"
import { ipcRenderer } from "electron"

import { Alert } from "react-bootstrap"
import { FaServer } from "react-icons/fa6"
import FederatedNetworkConfigView from "./NetworkConfig"
import { FaApple, FaChartLine, FaLaptop, FaNetworkWired, FaPause, FaPlay, FaSave, FaTable, FaWindows } from "react-icons/fa"
import { requestBackend } from "../../../utilities/requests"
import { WorkspaceContext } from "../../workspace/workspaceContext"
import { PageInfosContext } from "../../mainPages/moduleBasics/pageInfosContext"
import RoundLineChart from "./RoundLine"
import Col from "react-bootstrap/Col"
import Nav from "react-bootstrap/Nav"
import Row from "react-bootstrap/Row"
import Tab from "react-bootstrap/Tab"
import ClientConnectionPanel from "./ConnectedClients"
import ProgressTable from "./ProgressTable"
import ClientEvalLineChart from "./ ClientsLineChart"
import CommunicationFlow from "./CommunicationFlow"

import { JsonView, allExpanded } from "react-json-view-lite"
import MedDataObject from "../../workspace/medDataObject"
import { toast } from "react-toastify"

import { UUID_ROOT, DataContext } from "../../workspace/dataContext"
import { EXPERIMENTS } from "../../workspace/workspaceContext"

import Path from "path"

const ServerLogosModal = ({ show, onHide, nodes }) => {
  const { port } = useContext(WorkspaceContext)
  const { pageId } = useContext(PageInfosContext)

  // Logs and monitoring state
  const [serverLogs, setServerLogs] = useState([])
  const [connectedClients, setConnectedClients] = useState([])
  const [currentRound, setCurrentRound] = useState(0)
  const [roundResults, setRoundResults] = useState([])
  const [trainingresults, setTraningResulsts] = useState([])
  const [isAggregating, setIsAggregating] = useState(false)
  const [runningClients, setRunningClients] = useState([])

  const [strategyConfigs, setStrategyConfigs] = useState(nodes?.filter((node) => node.type == "flRunServerNode") || [])
  const [modelConfigs, setModelConfigs] = useState(nodes?.filter((node) => node.type == "flModelNode") || [])

  const [displayView, setView] = useState("chart")

  const [devices, setDevices] = useState({})

  const [serverPID, setServerPageId] = useState(null)
  const [waitingForClients, setWaitingForClients] = useState(false)
  const [nClients, setNClients] = useState(0)
  const [serverRunning, setServerRunning] = useState(false)
  const [finishedruning, setFinished] = useState(false)
  const [clientTrainMetrics, setClientTrainMetrics] = useState([])
  const [clientEvalMetrics, setClientEvalMetrics] = useState([])

  // Configuration state
  const [strategy, setStrategy] = useState(strategyConfigs[0]?.data.internal.settings.strategy || "FedAvg")
  const [serverAddress, setServerAddress] = useState(strategyConfigs[0]?.data.internal.settings.serverAddress || "0.0.0.0:8080")
  const [numRounds, setNumRounds] = useState(strategyConfigs[0]?.data.internal.settings.numRounds || 10)
  const [fractionFit, setFractionFit] = useState(strategyConfigs[0]?.data.internal.settings.fractionFit || 1)
  const [fractionEvaluate, setFractionEvaluate] = useState(strategyConfigs[0]?.data.internal.settings.fractionEvaluate || 1)
  const [minFitClients, setMinFitClients] = useState(strategyConfigs[0]?.data.internal.settings.minFitClients || 3)
  const [minEvaluateClients, setMinEvaluateClients] = useState(strategyConfigs[0]?.data.internal.settings.minEvaluateClients || 3)
  const [minAvailableClients, setMinAvailableClients] = useState(strategyConfigs[0]?.data.internal.settings.minAvailableClients || 3)

  const [fileName, setFileName] = useState("")
  const [isFileName, showFileName] = useState(false)

  // context
  const { globalData } = useContext(DataContext)

  const saveResults = async () => {
    try {
      let path = Path.join(globalData[UUID_ROOT].path, EXPERIMENTS)

      MedDataObject.createFolderFromPath(path + "/FL")
      MedDataObject.createFolderFromPath(path + "/FL/RW")

      // do custom actions in the folder while it is unzipped
      let data = {
        config: { strategy, numRounds },

        devices,
        trainingResults: trainingresults,
        evaluationResults: roundResults,
        clientTrainMetrics,
        clientEvalMetrics
      }

      await MedDataObject.writeFileSync({ data, date: Date.now() }, path + "/FL/RW", fileName, "json")
      await MedDataObject.writeFileSync({ data, date: Date.now() }, path + "/FL/RW", fileName, "medflrw")

      toast.success("Optimization results saved under /FL/RW/")
    } catch {
      toast.error("Something went wrong ")
    }
  }

  useEffect(() => {
    if (strategyConfigs && strategyConfigs.length > 0) {
      const config = strategyConfigs[0].data.internal.settings
      setStrategy(config.strategy || "FedAvg")
      setServerAddress(config.serverAddress || "")
      setNumRounds(config.numRounds || 10)
      setFractionFit(config.fractionFit || 1)
      setFractionEvaluate(config.fractionEvaluate || 1)
      setMinFitClients(config.minFitClients || 3)
      setMinEvaluateClients(config.minEvaluateClients || 3)
      setMinAvailableClients(config.minAvailableClients || 3)
    }
  }, [strategyConfigs])

  useEffect(() => {
    setModelConfigs(nodes?.filter((node) => node.type == "flModelNode") || [])
    setStrategyConfigs(nodes?.filter((node) => node.type == "flRunServerNode") || [])

    console.log("Strategy Configs:", strategyConfigs)
    console.log("Model Configs:", modelConfigs)
    console.log("nodes:", nodes)
  }, [nodes])

  useEffect(() => {
    // ipcRenderer.removeAllListeners("log")
    ipcRenderer.on("log", (event, data) => {
      setServerLogs((prev) => [...prev, data])
      if (data.includes("Server started with PID")) {
        const match = data.match(/PID (\d+)/)
        if (match) {
          const pid = parseInt(match[1], 10)
          setServerPageId(pid)
        }
      }
      if (data.includes("Starting Flower server")) {
        setIsAggregating(true)
        setWaitingForClients(true)
        setServerRunning(true)
        setFinished(false)
      }
      if (data.includes("Finished running script")) {
        setWaitingForClients(false)
        setFinished(true)
      }

      if (data.includes("Client connected - CID:")) {
        console.log("Client connected:", data)

        // Extract CID using regex
        const match = data.match(/CID:\s*([a-fA-F0-9]+)/)
        if (!match) return // Exit if CID is not found

        const cid = match[1]
        console.log("Client connected with ID:", cid)

        const connected = {
          id: cid,
          name: "",
          os: "unknown",
          joinedAt: new Date()
        }

        // Push only if CID doesn't already exist
        setConnectedClients((prev) => {
          const exists = prev.some((client) => client.id === cid)
          return exists ? prev : [...prev, connected]
        })
      }

      // ---- NEW: CLIENT TRAIN METRICS (CTM) ----
      // ---- NEW: CLIENT TRAIN METRICS (CTM) ----
      if (data.includes("CTM Round")) {
        const ctmMatches = data.matchAll(/CTM Round (\d+) Client:([a-f0-9]+):\s*({.*})/g)

        for (const match of ctmMatches) {
          const round = parseInt(match[1], 10)
          const cid = match[2]
          const metricsStr = match[3].replace(/'/g, '"') // Convert single quotes to double quotes for JSON

          try {
            const metrics = JSON.parse(metricsStr)

            const trainResult = {
              round,
              clientId: cid,
              auc: metrics.train_auc,
              accuracy: metrics.train_accuracy,
              loss: metrics.train_loss,
              hostname: metrics.hostname,
              type: "train",
              timestamp: new Date()
            }

            // Add only if this (round, clientId) does not already exist
            setClientTrainMetrics((prev) => {
              const exists = prev.some((item) => item.clientId === cid && item.round === round)
              return exists ? prev : [...prev, trainResult]
            })

            setConnectedClients((prev) => {
              return prev.map((client) => {
                if (client.id === cid && (!client.hostname || client.hostname === "")) {
                  return { ...client, hostname: metrics.hostname, os: metrics.os_type || "unknown" }
                }
                return client
              })
            })

            console.log("Parsed CTM:", trainResult)

            setRunningClients((prev) => prev.filter((id) => id !== cid))
          } catch (err) {
            console.error("Failed to parse CTM JSON for client", cid, "on round", round, err)
          }
        }
        setIsAggregating(true)
      }

      // ---- NEW: CLIENT EVAL METRICS (CEM) ----
      if (data.includes("CEM Round")) {
        const cemMatches = data.matchAll(/CEM Round (\d+) Client:([a-f0-9]+):\s*({.*})/g)

        for (const match of cemMatches) {
          const round = parseInt(match[1], 10)
          const cid = match[2]
          const metricsStr = match[3].replace(/'/g, '"') // Convert single quotes to JSON

          try {
            const metrics = JSON.parse(metricsStr)
            const evalResult = {
              round,
              clientId: cid,
              auc: metrics.eval_auc,
              accuracy: metrics.eval_accuracy,
              loss: metrics.eval_loss,
              type: "eval",
              timestamp: new Date()
            }

            // Add only if this (round, clientId) does not already exist
            setClientEvalMetrics((prev) => {
              const exists = prev.some((item) => item.clientId === cid && item.round === round)
              return exists ? prev : [...prev, evalResult]
            })

            setRunningClients((prev) => prev.filter((id) => id !== cid))

            console.log("toooose ara te running ====", runningClients)
            console.log("Parsed CEM:", evalResult)
          } catch (err) {
            console.error("Failed to parse CEM JSON for client", cid, "on round", round, err)
          }
        }
        setIsAggregating(true)
      }

      if (data.includes("Aggregated Training Metrics")) {
        // setIsAggregating(true)
        let roundNumber = 0

        // Extract round number
        const roundMatch = data.match(/Round (\d+) - Aggregated Training Metrics/)
        if (roundMatch && roundMatch[1]) {
          roundNumber = parseInt(roundMatch[1], 10)
          console.log("Current Training Round:", roundNumber)
        } else {
          console.warn("Could not parse round number from line:", data)
          return
        }

        // Extract JSON-like metrics part
        const metricsMatch = data.match(/Aggregated Training Metrics:\s*(\{.*\})/)
        if (!metricsMatch || !metricsMatch[1]) {
          console.warn("Could not parse training metrics from line:", data)
          return
        }

        let metrics = {}
        try {
          const jsonStr = metricsMatch[1].replace(/'/g, '"') // Convert single quotes to double quotes for JSON parse
          metrics = JSON.parse(jsonStr)
        } catch (err) {
          console.error("Error parsing training metrics JSON:", err)
          return
        }

        const result = {
          round: roundNumber,
          loss: metrics.train_loss,
          accuracy: metrics.train_accuracy,
          auc: metrics.train_auc,
          clientsTrained: 3, // You can update this with real client count if needed
          timeTaken: (Math.random() * 3).toFixed(2), // Placeholder for duration
          timestamp: new Date()
        }

        setTraningResulsts((prev) => {
          const alreadyExists = prev.some((r) => r.round === roundNumber)
          return alreadyExists ? prev : [...prev, result]
        })

        console.log("Parsed Aggregated Training Metrics for Round", roundNumber, result)
        setTimeout(() => {
          setIsAggregating(false)
        }, 2000)

        setRunningClients((prev) => {
          const clientIds = connectedClients.map((client) => client.id)
          // Add any client.id not already in runningClients
          const newClients = clientIds.filter((id) => !prev.includes(id))
          return [...prev, ...newClients]
        })
      }

      if (data.includes("Aggregated Evaluation Metrics")) {
        // setIsAggregating(true)
        let roundNumber = 0
        const match = data.match(/Round (\d+) - Aggregated Evaluation Metrics/)
        if (match && match[1]) {
          roundNumber = parseInt(match[1])
          console.log("Current Round:", roundNumber)
          // You can now set this to state or display it in your UI
        }
        // Extract the next line which contains the actual metrics
        const metricsLineMatch = data.match(/Loss:\s*([\d.]+),\s*Metrics:\s*({.*})/)
        if (!metricsLineMatch) {
          console.warn("Could not parse metrics from line:", data)
          return
        }

        const loss = parseFloat(metricsLineMatch[1])
        const metricsStr = metricsLineMatch[2]

        let metrics = {}
        try {
          // Convert Python-style dict to JSON-style (single to double quotes)
          const jsonStr = metricsStr.replace(/'/g, '"')
          metrics = JSON.parse(jsonStr)
        } catch (err) {
          console.error("Error parsing metrics JSON:", err)
          return
        }

        const result = {
          round: roundNumber,
          loss,
          accuracy: metrics.eval_accuracy,
          auc: metrics.eval_auc,
          clientsTrained: 3,
          timeTaken: (Math.random() * 3).toFixed(2), // Simulated time taken
          timestamp: new Date()
        }

        setRoundResults((prev) => {
          const alreadyExists = prev.some((r) => r.round === roundNumber)
          return alreadyExists ? prev : [...prev, result]
        })
        setTimeout(() => {
          setIsAggregating(false)
        }, 2000)
        setRunningClients((prev) => {
          const clientIds = connectedClients.map((client) => client.id)
          // Add any client.id not already in runningClients
          const newClients = clientIds.filter((id) => !prev.includes(id))
          return [...prev, ...newClients]
        })
        console.log("this is the runing clients ", runningClients)
      }
    })
  }, [])

  const styles = {
    container: {
      display: "flex",
      flexDirection: "column",
      maxWidth: "1200px",
      margin: "0 auto",
      padding: "2rem",
      fontFamily: "'Segoe UI', Roboto, sans-serif",
      color: "#333"
    },
    header: {
      marginBottom: "2rem",
      paddingBottom: "1rem",
      borderBottom: "1px solid #eaeaea"
    },
    title: {
      fontSize: "1.8rem",
      fontWeight: "600",
      margin: "0 0 0.5rem"
    },
    subtitle: {
      fontSize: "1rem",
      color: "#666",
      margin: "0"
    },
    content: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "2rem",
      marginBottom: "2rem"
    },
    configPanel: {
      backgroundColor: "#f8f9fa",
      padding: "1.5rem",
      borderRadius: "8px",
      boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
      border: "1px solid #e9ecef"
    },
    formGroup: {
      marginBottom: "1.5rem"
    },
    label: {
      display: "block",
      marginBottom: "0.5rem",
      fontWeight: "500",
      color: "#495057",
      fontSize: "0.9rem"
    },
    input: {
      width: "100%",
      padding: "0.75rem",
      backgroundColor: "#fff",
      border: "1px solid #ced4da",
      color: "#212529",
      borderRadius: "4px",
      fontSize: "0.9rem"
    },
    select: {
      width: "100%",
      padding: "0.75rem",
      backgroundColor: "#fff",
      border: "1px solid #ced4da",
      color: "#212529",
      borderRadius: "4px",
      fontSize: "0.9rem"
    },
    buttonGroup: {
      display: "flex",
      gap: "1rem",
      marginTop: "1.5rem"
    },
    startButton: {
      backgroundColor: "#28a745",
      color: "white",
      border: "none",
      padding: "0.75rem 1.5rem",
      borderRadius: "4px",
      cursor: "pointer",
      transition: "background 0.2s",
      fontSize: "1rem",
      fontWeight: "500",
      flex: "1"
    },
    stopButton: {
      backgroundColor: "#dc3545",
      color: "white",
      border: "none",
      padding: "0.75rem 1.5rem",
      borderRadius: "4px",
      cursor: "pointer",
      transition: "background 0.2s",
      fontSize: "1rem",
      fontWeight: "500",
      flex: "1"
    },
    codePreview: {
      backgroundColor: "#f8f9fa",
      borderRadius: "8px",
      overflow: "hidden",
      border: "1px solid #e9ecef"
    },
    codeHeader: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "1rem",
      backgroundColor: "#f8f9fa",
      borderBottom: "1px solid #e9ecef"
    },
    monitoringSection: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "2rem",
      marginBottom: "2rem"
    },

    logsContainer: {
      backgroundColor: "#f8f9fa",
      borderRadius: "8px",
      border: "1px solid #e9ecef",
      overflow: "hidden"
    },
    logsHeader: {
      padding: "1rem",
      backgroundColor: "#f8f9fa",
      borderBottom: "1px solid #e9ecef",
      fontWeight: "500"
    },
    logsContent: {
      minHeight: "200px",
      maxHeight: "300px",
      overflowY: "auto",
      padding: "1rem",
      fontFamily: "monospace",
      fontSize: "0.85rem",
      backgroundColor: "#fff"
    },
    logEntry: {
      padding: "0.25rem 0",
      borderBottom: "1px solid #f0f0f0"
    },
    sectionTitle: {
      fontSize: "1.1rem",
      fontWeight: 600,
      margin: 0,
      color: "#2d3748"
    },
    headerTitleGroup: {
      display: "flex",
      alignItems: "center",
      gap: "12px"
    },
    statusPills: {
      display: "flex",
      gap: "8px"
    },
    statusPillActive: {
      backgroundColor: "#e6f4ea",
      color: "#137333",
      borderRadius: "16px",
      padding: "4px 10px",
      fontSize: "0.8rem",
      fontWeight: 500
    },
    statusPillTotal: {
      backgroundColor: "#e8f0fe",
      color: "#1a73e8",
      borderRadius: "16px",
      padding: "4px 10px",
      fontSize: "0.8rem",
      fontWeight: 500
    }
  }

  const runServer = () => {
    requestBackend(
      port,
      "/medfl/rw/run-server/" + pageId,
      {
        strategy_name: strategy,
        serverAddress: serverAddress,
        num_rounds: numRounds,
        fraction_fit: fractionFit,
        fraction_evaluate: fractionEvaluate,
        min_fit_clients: minFitClients,
        min_evaluate_clients: minEvaluateClients,
        min_available_clients: minAvailableClients,
        port: serverAddress?.split(":")[1],
        use_transfer_learning: modelConfigs[0]?.data.internal.settings.activateTl == "true" ? true : false,
        pretrained_model_path: modelConfigs[0]?.data.internal.settings.file.path || ""
      },
      (json) => {
        if (json.error) {
          toast.error("Error: " + json.error)
        } else {
          console.log(json)
        }
      },
      (err) => {
        console.error(err)
        // toast.error("Fetch failed")
        // setLoading(false)
      }
    )
  }

  const stopServer = () => {
    serverPID &&
      requestBackend(
        port,
        "/medfl/rw/stop-server/" + pageId,
        {
          pid: serverPID
        },
        (json) => {
          if (json.error) {
            toast.error("Error: " + json.error)
          } else {
            console.log(json)
            setServerRunning(false)
            setServerPageId(null)
            setWaitingForClients(false)
            setNClients(0)
            setConnectedClients([])
            setCurrentRound(0)
            setRoundResults([])
            setServerLogs([])
            setFinished(false)
            setClientTrainMetrics([])
            setClientEvalMetrics([])
            setTraningResulsts([])
          }
        },
        (err) => {
          console.error(err)
          // toast.error("Fetch failed")
          // setLoading(false)
        }
      )
  }

  return (
    <div>
      <Modal show={show} onHide={onHide} size="xl" aria-labelledby="contained-modal-title-vcenter" centered className="modal-settings-chooser">
        <Modal.Header closeButton>
          <Modal.Title id="contained-modal-title-vcenter">
            <FaServer className="me-2" />
            Run Server{" "}
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {waitingForClients && (
            <Alert variant={connectedClients.length < minAvailableClients ? "warning" : "success"} className="shadow-sm rounded">
              <strong>Info:</strong> Server running,{" "}
              {connectedClients.length < minAvailableClients ? `Waiting for ${minAvailableClients - connectedClients.length} clients to connect` : "All clients are connected"}
            </Alert>
          )}

          {!serverRunning ? (
            <>
              {/* <FederatedLearningAnimation  /> */}
              <FederatedNetworkConfigView
                config={{
                  server: { rounds: numRounds, strategy: strategy },
                  model: modelConfigs[0]?.data.internal.settings || {}
                }}
                setDevices={setDevices}
              />
            </>
          ) : (
            <>
              <ClientConnectionPanel connectedClients={connectedClients} minAvailableClients={minAvailableClients} />

              <Tab.Container id="left-tabs-example" defaultActiveKey="first">
                <Row>
                  <Col sm={1}>
                    <Nav variant="pills" className="flex-column" style={{ maxWidth: "50px" }}>
                      <Nav.Item>
                        <Nav.Link eventKey="first">
                          <FaServer />
                        </Nav.Link>
                      </Nav.Item>
                      <Nav.Item>
                        <Nav.Link eventKey="second">
                          <FaLaptop />
                        </Nav.Link>
                      </Nav.Item>
                      <Nav.Item>
                        <Nav.Link eventKey="third">
                          <FaNetworkWired />
                        </Nav.Link>
                      </Nav.Item>
                    </Nav>
                  </Col>
                  <Col sm={11}>
                    <div className={`d-flex justify-content-end `}>
                      <button className={`btn ${displayView == "chart" ? "border" : ""}`} onClick={() => setView("chart")}>
                        <FaChartLine />
                      </button>
                      <button className={`btn ${displayView == "table" ? "border" : ""}`} onClick={() => setView("table")}>
                        <FaTable />
                      </button>
                    </div>
                    <Tab.Content>
                      <Tab.Pane eventKey="first">
                        <Tabs defaultActiveKey="Training" id="uncontrolled-tab-example" className="mb-3">
                          <Tab eventKey="Training" title="Training ">
                            {displayView == "chart" ? (
                              <RoundLineChart roundResults={trainingresults} title="Training metrics over rounds" />
                            ) : (
                              <ProgressTable serverRunning={serverRunning} currentRound={currentRound} roundResults={trainingresults} title="Training progress" />
                            )}
                          </Tab>

                          <Tab eventKey="profile" title="Evaluation">
                            {displayView == "chart" ? (
                              <RoundLineChart roundResults={roundResults} title="Evaluation metrics over rounds" />
                            ) : (
                              <ProgressTable serverRunning={serverRunning} currentRound={currentRound} roundResults={roundResults} title="Evaluation progress" />
                            )}
                          </Tab>
                        </Tabs>
                      </Tab.Pane>
                      <Tab.Pane eventKey="second">
                        <Tabs defaultActiveKey="Training" id="clients-tab" className="mb-3">
                          <Tab eventKey="Training" title="Training">
                            <ClientEvalLineChart clientEvalMetrics={clientTrainMetrics} />
                          </Tab>
                          <Tab eventKey="Evaluation" title="Evaluation">
                            <ClientEvalLineChart clientEvalMetrics={clientEvalMetrics} />
                          </Tab>
                        </Tabs>
                      </Tab.Pane>
                      <Tab.Pane eventKey="third">
                        <CommunicationFlow connectedClients={connectedClients} isAggregating={isAggregating} runningClients={runningClients} finished={finishedruning} currentRound={currentRound} />
                      </Tab.Pane>
                    </Tab.Content>
                  </Col>
                </Row>
              </Tab.Container>

              <hr />

              <div style={styles.logsContainer}>
                <div style={styles.logsHeader}>Server Logs</div>
                <div style={styles.logsContent}>
                  {serverLogs.length > 0 ? (
                    serverLogs.map((log, index) => (
                      <div key={index} style={styles.logEntry}>
                        {`[${new Date().toLocaleTimeString()}] ${log}`}
                      </div>
                    ))
                  ) : (
                    <div style={{ color: "#6c757d", fontStyle: "italic" }}>No logs yet. Start the server to see activity...</div>
                  )}
                </div>
              </div>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          {serverRunning ? (
            <div className="d-flex gap-3">
              {finishedruning ? (
                !isFileName ? (
                  <button className="btn btn-success text-nowrap" onClick={() => showFileName(true)}>
                    <span className="me-2">Save results</span>
                    <FaSave />
                  </button>
                ) : (
                  <div class="input-group">
                    <input type="text" class="form-control" placeholder="File name" value={fileName} onChange={(e) => setFileName(e.target.value)} />
                    <div class="input-group-append">
                      <button class="btn btn-success" type="button" onClick={saveResults}>
                        <FaSave />
                      </button>
                    </div>
                  </div>
                )
              ) : null}
              <button className="btn btn-secondary text-nowrap" onClick={stopServer}>
                <span className="me-2">Stop Server</span>
                <FaPause />
              </button>{" "}
            </div>
          ) : (
            <button className="btn btn-success" onClick={runServer}>
              <span className="me-2">Run Server</span>
              <FaPlay />
            </button>
          )}
        </Modal.Footer>
      </Modal>
    </div>
  )
}
export default ServerLogosModal
