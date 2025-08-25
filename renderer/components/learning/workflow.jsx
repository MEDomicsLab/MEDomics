import { useState, useCallback, useMemo, useEffect, useContext, forwardRef, useImperativeHandle } from "react"
import uuid from "react-native-uuid"
import { toast } from "react-toastify"
import Form from "react-bootstrap/Form"
import { useNodesState, useEdgesState, useReactFlow, addEdge } from "reactflow"
import WorkflowBase from "../flow/workflowBase"
import { loadJsonSync } from "../../utilities/fileManagementUtils"
import { requestBackend } from "../../utilities/requests"
import EditableLabel from "react-simple-editlabel"
import BtnDiv from "../flow/btnDiv"
import ProgressBarRequests from "../generalPurpose/progressBarRequests"
import { PageInfosContext } from "../mainPages/moduleBasics/pageInfosContext"
import { FlowFunctionsContext } from "../flow/context/flowFunctionsContext"
import { FlowResultsContext } from "../flow/context/flowResultsContext"
import { WorkspaceContext } from "../workspace/workspaceContext"
import { ErrorRequestContext } from "../generalPurpose/errorRequestContext.jsx"
import { sceneDescription } from "../../public/setupVariables/learningNodesParams.jsx"
import { DataContext } from "../workspace/dataContext.jsx"
import { randomUUID } from "crypto"
import { insertMEDDataObjectIfNotExists } from "../mongoDB/mongoDBUtils.js"

// here are the different types of nodes implemented in the workflow
import StandardNode from "./nodesTypes/standardNode"
import SelectionNode from "./nodesTypes/selectionNode"
import GroupNode from "../flow/groupNode"
import DatasetNode from "./nodesTypes/datasetNode"
import LoadModelNode from "./nodesTypes/loadModelNode"
import TrainModelNode from "./nodesTypes/trainModelNode.jsx"
import boxNode from "./nodesTypes/boxNode.jsx"
import ResizableGroupNode from "./nodesTypes/resizableGroupNode.jsx"
import analysisBoxNode from "./nodesTypes/analysisBoxNode.jsx"
import CombineModelsNode from "./nodesTypes/combineModelsNode.jsx"
import SplitNode from "./nodesTypes/splitNode.jsx"

// here are the parameters of the nodes
import nodesParams from "../../public/setupVariables/allNodesParams"
import classificationSettings from "../../public/setupVariables/possibleSettings/learning/classificationSettings.js"

// here are static functions used in the workflow
import { removeDuplicates, deepCopy } from "../../utilities/staticFunctions"
import { defaultValueFromType } from "../../utilities/learning/inputTypesUtils.js"
import { FlowInfosContext } from "../flow/context/flowInfosContext.jsx"
import { overwriteMEDDataObjectContent } from "../mongoDB/mongoDBUtils.js"
import { getCollectionData } from "../dbComponents/utils.js"
import { MEDDataObject } from "../workspace/NewMedDataObject.js"
import { Tooltip } from "primereact/tooltip"
import { Tag } from "primereact/tag"

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
const Workflow = forwardRef(({ setWorkflowType, workflowType, isExperiment }, ref) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]) // nodes array, setNodes is used to update the nodes array, onNodesChange is a callback hook that is executed when the nodes array is changed
  const [edges, setEdges, onEdgesChange] = useEdgesState([]) // edges array, setEdges is used to update the edges array, onEdgesChange is a callback hook that is executed when the edges array is changed
  const [reactFlowInstance, setReactFlowInstance] = useState(null) // reactFlowInstance is used to get the reactFlowInstance object important for the reactFlow library
  const [MLType, setMLType] = useState("classification") // MLType is used to know which machine learning type is selected
  const [treeData, setTreeData] = useState({}) // treeData is used to set the data of the tree menu
  const [intersections, setIntersections] = useState([]) // intersections is used to store the intersecting nodes related to optimize nodes start and end
  const [boxIntersections, setBoxIntersections] = useState({}) // boxIntersections is used to store the intersecting nodes related to box nodes
  const [isProgressUpdating, setIsProgressUpdating] = useState(false) // progress is used to store the progress of the workflow execution
  const [metadataFileID, setMetadataFileID] = useState(null) // the metadata file in the .medml folder containing the frontend workflow
  const [backendMetadataFileID, setBackendMetadataFileID] = useState(null) // the metadata file in the .medml folder containing the backend workflow
  const [isInitialized, setIsInitialized] = useState(false)
  const [progress, setProgress] = useState({
    now: 0,
    currentLabel: ""
  })

  const { setViewport } = useReactFlow() // setViewport is used to update the viewport of the workflow
  const { getIntersectingNodes } = useReactFlow() // getIntersectingNodes is used to get the intersecting nodes of a node

  const { groupNodeId, changeSubFlow, hasNewConnection } = useContext(FlowFunctionsContext)
  const { pageId } = useContext(PageInfosContext) // used to get the page infos such as id and config path
  const { updateFlowResults, isResults } = useContext(FlowResultsContext)
  const { canRun, sceneName, setSceneName } = useContext(FlowInfosContext)
  const { port } = useContext(WorkspaceContext)
  const { setError } = useContext(ErrorRequestContext)
  const { globalData } = useContext(DataContext)

  // declare node types using useMemo hook to avoid re-creating component types unnecessarily (it memorizes the output) https://www.w3schools.com/react/react_usememo.asp
  const nodeTypes = useMemo(
    () => ({
      standardNode: StandardNode,
      splitNode: SplitNode,
      selectionNode: SelectionNode,
      boxNode, boxNode,
      analysisBoxNode: analysisBoxNode,
      ResizableGroupNode: ResizableGroupNode,
      CombineModelsNode: CombineModelsNode,
      groupNode: GroupNode,
      datasetNode: DatasetNode,
      loadModelNode: LoadModelNode,
      trainModelNode: TrainModelNode
    }),
    []
  )

  // Set initialized when isExperiment loads
  useEffect(() => {
    if (isExperiment !== undefined) {
      setIsInitialized(true);
    }
  }, [isExperiment])

  // When config is changed, we update the workflow
  useEffect(() => {
    async function getConfig() {
      // Get Config file
      if (globalData[pageId]?.childrenIDs) {
        let configToLoad = MEDDataObject.getChildIDWithName(globalData, pageId, "metadata.json")
        setMetadataFileID(configToLoad)
        setBackendMetadataFileID(MEDDataObject.getChildIDWithName(globalData, pageId, "backend_metadata.json"))
        if (configToLoad) {
          let jsonContent = await getCollectionData(configToLoad)
          updateScene(jsonContent[0])
          toast.success("Config file has been loaded successfully")
        } else {
          console.log("No config file found for this page, base workflow will be used")
        }
      }
      // Get Results if exists
      if (globalData[pageId]?.parentID) {
        const parentID = globalData[pageId].parentID
        setSceneName(globalData[parentID].name)
        const existingResultsName = globalData[pageId].name + "res"
        const existingResultsID = MEDDataObject.getChildIDWithName(globalData, parentID, existingResultsName)
        if (existingResultsID) {
          const jsonResultsID = MEDDataObject.getChildIDWithName(globalData, existingResultsID, "results.json")
          if (jsonResultsID) {
            const jsonResults = await getCollectionData(jsonResultsID)
            delete jsonResults[0]["_id"]
            updateFlowResults(jsonResults[0], parentID)
          }
        }
      }
    }
    getConfig()
  }, [pageId])

  // when isResults is changed, we set the progressBar to completed state
  useEffect(() => {
    if (isResults) {
      setProgress({
        now: 100,
        currentLabel: "Done!"
      })
    }
  }, [isResults])

  // Example function you want to expose
  const triggerAction = (modelToFinalize, modelName) => {
    // Run experiment with finalize and save
    onRun(null, null, true, modelToFinalize, modelName)
  }

  useImperativeHandle(ref, () => ({
    triggerAction
  }))

  const createBoxNode = (position, node, id) => {
    const { nodeType, name, draggable, selectable, image, size, borderColor, selectedBorderColor } = node
    let newNode = {
      id: id,
      type: nodeType,
      name: name,
      draggable: draggable, // if draggable is not defined, it is set to true by default
      selectable: selectable, // if selectable is not defined, it is set to true by default
      position,
      style: {
        zIndex: -1
      }, // style of the node, used to set the zIndex of the node
      data: {
        // here is the data accessible by children components
        internal: {
          name: name,
          img: image,
          type: name.toLowerCase().replaceAll(" ", "_"),
          results: { checked: false, contextChecked: false },
          borderColor: borderColor, // borderColor is used to set the border color of the node
          selectedBorderColor: selectedBorderColor, // selectedBorderColor is used to set the border color of the node when it is selected
          subflowId: "MAIN", // subflowId is used to know which group the node belongs to
          hasRun: false
        },
        setupParam: {
          possibleSettings: {}
        },
        size: size, // size of the node, used to set the width and height of the node
        tooltipBy: "node" // this is a default value that can be changed in addSpecificToNode function see workflow.jsx for example
      }
    }
    if (nodeType == "analysisBoxNode") {
      newNode.data.setupParam = {
        input: ["model"],
        output: [],
        classes: "action analyze run endNode",
        possibleSettings: {
          plot: "auc",
          scale: "1"
        }
      }
    }
    return newNode
  }

  // executed when the machine learning type is changed
  // it updates the possible settings of the nodes
  useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => {
        // it's important that you create a new object here in order to notify react flow about the change
        node.data = {
          ...node.data
        }
        if (!node.id.includes("opt") && !node.id.startsWith("box-")) {
          let subworkflowType = node.data.internal.subflowId != "MAIN" ? "optimize" : "learning"
          node.data.setupParam.possibleSettings = deepCopy(staticNodesParams[subworkflowType][node.data.internal.type]["possibleSettings"][MLType])
          console.log(node.type)
          if (node.type == "trainModelNode") {
            node.data.setupParam.possibleSettingsTuning = deepCopy(staticNodesParams["optimize"]["tune_model"]["possibleSettings"][MLType])
            node.data.internal.checkedOptionsTuning = []
            node.data.internal.settingsTuning = {}
            node.data.internal.settingsCalibration = {}
            node.data.internal.settingsEnsembling = {}
          }
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
    const createDefaultBoxes = () => {
      let boxes = []
      let newId = ''
      let initBox = createBoxNode(
        { x: 0, y: 0 },
        {
          nodeType: "boxNode",
          name: "Initialization",
          draggable: false,
          selectable: true,
          image: "",
          size: { width: 700, height: 1000 },
          borderColor: "rgba(173, 230, 150, 0.8)",
          selectedBorderColor: "rgb(255, 187, 0)",
        },
        "box-initialization"
      )
      let trainBox = createBoxNode(
        { x: 800, y: 250 },
        {
          nodeType: "boxNode",
          name: "Training",
          draggable: false,
          selectable: true,
          image: "",
          size: { width: 500, height: 500 },
          borderColor: "rgba(173, 230, 150, 0.8)",
          selectedBorderColor: "rgb(255, 187, 0)",
        },
        "box-training"
      )
      let analysisBox = createBoxNode(
        { x: 1500, y: 350 },
        {
          nodeType: "analysisBoxNode",
          name: "Analysis",
          draggable: false,
          selectable: true,
          image: "",
          size: { width: 500, height: 300 },
          borderColor: "rgba(150, 201, 230, 0.8)",
          selectedBorderColor: "rgb(255, 187, 0)",
        },
        "box-analysis"
      )
      const newBoxes = [initBox, trainBox, analysisBox]
      newBoxes.forEach((box) => {
        const exists = nodes.find((node) => node.name == box.name && (node.type == "boxNode" || node.type == "analysisBoxNode"))
        if (exists && exists.type === "analysisBoxNode" && !exists.data.setupParam) {
          // If the analysis box exists but does not have setupParam, we need to update it
          setNodes((nds) =>
            nds.map((node) => {
              if (node.id === exists.id) {
                node.data.setupParam = {
                  input: ["model"],
                  output: [],
                  classes: "action analyze run endNode",
                  possibleSettings: {
                    plot: "auc",
                    scale: "1"
                  }
                }
              }
              return node
            })
          )
          return
        }
        if (exists) return
        newId = `box-node_${uuid.v4()}`
        box = addSpecificToNode(box)
        boxes.push(box)
      })
      if (boxes.length > 0) setNodes((nds => [...nds, ...boxes])) // add the boxes to the nodes array
    }
    if (isInitialized) {
      createDefaultBoxes() // create default boxes to add to the workflow
    }
    checkDuplicateModelNodes(nodes) // check for duplicate model nodes and show a warning
    setTreeData(createTreeFromNodes())
    updateTrainModelNode(nodes, edges)
    cleanTrainModelNode(nodes)
    updateSplitNodesColumns(nodes)
  }, [nodes, edges, isExperiment, isInitialized])

  // Check if there are duplicate model nodes and show a warning if there are
  const checkDuplicateModelNodes = (nodes) => {
    const duplicateNodes = nodes.filter((node, index) => node.data.internal.nameID && nodes.findIndex((n) => n.data.internal.nameID === node.data.internal.nameID) !== index)
    if (duplicateNodes.length > 0) {
      const nonDuplicateNodes = nodes.filter((node) => !duplicateNodes.includes(node))
      duplicateNodes.forEach((node) => {
        if (node.data.internal.hasWarning && !node.data.internal.hasWarning.state) {
          node.data.internal.hasWarning = { state: true, tooltip: <p>This node shares the same ID with another node. To avoid conflicts, please update it.</p> }
          setNodes((nds) =>
            nds.map((n) => {
              if (n.id === node.id) {
                n.data.internal = node.data.internal
              }
              return n
            })
          )
        }
      })
      nonDuplicateNodes.length > 0 && nonDuplicateNodes.forEach((node) => {
        if (node.data.internal.hasWarning && node.data.internal.hasWarning.state && node.data.internal.hasWarning.tooltip.props.children.startsWith("This node shares the same ID")) {
          node.data.internal.hasWarning = { state: false }
          setNodes((nds) =>
            nds.map((n) => {
              if (n.id === node.id) {
                n.data.internal = node.data.internal
              }
              return n
            })
          )
        }
      })
    } else {
      // Remove warnings if no duplicates are found
      nodes.forEach((node) => {
        if (node.data.internal.hasWarning && node.data.internal.hasWarning.state && node.data.internal.hasWarning.tooltip.props.children.startsWith("This node shares the same ID")) {
          node.data.internal.hasWarning = { state: false }
          setNodes((nds) =>
            nds.map((n) => {
              if (n.id === node.id) {
                n.data.internal = node.data.internal
              }
              return n
            })
          )
        }
      })
    }
  }

  // Update split node columns
  const updateSplitNodesColumns = (nodes) => {
    const splitNodes = nodes.filter((node) => node.type === "splitNode")
    if (splitNodes.length === 0) return
    const datasetNodes = nodes.filter((node) => node.type === "datasetNode")
    if (datasetNodes.length === 0) return
    const cleanNodes = nodes.filter((node) => node.type === "standardNode" && node.name == "Clean")
    // Link split nodes to dataset nodes
    let dataSplitCouples = {}
    if (cleanNodes.length === 0) {
      edges.forEach((edge) => {
        datasetNodes.forEach((datasetNode) => {
          splitNodes.forEach((splitNode) => {
            if (edge.source === datasetNode.id && edge.target === splitNode.id) {
              if (!dataSplitCouples[datasetNode.id]) {
                dataSplitCouples[datasetNode.id] = {}
              }
              dataSplitCouples[datasetNode.id] = splitNode.id
            }
          })
        })
      })
    } else {
      let dataCleanCouples = {}
      edges.forEach((edge) => {
        datasetNodes.forEach((datasetNode) => {
          cleanNodes.forEach((cleanNode) => {
            if (edge.source === datasetNode.id && edge.target === cleanNode.id) {
              if (!dataCleanCouples[datasetNode.id]) {
                dataCleanCouples[datasetNode.id] = {}
              }
              dataCleanCouples[datasetNode.id] = cleanNode.id
            }
          })
        })
      })
      edges.forEach((edge) => {
        Object.keys(dataCleanCouples).length > 0 && Object.keys(dataCleanCouples).forEach((datasetNodeId) => {
          const cleanNodeId = dataCleanCouples[datasetNodeId]
          splitNodes.forEach((splitNode) => {
            if (edge.source === cleanNodeId && edge.target === splitNode.id) {
              if (!dataSplitCouples[datasetNodeId]) {
                dataSplitCouples[datasetNodeId] = {}
              }
              dataSplitCouples[datasetNodeId] = splitNode.id
            }
          })
        })
      })
    }
    let needsUpdate = false
    Object.keys(dataSplitCouples).length > 0 && Object.keys(dataSplitCouples).forEach((datasetNodeId) => {
      const splitNodeId = dataSplitCouples[datasetNodeId]
      const datasetNode = nodes.find((node) => node.id === datasetNodeId)
      const splitNode = nodes.find((node) => node.id === splitNodeId)
      if (!splitNode.data.internal.settings.columns) needsUpdate = true
      if (datasetNode.data.internal.settings.columns && splitNode.data.internal.settings.columns && datasetNode.data.internal.settings.columns !== splitNode.data.internal.settings.columns) needsUpdate = true
    })
    if (!needsUpdate) return
    Object.keys(dataSplitCouples).length > 0 && Object.keys(dataSplitCouples).forEach((datasetNodeId) => {
      const splitNodeId = dataSplitCouples[datasetNodeId]
      const datasetNode = nodes.find((node) => node.id === datasetNodeId)
      const splitNode = nodes.find((node) => node.id === splitNodeId)
      if (datasetNode.data.internal.settings.columns && splitNode.data.internal.settings.columns && datasetNode.data.internal.settings.columns === splitNode.data.internal.settings.columns) return
      splitNode.data.internal.datasetId = datasetNodeId
      if (datasetNode && splitNode && datasetNode.data.internal.settings.columns) {
        splitNode.data.internal.settings.columns = datasetNode.data.internal.settings.columns
        if (datasetNode.data.internal.settings.files) {
          splitNode.data.internal.settings.files = datasetNode.data.internal.settings.files
        }
        splitNode.data.internal.settings.useTags = splitNode.data.internal.settings.useTags || false
        setNodes((nds) =>
          nds.map((node) => {
            if (node.id === splitNodeId) {
              node.data.internal = splitNode.data.internal
            }
            return node
          })
        )
      }
    })
  }


  const cleanTrainModelNode = (nodes) => {
    // Find the relevant train model node
    const trainModelNode = nodes.find(
      (node) => node.type === "trainModelNode" && node.data.internal.subflowId === groupNodeId.id
    )
    
    // If no train model node found, exit early
    if (!trainModelNode) return
    
    // Find all model selection nodes in the same subflow
    const modelSelectionNodes = nodes.filter(
      (node) => 
        node.type === "selectionNode" && 
        node.data.internal.subflowId === groupNodeId.id && 
        node.data.internal.type === "model"
    )
    
    // Get the tuning grid from the train model node
    const { tuningGrid } = trainModelNode.data.internal
    
    // If no tuning grid or empty tuning grid, exit early
    if (!tuningGrid || Object.keys(tuningGrid).length === 0) return
    
    // Create a set of existing model selections for faster lookups
    const existingModelSelections = new Set(
      modelSelectionNodes.filter((node) => node.data.internal.checkedOptions.length > 0).map(node => node.id)
    )
    
    // Get models to remove (those without corresponding selection nodes)
    const modelsToRemove = Object.keys(tuningGrid).filter(
      model => !existingModelSelections.has(model)
    )
    
    // If all models need to be removed or no models to remove, handle accordingly
    const allModelsNeedRemoval = modelsToRemove.length === Object.keys(tuningGrid).length
    if (modelsToRemove.length === 0 && !allModelsNeedRemoval) return
    
    // If no valid model selections remain, remove the tuningGrid completely
    // Otherwise, update it with the filtered version
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === trainModelNode.id) {
          const updatedInternal = { ...node.data.internal }
          if (modelsToRemove.length > 0) {
            modelsToRemove.forEach(model => {
              delete updatedInternal.tuningGrid[model]
              delete updatedInternal[model]
            })
          }
          else if (modelSelectionNodes.length === 0) {
            // Remove tuningGrid key completely when no models remain
            delete updatedInternal.tuningGrid
          }
          node.data.internal = updatedInternal
        }
        return node
      })
    )
  }

  const updateTrainModelNode = (nodes) => {
    const trainModelNode = nodes.find((node) => node.type == "trainModelNode" && node.data.internal.subflowId == groupNodeId.id)
    if (trainModelNode) {
      // Update tuning related settings
      let tuneModel = trainModelNode.data.internal.hasOwnProperty("isTuningEnabled") ? trainModelNode.data.internal.isTuningEnabled : false
      const listModelSelectionNode = nodes.filter((node) => node.type == "selectionNode" && node.data.internal.subflowId == groupNodeId.id&& node.data.internal.type == "model")
      for (const modelSelectionNode of listModelSelectionNode) {
        let newTrainModelNode = deepCopy(trainModelNode)
        let selectedModel = modelSelectionNode.id
        let modelName = modelSelectionNode.data.internal.selection
        let modelFullName = modelSelectionNode.data.setupParam.possibleSettings[modelName].label
        if (Object.keys(modelSelectionNode.data.internal.settings).length > 0) {
          let filled = newTrainModelNode.data.internal.tuningGrid ? Object.keys(newTrainModelNode.data.internal.tuningGrid).length > 0 : false
          newTrainModelNode.data.internal.tuningGrid = filled ? deepCopy(newTrainModelNode.data.internal.tuningGrid) : {}
          if (!newTrainModelNode.data.internal.hasOwnProperty("modelsInfo")) {
            newTrainModelNode.data.internal["modelsInfo"] = {}
          }
          if (selectedModel) {
            newTrainModelNode.data.internal.tuningGrid[selectedModel] = newTrainModelNode.data.internal.tuningGrid[selectedModel] ? deepCopy(newTrainModelNode.data.internal.tuningGrid[selectedModel]) : {}
            let alreadyUpdated = true
            if (!newTrainModelNode.data.internal.modelsInfo.hasOwnProperty(selectedModel)) {
              newTrainModelNode.data.internal.modelsInfo[selectedModel] = {
                id: modelSelectionNode.id,
                nameID: modelSelectionNode.data.internal.nameID,
                name: modelFullName
              }
            }
            Object.keys(modelSelectionNode.data.internal.settings).forEach((setting) => {
              if (newTrainModelNode.data.internal.tuningGrid[selectedModel] && newTrainModelNode.data.internal.tuningGrid[selectedModel].hasOwnProperty(setting)) {
                if (!modelSelectionNode.data.internal.checkedOptions.includes(setting)) {
                  delete newTrainModelNode.data.internal.tuningGrid[selectedModel][setting]
                  alreadyUpdated = false
                  return
                }
                if (newTrainModelNode.data.internal.tuningGrid[selectedModel].hasOwnProperty("options")) {
                  if (!newTrainModelNode.data.internal.tuningGrid[selectedModel].options.hasOwnProperty(setting)) {
                    alreadyUpdated = false
                    return
                  }
                } else {
                  newTrainModelNode.data.internal.tuningGrid[selectedModel] = {
                    ...newTrainModelNode.data.internal.tuningGrid[selectedModel],
                    ...modelSelectionNode.data.internal.settings
                  }
                  alreadyUpdated = false
                  return
                }
              } else {
                newTrainModelNode.data.internal.tuningGrid[selectedModel] = {
                  ...newTrainModelNode.data.internal.tuningGrid[selectedModel],
                  ...modelSelectionNode.data.internal.settings
                }
                alreadyUpdated = false
                return
              }
            })
            newTrainModelNode.data.internal.tuningGrid[selectedModel] && (Object.keys(newTrainModelNode.data.internal.tuningGrid[selectedModel]).forEach((setting) => {
              if (setting !== "options" && !modelSelectionNode.data.internal.checkedOptions.includes(setting)) {
                delete newTrainModelNode.data.internal.tuningGrid[selectedModel][setting]
                alreadyUpdated = false
              }
            }))
            if (!alreadyUpdated) {
              newTrainModelNode.data.internal.tuningGrid[selectedModel] = {
                ...newTrainModelNode.data.internal.tuningGrid[selectedModel],
                ...{options: modelSelectionNode.data.setupParam.possibleSettings[modelName].options}
              }

              setNodes((nds) =>
                nds.map((node) => {
                  if (node.id == trainModelNode.id) {
                    node.data.internal = newTrainModelNode.data.internal
                    node.data.internal.isTuningEnabled = tuneModel
                  }
                  return node
                })
              )
            } else {
              continue
            }
          }
        }
      }
      // Update ensemble related settings
      if (trainModelNode.data.internal.hasOwnProperty("ensembleOptions") && trainModelNode.data.internal.ensembleOptions) return
      const ensembleOptions = classificationSettings.ensemble_model.options
      trainModelNode.data.internal.ensembleOptions = ensembleOptions
      trainModelNode.data.internal.hasOwnProperty("settingsEnsembling") || (trainModelNode.data.internal.settingsEnsembling = {})
      Object.keys(ensembleOptions).forEach((option) => {
        if (!trainModelNode.data.internal.settingsEnsembling.hasOwnProperty(option)) {
          trainModelNode.data.internal.settingsEnsembling[option] = ensembleOptions[option].default_val
        }
      })
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id == trainModelNode.id) {
            node.data.internal = trainModelNode.data.internal
          }
          return node
        })
      )

      // Update calibration related settings
      if (trainModelNode.data.internal.hasOwnProperty("calibrateOptions") && trainModelNode.data.internal.calibrateOptions) return
      const calibrateOptions = classificationSettings.calibrate_model.options
      trainModelNode.data.internal.calibrateOptions = calibrateOptions
      trainModelNode.data.internal.hasOwnProperty("settingsCalibration") || (trainModelNode.data.internal.settingsCalibration = {})
      Object.keys(calibrateOptions).forEach((option) => {
        if (!trainModelNode.data.internal.settingsCalibration.hasOwnProperty(option)) {
          trainModelNode.data.internal.settingsCalibration[option] = calibrateOptions[option].default_val
        }
      })
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id == trainModelNode.id) {
            node.data.internal = trainModelNode.data.internal
          }
          return node
        })
      )
    }
  }

  // execute this when groupNodeId change. I put it in useEffect because it assures groupNodeId is updated
  useEffect(() => {
    if (groupNodeId.id == "MAIN") {
      setWorkflowType("learning")
      hideNodesbut(groupNodeId.id)
    } else {
      setWorkflowType("optimize")
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
      // for each edge, we check if the source node is the current node
      edges.forEach((edge) => {
        if (edge.source == node.id) {
          // we find the target node associated with the edge
          let targetNode = deepCopy(nodes.find((node) => node.id === edge.target))
          if (targetNode.type != "groupNode") {
            let subIdText = ""
            let subflowId = targetNode.data.internal.subflowId
            if (subflowId != "MAIN") {
              subIdText = deepCopy(nodes.find((node) => node.id == subflowId)).data.internal.name + "."
            }
            children[targetNode.id] = {
              label: subIdText + targetNode.data.internal.name,
              nodes: createTreeFromNodesRec(targetNode)
            }
          }
        }
      })
      return children
    }

    let treeMenuData = {}
    edges.forEach((edge) => {
      let sourceNode = deepCopy(nodes.find((node) => node.id === edge.source))
      if (sourceNode.data.setupParam.classes.split(" ").includes("startNode")) {
        treeMenuData[sourceNode.id] = {
          label: sourceNode.data.internal.name,
          nodes: createTreeFromNodesRec(sourceNode)
        }
      }
    })

    return treeMenuData
  }

  useEffect(() => {
    if (Object.keys(boxIntersections).length > 0) {
      Object.keys(boxIntersections).map(((boxId) => {
        const foundOutlier = boxIntersections[boxId].some((target => {
          const targetNode = nodes.find((node) => node.id === target)
          if (!targetNode) return // If the target node is not found, exit early
          return targetNode.data.setupParam.section.toLowerCase() !== boxId.split("-")[1].split(".")[0]
        }))
        if (foundOutlier) {
          // Update the box color to red if the section does not match
          changeBoxColor(boxId, "rgba(255, 0, 0, 0.8)", "rgb(255, 0, 0)")
        } else {
          if (boxId.includes("analysis")) {
            // If the box is an analysis box, we set the color to blue
            changeBoxColor(boxId, "rgba(150, 201, 230, 0.8)", "rgb(255, 187, 0)")
          } else {
            // Update the box color to green if the section matches
            changeBoxColor(boxId, "rgba(173, 230, 150, 0.8)", "rgb(255, 187, 0)")
          }
        }
      }))
    } else {
      // Ensure all boxes are green if no intersections are found
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id.startsWith("box-")) {
            if (node.type === "analysisBoxNode") {
              // If the box is an analysis box, we set the color to blue
              changeBoxColor(node.id, "rgba(150, 201, 230, 0.8)", "rgb(255, 187, 0)")
            } else {
              // If not, we set the color to green
              changeBoxColor(node.id, "rgba(173, 230, 150, 0.8)", "rgb(255, 187, 0)")
            }
          }
          return node
        })
      )
    }
  }, [boxIntersections])

  const changeBoxColor = (nodeId, color, onSelectedColor) => {
    // This function changes the color of the box node
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          node.data.internal.borderColor = color
          node.data.internal.selectedBorderColor = onSelectedColor
        }
        return node
      })
    )
  }

  const handleIntersectionWithBox = (source, targets=[]) => {
    // This function checks if the node is intersecting with a box node
    // If it is, it adds the intersection to the intersections array
    if (targets.length !== 0){
      let newIntersections = targets.filter((int) => int.startsWith("box-"))
      newIntersections.forEach((int) => {
        if (!Object.keys(boxIntersections).includes(int) || boxIntersections[int].length == 0 || !boxIntersections[int].includes(source.id)) {
          setBoxIntersections(prev => ({
            ...prev,
            [int]: [...new Set([...(prev[int] || []), source.id])]
          }))
        }
      })
      // Remove source.id from boxes not listed in targets
      Object.keys(boxIntersections).forEach((boxId) => {
        if (!newIntersections.includes(boxId) && boxIntersections[boxId]?.includes(source.id)) {
          setBoxIntersections(prev => ({
            ...prev,
            [boxId]: prev[boxId].filter(item => item !== source.id)
          }))
        }
      })
    } else {
      // Remove source.id from all box intersections
      Object.keys(boxIntersections).forEach((boxId) => {
        if (!boxIntersections[boxId]?.includes(source.id)) return
        setBoxIntersections(prev => ({
          ...prev,
          [boxId]: prev[boxId].filter(item => item !== source.id)
        }))
      })
    }
  }

  /**
   * @param {Object} event event object
   * @param {Object} node node object
   *
   * This function is called when a node is dragged
   * It checks if the node is intersecting with another node
   * If it is, it adds the intersection to the intersections array
   */
  const onNodeDrag = useCallback((event, node) => {
      const intersectingNodes = getIntersectingNodes(node)
      let rawIntersects = intersectingNodes.map((n) => n.id)

      // Handle intersection with box nodes
      handleIntersectionWithBox(node, rawIntersects)

      // Filter out nodes that are not in the same subflow as the current node
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

      if (!node.data.setupParam.section) return
      const boxNode = nodes.find((n) => n.id.startsWith("box-") && n.name.toLowerCase() === node.data.setupParam.section.toLowerCase())
      if (!boxNode) return
      const maxPosX = boxNode ? boxNode.position.x + boxNode.width - node.width : 1000 // Default max position if no box node found
      const minPosX = boxNode ? boxNode.position.x + 60 : 0 // Default min position if no box node  (60 is side bar width)
      const maxPosY = boxNode ? boxNode.position.y + boxNode.height - node.height : 1000 // Default max position if no box node found
      const minPosY = boxNode ? boxNode.position.y : 0 // Default min position if no box node found
      if (node.position.x < minPosX || node.position.x > maxPosX || node.position.y < minPosY || node.position.y > maxPosY) {
        node.data.className = "misplaced"
      } else {
        node.data.className = ""
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
      setBoxIntersections({})
      if (Object.keys(newScene).length > 0) {
        Object.values(newScene.nodes).forEach((node) => {
          if (!node.id.includes("opt") && !node.id.startsWith("box-")) {
            let subworkflowType = node.data.internal.subflowId != "MAIN" ? "optimize" : "learning"
            let setupParams = deepCopy(staticNodesParams[subworkflowType][node.data.internal.type])
            setupParams.possibleSettings = setupParams["possibleSettings"][newScene.MLType]
            console.log(node.type)
            if (node.type == "trainModelNode") {
              let setupParamsTuning = deepCopy(staticNodesParams["optimize"]["tune_model"])
              setupParams.possibleSettingsTuning = setupParamsTuning["possibleSettings"][newScene.MLType]
            }
            node.data.setupParam = setupParams
            !node.data.internal.nameID && (node.data.internal.nameID = node.data.setupParam.nameID)
          } else if (node.id.startsWith("box-")) {
            node.draggable = false
          }
        })
        const { x = 0, y = 0, zoom = 1 } = newScene.viewport
        setMLType(newScene.MLType)
        setNodes(newScene.nodes || [])
        setEdges(newScene.edges || [])
        setViewport({ x, y, zoom })
        setIntersections(newScene.intersections || [])
        setBoxIntersections(newScene.boxIntersections || {})
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
    // Handle box intersections
    setBoxIntersections((prev) => {
      const newBoxIntersections = { ...prev }
      Object.keys(newBoxIntersections).forEach((boxId) => {
        newBoxIntersections[boxId] = newBoxIntersections[boxId].filter((item) => item !== id)
        if (newBoxIntersections[boxId].length === 0) {
          delete newBoxIntersections[boxId]
        }
      })
      return newBoxIntersections
    })
  }, [])

  /**
   *
   * @param {Object} newNode base node object
   * @param {String} associatedNode id of the parent node if the node is a sub-group node
   * @returns
   */
  const addSpecificToNode = (newNode, associatedNode) => {
    // if the node is not a static node for a optimize subflow, it needs possible settings
    let setupParams = {}
    if (!newNode.id.includes("opt") && !newNode.id.startsWith("box-")) {
      setupParams = deepCopy(staticNodesParams[workflowType][newNode.data.internal.type])
      setupParams.possibleSettings = setupParams["possibleSettings"][MLType]
      if (newNode.type == "trainModelNode") {
        let setupParamsTuning = deepCopy(staticNodesParams["optimize"]["tune_model"])
        setupParams.possibleSettingsTuning = setupParamsTuning["possibleSettings"][MLType]
        newNode.data.internal.checkedOptionsTuning = []
        newNode.data.internal.settingsTuning = {}
        newNode.data.internal.settingsCalibration = {}
        newNode.data.internal.settingsEnsembling = {}
      }
    }
    newNode.id = `${newNode.id}${associatedNode ? `.${associatedNode}` : ""}` // if the node is a sub-group node, it has the id of the parent node seperated by a dot. useful when processing only ids
    newNode.hidden = newNode.type == "optimizeIO"
    newNode.zIndex = newNode.type == "optimizeIO" ? 1 : 1010
    newNode.data.tooltipBy = "type"
    // if analysis box, add input and output
    if (newNode.type == "analysisBoxNode") {
      setupParams = {
        ...newNode.data.setupParam,
        input: ["model"],
        output: [],
        classes: "action analyze run endNode",
        possibleSettings: {
          plot: "auc",
          scale: "1"
        }
      }
    }
    newNode.data.setupParam = setupParams
    newNode.data.internal.nameID = newNode.data.setupParam.nameID
    newNode.data.internal.code = ""
    newNode.className = setupParams.classes

    let tempDefaultSettings = {}
    if (newNode.data.setupParam.possibleSettings && newNode.type !== "splitNode") {
      "default" in newNode.data.setupParam.possibleSettings &&
        Object.entries(newNode.data.setupParam.possibleSettings.default).map(([settingName, setting]) => {
          tempDefaultSettings[settingName] = defaultValueFromType[setting.type]
        })
    }
    else if (newNode.data.setupParam.possibleSettings && newNode.type == "splitNode") {
      const settings = newNode.data.setupParam.possibleSettings.default || newNode.data.setupParam.possibleSettings
      
      Object.entries(settings).forEach(([settingName, setting]) => {
        if (!setting) return
        
        if (setting.hasOwnProperty("type")) {
          tempDefaultSettings[settingName] = setting.default_val ?? defaultValueFromType[setting.type] ?? null
        } else if (typeof setting === "object") {
          tempDefaultSettings[settingName] = tempDefaultSettings[settingName] || {}
          
          Object.entries(setting).forEach(([name, actualSetting]) => {
            if (!actualSetting) return
            
            if (actualSetting.hasOwnProperty("type")) {
              tempDefaultSettings[settingName][name] = actualSetting.default_val ?? defaultValueFromType[actualSetting.type] ?? null
            } else if (typeof actualSetting === "object") {
              tempDefaultSettings[settingName][name] = {}
              
              Object.entries(actualSetting).forEach(([name2, actualSetting2]) => {
                tempDefaultSettings[settingName][name][name2] = actualSetting2?.default_val ?? null
              })
            }
          })
        }
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
   * @param {function} createBaseNode function to create a base node. Useful to create automatically base nodes in the subflow
   * @param {String} newId id of the parent node
   */
  const groupNodeHandlingDefault = (createBaseNode, newId) => {
    let newNodeStart = createBaseNode(
      { x: 0, y: 200 },
      {
        nodeType: "optimizeIO",
        name: "Start",
        image: "/icon/dataset.png"
      },
      "opt-start"
    )
    newNodeStart = addSpecificToNode(newNodeStart, newId)

    let newNodeEnd = createBaseNode(
      { x: 500, y: 200 },
      {
        nodeType: "optimizeIO",
        name: "End",
        image: "/icon/dataset.png"
      },
      "opt-end"
    )
    newNodeEnd = addSpecificToNode(newNodeEnd, newId)
    setNodes((nds) => nds.concat(newNodeStart))
    setNodes((nds) => nds.concat(newNodeEnd))
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
      if (id) {
        console.log(reactFlowInstance)
        onRun(null, id)
      }
    },
    [reactFlowInstance, MLType, nodes, edges, intersections]
  )

  /**
   * Request the backend to run the experiment
   * @param {Number} port port of the backend
   * @param {Object} flowID id of the json object containing the backend workflow
   * @param {Boolean} isValid boolean to know if the workflow is 
   * @param {Boolean} saveAndFinalize boolean to know if the workflow should be saved and finalized
   * @returns {Object} results of the experiment
   */
  function requestBackendRunExperiment(port, flowID, isValid, saveAndFinalize = false, modelToFinalize = null, modelName = null) {
    if (isValid) {
      console.log("flow sent", flowID)
      setIsProgressUpdating(true)
      requestBackend(
        port,
        "/learning/run_experiment/" + pageId,
        { DBName: "data", id: flowID, saveAndFinalize: saveAndFinalize, modelToFinalize: modelToFinalize, modelName: modelName },
        (jsonResponse) => {
          console.log("received results:", jsonResponse)
          if (!jsonResponse.error) {
            updateFlowResults(jsonResponse, globalData[pageId].parentID, saveAndFinalize, modelToFinalize)
            setProgress({
              now: 100,
              currentLabel: "Done!"
            })
            setIsProgressUpdating(false)
          } else {
            setProgress({
              now: 0,
              currentLabel: ""
            })
            setIsProgressUpdating(false)
            toast.error("Error detected while running the experiment")
            console.log("error", jsonResponse.error)
            setError(jsonResponse.error)
          }
        },
        (error) => {
          setProgress({
            now: 0,
            currentLabel: ""
          })
          setIsProgressUpdating(false)
          toast.error("Error detected while running the experiment")
          console.log("error", error)
          setError(error)
        }
      )
    } else {
      toast.warn("Workflow is not valid, maybe some default values are not set")
    }
  }

  /**
   * execute the whole workflow
   */
  const onRun = useCallback(
    async (e, up2Id = undefined, saveAndFinalize = false, modelToFinalize = null, modelName = null) => {
      // Check if all nodes are in place
      const misPlacedNode = nodes.find(node => node.data.className === "misplaced")
      if (misPlacedNode) {
        if (misPlacedNode?.data?.setupParam?.section) {
          toast.error(`Node "${misPlacedNode.data.internal.name}" is misplaced. Please place it inside the "${misPlacedNode.data.setupParam.section}" box.`)
        } else {
          toast.error(`Node "${misPlacedNode.data.internal.name}" is misplaced. Please place them inside their designated boxes.`)
        }
        return
      }
      if (reactFlowInstance) {
        let flow = deepCopy(reactFlowInstance.toObject())
        flow.MLType = MLType
        flow.nodes.forEach((node) => {
          node.data.setupParam = null
        })
        flow.nodes = flow.nodes.filter((node) => node.type !== "boxNode")
        // Create results Folder
        let resultsFolder = new MEDDataObject({
          id: randomUUID(),
          name: sceneName + ".medmlres",
          type: "medmlres",
          parentID: globalData[pageId].parentID,
          childrenIDs: [],
          inWorkspace: false
        })
        let resultsFolderID = await insertMEDDataObjectIfNotExists(resultsFolder)
        let plotsDirectory = new MEDDataObject({
          id: randomUUID(),
          name: "plots",
          type: "directory",
          parentID: resultsFolderID,
          childrenIDs: [],
          inWorkspace: false
        })
        const plotDirectoryID = await insertMEDDataObjectIfNotExists(plotsDirectory)

        // Clean everything before running a new experiment
        console.log("sending flow ", flow)
        let { success, isValid } = await cleanJson2Send(flow, up2Id, plotDirectoryID)
        if (success) {
          requestBackendRunExperiment(port, backendMetadataFileID, isValid, saveAndFinalize, modelToFinalize, modelName)
        } else {
          toast.error("Could not format metadata for backend")
        }
      } else {
        toast.warn("react flow instance not found")
      }
    },
    [reactFlowInstance, MLType, nodes, edges, intersections]
  )

  /**
   * @param {Object} json json object to clean
   * @param {String} up2Id id of the node to run
   * @returns {Object} cleaned json object
   *
   * This function cleans the json object to send to the server
   * It removes the optimize nodes and the edges linked to them
   * It also checks if the default values are set for each node
   * It returns a boolean indicating wether the newJson has been
   * registered and a boolean to know if the default values are set.
   */
  const cleanJson2Send = useCallback(
    async (json, up2Id, plotDirectoryID) => {
      // function to check if default values are set
      const checkDefaultValues = (node) => {
        let isValid = true
        if ("default" in node.data.setupParam.possibleSettings) {
          Object.entries(node.data.setupParam.possibleSettings.default).map(([settingName, setting]) => {
            if (settingName in node.data.internal.settings) {
              if (node.data.internal.settings[settingName] == defaultValueFromType[setting.type]) {
                isValid = false
              }
            } else {
              isValid = false
            }
          })
        }
        if (!isValid) {
          toast.warn("Some default values are not set for node: " + node.data.internal.name + ".", {
            position: "bottom-right",
            autoClose: 2000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
            progress: undefined,
            theme: "light",
            toastId: "customId"
          })
        }
        return isValid
      }

      //clean recursive pipelines from treeData
      let nbNodes2Run = 0
      let isValidDefault = true
      const cleanTreeDataRec = (node) => {
        let children = {}
        Object.keys(node).forEach((key) => {
          // check if node is a create model node
          // n pipelines should be added according to model node inputs
          let hasModels = false
          let currentNode = nodes.find((node) => node.id === key)
          let nodeType = currentNode.data.internal.type
          let edgesCopy = deepCopy(edges)
          if (nodeType == "train_model") {
            edgesCopy = edgesCopy.filter((edge) => edge.target == currentNode.id)
            edgesCopy = edgesCopy.reduce((acc, edge) => {
              if (edge.target == currentNode.id) {
                let sourceNode = nodes.find((node) => node.id == edge.source)
                if (sourceNode.data.internal.type == "model") {
                  acc.push(edge)
                }
              }
              return acc
            }, [])
            hasModels = true
          }

          if (nodeType == "combine_models") {
            edgesCopy = edgesCopy.filter((edge) => edge.target == currentNode.id)
            console.log("edgesCopy", edgesCopy)
            edgesCopy = edgesCopy.reduce((acc, edge) => {
              if (edge.target == currentNode.id) {
                let sourceNode = nodes.find((node) => node.id == edge.source)
                if (sourceNode.data.setupParam.output.includes("model")) {
                  acc.push(edge)
                }
              }
              return acc
            }, [])
            hasModels = true
          }

          // check if node has default values
          isValidDefault = isValidDefault && checkDefaultValues(currentNode)

          // if this is not a leaf, we need to go deeper
          if (node[key].nodes != {}) {
            // if this is a create model node, we need to add n pipelines
            if (hasModels) {
              edgesCopy.forEach((edge) => {
                let id = key + "*" + edge.source
                if (key != up2Id) {
                  children[id] = cleanTreeDataRec(node[key].nodes)
                } else {
                  children[id] = {}
                }
              })
              // if this is not a create model node, we continue normally
            } else {
              if (key != up2Id) {
                children[key] = cleanTreeDataRec(node[key].nodes)
              } else {
                children[key] = {}
              }
            }
            nbNodes2Run++
          }

          // Check true or false values for current node
          let currentNodeCanModify = json.nodes.find((node) => node.id === key)
          if (currentNodeCanModify.data.internal.settings) {
            Object.entries(currentNodeCanModify.data.internal.settings).forEach(([key, value]) => {
              if (typeof value == "string" && value.toLocaleLowerCase() == "true") {
                currentNodeCanModify.data.internal.settings[key] = true
              } else if (typeof value == "string" && value.toLocaleLowerCase() == "false") {
                currentNodeCanModify.data.internal.settings[key] = false
              }
            })
          }
        })
        return children
      }
      let recursivePipelines = cleanTreeDataRec(treeData)

      //clean flow
      let newJson = {}
      newJson.MLType = json.MLType
      newJson.nodes = {}
      let nodesCopy = deepCopy(json.nodes)
      nodesCopy.forEach((node) => {
        !node.id.includes("opt") && (newJson.nodes[node.id] = node)
      })

      newJson.pipelines = recursivePipelines
      newJson.pageId = pageId
      newJson.identifiers = {}
      sceneDescription.internalFolders.forEach((folder) => {
        newJson.identifiers[folder] = MEDDataObject.getChildIDWithName(globalData, pageId, folder)
      })
      sceneDescription.externalFolders.forEach((folder) => {
        newJson.identifiers[folder] = MEDDataObject.getChildIDWithName(globalData, globalData[pageId].parentID, folder)
      })
      newJson.identifiers["plots"] = plotDirectoryID
      newJson.nbNodes2Run = nbNodes2Run + 1 // +1 because the results generation is a time consuming task
      let success = await overwriteMEDDataObjectContent(backendMetadataFileID, [newJson])

      return { success: success, isValid: isValidDefault }
    },
    [reactFlowInstance, MLType, nodes, edges, intersections, treeData]
  )

  /**
   * save the workflow as a json file
   */
  const onSave = useCallback(async () => {
    if (reactFlowInstance && metadataFileID) {
      const flow = deepCopy(reactFlowInstance.toObject())
      flow.MLType = MLType
      flow.intersections = intersections
      flow.isExperiment = isExperiment
      console.log("scene saved", flow)
      flow.nodes.forEach((node) => {
        node.data.setupParam = null
      })
      let success = await overwriteMEDDataObjectContent(metadataFileID, [flow])
      if (success) {
        toast.success("Scene has been saved successfully")
      } else {
        toast.error("Error while saving scene")
      }
    }
  }, [reactFlowInstance, MLType, intersections])

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

  /**
   *
   * @param {Event} e event object
   *
   * This function is called when the user changes the machine learning type
   */
  const handleMlTypeChanged = (e) => {
    confirm("This action resets all node's setting.\nBe sure to save if you want to keep your changes") && setMLType(e.target.value)
  }

  /**
   * Set the subflow id to null to go back to the main workflow
   */
  const onBack = useCallback(() => {
    changeSubFlow("MAIN")
  }, [])

  /**
   *
   * @param {String} value new value of the node name
   *
   * This function is called when the user changes the name of the node (focus out of the input).
   * It checks if the name is over 15 characters and if it is, it displays a warning message.
   * It then updates the name of the node by calling the updateNode function
   * this function is specific to groupNodes
   */
  const newNameHasBeenWritten = (value) => {
    let newName = value
    if (value.length > 15) {
      newName = value.substring(0, 15)
      toast.warn("Node name cannot be over 15 characters. Only the first 15 characters will be saved.", {
        position: "bottom-right",
        autoClose: 2000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "light",
        toastId: "customId"
      })
    }
    let groupNode = nodes.find((node) => node.id === groupNodeId.id)
    groupNode.data.internal.name = newName
  }

  return (
    <>
      <WorkflowBase
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
        groupNodeHandlingDefault={groupNodeHandlingDefault}
        onNodeDrag={onNodeDrag}
        isExperiment={isExperiment}
        // reprensents the visual over the workflow
        uiTopRight={
          <>
            {workflowType == "learning" && (
              <div className="d-flex align-items-center gap-2 p-1.5 rounded-3">
                {isExperiment && <>
                  <Tooltip target=".experimenting-tag" position="bottom" className="tooltip-custom">
                    <span>This scene is for experimentation. Set up a new scene to switch to the main mode.</span>
                  </Tooltip>
                  <Tag className="experimenting-tag" severity="info" value="Experimental Mode"></Tag>
                </>
                }
                <Form.Select className="margin-left-10" aria-label="Default select example" value={MLType} onChange={handleMlTypeChanged}>
                  <option value="classification">Classification</option>
                  <option value="regression">Regression</option>
                  {/* <option value="survival-analysis">Survival Analysis</option> */}
                </Form.Select>
                <BtnDiv
                  buttonsList={[
                    { type: "run", onClick: onRun, disabled: !canRun },
                    { type: "clear", onClick: onClear },
                    { type: "save", onClick: onSave },
                    { type: "load", onClick: onLoad }
                  ]}
                />
              </div>
            )}
          </>
        }
        uiTopCenter={
          <>
            {workflowType == "optimize" && (
              <>
                <div>
                  {groupNodeId.id != "MAIN" && (
                    <div className="subFlow-title">
                      <EditableLabel
                        text={nodes.find((node) => node.id === groupNodeId.id).data.internal.name}
                        labelClassName="node-editableLabel"
                        inputClassName="node-editableLabel"
                        inputWidth="20ch"
                        inputHeight="45px"
                        labelFontWeight="bold"
                        inputFontWeight="bold"
                        onFocusOut={(value) => {
                          newNameHasBeenWritten(value)
                        }}
                      />

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
})

export default Workflow
