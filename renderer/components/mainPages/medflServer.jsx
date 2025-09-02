import React, { useContext, useEffect, useState } from "react"
import ModulePage from "./moduleBasics/modulePage"
import dynamic from "next/dynamic"

// Dynamically import with SSR disabled
const SyntaxHighlighter = dynamic(() => import("react-syntax-highlighter").then((mod) => mod.Prism), { ssr: false })
import { IoCopyOutline } from "react-icons/io5"
import { FaWindows, FaApple, FaAngleRight, FaLaptop } from "react-icons/fa"
import { FcLinux } from "react-icons/fc"
import { vs } from "react-syntax-highlighter/dist/cjs/styles/prism"
import { requestBackend } from "../../utilities/requests"
import { WorkspaceContext } from "../workspace/workspaceContext"
import { toast } from "react-toastify"
import { ipcRenderer } from "electron"
import { Alert } from "react-bootstrap"

const MEDflSeverPage = ({ pageId, configPath = "" }) => {
  const [displayWelcomeMessage, setWelcomeMessage] = useState(configPath != "" ? false : true)

  const [flFlowType, setFlFlowType] = useState("fl") // this state has been implemented because of subflows implementation
  // Server configuration state
  const [serverAddress, setServerAddress] = useState("0.0.0.0:8080")
  const [numRounds, setNumRounds] = useState(10)
  const [fractionFit, setFractionFit] = useState(0.1)
  const [fractionEvaluate, setFractionEvaluate] = useState(0.1)
  const [minFitClients, setMinFitClients] = useState(2)
  const [minEvaluateClients, setMinEvaluateClients] = useState(2)
  const [minAvailableClients, setMinAvailableClients] = useState(3)
  const [strategy, setStrategy] = useState("FedAvg")
  const [serverRunning, setServerRunning] = useState(false)
  const { port } = useContext(WorkspaceContext)

  // Logs and monitoring state
  const [serverLogs, setServerLogs] = useState([])
  const [connectedClients, setConnectedClients] = useState([])
  const [currentRound, setCurrentRound] = useState(0)
  const [roundResults, setRoundResults] = useState([])

  const [serverPID, setServerPageId] = useState(null)
  const [waitingForClients, setWaitingForClients] = useState(false)
  const [nClients, setNClients] = useState(0)

  useEffect(() => {
    // ipcRenderer.removeAllListeners("log")
    ipcRenderer.on("log", (event, data) => {
      if (data.includes("Server started with PID")) {
        const match = data.match(/PID (\d+)/)
        if (match) {
          const pid = parseInt(match[1], 10)
          setServerPageId(pid)
        }
      }
      if (data.includes("Requesting initial parameters from one random client")) {
        setWaitingForClients(true)
      }
      if (data.includes("Client connected - CID:")) {
        console.log("Client connected:", data)

        // Extract CID using regex
        const match = data.match(/CID:\s*([a-fA-F0-9]+)/)
        if (!match) return // Exit if CID is not found

        const cid = match[1]
        console.log("Client connected with ID:", cid)

        setNClients((prev) => prev + 1)

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

      if (data.includes("Aggregated Evaluation Metrics")) {
        console.log("Detected aggregated evaluation metrics.")

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

        setCurrentRound((prev) => prev + 1)

        console.log(currentRound, "round completed")
        const result = {
          round: currentRound,
          loss,
          accuracy: metrics.eval_accuracy,
          clientsTrained: 3,
          timeTaken: (Math.random() * 3).toFixed(2), // Simulated time taken
          timestamp: new Date()
        }

        setRoundResults((prev) => [result, ...prev])

        console.log("Parsed Metrics:")
        console.log("  Loss:", loss)
        console.log("  eval_loss:", metrics.eval_loss)
        console.log("  eval_accuracy:", metrics.eval_accuracy)
        console.log("  eval_auc:", metrics.eval_auc)

        // You can now use setState or push to a list if needed
        // Example:
        // setEvalMetricsList(prev => [...prev, { round: 10, ...metrics }])
      }
    })
  }, [])

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
        port: serverAddress.split(":")[1]
      },
      (json) => {
        if (json.error) {
          toast.error("Error: " + json.error)
        } else {
          console.log(json)
          setServerPageId(json.pid)
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
          }
        },
        (err) => {
          console.error(err)
          // toast.error("Fetch failed")
          // setLoading(false)
        }
      )
  }
  // Simulate server operations
  useEffect(() => {
    let interval
    if (serverRunning) {
      // Simulate clients connecting
      const clients = [
        { id: "c1", name: "Workstation-01", os: "windows", joinedAt: new Date() },
        { id: "c2", name: "Mac-Pro-2023", os: "macos", joinedAt: new Date() },
        { id: "c3", name: "Ubuntu-Server", os: "linux", joinedAt: new Date() },
        { id: "c4", name: "Research-Laptop", os: "windows", joinedAt: new Date() }
      ]
      setConnectedClients(clients)

      // Simulate round progression
      let round = 1
      interval = setInterval(() => {
        if (round <= numRounds) {
          setCurrentRound(round)

          // Generate random metrics
          const loss = (Math.random() * 2).toFixed(4)
          const accuracy = (80 + Math.random() * 20).toFixed(2)
          const clientsTrained = Math.floor(minFitClients + Math.random() * 2)
          const timeTaken = (1 + Math.random() * 3).toFixed(2)

          const result = {
            round,
            loss,
            accuracy,
            clientsTrained,
            timeTaken,
            timestamp: new Date()
          }

          setRoundResults((prev) => [result, ...prev])
          setServerLogs((prev) => [`Round ${round}/${numRounds} completed`, `Results - Loss: ${loss}, Accuracy: ${accuracy}%`, ...prev])

          round++
        } else {
          clearInterval(interval)
          setServerLogs((prev) => ["Training completed!", ...prev])
        }
      }, 5000)
    } else {
      setConnectedClients([])
      setCurrentRound(0)
      setRoundResults([])
    }

    return () => clearInterval(interval)
  }, [serverRunning, numRounds, minFitClients])

  const handleStartServer = () => {
    setServerRunning(true)
    setServerLogs([`Starting Flower server at ${serverAddress}`, `Configuration: ${strategy} strategy, ${numRounds} rounds`, "Waiting for clients to connect..."])
  }

  const handleStopServer = () => {
    setServerRunning(false)
    setServerLogs((prev) => ["Server stopped by user", ...prev])
  }
  const generateConfigCode = () => {
    return `from MEDfl.rw.server.server import FederatedServer, Strategy


# Configure server strategy
strategy = ${strategy}(
    fraction_fit=${fractionFit},
    fraction_evaluate=${fractionEvaluate},
    min_fit_clients=${minFitClients},
    min_evaluate_clients=${minEvaluateClients},
    min_available_clients=${minAvailableClients}
)

custom_strategy = Strategy(
name=${strategy},
    fraction_fit=${fractionFit},
    fraction_evaluate=${fractionEvaluate},
    min_fit_clients=${minFitClients},
    min_evaluate_clients=${minEvaluateClients},
    min_available_clients=${minAvailableClients}
)


# Create server configuration
server = FederatedServer(
    host=${serverAddress.split(":")[0]},
    port=${serverAddress.split(":")[1]},
    num_rounds=${numRounds},
    strategy=custom_strategy,
)
server.start()
`
  }

  const renderOsIcon = (os) => {
    switch (os.toLowerCase()) {
      case "windows":
        return <FaWindows className="text-blue-500" />
      case "macos":
        return <FaApple />
      case "linux":
        return <FcLinux />
      case "darwin":
        return <FcLinux />
      default:
        return <FaLaptop />
    }
  }

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
    clientsContainer: {
      backgroundColor: "#f8f9fa",
      borderRadius: "8px",
      border: "1px solid #e9ecef",
      overflow: "hidden"
    },
    sectionHeader: {
      padding: "1rem",
      backgroundColor: "#f8f9fa",
      borderBottom: "1px solid #e9ecef",
      fontWeight: "500",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center"
    },
    clientsContent: {
      padding: "1rem",
      backgroundColor: "#fff"
    },
    clientItem: {
      display: "flex",
      alignItems: "center",
      padding: "0.75rem",
      borderBottom: "1px solid #f0f0f0"
    },
    clientIcon: {
      marginRight: "1rem",
      fontSize: "1.5rem"
    },
    clientInfo: {
      flex: 1
    },
    clientName: {
      fontWeight: "500"
    },
    clientOs: {
      fontSize: "0.85rem",
      color: "#666"
    },
    roundProgressContainer: {
      backgroundColor: "#f8f9fa",
      borderRadius: "8px",
      border: "1px solid #e9ecef",
      overflow: "hidden"
    },
    roundHeader: {
      display: "flex",
      alignItems: "center",
      padding: "1rem",
      backgroundColor: "#f8f9fa",
      borderBottom: "1px solid #e9ecef"
    },
    roundBadge: {
      backgroundColor: "#007bff",
      color: "white",
      borderRadius: "20px",
      padding: "0.25rem 0.75rem",
      fontSize: "0.85rem",
      fontWeight: "500",
      marginRight: "1rem"
    },
    roundContent: {
      padding: "1rem",
      backgroundColor: "#fff"
    },
    resultsTable: {
      width: "100%",
      borderCollapse: "collapse",
      fontSize: "0.85rem"
    },
    tableHeader: {
      backgroundColor: "#f0f0f0",
      textAlign: "left",
      padding: "0.5rem"
    },
    tableCell: {
      padding: "0.5rem",
      borderBottom: "1px solid #f0f0f0"
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
    }
  }
  return (
    <>
      <ModulePage pageId={pageId} configPath={configPath}>
        <div style={styles.container}>
          <div style={styles.header}>
            <h1 style={styles.title}>Federated Learning Server Management</h1>
            <p style={styles.subtitle}>Configure and manage your central Flower server</p>
          </div>

          <div style={styles.content}>
            <div style={styles.configPanel}>
              <h2 style={{ marginTop: 0, marginBottom: "1.5rem" }}>Server Configuration</h2>

              <div style={styles.formGroup}>
                <label style={styles.label}>Server Address:</label>
                <input type="text" value={serverAddress} onChange={(e) => setServerAddress(e.target.value)} placeholder="0.0.0.0:8080" style={styles.input} />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Number of Rounds:</label>
                <input type="number" value={numRounds} onChange={(e) => setNumRounds(e.target.value)} style={styles.input} min="1" />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Fraction Fit:</label>
                  <input type="number" value={fractionFit} onChange={(e) => setFractionFit(e.target.value)} step="0.1" min="0.1" max="1.0" style={styles.input} />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Fraction Evaluate:</label>
                  <input type="number" value={fractionEvaluate} onChange={(e) => setFractionEvaluate(e.target.value)} step="0.1" min="0.1" max="1.0" style={styles.input} />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Min Fit Clients:</label>
                  <input type="number" value={minFitClients} onChange={(e) => setMinFitClients(e.target.value)} min="1" style={styles.input} />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Min Evaluate Clients:</label>
                  <input type="number" value={minEvaluateClients} onChange={(e) => setMinEvaluateClients(e.target.value)} min="1" style={styles.input} />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Min Available Clients:</label>
                  <input type="number" value={minAvailableClients} onChange={(e) => setMinAvailableClients(e.target.value)} min="1" style={styles.input} />
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Strategy:</label>
                <select value={strategy} onChange={(e) => setStrategy(e.target.value)} style={styles.select}>
                  <option value="FedAvg">FedAvg</option>
                  <option value="FedAdam">FedAdam</option>
                  <option value="FedAdagrad">FedAdagrad</option>
                  <option value="FedYogi">FedYogi</option>
                  <option value="QFedAvg">QFedAvg</option>
                </select>
              </div>

              <div style={styles.buttonGroup}>
                <button onClick={runServer} style={styles.startButton} disabled={serverRunning}>
                  {serverRunning ? "Server Running" : "Start Server"} {serverPID}
                </button>
                <button onClick={stopServer} style={styles.stopButton}>
                  Stop Server
                </button>
              </div>
            </div>

            <div style={styles.codePreview}>
              <div style={styles.codeHeader}>
                <h3 style={{ margin: 0 }}>Configuration Code</h3>
                <button onClick={() => navigator.clipboard.writeText(generateConfigCode())} className="btn">
                  <IoCopyOutline />
                </button>
              </div>
              <SyntaxHighlighter
                language="python"
                style={vs}
                customStyle={{
                  maxHeight: "500px",
                  borderRadius: "0",
                  padding: "1rem",
                  margin: 0
                }}
              >
                {generateConfigCode()}
              </SyntaxHighlighter>
            </div>
          </div>
          {waitingForClients && (
            <Alert variant={nClients < minAvailableClients ? "warning" : "success"} className="shadow-sm rounded">
              <strong>Info:</strong> Server running, {nClients < minAvailableClients ? `Waiting for ${minAvailableClients - nClients} clients to connect` : "All clients are connected"}
            </Alert>
          )}
          <div style={styles.monitoringSection}>
            {/* Connected Clients Panel */}
            <div style={styles.clientsContainer}>
              <div style={styles.sectionHeader}>
                <h3 style={{ margin: 0 }}>Connected Clients</h3>
                <span>{connectedClients.length} active</span>
              </div>
              <div style={styles.clientsContent}>
                {connectedClients.length > 0 ? (
                  connectedClients.map((client) => (
                    <div key={client.id} style={styles.clientItem}>
                      <div style={styles.clientIcon}>{renderOsIcon(client.os)}</div>
                      <div style={styles.clientInfo}>
                        <div style={styles.clientName}>{client.name != "" ? client.name : client.id}</div>
                        <div style={styles.clientOs}>{client.os}</div>
                      </div>
                      <div style={{ color: "#28a745", fontSize: "0.85rem" }}>Active</div>
                    </div>
                  ))
                ) : (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "2rem",
                      color: "#6c757d"
                    }}
                  >
                    No clients connected
                  </div>
                )}
              </div>
            </div>

            {/* Round Progress Panel */}
            <div style={styles.roundProgressContainer}>
              <div style={styles.sectionHeader}>
                <h3 style={{ margin: 0 }}>Training Progress</h3>
                {currentRound > 0 && (
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <div style={styles.roundBadge}>
                      Round {currentRound} of {numRounds}
                    </div>
                    <div style={{ color: "#28a745", fontWeight: "500" }}>{Math.round((currentRound / numRounds) * 100)}%</div>
                  </div>
                )}
              </div>
              <div style={styles.roundContent}>
                {roundResults.length > 0 ? (
                  <table style={styles.resultsTable}>
                    <thead>
                      <tr>
                        <th style={styles.tableHeader}>Round</th>
                        <th style={styles.tableHeader}>Loss</th>
                        <th style={styles.tableHeader}>Accuracy</th>
                        <th style={styles.tableHeader}>Clients</th>
                        <th style={styles.tableHeader}>Time (s)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {roundResults.map((result, index) => (
                        <tr key={index}>
                          <td style={styles.tableCell}>{result.round}</td>
                          <td style={styles.tableCell}>{result.loss}</td>
                          <td style={styles.tableCell}>{result.accuracy}%</td>
                          <td style={styles.tableCell}>{result.clientsTrained}</td>
                          <td style={styles.tableCell}>{result.timeTaken}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "2rem",
                      color: "#6c757d"
                    }}
                  >
                    {serverRunning ? "Waiting for first round..." : "Start server to begin training"}
                  </div>
                )}
              </div>
            </div>
          </div>
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
        </div>
      </ModulePage>
    </>
  )
}

export default MEDflSeverPage
