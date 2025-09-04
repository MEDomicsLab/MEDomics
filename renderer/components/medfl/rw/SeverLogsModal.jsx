import React, { useState, useEffect, useContext } from "react"
import { FiMail, FiPaperclip, FiSend } from "react-icons/fi"
import { Modal, Tabs } from "react-bootstrap"
import { ipcRenderer } from "electron"

import { Alert } from "react-bootstrap"
import { FaDatabase, FaServer, FaSpinner } from "react-icons/fa6"
import FederatedNetworkConfigView from "./NetworkConfig"
import { FaApple, FaChartLine, FaFileAlt, FaLaptop, FaNetworkWired, FaPause, FaPlay, FaSave, FaTable, FaWindows } from "react-icons/fa"
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
import ClientDetails from "./ClientDetails"
import ConnectedWSAgents from "./ConnectedWSAgents"
import { FcLinux } from "react-icons/fc"
import ClientLogs from "./ClientLogs"
import { Message } from "primereact/message"
import { start } from "repl"

const ServerLogosModal = ({ show, onHide, nodes, onSaveScean, setRunServer, configs }) => {
  const { port } = useContext(WorkspaceContext)
  const { config, pageId, configPath } = useContext(PageInfosContext)

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
  const [waitingForServer, setWaitingForServer] = useState(false)
  const [clientProperties, setClientProperties] = useState({})
  const [isListening, setIsListening] = useState(false)

  // Configuration state
  const [strategy, setStrategy] = useState(strategyConfigs[0]?.data.internal.settings.strategy || "FedAvg")
  const [serverAddress, setServerAddress] = useState(strategyConfigs[0]?.data.internal.settings.serverAddress || "0.0.0.0:8080")
  const [numRounds, setNumRounds] = useState(strategyConfigs[0]?.data.internal.settings.numRounds || 10)
  const [fractionFit, setFractionFit] = useState(strategyConfigs[0]?.data.internal.settings.fractionFit || 1)
  const [fractionEvaluate, setFractionEvaluate] = useState(strategyConfigs[0]?.data.internal.settings.fractionEvaluate || 1)
  const [minFitClients, setMinFitClients] = useState(strategyConfigs[0]?.data.internal.settings.minFitClients || 3)
  const [minEvaluateClients, setMinEvaluateClients] = useState(strategyConfigs[0]?.data.internal.settings.minEvaluateClients || 3)
  const [minAvailableClients, setMinAvailableClients] = useState(strategyConfigs[0]?.data.internal.settings.minAvailableClients || 3)

  const [currentExecConfig, setCurrentExecConfig] = useState(0)
  const [startRunningConfig, setStartRunningConfig] = useState(false)

  // for saving the results
  const [fileName, setFileName] = useState("")
  const [isFileName, showFileName] = useState(false)

  // for saving the scean , model and results
  const [savingPath, setSavingPath] = useState("")

  const [wsAgents, setWSAgents] = React.useState(null) // e.g., ["DESKTOP-ENI5U7G-windows"]
  const [selectedAgents, setSelectedAgents] = React.useState([]) // { "DESKTOP-...": true }
  const [datasetStats, setDatasetStats] = React.useState({})

  const [canRun, setCanRun] = React.useState(false)

  // context
  const { globalData } = useContext(DataContext)

  const [experimentConfig, setConfig] = useState(null)

  const getConfigInfos = () => {
    console.log("this is the nodes", configs)
    let fullConfig = []
    configs.map((config, index) => {
      fullConfig[index] = {}
      Object.keys(config).map((key) => {
        let nodeId = config[key].id
        let [nodeData, nodeType] = getNodeById(nodeId)

        fullConfig[index][nodeType == "groupNode" ? "Network" : nodeType] = nodeData
      })
    })

    setConfig(fullConfig)
    console.log(fullConfig)
  }

  useEffect(() => {
    setConfig(null)
  }, [show])

  const getNodeById = (id) => {
    let n
    let nodeType

    nodes.forEach((node) => {
      if (node.id == id) {
        switch (node.type) {
          case "groupNode":
            n = {
              name: node.data.internal.name,
              clients: []
            }
            nodes.forEach((client) => {
              if (client.data.internal.subflowId == node.id) {
                if (client.type == "flClientNode") {
                  n.clients = [
                    ...n.clients,
                    {
                      name: client.data.internal.name,
                      type: client.data.internal.settings.nodeType,
                      dataset: client.data.internal.settings.Node_Dataset
                    }
                  ]
                } else {
                  n.server = {
                    name: client.data.internal.name,
                    nRounds: client.data.internal.settings.nRounds,
                    activateDP: client.data.internal.settings.diffPrivacy
                  }
                  if (client.data.internal.settings.diffPrivacy == "Activate") {
                    n.server = {
                      ...n.server,
                      delta: client.data.internal.settings.delta,
                      alpha: client.data.internal.settings.alpha
                    }
                  } else {
                    n.server.delta && delete n.server.delta
                    n.server.alpha && delete n.server.alpha
                  }
                }
              }
            })

            break

          case "flModelNode":
            if (node.data.internal.settings.activateTl == "false") {
              delete node.data.internal.settings.file
            } else {
              delete node.data.internal.settings["Model type"]
              delete node.data.internal.settings["Hidden size"]
              delete node.data.internal.settings["Number of layers"]
            }
            n = node.data.internal.settings

            break
          case "flStrategyNode":
            n = node.data.internal.settings
            break

          default:
            n = node.data.internal.settings

            break
        }
        nodeType = node.type
      }
    })

    return [n, nodeType]
  }

  useEffect(() => {
    if (!experimentConfig) getConfigInfos()
  }, [experimentConfig, configs])

  const renderOsIcon = (os) => {
    const osName = os?.toLowerCase()
    if (!osName) return <FaLaptop className="text-secondary" />
    if (osName.includes("linux")) return <FcLinux size={25} />
    if (osName.includes("windows")) return <FaWindows style={{ color: "#357EC7" }} />
    if (osName.includes("mac") || osName.includes("darwin")) return <FaApple />
    return <FaLaptop className="text-secondary" />
  }

  const saveResults = async () => {
    try {
      // do custom actions in the folder while it is unzipped

      let dirPath = ""
      if (configPath != "") {
        const base = configPath.slice(configPath.lastIndexOf("/") + 1)

        dirPath = configPath.substring(0, configPath.lastIndexOf("/"))
      } else {
        dirPath = savingPath != "" ? savingPath : await onSaveScean(fileName)
      }

      let data = {
        config: { strategy, numRounds, id: dirPath.slice(dirPath.lastIndexOf("/") + 1) },
        devices,
        trainingResults: trainingresults,
        evaluationResults: roundResults,
        clientTrainMetrics,
        clientEvalMetrics,
        clientProperties,
        connectedClients
      }

      console.log("Saving results to directory:", dirPath, "with file name:", fileName)
      await MedDataObject.writeFileSync({ data, date: Date.now() }, dirPath, fileName, "json")
      await MedDataObject.writeFileSync({ data, date: Date.now() }, dirPath, fileName, "medflrw")

      toast.success("Experimentation results saved successfully")
    } catch {
      toast.error("Something went wrong ")
    }
  }

  useEffect(() => {
    setRunServer(serverRunning)
  }, [serverRunning])
  useEffect(() => {
    if (strategyConfigs && strategyConfigs.length > 0) {
      const config = strategyConfigs[0].data.internal.settings
      console.log("Strategy config loaded:", config)
      setStrategy(config.strategy || "FedAvg")
      setServerAddress(config.serverAddress || "")
      setNumRounds(config.numRounds || 10)
      setFractionFit(config.fractionFit || 1)
      setFractionEvaluate(config.fractionEvaluate || 1)
      setMinFitClients(config.minFitClients || 3)
      setMinEvaluateClients(config.minEvaluateClients || 3)
      setMinAvailableClients(config.minAvailableClients || 3)

      const isSaveModel = strategyConfigs[0].data.internal.settings.isSaveModel || false
      setTheSavingpath(isSaveModel)
    }
  }, [strategyConfigs])

  const setTheSavingpath = async (isSaveModel) => {
    if (isSaveModel) {
      console.log("Saving path is set to:", savingPath)
      if (savingPath != "") return
      const savePath = await onSaveScean("FL_scean")
      setSavingPath(savePath)
    } else {
      setSavingPath("")
    }
  }

  useEffect(() => {
    setModelConfigs(nodes?.filter((node) => node.type == "flModelNode") || [])
    setStrategyConfigs(nodes?.filter((node) => node.type == "flRunServerNode") || [])
  }, [nodes])

  const current = React.useRef(null)

  useEffect(() => {
    // ipcRenderer.removeAllListeners("log")
    isListening &&
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
          setWaitingForServer(false)
        }
        if (data.includes("Finished running script")) {
          setWaitingForClients(false)
          setFinished(true)
          setIsListening(false)

          if (experimentConfig.length == currentExecConfig) {
            setStartRunningConfig(false)
            setCurrentExecConfig(0)
          } else {
            setCurrentExecConfig((prev) => prev + 1)
          }
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

        if (data.includes("Properties:")) {
          setIsAggregating(false)
          console.log("Processing Properties entry ▶", data)

          // Match “📋” anywhere, then capture a mixed‑case hex CID, then the dict
          const regex = /📋.*Client\s+([A-Fa-f0-9]+)\s+Properties:\s*(\{.*\})/
          const m = data.match(regex)
          if (!m) {
            console.warn("Properties regex did not match CID:", data)
            return
          }

          const cid = m[1]
          const propsJson = m[2].replace(/'/g, '"')
          let props
          try {
            props = JSON.parse(propsJson)
          } catch (err) {
            console.error("❌ Failed to JSON‑parse props:", propsJson, err)
            return
          }

          const entry = { id: cid, ...props }
          const host = props.hostname

          setClientProperties((prev) => {
            const bucket = prev[host] || []
            // Only add if not already present
            if (bucket.some((item) => item.id === cid)) {
              console.log(`Client ${cid} @ ${host} already recorded, skipping.`)
              return prev
            }
            const next = {
              ...prev,
              [host]: [...bucket, entry]
            }
            console.log("Updated clientProperties ▶", next)
            return next
          })
        }
      })
  }, [isListening])

  const styles = {
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

  const runServer = () => {
    setIsListening(true)
    setWaitingForServer(true)
    requestBackend(
      port,
      "/medfl/rw/run-server/" + pageId,
      {
        strategy_name: strategy,
        serverAddress: serverAddress,
        num_rounds: numRounds,
        fraction_fit: fractionFit,
        fraction_evaluate: fractionEvaluate,
        min_fit_clients: minAvailableClients,
        min_evaluate_clients: minAvailableClients,
        min_available_clients: minAvailableClients,
        port: serverAddress?.split(":")[1],
        use_transfer_learning: modelConfigs[0]?.data.internal.settings.activateTl == "true" ? true : false,
        pretrained_model_path: modelConfigs[0]?.data.internal.settings.file.path || "",
        local_epochs: modelConfigs[0]?.data.internal.settings["Local epochs"] || 1,
        threshold: modelConfigs[0]?.data.internal.settings.Threshold || 0.5,
        optimizer: modelConfigs[0]?.data.internal.settings.optimizer || "SGD",
        learning_rate: modelConfigs[0]?.data.internal.settings["Learning rate"] || 0.01,
        savingPath: savingPath + "/models",
        saveOnRounds: strategyConfigs[0]?.data.internal.settings.saveOnRounds || 5
      },
      (json) => {
        if (json.error) {
          toast.error("Error: " + json.error)
        } else {
          MedDataObject.updateWorkspaceDataObject()
        }
      },
      (err) => {
        console.error(err)
        // toast.error("Fetch failed")
        // setLoading(false)
      }
    )

    const selectedClients = Object.keys(selectedAgents).filter((key) => selectedAgents[key])

    selectedClients.reduce((promise, client) => {
      return promise.then(() => {
        return new Promise((resolve) => {
          requestBackend(
            port,
            "/medfl/rw/ws/run/" + pageId,
            {
              id: client,
              ServerAddr: "100.65.215.27:8080",
              DP: "none"
            },
            (json) => {
              if (json.error) {
                toast.error("Error: " + json.error)
              } else {
                console.log("Client connected:", json)
                toast.success("Client " + client + " connected successfully")
              }
            },
            (err) => {
              console.error(err)
            }
          )
          setTimeout(resolve, 1000)
        })
      })
    }, Promise.resolve())
  }

  useEffect(() => {
    if (startRunningConfig && currentExecConfig < experimentConfig?.length) {
      runServerWithMultipleConfigs(experimentConfig[currentExecConfig], currentExecConfig)
    }
  }, [startRunningConfig, currentExecConfig])

  const runServerWithMultipleConfigs = (conf, index) => {
    setIsListening(true)
    setWaitingForServer(true)
    console.log("experimentConfig", experimentConfig)
    console.log("selectedAgents", selectedAgents)

    console.log("Ruuning config ", index)
    requestBackend(
      port,
      "/medfl/rw/run-server/" + pageId,
      {
        strategy_name: conf.flRunServerNode.strategy,
        // serverAddress: conf.flRunServerNode.serverAddress,
        serverAddress: "0.0.0.0:808" + String(index),
        num_rounds: conf.flRunServerNode.numRounds,
        fraction_fit: conf.flRunServerNode.fractionFit,
        fraction_evaluate: conf.flRunServerNode.fractionEvaluate,
        min_fit_clients: Object.keys(selectedAgents[index]).length,
        min_evaluate_clients: Object.keys(selectedAgents[index]).length,
        min_available_clients: Object.keys(selectedAgents[index]).length,
        port: "808" + String(index),
        use_transfer_learning: conf.flModelNode.activateTl == "true" ? true : false,
        pretrained_model_path: conf.flModelNode.file.path || "",
        local_epochs: conf.flModelNode["Local epochs"] || 1,
        threshold: conf.flModelNode.Threshold || 0.5,
        optimizer: conf.flModelNode.optimizer || "SGD",
        learning_rate: conf.flModelNode["Learning rate"] || 0.01,
        savingPath: savingPath + "/models",
        saveOnRounds: conf.flRunServerNode.saveOnRounds || 5
      },
      (json) => {
        if (json.error) {
          toast.error("Error: " + json.error)
        } else {
          MedDataObject.updateWorkspaceDataObject()
        }
      },
      (err) => {
        console.error(err)
        // toast.error("Fetch failed")
        // setLoading(false)
      }
    )

    const selectedClients = Object.keys(selectedAgents[index]).filter((key) => selectedAgents[index][key])

    selectedClients.reduce((promise, client) => {
      return promise.then(() => {
        return new Promise((resolve) => {
          requestBackend(
            port,
            "/medfl/rw/ws/run/" + pageId,
            {
              id: client,
              ServerAddr: "100.65.215.27:808" + String(index),
              DP: "none"
            },
            (json) => {
              if (json.error) {
                toast.error("Error: " + json.error)
              } else {
                console.log("Client connected:", json)
                toast.success("Client " + client + " connected successfully")
              }
            },
            (err) => {
              console.error(err)
            }
          )
          setTimeout(resolve, 1000)
        })
      })
    }, Promise.resolve())
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
            setClientProperties({})
          }
        },
        (err) => {
          console.error(err)
          // toast.error("Fetch failed")
          // setLoading(false)
        }
      )
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
          // setSelectedAgents((prev) => {
          //   const next = {}
          //   agents.forEach((a) => (next[a] = !!prev[a]))
          //   return next
          // })
          console.log("WS Agents set:", agents)
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
              {/* <FederatedNetworkConfigView
                config={{
                  server: { rounds: numRounds, strategy: strategy },
                  model: modelConfigs[0]?.data.internal.settings || {},
                  savingPath: savingPath
                }}
                setDevices={setDevices}
              /> */}

              {experimentConfig?.length > 0 ? (
                <Tabs defaultActiveKey="conf0" id="uncontrolled-tab-example" className="mb-3">
                  {experimentConfig?.map((config, index) => {
                    return (
                      <Tab key={index} eventKey={"conf" + index} title={"Configuration " + (index + 1)}>
                        {Object.keys(config).map((key) =>
                          key != "Network" ? (
                            <div className="card shadow-sm border-0 mb-3">
                              <div
                                className="card-header fw-semibold"
                                style={{
                                  background: "var(--bs-primary-bg-subtle)",
                                  color: "var(--bs-emphasis-color)",
                                  fontSize: 16
                                }}
                              >
                                {key}
                              </div>

                              <div className="card-body p-3">
                                <div className="bg-body-tertiary rounded p-2">
                                  <JsonView data={config[key]} shouldExpandNode={allExpanded} />
                                </div>
                              </div>
                            </div>
                          ) : (
                            <ConnectedWSAgents
                              wsAgents={wsAgents}
                              selectedAgents={selectedAgents[index] || {}}
                              setSelectedAgents={(value) =>
                                setSelectedAgents((prev) => {
                                  const next = [...prev]
                                  next[index] = value // replace value at index
                                  return next
                                })
                              }
                              setMinAvailableClients={setMinAvailableClients}
                              getWSAgents={getWSAgents}
                              setCanRun={setCanRun}
                              renderOsIcon={renderOsIcon}
                            ></ConnectedWSAgents>
                          )
                        )}
                      </Tab>
                    )
                  })}
                </Tabs>
              ) : (
                <div className="text-center fs-3">
                  <Message severity="info" text="    You have no configurations !! " className="w-100   " />
                </div>
              )}
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
                      <Nav.Item>
                        <Nav.Link eventKey="fourth">
                          <FaDatabase />
                        </Nav.Link>
                      </Nav.Item>
                      <Nav.Item>
                        <Nav.Link eventKey="fifth">
                          <FaFileAlt />
                        </Nav.Link>
                      </Nav.Item>
                    </Nav>
                  </Col>
                  <Col sm={11}>
                    {/* <div className={`d-flex justify-content-end `}>
                      <button className={`btn ${displayView == "chart" ? "border" : ""}`} onClick={() => setView("chart")}>
                        <FaChartLine />
                      </button>
                      <button className={`btn ${displayView == "table" ? "border" : ""}`} onClick={() => setView("table")}>
                        <FaTable />
                      </button>
                    </div> */}
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
                      <Tab.Pane eventKey="fourth">
                        <ClientDetails clientProperties={clientProperties} />
                      </Tab.Pane>
                      <Tab.Pane eventKey="fifth">
                        <ClientLogs
                          clients={wsAgents.map((agent) => {
                            return { id: agent }
                          })}
                          pageId={pageId}
                          port={port}
                        />
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
            <button
              className="btn btn-success w-25"
              onClick={() => {
                setStartRunningConfig(true)
              }}
              disabled={waitingForServer}
            >
              <span className="me-2"> {waitingForServer ? "waiting for server" : "Run Server"} </span>
              {waitingForServer ? <FaSpinner /> : <FaPlay />}
            </button>
          )}
        </Modal.Footer>
      </Modal>
    </div>
  )
}
export default ServerLogosModal
