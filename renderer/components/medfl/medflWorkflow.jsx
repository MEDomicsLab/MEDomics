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
const MedflWorkflow = ({ setWorkflowType, workflowType }) => {
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
  const [showDBconfigModal, setDBModal] = useState(false)
  // const [showConfigModal, setconfigModal] = useState(true)

  const [optimResults, setOptimResults] = useState(null)
  const [optimType, setOptimType] = useState("")

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

  let ALL_CONFIGS = [
    {
      masterDatasetNode: {
        name: "Mimic_2017.csv",
        // path: "C:\\Users\\HP User\\Desktop\\MEDomicsLab\\DATA\\Mimic_ouael.csv",
        path: "C:\\Users\\HP User\\Desktop\\medfl_workspace\\DATA\\client_3_dataset.csv",
        target: "diabetes"
      },
      Network: {
        name: "Network",
        clients: [
          {
            name: "Client",
            type: "Train Node",
            dataset: {
              name: "Mimic_2017.csv",
              // path: "C:\\Users\\HP User\\Desktop\\MEDomicsLab\\DATA\\Mimic_ouael.csv"
              path: "C:\\Users\\HP User\\Desktop\\medfl_workspace\\DATA\\client_2_dataset.csv"
            }
          },
          {
            name: "Client",
            type: "Train node",
            dataset: {
              name: "Mimic_2017.csv",
              // path: "C:\\Users\\HP User\\Desktop\\MEDomicsLab\\DATA\\Mimic_ouael.csv"
              path: "C:\\Users\\HP User\\Desktop\\medfl_workspace\\DATA\\client_1_dataset.csv"
            }
          }
        ],
        server: {
          name: "FL Server",
          nRounds: 2,
          activateDP: "Deactivate"
        }
      },
      flSetupNode: {
        name: "FL Setup",
        description: "fsfsf"
      },
      flDatasetNode: {
        name: "FL Dataset",
        validationFraction: 0.1,
        testFraction: 0.2
      },
      flModelNode: {
        activateTl: "true",
        file: {
          name: "grid_search_classifier.pth",
          path: "C:\\Users\\HP User\\Desktop\\MEDomicsLab\\DATA\\diabetes_model2.pth"
        },
        optimizer: "Adam",
        "learning rate": 0.0001,
        Threshold: 0.4
      },
      flStrategyNode: {
        "Aggregation algorithm": "FedAvg",
        "Evaluation fraction": 1,
        "Training fraction": 1,
        "Minimal used clients for evaluation": 1,
        "Minimal used clients for training": 1,
        "Minimal available clients": 1
      },
      flTrainModelNode: { clientRessources: "Use GPU" },
      flSaveModelNode: { fileName: "resultsauto" },
      flMergeresultsNode: {
        files: [
          {
            name: "testResults.medflres",
            path: "C:\\Users\\HP User\\Desktop\\MEDomicsLab\\EXPERIMENTS\\FL\\Results\\testResults.medflres"
          }
        ],
        fileName: "automerge"
      }
    },
    {
      masterDatasetNode: {
        name: "Mimic_2017.csv",
        // path: "C:\\Users\\HP User\\Desktop\\MEDomicsLab\\DATA\\Mimic_ouael.csv",
        path: "C:\\Users\\HP User\\Desktop\\medfl_workspace\\DATA\\client_1_dataset.csv",
        target: "diabetes"
      },
      Network: {
        name: "Network",
        clients: [
          {
            name: "Client",
            type: "Train Node",
            dataset: {
              name: "Mimic_2017.csv",
              // path: "C:\\Users\\HP User\\Desktop\\MEDomicsLab\\DATA\\Mimic_ouael.csv"
              path: "C:\\Users\\HP User\\Desktop\\medfl_workspace\\DATA\\client_1_dataset.csv"
            }
          },
          {
            name: "Client",
            type: "Train node",
            dataset: {
              name: "Mimic_2017.csv",
              // path: "C:\\Users\\HP User\\Desktop\\MEDomicsLab\\DATA\\Mimic_ouael.csv"
              path: "C:\\Users\\HP User\\Desktop\\medfl_workspace\\DATA\\client_2_dataset.csv"
            }
          }
        ],
        server: {
          name: "FL Server",
          nRounds: 2,
          activateDP: "Deactivate"
        }
      },
      flSetupNode: {
        name: "FL Setup",
        description: "fsfsf"
      },
      flDatasetNode: {
        name: "FL Dataset",
        validationFraction: 0.1,
        testFraction: 0.2
      },
      flModelNode: {
        activateTl: "true",
        file: {
          name: "grid_search_classifier.pth",
          path: "C:\\Users\\HP User\\Desktop\\MEDomicsLab\\DATA\\diabetes_model2.pth"
        },
        optimizer: "Adam",
        "learning rate": 0.0001,
        Threshold: 0.1
      },
      flStrategyNode: {
        "Aggregation algorithm": "FedAvg",
        "Evaluation fraction": 1,
        "Training fraction": 1,
        "Minimal used clients for evaluation": 1,
        "Minimal used clients for training": 1,
        "Minimal available clients": 1
      },
      flTrainModelNode: { clientRessources: "Use GPU" },
      flSaveModelNode: { fileName: "resultsauto" },
      flMergeresultsNode: {
        files: [
          {
            name: "testResults.medflres",
            path: "C:\\Users\\HP User\\Desktop\\MEDomicsLab\\EXPERIMENTS\\FL\\Results\\testResults.medflres"
          }
        ],
        fileName: "automerge"
      }
    }
  ]
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
      flMergeresultsNode: FlCompareResults
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
          let subworkflowType = node.data.internal.subflowId != "MAIN" ? "flNetwork" : "fl"
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
      setWorkflowType("fl")
      hideNodesbut(groupNodeId.id)
    } else {
      setWorkflowType("flNetwork")
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
            let subworkflowType = node.data.internal.subflowId != "MAIN" ? "flNetwork" : "fl"
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
    setRunModal(true)

    if (reactFlowInstance) {
      getFlSettings(nodes)
    }
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
        if (configPath && configPath != "") {
          console.log("Heeeeeeere")
          modifyZipFileSync(configPath, async (path) => {
            // do custom actions in the folder while it is unzippsed
            await MEDDataObject.writeFileSync(flow, path, "metadata", "json")
            toast.success("Scene has been saved successfully")
          })
        } else {
          console.log("here", scean)
          console.log(globalData, "globalData")
          let configPath = globalData["ROOT"].path + "/EXPERIMENTS/FL/Sceans"
          createSceneContent(configPath, scean, "fl", null).then(() => {
            console.log("Scene created successfully ================== ")
            modifyZipFileSync(configPath + "/" + scean + ".fl", async (path) => {
              // do custom actions in the folder while it is unzipped
              await MEDDataObject.writeFileSync(flow, path, scean, "fl")
              toast.success("Scene has been saved successfully")
            })
          })
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

  const runFlPipeline = (flConfig, dbConfigfile) => {
    let JSONToSend = { flConfig: flConfig, dbConfigfile: dbConfigfile }

    setIsProgressUpdating(true)
    setIsUpdating(true)
    if (isUpdating) {
      console.log("")
    }
    requestBackend(
      // Send the request
      port,
      "/medfl/run-pipeline/" + pageId,
      JSONToSend,
      async (jsonResponse) => {
        if (jsonResponse.error) {
          if (typeof jsonResponse.error == "string") {
            jsonResponse.error = JSON.parse(jsonResponse.error)
          }
          setError(jsonResponse.error)
        } else {
          setIsUpdating(false) // Set the isUpdating to false
          console.log("jsonResponse", jsonResponse)
          toast.success(jsonResponse["stringFromBackend"])
          updateFlowResults(jsonResponse)
          // save the results on a file
          if (flConfig[0]?.flSaveModelNode?.fileName) {
            try {
              let path = Path.join(globalData[UUID_ROOT].path, EXPERIMENTS)

              MEDDataObject.createFolderFromPath(path + "/FL")
              MEDDataObject.createFolderFromPath(path + "/FL/Results")

              // do custom actions in the folder while it is unzipped
              await MEDDataObject.writeFileSync(jsonResponse["data"], path + "/FL/Results", flConfig[0]?.flSaveModelNode?.fileName, "json")
              await MEDDataObject.writeFileSync({ data: jsonResponse["data"], configs: flConfig, date: Date.now() }, path + "/FL/Results", flConfig[0]?.flSaveModelNode?.fileName, "medflres")

              toast.success("Experiment results saved successfuly ")
            } catch {
              toast.error("Something went wrong ")
            }
          }

          if (flConfig[0]?.flMergeresultsNode?.files) {
            let resultsFiles = flConfig[0]?.flMergeresultsNode?.files

            const readData = async (index, data) => {
              let resData = data
              if (index === resultsFiles.length) {
                return resData
              } else {
                try {
                  const fileData = await loadFileFromPathSync(resultsFiles[index].path)
                  return readData(index + 1, [...resData, fileData])
                } catch (error) {
                  console.error("Error loading file:", error)
                  return resData
                }
              }
            }

            readData(0, []).then(async (readData) => {
              let resultFileData = { data: jsonResponse["data"], configs: flConfig, date: Date.now() }

              readData.map((data) => {
                resultFileData = {
                  ...resultFileData,
                  data: resultFileData.data.concat(data.data),
                  configs: resultFileData.configs.concat(data.configs)
                }
              })
              try {
                let path = Path.join(globalData[UUID_ROOT].path, EXPERIMENTS)

                MEDDataObject.createFolderFromPath(path + "/FL")
                MEDDataObject.createFolderFromPath(path + "/FL/Results")

                // do custom actions in the folder while it is unzipped
                await MEDDataObject.writeFileSync(resultFileData["data"], path + "/FL/Results", fileName, "json")
                await MEDDataObject.writeFileSync(resultFileData, path + "/FL/Results", fileName, "medflres")

                toast.success("Experiment results saved successfuly ")
              } catch {
                toast.error("Something went wrong ")
              }
            })
          }
          setAllresults([...allConfigResults, jsonResponse])
          setRunModal(false)
          setTimeout(() => {
            setIsProgressUpdating(false)
          }, 2000)
        }
      },
      function (error) {
        setIsUpdating(false)
        setProgress({ now: 0, currentLabel: "Message sending failed ❌" })
        toast.error("Sending failed", error)
        console.log(error)
      }
    )
  }

  const createDBfile = (file) => {
    setDBConfig(file.path)
  }

  const setDBConfig = (filePath) => {
    let JSONToSend = { path: filePath }

    setIsProgressUpdating(true)
    setIsUpdating(true)

    requestBackend(
      // Send the request
      port,
      "/medfl/config-db/" + pageId,
      JSONToSend,
      (jsonResponse) => {
        if (jsonResponse.error) {
          if (typeof jsonResponse.error == "string") {
            jsonResponse.error = JSON.parse(jsonResponse.error)
          }
          setError(jsonResponse.error)
        } else {
          setIsUpdating(false) // Set the isUpdating to false
          console.log("jsonResponse", jsonResponse)
          setProgress({ now: 100, currentLabel: "Ceating the db config" }) // Set the progress value to 100 and show the message that the backend received from the frontend
          toast.success(jsonResponse["stringFromBackend"])
          setRunModal(false)
          setTimeout(() => {
            setIsProgressUpdating(false)
          }, 2000)
        }
      },
      function (error) {
        setIsUpdating(false)
        setProgress({ now: 0, currentLabel: "Message sending failed ❌" })
        toast.error("Sending failed", error)
        console.log(error)
      }
    )
  }

  // optimise hyperparameters
  const runFlOptimisation = (flConfig, dbConfigfile) => {
    let optim_params

    switch (flConfig[0]["flOptimizeNode"]["optimisation Type"]) {
      case "optunaCentral":
        optim_params = {
          num_layers: { low: flConfig[0]["flOptimizeNode"]["Number of layers"]["Min"], high: flConfig[0]["flOptimizeNode"]["Number of layers"]["Max"] },
          hidden_size: { low: flConfig[0]["flOptimizeNode"]["Hidden layers size"]["Min"], high: flConfig[0]["flOptimizeNode"]["Hidden layers size"]["Max"] },
          num_epochs: { low: flConfig[0]["flOptimizeNode"]["Number of epochs"]["Min"], high: flConfig[0]["flOptimizeNode"]["Number of epochs"]["Max"] },
          learning_rate: { low: flConfig[0]["flOptimizeNode"]["Learning rate"]["Min"], high: flConfig[0]["flOptimizeNode"]["Learning rate"]["Max"], log: true },
          optimizer: flConfig[0]["flOptimizeNode"]["Optimiser"],
          n_trials: flConfig[0]["flOptimizeNode"]["Number of trials"],
          batch_size: { low: 8, high: 256 }
        }
        break

      case "gridSearch":
        optim_params = {
          hidden_dim: flConfig[0]["flOptimizeNode"]["Hidden dimentions"].split(",").map(Number),
          lr: flConfig[0]["flOptimizeNode"]["Learning rate"].split(",").map(Number),
          pos_weight: [5],
          max_epochs: flConfig[0]["flOptimizeNode"]["Max epochs"].split(",").map(Number)
        }
        break

      default:
        break
    }

    console.log("this is is the optim params", optim_params)

    let JSONToSend = {
      flConfig: {
        dataset: flConfig[0]["masterDatasetNode"]["path"],
        target: flConfig[0]["masterDatasetNode"]["target"],
        param_grid: optim_params,
        metric: flConfig[0]["flOptimizeNode"]["Metric"],
        direction: flConfig[0]["flOptimizeNode"]["optimisation direction"],
        type: flConfig[0]["flOptimizeNode"]["optimisation Type"]
      },
      dbConfigfile: dbConfigfile
    }

    setIsProgressUpdating(true)
    setIsUpdating(true)
    if (isUpdating) {
      console.log("")
    }
    requestBackend(
      // Send the request
      port,
      "/medfl/param-optim/" + pageId,
      JSONToSend,
      (jsonResponse) => {
        if (jsonResponse.error) {
          if (typeof jsonResponse.error == "string") {
            jsonResponse.error = JSON.parse(jsonResponse.error)
          }
          setError(jsonResponse.error)
        } else {
          setIsUpdating(false) // Set the isUpdating to false
          console.log("jsonResponse", jsonResponse)
          toast.success(jsonResponse["stringFromBackend"])
          setOptimResults(jsonResponse)
          setRunModal(false)
          setTimeout(() => {
            setIsProgressUpdating(false)
          }, 2000)
        }
      },
      function (error) {
        setIsUpdating(false)
        setProgress({ now: 0, currentLabel: "Message sending failed ❌" })
        toast.error("Sending failed", error)
        console.log(error)
      }
    )
  }

  useEffect(() => {
    console.log(allConfigResults)
  }, [allConfigResults.length])

  return (
    <>
      {/* DB config modal */}
      <DBCOnfigFileModal
        show={showDBconfigModal}
        onHide={() => setDBModal(false)}
        setFile={setConfigFile}
        configFile={flConfigFile}
        onConfirm={() => {
          createDBfile(flConfigFile)
        }}
      />
      <Modal show={isSaveModal} onHide={() => openSaveModal(false)} centered>
        <Modal.Header>
          <Modal.Title> Save scean</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <FlInput
            name="file name"
            settingInfos={{
              type: "string",
              tooltip: "<p>Specify a data file (xlsx, csv, json)</p>"
            }}
            currentValue={scenName}
            onInputChange={(e) => {
              setSceanName(e.value)
              console.log(e.value)
              console.log(scenName)
            }}
            setHasWarning={() => {}}
          />
        </Modal.Body>
        <Modal.Footer>
          <Button label="Save Scean" icon="pi pi-save" className="p-button-primary" onClick={() => onSave(scenName)} disabled={!scenName || scenName == ""}></Button>
        </Modal.Footer>
      </Modal>
      {/* set the fl config file  */}

      {/* <FlConfigModal
        show={showConfigModal}
        onHide={() => {
          setconfigModal(false)
        }}
      /> */}
      <OptimResultsModal
        show={optimResults}
        onHide={() => {
          updatePipelineConfigs
          setOptimResults(null)
        }}
        results={optimResults ? optimResults : {}}
        title={optimType == "gridSearch" ? "GRID Search optimisation results" : "Optuna central optimization"}
      />

      {/* RUN the fl pipeline modal  */}
      <RunPipelineModal
        show={showRunModal}
        onHide={() => {
          console.log(nodes)
          setRunModal(false)
        }}
        configs={getConfigs(treeData, 0)}
        nodes={nodes}
        onRun={(flConfig, mode) => {
          // updatePipelineConfigs(ALL_CONFIGS)
          updatePipelineConfigs(flConfig)

          setRunModal(false)

          if (mode == "run") {
            // runFlPipeline(ALL_CONFIGS, flConfigFile?.path)
            runFlPipeline(flConfig, flConfigFile?.path)
          } else {
            setOptimType(flConfig[0]["flOptimizeNode"]["optimisation Type"])
            runFlOptimisation(flConfig, flConfigFile?.path)
          }
        }}
      />
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
        uiTopLeft={
          <Button onClick={() => setDBModal(true)} label="Select a DB file" icon="pi pi-cog" severity="primary" outlined badge={flConfigFile?.path == "" ? "!" : ""} badgeClassName="p-badge-warning" />
        }
        // reprensents the visual over the workflow
        uiTopRight={
          <>
            {workflowType == "fl" && (
              <>
                <BtnDiv
                  buttonsList={[
                    { type: "run", onClick: onRun, disabled: !canRun },
                    { type: "clear", onClick: onClear },
                    {
                      type: "save",
                      onClick: () => {
                        configPath && configPath != "" ? onSave() : openSaveModal(true)
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
            {workflowType == "flNetwork" && (
              <>
                <div>
                  {groupNodeId.id != "fl" && (
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

export default MedflWorkflow
