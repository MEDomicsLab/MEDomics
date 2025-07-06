import React, { useState, useCallback, useMemo, useEffect, useContext } from "react"
import { toast } from "react-toastify"
import { useNodesState, useEdgesState, useReactFlow, addEdge } from "reactflow"
import { loadJsonSync } from "../../utilities/fileManagementUtils"
import { requestBackend } from "../../utilities/requests"
import BtnDiv from "../flow/btnDiv"
import ProgressBarRequests from "../generalPurpose/progressBarRequests"
import { PageInfosContext } from "../mainPages/moduleBasics/pageInfosContext"
import { FlowFunctionsContext } from "../flow/context/flowFunctionsContext"
import { FlowResultsContext } from "../flow/context/flowResultsContext"
import { EXPERIMENTS, WorkspaceContext } from "../workspace/workspaceContext"
import { ErrorRequestContext } from "../generalPurpose/errorRequestContext.jsx"
import { createZipFileSync, modifyZipFileSync } from "../../utilities/customZipFile.js"

import { UUID_ROOT, DataContext } from "../workspace/dataContext"

import Path from "path"

// here are the different types of nodes implemented in the workflow

// here are the parameters of the nodes
import nodesParams from "../../public/setupVariables/allNodesParams"

// here are static functions used in the workflow
import { removeDuplicates, deepCopy } from "../../utilities/staticFunctions"
import { defaultValueFromType } from "../../utilities/learning/inputTypesUtils.js"
import { FlowInfosContext } from "../flow/context/flowInfosContext.jsx"
import StandardNode from "../learning/nodesTypes/standardNode.jsx"
import GroupNode from "../flow/groupNode.jsx"
import NetworkNode from "./nodesTypes/networkNode.jsx"
import FlClientNode from "./nodesTypes/flClientNode.jsx"
import FlServerNode from "./nodesTypes/flServerNode.jsx"
import FlSetupNode from "./nodesTypes/flSetupNode.jsx"
import MasterDatasetNode from "./nodesTypes/masterDatasetNode.jsx"
import FlDatasetNode from "./nodesTypes/flDatasetNode.jsx"
import FlModelNode from "./nodesTypes/flModelNode.jsx"
import FlOptimizeNode from "./nodesTypes/flOptimizeNode.jsx"
import FlStrategyNode from "./nodesTypes/flStrategyNode.jsx"
import FlPipelineNode from "./nodesTypes/flPipelineNode.jsx"
import FlResultsNode from "./nodesTypes/flResultsNode.jsx"
import { Button } from "primereact/button"
import RunPipelineModal from "./runPipelineModal"
import FlConfigModal from "./flConfigModal"
import DBCOnfigFileModal from "./dbCOnfigFileModal.jsx"
import FlWorflowBase from "./flWorkflowBase.jsx"
import OptimResultsModal from "./optimResultsModal"
import FlTrainModelNode from "./nodesTypes/flTrainModel.jsx"
import FlSaveModelNode from "./nodesTypes/flSaveModelNode.jsx"
import { useMEDflContext } from "../workspace/medflContext.jsx"
import FlCompareResults from "./nodesTypes/flCompareResultsNode"
import { Modal } from "react-bootstrap"
import FlInput from "./flInput"
import FlRunServerNode from "./nodesTypes/flRunServerNode.jsx"
import ServerLogosModal from "./rw/SeverLogsModal.jsx"
import FlDatasetrwNode from "./nodesTypes/DatasetrwNode.jsx"
import FlrwServerNode from "./nodesTypes/flrwServerNode.jsx"
import { MEDDataObject } from "../workspace/NewMedDataObject.js"

const staticNodesParams = nodesParams // represents static nodes parameters

/**
 *
 * @param {function} setWorkflowType function to change the sidebar type
 * @param {String} workflowType type of the workflow (learning or optimize)
 * @returns {JSX.Element} A workflow
 *
 * @description
 * This component is used to display a workflow (ui, nodes, edges, etc.).
 *
 */
const MedflrwWorkflow = ({ setWorkflowType, workflowType, mode = "fl" }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]) // nodes array, setNodes is used to update the nodes array, onNodesChange is a callback hook that is executed when the nodes array is changed
  const [edges, setEdges, onEdgesChange] = useEdgesState([]) // edges array, setEdges is used to update the edges array, onEdgesChange is a callback hook that is executed when the edges array is changed
  const [reactFlowInstance, setReactFlowInstance] = useState(null) // reactFlowInstance is used to get the reactFlowInstance object important for the reactFlow library
  const [MLType, setMLType] = useState("classification") // MLType is used to know which machine learning type is selected
  const { setViewport } = useReactFlow() // setViewport is used to update the viewport of the workflow
  const [treeData, setTreeData] = useState({}) // treeData is used to set the data of the tree menu
  const { getIntersectingNodes } = useReactFlow() // getIntersectingNodes is used to get the intersecting nodes of a node
  const [intersections, setIntersections] = useState([]) // intersections is used to store the intersecting nodes related to optimize nodes start and end
  const [isProgressUpdating, setIsProgressUpdating] = useState(false) // progress is used to store the progress of the workflow execution
  const [progress, setProgress] = useState({
    now: 0,
    currentLabel: ""
  })

  const [flWorkflowSettings, setflWorkflowSettings] = useState({})
  const [showRunModal, setRunModal] = useState(false)

  const [isUpdating, setIsUpdating] = useState(false) // we use this to store the progress value of the dashboard

  const [flConfigFile, setConfigFile] = useState({ path: "" })

  const [optimResults, setOptimResults] = useState(null)

  const [serverRunning, setServerRunning] = useState(false)

  const [isSaveModal, openSaveModal] = useState(false)
  const [scenName, setSceanName] = useState("")

  const { groupNodeId, changeSubFlow, hasNewConnection } = useContext(FlowFunctionsContext)
  const { config, pageId, configPath } = useContext(PageInfosContext) // used to get the page infos such as id and config path
  const { updateFlowResults, isResults } = useContext(FlowResultsContext)
  const { canRun } = useContext(FlowInfosContext)
  const { port } = useContext(WorkspaceContext)
  const { setError } = useContext(ErrorRequestContext)

  const { globalData } = useContext(DataContext)

  const [allConfigResults, setAllresults] = useState([])

  const { updatePipelineConfigs } = useMEDflContext()

  // declare node types using useMemo hook to avoid re-creating component types unnecessarily (it memorizes the output) https://www.w3schools.com/react/react_usememo.asp
  const nodeTypes = useMemo(
    () => ({
      standardNode: StandardNode,
      groupNode: GroupNode,
      masterDatasetNode: MasterDatasetNode,
      networkNode: NetworkNode,
      flClientNode: FlClientNode,
      flServerNode: FlServerNode,
      flSetupNode: FlSetupNode,
      flDatasetNode: FlDatasetNode,
      flModelNode: FlModelNode,
      flOptimizeNode: FlOptimizeNode,
      flStrategyNode: FlStrategyNode,
      flPipelineNode: FlPipelineNode,
      flResultsNode: FlResultsNode,
      flTrainModelNode: FlTrainModelNode,
      flSaveModelNode: FlSaveModelNode,
      flMergeresultsNode: FlCompareResults,
      flRunServerNode: FlRunServerNode,
      DatasetrwNode: FlDatasetrwNode,
      flrwServerNode: FlrwServerNode
    }),
    []
  )

  // When config is changed, we update the workflow
  useEffect(() => {
    if (config && Object.keys(config).length > 0) {
      updateScene(config)
      toast.success("Config file has been loaded successfully")
    } else {
      console.log("No config file found for this page, base workflow will be used")
    }
  }, [config])

  // when isResults is changed, we set the progressBar to completed state
  useEffect(() => {
    if (isResults) {
      setProgress({
        now: 100,
        currentLabel: "Done!"
      })
    }
  }, [isResults])

  // executed when the machine learning type is changed
  // it updates the possible settings of the nodes
  useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => {
        // it's important that you create a new object here in order to notify react flow about the change
        node.data = {
          ...node.data
        }
        if (!node.id.includes("opt")) {
          let subworkflowType = node.data.internal.subflowId != "MAIN" ? "rwflNetwork" : mode
          node.data.setupParam.possibleSettings = deepCopy(staticNodesParams[subworkflowType][node.data.internal.type]["possibleSettings"])
          node.data.internal.settings = {}
          node.data.internal.checkedOptions = []
          if (node.type == "selectionNode") {
            node.data.internal.selection = Object.keys(node.data.setupParam.possibleSettings)[0]
          }
        }
        return node
      })
    )
  }, [MLType])

  // executed when the nodes array and edges array are changed
  useEffect(() => {
    setTreeData(createTreeFromNodes())
  }, [nodes, edges])

  // execute this when groupNodeId change. I put it in useEffect because it assures groupNodeId is updated
  useEffect(() => {
    if (groupNodeId.id == "MAIN") {
      setWorkflowType(mode)
      hideNodesbut(groupNodeId.id)
    } else {
      setWorkflowType("rwflNetwork")
      hideNodesbut(groupNodeId.id)
    }
  }, [groupNodeId])

  // executed when intersections array is changed
  // it updates nodes and eges array
  useEffect(() => {
    // first, we add 'intersect' class to the nodes that are intersecting with OptimizeIO nodes
    setNodes((nds) =>
      nds.map((node) => {
        node.data = {
          ...node.data
        }
        node.className = ""
        intersections.forEach((intersect) => {
          if (intersect.targetId == node.id || intersect.sourceId == node.id) {
            node.className = "intersect"
          }
        })
        return node
      })
    )

    // then, we add the edges between the intersecting nodes and hide them to simulate the connection between the nodes
    // this is useful to create the recursive workflow automatically
    // it basically bypasses the optimize nodes
    setEdges((eds) => eds.filter((edge) => !edge.id.includes("opt"))) // remove all edges that are linked to optimize nodes
    intersections.forEach((intersect, index) => {
      if (intersect.targetId.includes("start")) {
        let groupNodeId = intersect.targetId.split(".")[1]
        let groupNodeIdConnections = edges.filter((eds) => eds.target == groupNodeId)
        groupNodeIdConnections.forEach((groupNodeIdConnection, index2) => {
          let edgeSource = groupNodeIdConnection.source
          let edgeTarget = intersect.sourceId
          setEdges((eds) =>
            addEdge(
              {
                source: edgeSource,
                sourceHandle: 0 + "_" + edgeSource, // we add 0_ because the sourceHandle always starts with 0_. Handles are created by a for loop so it represents an index
                target: edgeTarget,
                targetHandle: 0 + "_" + edgeTarget,
                id: index + "_" + index2 + edgeSource + "_" + edgeTarget + "_opt",
                hidden: true
              },
              eds
            )
          )
        })
      } else if (intersect.targetId.includes("end")) {
        let groupNodeId = intersect.targetId.split(".")[1]
        let groupNodeIdConnections = edges.filter((eds) => eds.source == groupNodeId)
        groupNodeIdConnections.forEach((groupNodeIdConnection, index2) => {
          let edgeSource = intersect.sourceId
          let edgeTarget = groupNodeIdConnection.target
          setEdges((eds) =>
            addEdge(
              {
                source: edgeSource,
                sourceHandle: 0 + "_" + edgeSource, // we add 0_ because the sourceHandle always starts with 0_. Handles are created by a for loop so it represents an index
                target: edgeTarget,
                targetHandle: 0 + "_" + edgeTarget,
                id: index + "_" + index2 + edgeSource + "_" + edgeTarget + "_opt",
                hidden: true
              },
              eds
            )
          )
        })
      }
    })
  }, [intersections, hasNewConnection])

  useEffect(() => {
    if (workflowType === "rwflNetwork") {
      requestBackend(
        port,
        "/medfl/devices/" + pageId,
        {},
        (json) => {
          if (!json?.devices) return
          createNetworkFromDevices(json.devices)

          console.log("Tailscale devices loaded", json.devices)
        },
        (err) => {
          toast.error("Failed to load Tailscale devices")
          console.error(err)
        }
      )
    }
  }, [workflowType])

  const createNetworkFromDevices = (devices) => {
    const server = devices.find((d) => (d.tags || []).includes("tag:server"))
    const clients = devices.filter((d) => d.id !== server?.id)

    const serverNode = {
      id: `server-${server.id}`,
      type: "flrwServerNode",
      position: { x: 0, y: 300 },
      data: {
        setupParam: {
          classes: "flClientNode",
          input: [],
          output: [],
          possibleSettings: {},
          nbInput: 0,
          nbOutput: 1
        },
        internal: {
          name: server.hostname,
          type: "flrwServerNode",
          subflowId: groupNodeId.id,
          settings: {},
          checkedOptions: [],
          code: "",
          hasWarning: { state: false },
          img: "server.png"
        },
        tooltipBy: "node",
        device: server
      }
    }

    const clientNodes = clients.map((c, i) => ({
      id: `client-${c.id}`,
      type: "flClientNode",
      position: { x: 400, y: 100 + i * 400 },
      data: {
        setupParam: {
          classes: "flClientNode",
          input: [],
          output: [],
          possibleSettings: {},
          nbInput: 1,
          nbOutput: 0
        },
        internal: {
          name: c.hostname,
          type: "flClientNode",
          subflowId: groupNodeId.id,
          settings: {},
          checkedOptions: [],
          code: "",
          hasWarning: { state: false },
          img: "node.png"
        },
        tooltipBy: "node",
        device: c
      }
    }))

    const newEdges = clients.map((c) => ({
      id: `edge-server-${c.id}`,
      source: `server-${server.id}`,
      target: `client-${c.id}`,
      sourceHandle: `0_server-${server.id}`,
      targetHandle: `0_client-${c.id}`,
      type: "default"
    }))

    setEdges((prev) => prev.filter((edge) => !edge.id.startsWith("edge-server")))
    setNodes((prev) => [...prev, serverNode, ...clientNodes])
    setEdges((prev) => [...prev, ...newEdges])
  }

  /**
   *
   * @param {String} activeSubflowId id of the group that is active
   *
   * This function hides the nodes and edges that are not in the active group
   * each node has a subflowId that is the id of the group it belongs to
   * if the subflowId is not equal to the activeNodeId, then the node is hidden
   *
   */
  const hideNodesbut = (activeSubflowId) => {
    setNodes((nodes) =>
      nodes.map((node) => {
        node = {
          ...node
        }
        node.hidden = node.data.internal.subflowId != activeSubflowId
        return node
      })
    )

    setEdges((edges) =>
      edges.map((edge) => {
        edge = {
          ...edge
        }
        edge.hidden =
          nodes.find((node) => node.id === edge.source).data.internal.subflowId != activeSubflowId || nodes.find((node) => node.id === edge.target).data.internal.subflowId != activeSubflowId
        return edge
      })
    )
  }

  /**
   * @returns {Object} updated tree data
   *
   * This function creates the tree data from the nodes array
   * it is used to create the recursive workflow
   */
  const createTreeFromNodes = () => {
    // recursively create tree from nodes
    const createTreeFromNodesRec = (node) => {
      let children = {}

      edges.forEach((edge) => {
        if (edge.source == node.id) {
          let targetNode = deepCopy(nodes.find((node) => node.id === edge.target))
          // if (targetNode.type != "groupNode") {
          let subIdText = ""
          let subflowId = targetNode.data.internal.subflowId
          if (subflowId != "MAIN") {
            subIdText = deepCopy(nodes.find((node) => node.id == subflowId)).data.internal.name + "."
          }
          children[targetNode.id] = {
            id: targetNode.id,
            label: subIdText + targetNode.data.internal.name,
            nodes: createTreeFromNodesRec(targetNode)
          }
          // }
        }
      })
      return children
    }

    let treeMenuData = {}
    edges.forEach((edge) => {
      let sourceNode = deepCopy(nodes.find((node) => node.id === edge.source))
      if (sourceNode.data.setupParam.classes.split(" ").includes("startNode")) {
        treeMenuData[sourceNode.id] = {
          id: sourceNode.id,
          label: sourceNode.data.internal.name,
          nodes: createTreeFromNodesRec(sourceNode)
        }
      }
    })

    return treeMenuData
  }

  /**
   * @param {Object} event event object
   * @param {Object} node node object
   *
   * This function is called when a node is dragged
   * It checks if the node is intersecting with another node
   * If it is, it adds the intersection to the intersections array
   */
  const onNodeDrag = useCallback(
    (event, node) => {
      let rawIntersects = getIntersectingNodes(node).map((n) => n.id)
      rawIntersects = rawIntersects.filter((n) => nodes.find((node) => node.id == n).data.internal.subflowId == node.data.internal.subflowId)
      let isNew = false

      // clear all intersections associated with
      let newIntersections = intersections.filter((int) => int.sourceId !== node.id && int.targetId !== node.id)

      // add new intersections
      rawIntersects.forEach((rawIntersect) => {
        // if the node is not a optimize node, it can't intersect with an optimize node
        // this a XOR logic gate so only true when only one of the two is true
        if (node.id.includes("opt") ^ rawIntersect.includes("opt")) {
          if (node.id.includes("opt")) {
            newIntersections = newIntersections.concat({
              sourceId: rawIntersect,
              targetId: node.id
            })
          } else if (rawIntersect.includes("opt")) {
            newIntersections = newIntersections.concat({
              sourceId: node.id,
              targetId: rawIntersect
            })
          }
          newIntersections = removeDuplicates(newIntersections)
          isNew = true
          setIntersections(newIntersections)
        }
      })
      if (!isNew) {
        if (node.id.includes("opt")) {
          setIntersections((intersects) => intersects.filter((int) => int.targetId !== node.id))
        } else {
          setIntersections((intersects) => intersects.filter((int) => int.sourceId !== node.id))
        }
      }
    },
    [nodes, intersections]
  )

  /**
   *
   * this function handles loading a json file to the editor
   * it is called when the user clicks on the load button
   * it checks if the user wants to import a new experiment because it erase the current one
   * it then loads the json file and creates the nodes and edges
   */
  const onLoad = useCallback(() => {
    let confirmation = true
    if (nodes.length > 0) {
      confirmation = confirm("Are you sure you want to import a new experiment?\nEvery data will be lost.")
    }
    if (confirmation) {
      const restoreFlow = async () => {
        const newScene = await loadJsonSync()
        updateScene(newScene)
      }

      restoreFlow()
    }
  }, [setNodes, setViewport, nodes])

  /**
   *
   * @param {Object} newScene new scene to update the workflow
   *
   * This function updates the workflow with the new scene
   */
  const updateScene = (newScene) => {
    console.log("Scene updating", newScene)
    if (newScene) {
      if (Object.keys(newScene).length > 0) {
        Object.values(newScene.nodes).forEach((node) => {
          if (!node.id.includes("opt")) {
            let subworkflowType = node.data.internal.subflowId != "MAIN" ? "rwflNetwork" : mode
            let setupParams = deepCopy(staticNodesParams[subworkflowType][node.data.internal.type])

            node.data.setupParam = setupParams
          }
        })
        const { x = 0, y = 0, zoom = 1 } = newScene.viewport
        setMLType(newScene.MLType)
        setNodes(newScene.nodes || [])
        setEdges(newScene.edges || [])
        setViewport({ x, y, zoom })
        setIntersections(newScene.intersections || [])
      }
    }
  }

  /**
   * @param {Object} id id of the node to delete
   *
   * This function is called when the user clicks on the delete button of a node
   * It deletes the node and its edges
   * If the node is a group node, it deletes all the nodes inside the group node
   */
  const onDeleteNode = useCallback((id) => {
    console.log("delete node", id)
    console.log("nodes before delete", nodes)
    setNodes((nds) =>
      nds.reduce((filteredNodes, n) => {
        if (n.id !== id) {
          filteredNodes.push(n)
        }
        if (n.type == "groupNode") {
          let childrenNodes = nds.filter((node) => node.data.internal.subflowId == id)
          childrenNodes.forEach((node) => {
            onDeleteNode(node.id)
          })
        }
        return filteredNodes
      }, [])
    )
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id))
    setIntersections((ints) =>
      ints.reduce((filteredInts, n) => {
        if (n.sourceId !== id && n.targetId !== id) {
          filteredInts.push(n)
        }
        return filteredInts
      }, [])
    )
  }, [])

  /**
   *
   * @param {Object} newNode base node object
   * @param {String} associatedNode id of the parent node if the node is a sub-group node
   * @returns
   */
  const addSpecificToNode = (newNode, associatedNode) => {
    console.log(newNode)
    // if the node is not a static node for a optimize subflow, it needs possible settings
    let setupParams = {}
    if (!newNode.id.includes("opt")) {
      setupParams = deepCopy(staticNodesParams[workflowType][newNode.data.internal.type])
      console.log("this is the setup", staticNodesParams[workflowType])
    }
    newNode.id = `${newNode.id}${associatedNode ? `.${associatedNode}` : ""}` // if the node is a sub-group node, it has the id of the parent node seperated by a dot. useful when processing only ids
    newNode.hidden = newNode.type == "optimizeIO"
    newNode.zIndex = newNode.type == "optimizeIO" ? 1 : 1010
    newNode.data.tooltipBy = "type"
    newNode.data.setupParam = setupParams
    newNode.data.internal.code = ""
    newNode.className = setupParams.classes

    let tempDefaultSettings = {}
    if (newNode.data.setupParam.possibleSettings) {
      "default" in newNode.data.setupParam.possibleSettings &&
        Object.entries(newNode.data.setupParam.possibleSettings.default).map(([settingName, setting]) => {
          tempDefaultSettings[settingName] = defaultValueFromType[setting.type]
        })
    }
    newNode.data.internal.settings = tempDefaultSettings

    newNode.data.internal.selection = newNode.type == "selectionNode" && Object.keys(setupParams.possibleSettings)[0]
    newNode.data.internal.checkedOptions = []
    newNode.data.internal.subflowId = !associatedNode ? groupNodeId.id : associatedNode
    newNode.data.internal.hasWarning = { state: false }

    return newNode
  }

  /**
   *
   * @param {String} id id of the node to execute
   *
   * This function is called when the user clicks on the run button of a node
   * It executes the pipelines finishing with this node
   */
  const runNode = useCallback(
    (id) => {
      // setRunModal(true)
      console.log(id)
    },
    [reactFlowInstance, MLType, nodes, edges, intersections]
  )

  /**
   * Get the byte size of the json object
   * @param {Object} json json object
   * @param {String} sizeType type of the size (bytes, kb, mb)
   * @returns {Number} byte size of the json object
   */
  // const getByteSize = (json, sizeType) => {
  //   if (sizeType == undefined) {
  //     sizeType = "bytes"
  //   }
  //   if (json != null && json != undefined) {
  //     let size = new Blob([JSON.stringify(json)]).size
  //     if (sizeType == "bytes") {
  //       return size
  //     } else if (sizeType == "kb") {
  //       return size / 1024
  //     } else if (sizeType == "mb") {
  //       return size / 1024 / 1024
  //     }
  //   }
  // }

  /**
   * Get the fl workflow settings
   */

  const getFlSettings = (nodes) => {
    nodes.map((node) => {
      // DatasetNode
      if (node.type === "masterDatasetNode") {
        setflWorkflowSettings({
          ...flWorkflowSettings,
          masterDataset: node.data.internal.settings
        })
      }
    })
  }

  /**
   * execute the whole workflow
   */
  const onRun = useCallback(() => {
    setServerRunning(true)
  }, [reactFlowInstance, MLType, nodes, edges, intersections, configPath])

  /**
   *
   * @param {String} path The path of the folder where the scene will be created
   * @param {String} sceneName The name of the scene
   * @param {String} extension The extension of the scene
   */
  const createSceneContent = async (path, sceneName, extension, useMedStandard) => {
    const emptyScene = { useMedStandard: useMedStandard }
    // create custom zip file
    console.log("zipFilePath", Path.join(path, sceneName + "." + extension))
    await createZipFileSync(Path.join(path, sceneName + "." + extension), async (path) => {
      // do custom actions in the folder while it is unzipped
      await MEDDataObject.writeFileSync(emptyScene, path, "metadata", "json")
    })
  }
  /**
   * save the workflow as a json file
   */
  const onSave = useCallback(
    async (scean) => {
      if (reactFlowInstance) {
        const flow = deepCopy(reactFlowInstance.toObject())
        flow.MLType = MLType
        console.log("flow debug", flow)
        flow.nodes.forEach((node) => {
          node.data.setupParam = null
        })
        flow.intersections = intersections
        if (configPath != "") {
          console.log("Heeeeeeere")
          modifyZipFileSync(configPath, async (path) => {
            // do custom actions in the folder while it is unzippsed
            await MEDDataObject.writeFileSync(flow, path, "metadata", "json")
            toast.success("Scene has been saved successfully")
          })
        } else {
          console.log("here", scean)
          let configPath = "C:\\Users\\HP User\\Desktop\\medfl_workspace\\EXPERIMENTS\\FL\\Sceans"
          createSceneContent(configPath, scean, mode, null).then(() =>
            modifyZipFileSync(configPath + "\\" + scean + ".fl", async (path) => {
              // do custom actions in the folder while it is unzipped
              await MEDDataObject.writeFileSync(flow, path, "metadata", "json")
              toast.success("Scene has been saved successfully")
            })
          )
        }
      }
    },
    [reactFlowInstance, MLType, intersections]
  )

  /**
   * Clear the canvas if the user confirms
   */
  const onClear = useCallback(() => {
    let confirmation = confirm("Are you sure you want to clear the canvas?\nEvery data will be lost.")
    if (confirmation) {
      setNodes([])
      setEdges([])
      setIntersections([])
    }
  }, [])

  useEffect(() => {
    console.log(scenName)
  }, [scenName])

  /**
   * Set the subflow id to null to go back to the main workflow
   */
  const onBack = useCallback(() => {
    changeSubFlow("MAIN")
  }, [])

  const getConfigs = (tree, i, result = []) => {
    let nodes = {}
    Object.keys(tree)?.map((nod) => {
      if (nodes[tree[nod].label]) {
        nodes[tree[nod].label] = [...nodes[tree[nod].label], tree[nod]]
      } else {
        nodes[tree[nod].label] = [tree[nod]]
      }
    })

    Object.keys(nodes).map((node) => {
      let initArray = nodes[node]
      initArray.map((ar, index) => {
        if (i == 0) {
          result.push({
            [ar.label]: ar
          })
        } else {
          if (index == 0) {
            result[result.length - 1] = {
              ...result[result.length - 1],
              [ar.label]: ar
            }
          } else {
            result.push({
              ...result[result.length - 1],
              [ar.label]: ar
            })
          }
        }

        result = getConfigs(ar.nodes, i + 1, result)
      })
    })

    return result
  }

  useEffect(() => {
    if (flConfigFile?.path != "") {
      setDBConfig(flConfigFile?.path)
    }
  }, [flConfigFile?.path])

  useEffect(() => {
    console.log(allConfigResults)
  }, [allConfigResults.length])

  return (
    <>
      {/* RUN the fl pipeline modal  */}
      <ServerLogosModal
        configs={nodes.filter((node) => node.type == "flRunServerNode") || []}
        show={serverRunning}
        onHide={() => {
          setServerRunning(false)
        }}
      ></ServerLogosModal>

      <FlWorflowBase
        // mandatory props
        mandatoryProps={{
          reactFlowInstance: reactFlowInstance,
          setReactFlowInstance: setReactFlowInstance,
          addSpecificToNode: addSpecificToNode,
          nodeTypes: nodeTypes,
          nodes: nodes,
          setNodes: setNodes,
          onNodesChange: onNodesChange,
          edges: edges,
          setEdges: setEdges,
          onEdgesChange: onEdgesChange,
          runNode: runNode
        }}
        // optional props
        onDeleteNode={onDeleteNode}
        groupNodeHandlingDefault={() => {}}
        onNodeDrag={onNodeDrag}
        uiTopLeft={<></>}
        // reprensents the visual over the workflow
        uiTopRight={
          <>
            {workflowType == mode && (
              <>
                <BtnDiv
                  buttonsList={[
                    { type: "run", onClick: onRun, disabled: !canRun },
                    { type: "clear", onClick: onClear },
                    {
                      type: "save",
                      onClick: () => {
                        configPath != "" ? onSave() : openSaveModal(true)
                      }
                    },
                    { type: "load", onClick: onLoad }
                  ]}
                />
              </>
            )}
          </>
        }
        uiTopCenter={
          <>
            {workflowType == "rwflNetwork" && (
              <>
                <div>
                  {groupNodeId.id != mode && (
                    <div className="subFlow-title">
                      Network name
                      <BtnDiv
                        buttonsList={[
                          {
                            type: "back",
                            onClick: onBack
                          }
                        ]}
                      />
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        }
        ui={
          <>
            {/* bottom center - progress bar */}
            <div className="panel-bottom-center">
              {isProgressUpdating && (
                <ProgressBarRequests
                  progressBarProps={{ animated: true, variant: "success" }}
                  isUpdating={isProgressUpdating}
                  setIsUpdating={setIsProgressUpdating}
                  progress={progress}
                  setProgress={setProgress}
                  requestTopic={"learning/progress/" + pageId}
                />
              )}
            </div>
          </>
        }
      />
    </>
  )
}

export default MedflrwWorkflow
