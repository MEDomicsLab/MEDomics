import React, { useState, useEffect, useContext, useRef } from "react"
import { Modal, Tabs, Tab, Alert } from "react-bootstrap"
import { ipcRenderer } from "electron"
import { FaDatabase, FaServer, FaSpinner } from "react-icons/fa6"
import { FaApple, FaChartLine, FaCode, FaFileAlt, FaLaptop, FaNetworkWired, FaPause, FaPlay, FaSave, FaTable, FaWindows } from "react-icons/fa"
import Col from "react-bootstrap/Col"
import Nav from "react-bootstrap/Nav"
import Row from "react-bootstrap/Row"
import { toast } from "react-toastify"
import { JsonView, allExpanded } from "react-json-view-lite"

import FederatedNetworkConfigView from "./NetworkConfig"
import RoundLineChart from "./RoundLine"
import ClientEvalLineChart from "./ ClientsLineChart"
import ClientConnectionPanel from "./ConnectedClients"
import ProgressTable from "./ProgressTable"
import CommunicationFlow from "./CommunicationFlow"
import ClientDetails from "./ClientDetails"
import ConnectedWSAgents from "./ConnectedWSAgents"
import ClientLogs from "./ClientLogs"

import MedDataObject from "../../workspace/medDataObject"
import { requestBackend } from "../../../utilities/requests"
import { WorkspaceContext } from "../../workspace/workspaceContext"
import { PageInfosContext } from "../../mainPages/moduleBasics/pageInfosContext"
import { DataContext } from "../../workspace/dataContext"
import { FcLinux } from "react-icons/fc"
import { Message } from "primereact/message"

import { Form, Button } from "react-bootstrap"

import { buildNotebookText, buildServerNotebookText } from "../../../utilities/medfl/flUtils"

// ---------- helpers ----------
const ensureIndex = (arr, index, initValue) => {
  const next = Array.isArray(arr) ? [...arr] : []
  while (next.length <= index) next.push(typeof initValue === "function" ? initValue() : Array.isArray(initValue) ? [...initValue] : initValue)
  return next
}
const pushUniqueBy = (list, item, pred) => (list.some(pred) ? list : [...list, item])

const styles = {
  logsContainer: { backgroundColor: "#f8f9fa", borderRadius: "8px", border: "1px solid #e9ecef", overflow: "hidden" },
  logsHeader: { padding: "1rem", backgroundColor: "#f8f9fa", borderBottom: "1px solid #e9ecef", fontWeight: "500" },
  logsContent: { minHeight: "200px", maxHeight: "300px", overflowY: "auto", padding: "1rem", fontFamily: "monospace", fontSize: "0.85rem", backgroundColor: "#fff" },
  logEntry: { padding: "0.25rem 0", borderBottom: "1px solid #f0f0f0" }
}

const NewServerLogsModal = ({ show, onHide, nodes, onSaveScean, setRunServer, configs, datasetConfig }) => {
  const { port } = useContext(WorkspaceContext)
  const { pageId, configPath } = useContext(PageInfosContext)
  const { globalData } = useContext(DataContext)

  const [configToCode, setConfigToCode] = useState(0)
  const [code, setCode] = useState("")

  // ---------- config discovery ----------
  const [experimentConfig, setConfig] = useState(null)
  const [strategyConfigs, setStrategyConfigs] = useState(nodes?.filter((n) => n.type === "flRunServerNode") || [])
  const [modelConfigs, setModelConfigs] = useState(nodes?.filter((n) => n.type === "flModelNode") || [])

  const getNodeById = (id) => {
    let n, nodeType
    nodes.forEach((node) => {
      if (node.id === id) {
        switch (node.type) {
          case "groupNode": {
            n = { name: node.data.internal.name, clients: [] }
            nodes.forEach((client) => {
              if (client.data.internal.subflowId === node.id) {
                if (client.type === "flClientNode") {
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
                  if (client.data.internal.settings.diffPrivacy === "Activate") {
                    n.server = { ...n.server, delta: client.data.internal.settings.delta, alpha: client.data.internal.settings.alpha }
                  } else {
                    n.server?.delta && delete n.server.delta
                    n.server?.alpha && delete n.server.alpha
                  }
                }
              }
            })
            break
          }
          case "flModelNode": {
            if (node.data.internal.settings.activateTl === "false") {
              delete node.data.internal.settings.file
            } else {
              delete node.data.internal.settings["Model type"]
              delete node.data.internal.settings["Hidden size"]
              delete node.data.internal.settings["Number of layers"]
            }
            n = node.data.internal.settings
            break
          }
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

  const getConfigInfos = () => {
    let fullConfig = []
    configs?.forEach((config, index) => {
      fullConfig[index] = {}
      Object.keys(config).forEach((key) => {
        const nodeId = config[key].id
        const [nodeData, nodeType] = getNodeById(nodeId)
        fullConfig[index][nodeType === "groupNode" ? "Network" : nodeType] = nodeData
      })
    })
    setConfig(fullConfig)
  }

  useEffect(() => setConfig(null), [show])
  useEffect(() => {
    if (!experimentConfig) getConfigInfos()
  }, [experimentConfig, configs])
  useEffect(() => {
    setModelConfigs(nodes?.filter((n) => n.type === "flModelNode") || [])
    setStrategyConfigs(nodes?.filter((n) => n.type === "flRunServerNode") || [])
  }, [nodes])

  // ---------- global & per-config runtime ----------
  const [serverRunning, setServerRunning] = useState(false)
  const [displayView, setView] = useState("chart")
  const [devices, setDevices] = useState({})
  const [serverPID, setServerPageId] = useState(null)
  const [currentRound, setCurrentRound] = useState(0)

  // important: which config is executing now
  const [currentExecConfig, setCurrentExecConfig] = useState(0)
  const currentExecConfigRef = useRef(0)
  useEffect(() => {
    currentExecConfigRef.current = currentExecConfig
  }, [currentExecConfig])

  // selection, ws agents
  const [wsAgents, setWSAgents] = useState(null)
  const [selectedAgents, setSelectedAgents] = useState([]) // array of maps per index
  const [minAvailableClients, setMinAvailableClients] = useState(3)
  const [canRun, setCanRun] = useState(false)

  // per-config buckets (arrays indexed by config)
  const [serverLogs, setServerLogs] = useState([]) // [[], [], ...]
  const [connectedClients, setConnectedClients] = useState([]) // [[], [], ...]
  const [trainingresults, setTraningResulsts] = useState([]) // [[], [], ...]
  const [roundResults, setRoundResults] = useState([]) // [[], [], ...]
  const [clientTrainMetrics, setClientTrainMetrics] = useState([]) // [[], [], ...]
  const [clientEvalMetrics, setClientEvalMetrics] = useState([]) // [[], [], ...]
  const [runningClients, setRunningClients] = useState([]) // [[], [], ...]
  const [clientProperties, setClientProperties] = useState([]) // [{host:[...]}, {...}, ...]

  // per-config flags
  const [isAggregating, setIsAggregating] = useState([]) // [bool,bool,...]
  const [waitingForClients, setWaitingForClients] = useState([]) // [bool,bool,...]
  const [waitingForServer, setWaitingForServer] = useState([]) // [bool,bool,...]
  const [finishedruning, setFinished] = useState([]) // [bool,bool,...]
  const [isListening, setIsListening] = useState(false)

  // strategy/model form defaults (kept as-is)
  const [strategy, setStrategy] = useState(strategyConfigs[0]?.data.internal.settings.strategy || "FedAvg")
  const [serverAddress, setServerAddress] = useState(strategyConfigs[0]?.data.internal.settings.serverAddress || "0.0.0.0:8080")
  const [numRounds, setNumRounds] = useState(strategyConfigs[0]?.data.internal.settings.numRounds || 10)
  const [fractionFit, setFractionFit] = useState(strategyConfigs[0]?.data.internal.settings.fractionFit || 1)
  const [fractionEvaluate, setFractionEvaluate] = useState(strategyConfigs[0]?.data.internal.settings.fractionEvaluate || 1)
  const [minFitClients, setMinFitClients] = useState(strategyConfigs[0]?.data.internal.settings.minFitClients || 3)
  const [minEvaluateClients, setMinEvaluateClients] = useState(strategyConfigs[0]?.data.internal.settings.minEvaluateClients || 3)
  const [minAvailableClientsForm, setMinAvailableClientsForm] = useState(strategyConfigs[0]?.data.internal.settings.minAvailableClients || 3)

  const [startRunningConfig, setStartRunningConfig] = useState(false)
  const [fileName, setFileName] = useState("")
  const [isFileName, showFileName] = useState(false)
  const [savingPath, setSavingPath] = useState("")

  // when experimentConfig changes, ensure buckets are sized
  useEffect(() => {
    const n = experimentConfig?.length || 0
    if (!n) return
    setServerLogs((prev) => ensureIndex(prev, n - 1, []))
    setConnectedClients((prev) => ensureIndex(prev, n - 1, []))
    setTraningResulsts((prev) => ensureIndex(prev, n - 1, []))
    setRoundResults((prev) => ensureIndex(prev, n - 1, []))
    setClientTrainMetrics((prev) => ensureIndex(prev, n - 1, []))
    setClientEvalMetrics((prev) => ensureIndex(prev, n - 1, []))
    setRunningClients((prev) => ensureIndex(prev, n - 1, []))
    setClientProperties((prev) => ensureIndex(prev, n - 1, {}))
    setIsAggregating((prev) => ensureIndex(prev, n - 1, false))
    setWaitingForClients((prev) => ensureIndex(prev, n - 1, false))
    setWaitingForServer((prev) => ensureIndex(prev, n - 1, false))
    setFinished((prev) => ensureIndex(prev, n - 1, false))
    setSelectedAgents((prev) => ensureIndex(prev, n - 1, {}))
  }, [experimentConfig])

  const resetResults = () => {
    setServerLogs([])
    setConnectedClients([])
    setTraningResulsts([])
    setRoundResults([])
    setClientTrainMetrics([])
    setClientEvalMetrics([])
    setRunningClients([])
    setClientProperties([])
  }
  // saving path (unchanged)
  useEffect(() => setRunServer(serverRunning), [serverRunning])
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
      setMinAvailableClientsForm(config.minAvailableClients || 3)
      const isSaveModel = strategyConfigs[0].data.internal.settings.isSaveModel || false
      setTheSavingpath(isSaveModel)
    }
  }, [strategyConfigs])

  const setTheSavingpath = async (isSaveModel) => {
    if (isSaveModel) {
      if (savingPath !== "") return
      const savePath = await onSaveScean("FL_scean")
      setSavingPath(savePath)
    } else {
      setSavingPath("")
    }
  }

  // ---------- IPC: write to currentExecConfig buckets ----------
  useEffect(() => {
    if (!isListening) return
    const onLog = (event, data) => {
      const idx = currentExecConfigRef.current

      // per-config log
      setServerLogs((prev) => {
        const next = ensureIndex(prev, idx, [])
        next[idx] = [...(next[idx] || []), data]
        return next
      })

      if (data.includes("Server started with PID")) {
        const m = data.match(/PID (\d+)/)
        if (m) setServerPageId(parseInt(m[1], 10))
      }

      if (data.includes("Starting Flower server")) {
        setIsAggregating((prev) => {
          const next = ensureIndex(prev, idx, false)
          next[idx] = true
          return next
        })
        setWaitingForClients((prev) => {
          const next = ensureIndex(prev, idx, false)
          next[idx] = true
          return next
        })
        setFinished((prev) => {
          const next = ensureIndex(prev, idx, false)
          next[idx] = false
          return next
        })
        setWaitingForServer((prev) => {
          const next = ensureIndex(prev, idx, false)
          next[idx] = false
          return next
        })
        setServerRunning(true)
      }

      if (data.includes("Finished running script")) {
        // mark finished for this config
        setWaitingForClients((prev) => {
          const next = ensureIndex(prev, idx, false)
          next[idx] = false
          return next
        })
        setFinished((prev) => {
          const next = ensureIndex(prev, idx, false)
          next[idx] = true
          return next
        })
        setIsListening(false)

        // move to next config if any
        const lastIndex = (experimentConfig?.length || 1) - 1
        if (idx < lastIndex) {
          // keep serverRunning true to continue live view across sequence
          setTimeout(() => setCurrentExecConfig((p) => p + 1), 300)
        } else {
          // sequence done
          // setServerRunning(false)
          setStartRunningConfig(false)
          setTimeout(() => setCurrentExecConfig(0), 300)
        }
      }

      // Client connected
      if (data.includes("Client connected - CID:")) {
        const m = data.match(/CID:\s*([a-fA-F0-9]+)/)
        if (!m) return
        const cid = m[1]
        const connected = { id: cid, name: "", os: "unknown", joinedAt: new Date() }
        setConnectedClients((prev) => {
          const next = ensureIndex(prev, idx, [])
          next[idx] = pushUniqueBy(next[idx], connected, (c) => c.id === cid)
          return next
        })
      }

      // CTM
      if (data.includes("CTM Round")) {
        const ctmMatches = data.matchAll(/CTM Round (\d+) Client:([a-f0-9]+):\s*({.*})/g)
        for (const mt of ctmMatches) {
          const round = parseInt(mt[1], 10)
          const cid = mt[2]
          try {
            const metrics = JSON.parse(mt[3].replace(/'/g, '"'))
            const trainResult = {
              round,
              clientId: cid,
              auc: metrics.train_auc,
              accuracy: metrics.train_accuracy,
              loss: metrics.train_loss,
              hostname: metrics.hostname,
              os: metrics.os_type || "unknown",
              type: "train",
              timestamp: new Date()
            }
            setClientTrainMetrics((prev) => {
              const next = ensureIndex(prev, idx, [])
              next[idx] = pushUniqueBy(next[idx], trainResult, (r) => r.clientId === cid && r.round === round)
              return next
            })
            // enrich connected client row
            setConnectedClients((prev) => {
              const next = ensureIndex(prev, idx, [])
              next[idx] = (next[idx] || []).map((c) => (c.id === cid ? { ...c, hostname: metrics.hostname, os: metrics.os_type || "unknown" } : c))
              return next
            })
            // remove from running
            setRunningClients((prev) => {
              const next = ensureIndex(prev, idx, [])
              next[idx] = (next[idx] || []).filter((id) => id !== cid)
              return next
            })
          } catch (e) {
            console.error("CTM parse error", e)
          }
        }
        setIsAggregating((prev) => {
          const next = ensureIndex(prev, idx, false)
          next[idx] = true
          return next
        })
      }

      // CEM
      if (data.includes("CEM Round")) {
        const cemMatches = data.matchAll(/CEM Round (\d+) Client:([a-f0-9]+):\s*({.*})/g)
        for (const mt of cemMatches) {
          const round = parseInt(mt[1], 10)
          const cid = mt[2]
          try {
            const metrics = JSON.parse(mt[3].replace(/'/g, '"'))
            const evalResult = { round, clientId: cid, auc: metrics.eval_auc, accuracy: metrics.eval_accuracy, loss: metrics.eval_loss, type: "eval", timestamp: new Date() }
            setClientEvalMetrics((prev) => {
              const next = ensureIndex(prev, idx, [])
              next[idx] = pushUniqueBy(next[idx], evalResult, (r) => r.clientId === cid && r.round === round)
              return next
            })
            setRunningClients((prev) => {
              const next = ensureIndex(prev, idx, [])
              next[idx] = (next[idx] || []).filter((id) => id !== cid)
              return next
            })
          } catch (e) {
            console.error("CEM parse error", e)
          }
        }
        setIsAggregating((prev) => {
          const next = ensureIndex(prev, idx, false)
          next[idx] = true
          return next
        })
      }

      // Aggregated Training
      if (data.includes("Aggregated Training Metrics")) {
        const rm = data.match(/Round (\d+) - Aggregated Training Metrics/)
        const mm = data.match(/Aggregated Training Metrics:\s*(\{.*\})/)
        if (!rm?.[1] || !mm?.[1]) return
        try {
          const roundNumber = parseInt(rm[1], 10)
          const metrics = JSON.parse(mm[1].replace(/'/g, '"'))
          const result = {
            round: roundNumber,
            loss: metrics.train_loss,
            accuracy: metrics.train_accuracy,
            auc: metrics.train_auc,
            clientsTrained: 3,
            timeTaken: (Math.random() * 3).toFixed(2),
            timestamp: new Date()
          }
          setTraningResulsts((prev) => {
            const next = ensureIndex(prev, idx, [])
            next[idx] = pushUniqueBy(next[idx], result, (r) => r.round === roundNumber)
            return next
          })
          setTimeout(
            () =>
              setIsAggregating((prev) => {
                const next = ensureIndex(prev, idx, false)
                next[idx] = false
                return next
              }),
            2000
          )
          // mark all connected as running (visual)
          setRunningClients((prev) => {
            const next = ensureIndex(prev, idx, [])
            const connectedIds = (connectedClients[idx] || []).map((c) => c.id)
            next[idx] = Array.from(new Set([...(next[idx] || []), ...connectedIds]))
            return next
          })
        } catch (e) {
          console.error("Agg train parse error", e)
        }
      }

      // Aggregated Evaluation
      if (data.includes("Aggregated Evaluation Metrics")) {
        const rm = data.match(/Round (\d+) - Aggregated Evaluation Metrics/)
        const ml = data.match(/Loss:\s*([\d.]+),\s*Metrics:\s*({.*})/)
        if (!rm?.[1] || !ml) return
        try {
          const roundNumber = parseInt(rm[1], 10)
          const loss = parseFloat(ml[1])
          const metrics = JSON.parse(ml[2].replace(/'/g, '"'))
          const result = { round: roundNumber, loss, accuracy: metrics.eval_accuracy, auc: metrics.eval_auc, clientsTrained: 3, timeTaken: (Math.random() * 3).toFixed(2), timestamp: new Date() }
          setRoundResults((prev) => {
            const next = ensureIndex(prev, idx, [])
            next[idx] = pushUniqueBy(next[idx], result, (r) => r.round === roundNumber)
            return next
          })
          setTimeout(
            () =>
              setIsAggregating((prev) => {
                const next = ensureIndex(prev, idx, false)
                next[idx] = false
                return next
              }),
            2000
          )
          setRunningClients((prev) => {
            const next = ensureIndex(prev, idx, [])
            const connectedIds = (connectedClients[idx] || []).map((c) => c.id)
            next[idx] = Array.from(new Set([...(next[idx] || []), ...connectedIds]))
            return next
          })
        } catch (e) {
          console.error("Agg eval parse error", e)
        }
      }

      // Properties
      if (data.includes("Properties:")) {
        const regex = /📋.*Client\s+([A-Fa-f0-9]+)\s+Properties:\s*(\{.*\})/
        const m = data.match(regex)
        if (!m) return
        try {
          const cid = m[1]
          const props = JSON.parse(m[2].replace(/'/g, '"'))
          const host = props.hostname
          setClientProperties((prev) => {
            const next = ensureIndex(prev, idx, {})
            const bag = { ...(next[idx] || {}) }
            const bucket = bag[host] || []
            if (!bucket.some((it) => it.id === cid)) {
              bag[host] = [...bucket, { id: cid, ...props }]
            }
            next[idx] = bag
            return next
          })
          setIsAggregating((prev) => {
            const next = ensureIndex(prev, idx, false)
            next[idx] = false
            return next
          })
        } catch (e) {
          console.error("Props parse error", e)
        }
      }
    }

    ipcRenderer.on("log", onLog)
    console.log("========================= connectedClients", connectedClients)
    return () => ipcRenderer.removeListener("log", onLog)
  }, [isListening, experimentConfig, connectedClients])

  // ---------- single-run button (unchanged logic; just set flags per-index) ----------
  const runServer = () => {
    const idx = currentExecConfig
    setIsListening(true)
    setWaitingForServer((prev) => {
      const next = ensureIndex(prev, idx, false)
      next[idx] = true
      return next
    })

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
        saveOnRounds: strategyConfigs[0]?.data.internal.settings.saveOnRounds || 5,
        datasetConfig: datasetConfig
      },
      (json) => {
        json?.error ? toast.error("Error: " + json.error) : MedDataObject.updateWorkspaceDataObject()
      },
      (err) => {
        console.error(err)
      }
    )

    const selected = Object.keys(selectedAgents[idx] || {}).filter((k) => selectedAgents[idx][k])
    selected.reduce(
      (p, client) =>
        p.then(
          () =>
            new Promise((resolve) => {
              requestBackend(
                port,
                "/medfl/rw/ws/run/" + pageId,
                { id: client, ServerAddr: serverAddress, DP: "none" },
                (json) => {
                  json?.error ? toast.error("Error: " + json.error) : toast.success("Client " + client + " connected successfully")
                },
                (err) => console.error(err)
              )
              setTimeout(resolve, 1000)
            })
        ),
      Promise.resolve()
    )
  }

  // ---------- multi-config sequencer (uses your existing function) ----------
  useEffect(() => {
    if (startRunningConfig && currentExecConfig < (experimentConfig?.length || 0)) {
      runServerWithMultipleConfigs(experimentConfig[currentExecConfig], currentExecConfig)
    }
  }, [startRunningConfig, currentExecConfig])

  // DO NOT TOUCH the body of this function per your request (left identical)
  const runServerWithMultipleConfigs = (conf, index) => {
    setIsListening(true)
    setWaitingForServer((prev) => {
      const next = ensureIndex(prev, index, false)
      next[index] = true
      return next
    })
    console.log("experimentConfig", experimentConfig)
    console.log("selectedAgents", selectedAgents)
    console.log("Ruuning config ", index)

    requestBackend(
      port,
      "/medfl/rw/run-server/" + pageId,
      {
        strategy_name: conf.flRunServerNode.strategy,
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
        json?.error ? toast.error("Error: " + json.error) : MedDataObject.updateWorkspaceDataObject()
      },
      (err) => {
        console.error(err)
      }
    )

    const selectedClients = Object.keys(selectedAgents[index]).filter((key) => selectedAgents[index][key])
    selectedClients.reduce((promise, client) => {
      return promise.then(
        () =>
          new Promise((resolve) => {
            requestBackend(
              port,
              "/medfl/rw/ws/run/" + pageId,
              { id: client, ServerAddr: "100.65.215.27:808" + String(index), DP: "none" },
              (json) => {
                if (json?.error) {
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
      )
    }, Promise.resolve())
  }

  const stopServer = () => {
    serverPID &&
      requestBackend(
        port,
        "/medfl/rw/stop-server/" + pageId,
        { pid: serverPID },
        (json) => {
          if (json?.error) {
            toast.error("Error: " + json.error)
          } else {
            setServerRunning(false)
            setWaitingForServer([])
            setServerPageId(null)

            resetResults()

            setWaitingForClients((prev) => {
              const next = [...prev]
              next[currentExecConfig] = false
              return next
            })
            // do not wipe buckets here; we keep results by config
          }
        },
        (err) => console.error(err)
      )
  }

  useEffect(() => {
    if (!wsAgents) getWSAgents()
  }, [wsAgents])
  const getWSAgents = () => {
    requestBackend(
      port,
      "/medfl/rw/ws/agents/" + pageId,
      {},
      (json) => {
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
      },
      (err) => console.error(err)
    )
  }

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
      const idx = currentExecConfig
      let dirPath = ""
      if (configPath !== "") {
        dirPath = configPath.substring(0, configPath.lastIndexOf("/"))
      } else {
        dirPath = savingPath !== "" ? savingPath : await onSaveScean(fileName)
      }
      const data = {
        config: { strategy, numRounds, id: dirPath.slice(dirPath.lastIndexOf("/") + 1), index: idx },
        devices,
        trainingResults: trainingresults[idx] || [],
        evaluationResults: roundResults[idx] || [],
        clientTrainMetrics: clientTrainMetrics[idx] || [],
        clientEvalMetrics: clientEvalMetrics[idx] || [],
        clientProperties: clientProperties[idx] || {},
        connectedClients: connectedClients[idx] || [],
        serverLogs: serverLogs[idx] || []
      }
      await MedDataObject.writeFileSync({ data, date: Date.now() }, dirPath, fileName, "json")
      await MedDataObject.writeFileSync({ data, date: Date.now() }, dirPath, fileName, "medflrw")
      toast.success("Experimentation results saved successfully")
    } catch {
      toast.error("Something went wrong ")
    }
  }

  const handleGenerate = async () => {
    let noteBook = buildNotebookText({
      model_type: "nn",
      server_address: "100.65.215.27:8080",
      data_path: "../data/client1.csv"
    })

    let servernoteBook = buildServerNotebookText({
      host: "0.0.0.0",
      port: 8080,
      num_rounds: experimentConfig[currentExecConfig]?.flRunServerNode.numRounds || 10,
      strategy: {
        name: experimentConfig[currentExecConfig]?.flRunServerNode.strategy || "FedAvg",
        fraction_fit: experimentConfig[currentExecConfig]?.flRunServerNode.fractionFit || 1,
        min_fit_clients: experimentConfig[currentExecConfig]?.flRunServerNode.minFitClients || 1,
        min_evaluate_clients: experimentConfig[currentExecConfig]?.flRunServerNode.minEvaluateClients || 1,
        min_available_clients: experimentConfig[currentExecConfig]?.flRunServerNode.minAvailableClients || 3,
        local_epochs: experimentConfig[currentExecConfig]?.flModelNode["Local epochs"] || 1,
        threshold: experimentConfig[currentExecConfig]?.flModelNode.Threshold || 0.5,
        learning_rate: experimentConfig[currentExecConfig]?.flModelNode["Learning rate"] || 0.01,
        optimizer_name: experimentConfig[currentExecConfig]?.flModelNode.optimizer || "SGD",
        saveOnRounds: experimentConfig[currentExecConfig]?.flRunServerNode.saveOnRounds || 5,
        savingPath: "/.",
        total_rounds: experimentConfig[currentExecConfig]?.flRunServerNode.numRounds || 10
      }
    })

    console.log(noteBook)

    console.log(servernoteBook)

    if (configPath != "") {
    } else {
      let dirPath = savingPath != "" ? savingPath : await onSaveScean("FL_code")

      console.log(dirPath)

      await MedDataObject.writeFileSync(servernoteBook, dirPath + "/notebooks", "Server", "ipynb")
      await MedDataObject.writeFileSync(noteBook, dirPath + "/notebooks", "Client", "ipynb")
      setSavingPath(dirPath)

      toast.success(`Notebooks saved to ${dirPath}`)
    }
  }
  return (
    <div>
      <Modal show={show} onHide={onHide} size="xl" centered className="modal-settings-chooser">
        <Modal.Header closeButton>
          <Modal.Title>
            <FaServer className="me-2" />
            Run Server
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <div className="d-flex justify-content-between align-items-center bg-light p-3 rounded mb-3 border">
            <div>
              {" "}
              <h3>Generate code</h3>
              <p className="text-muted">Choose your configuration and generate its notebook</p>
            </div>
            <div className="d-flex gap-3 w-50">
              <Form.Select value={configToCode} onChange={(e) => setConfigToCode(e.target.value)} className="mb-3">
                {experimentConfig?.map((_, index) => (
                  <option key={index} value={index}>
                    Configuration {index + 1}
                  </option>
                ))}
              </Form.Select>

              <Button onClick={handleGenerate} variant="outline-primary" outline className="mb-3 w-50">
                Generate Code <FaCode />
              </Button>
            </div>

            {code && (
              <pre className="p-3 bg-light rounded" style={{ whiteSpace: "pre-wrap" }}>
                {code}
              </pre>
            )}
          </div>
          {waitingForClients[currentExecConfig] && (
            <Alert variant={(connectedClients[currentExecConfig]?.length || 0) < minAvailableClients ? "warning" : "success"} className="shadow-sm rounded">
              <strong>Info:</strong>{" "}
              {(connectedClients[currentExecConfig]?.length || 0) < minAvailableClients
                ? `Waiting for ${minAvailableClients - (connectedClients[currentExecConfig]?.length || 0)} clients to connect`
                : "All clients are connected"}
            </Alert>
          )}

          {!serverRunning ? (
            <>
              {experimentConfig?.length > 0 ? (
                <Tabs
                  id="configs-tabs"
                  className="mb-3"
                  // activeKey={`conf${currentExecConfig}`}
                  onSelect={(k) => {
                    if (!k) return
                    const idx = parseInt(k.replace("conf", ""), 10)
                    setCurrentExecConfig(idx)
                  }}
                >
                  {experimentConfig.map((config, index) => (
                    <Tab key={index} eventKey={"conf" + index} title={"Configuration " + (index + 1)}>
                      <ConnectedWSAgents
                        key={`agents-${index}`}
                        wsAgents={wsAgents}
                        selectedAgents={selectedAgents[index] || {}}
                        setSelectedAgents={(value) =>
                          setSelectedAgents((prev) => {
                            const next = ensureIndex(prev, index, {})
                            next[index] = value
                            return next
                          })
                        }
                        setMinAvailableClients={setMinAvailableClients}
                        getWSAgents={getWSAgents}
                        setCanRun={setCanRun}
                        renderOsIcon={renderOsIcon}
                      />
                      {Object.keys(config).map((key) =>
                        key !== "Network" ? (
                          <div key={`${key}-${index}`} className="card shadow-sm border-0 mb-3">
                            <div className="card-header fw-semibold" style={{ background: "var(--bs-primary-bg-subtle)", color: "var(--bs-emphasis-color)", fontSize: 16 }}>
                              {key}
                            </div>
                            <div className="card-body p-3">
                              <div className="bg-body-tertiary rounded p-2">
                                <JsonView data={config[key]} shouldExpandNode={allExpanded} className="bg-transparent" />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div></div>
                        )
                      )}
                      {/* <div className="d-flex justify-content-end mt-4">
                        <button
                          className="btn btn-outline-success "
                          onClick={() => {
                            setStartRunningConfig(true)
                            // the effect will call runServerWithMultipleConfigs with currentExecConfig
                          }}
                          disabled={!!waitingForServer[index]}
                        >
                          <span className="me-2">{waitingForServer[index] ? "waiting for server" : "Run configuration"}</span>
                          {waitingForServer[index] ? <FaSpinner /> : <FaPlay />}
                        </button>
                      </div> */}
                    </Tab>
                  ))}
                </Tabs>
              ) : (
                <div className="text-center fs-3">
                  <Message severity="info" text="You have no configurations !!" className="w-100" />
                </div>
              )}
            </>
          ) : (
            <Tabs id="results-per-config" className="mb-3">
              {(experimentConfig || []).map((_, cfgIdx) => (
                <Tab key={cfgIdx} eventKey={String(cfgIdx)} title={`Configuration ${cfgIdx + 1}`}>
                  <ClientConnectionPanel connectedClients={connectedClients[cfgIdx] || []} minAvailableClients={minAvailableClients} />

                  <Tab.Container id={`left-tabs-${cfgIdx}`} defaultActiveKey="first">
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
                        <Tab.Content>
                          <Tab.Pane eventKey="first">
                            <Tabs defaultActiveKey="Training" className="mb-3">
                              <Tab eventKey="Training" title="Training">
                                {displayView === "chart" ? (
                                  <RoundLineChart roundResults={trainingresults[cfgIdx] || []} title="Training metrics over rounds" />
                                ) : (
                                  <ProgressTable serverRunning={serverRunning} currentRound={currentRound} roundResults={trainingresults[cfgIdx] || []} title="Training progress" />
                                )}
                              </Tab>

                              <Tab eventKey="Evaluation" title="Evaluation">
                                {displayView === "chart" ? (
                                  <RoundLineChart roundResults={roundResults[cfgIdx] || []} title="Evaluation metrics over rounds" />
                                ) : (
                                  <ProgressTable serverRunning={serverRunning} currentRound={currentRound} roundResults={roundResults[cfgIdx] || []} title="Evaluation progress" />
                                )}
                              </Tab>
                            </Tabs>
                          </Tab.Pane>

                          <Tab.Pane eventKey="second">
                            <Tabs defaultActiveKey="Training" id={`clients-tab-${cfgIdx}`} className="mb-3">
                              <Tab eventKey="Training" title="Training">
                                <ClientEvalLineChart clientEvalMetrics={clientTrainMetrics[cfgIdx] || []} />
                              </Tab>
                              <Tab eventKey="Evaluation" title="Evaluation">
                                <ClientEvalLineChart clientEvalMetrics={clientEvalMetrics[cfgIdx] || []} />
                              </Tab>
                            </Tabs>
                          </Tab.Pane>

                          <Tab.Pane eventKey="third">
                            <CommunicationFlow
                              connectedClients={connectedClients[cfgIdx] || []}
                              isAggregating={!!isAggregating[cfgIdx]}
                              runningClients={runningClients[cfgIdx] || []}
                              finished={!!finishedruning[cfgIdx]}
                              currentRound={currentRound}
                            />
                          </Tab.Pane>

                          <Tab.Pane eventKey="fourth">
                            <ClientDetails clientProperties={clientProperties[cfgIdx] || {}} />
                          </Tab.Pane>

                          <Tab.Pane eventKey="fifth">
                            <ClientLogs clients={(wsAgents || []).map((agent) => ({ id: agent }))} pageId={pageId} port={port} />
                          </Tab.Pane>
                        </Tab.Content>
                      </Col>
                    </Row>
                  </Tab.Container>

                  <hr />

                  <div style={styles.logsContainer}>
                    <div style={styles.logsHeader}>Server Logs — Config {cfgIdx + 1}</div>
                    <div style={styles.logsContent}>
                      {(serverLogs[cfgIdx] || []).length > 0 ? (
                        (serverLogs[cfgIdx] || []).map((log, i) => (
                          <div key={i} style={styles.logEntry}>
                            {`[${new Date().toLocaleTimeString()}] ${log}`}
                          </div>
                        ))
                      ) : (
                        <div style={{ color: "#6c757d", fontStyle: "italic" }}>No logs yet. Start the server to see activity...</div>
                      )}
                    </div>
                  </div>
                </Tab>
              ))}
            </Tabs>
          )}
        </Modal.Body>

        <Modal.Footer>
          {serverRunning ? (
            <div className="d-flex gap-3">
              {finishedruning[currentExecConfig] ? (
                !isFileName ? (
                  <button className="btn btn-success text-nowrap" onClick={() => showFileName(true)}>
                    <span className="me-2">Save results</span>
                    <FaSave />
                  </button>
                ) : (
                  <div className="input-group">
                    <input type="text" className="form-control" placeholder="File name" value={fileName} onChange={(e) => setFileName(e.target.value)} />
                    <button className="btn btn-success" type="button" onClick={saveResults}>
                      <FaSave />
                    </button>
                  </div>
                )
              ) : null}
              <button className="btn btn-secondary text-nowrap" onClick={stopServer}>
                <span className="me-2">Stop Server</span>
                <FaPause />
              </button>
            </div>
          ) : (
            <button
              className="btn btn-success w-25"
              onClick={() => {
                if (experimentConfig?.length > 0) {
                  // Check if any configuration has no selected agents
                  const emptyConfigIndex = experimentConfig.findIndex((_, idx) => !selectedAgents[idx] || Object.keys(selectedAgents[idx]).length === 0)
                  console.log("Empty config index:", emptyConfigIndex)
                  if (emptyConfigIndex !== -1) {
                    toast.error(`Please select at least one agent for configuration ${emptyConfigIndex + 1}`)
                    return
                  } else {
                    setStartRunningConfig(true)
                  }
                }
              }}
              disabled={waitingForServer.includes(true)}
            >
              <span className="me-2"> {waitingForServer.includes(true) ? "waiting for server" : "Run Server"} </span>
              {waitingForServer.includes(true) ? <FaSpinner /> : <FaPlay />}
            </button>
          )}
        </Modal.Footer>
      </Modal>
    </div>
  )
}

export default NewServerLogsModal
