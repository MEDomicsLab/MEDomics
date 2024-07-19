/* eslint-disable react/prop-types */
import React, { useRef, useCallback, useEffect, useContext, useState } from "react"
import { toast } from "react-toastify"
import ReactFlow, { Controls, ControlButton, Background, MiniMap, addEdge, useReactFlow } from "reactflow"
import { FlowFunctionsContext } from "./context/flowFunctionsContext"
import { PageInfosContext } from "../mainPages/moduleBasics/pageInfosContext"
import { FlowInfosContext } from "./context/flowInfosContext"
import { FlowResultsContext } from "./context/flowResultsContext"
import { getId, deepCopy } from "../../utilities/staticFunctions"
import { ToggleButton } from "primereact/togglebutton"
import Row from "react-bootstrap/Row"
import Col from "react-bootstrap/Col"
import { Button } from "primereact/button"
import { ErrorRequestContext } from "../generalPurpose/errorRequestContext"

/**
 *
 * @param { function } isGoodConnection function to check if a connection is valid
 * @param { function } onDeleteNode function to delete a node
 * @param { function } groupNodeHandlingDefault function to handle a group node default actions such as creation of start and end nodes
 * @param { JSX.Element } ui jsx element to display on the workflow
 * @param { JSX.Element } uiTopLeft jsx element to display on the top left of the workflow
 * @param { JSX.Element } uiTopRight jsx element to display on the top right of the workflow
 * @param { JSX.Element } uiTopCenter jsx element to display on the top center of the workflow
 * @param { function } customOnConnect function to call when a connection is created
 *
 * @param { object } 	mandatoryProps.reactFlowInstance instance of the reactFlow
 * @param { function } 	mandatoryProps.setReactFlowInstance function to set the reactFlowInstance
 * @param { object } 	mandatoryProps.nodeTypes object containing the node types
 * @param { object } 	mandatoryProps.nodes array containing the nodes
 * @param { function } 	mandatoryProps.setNodes function to set the nodes
 * @param { function } 	mandatoryProps.onNodesChange function called when the nodes change
 * @param { object } 	mandatoryProps.edges array containing the edges
 * @param { function } 	mandatoryProps.setEdges function to set the edges
 * @param { function } 	mandatoryProps.onEdgesChange function called when the edges change
 * @param { function } 	mandatoryProps.onNodeDrag function called when a node is dragged
 * @param { function } 	mandatoryProps.runNode function called when a node is run
 * @param { function } 	mandatoryProps.addSpecificToNode function called to add specific properties to a node
 * @param { object } 	mandatoryProps.nodeUpdate object containing the id of the node to update and the updated data
 * @param { function } 	mandatoryProps.setNodeUpdate function to set the nodeUpdate
 *
 * @returns {JSX.Element} A workflow
 *
 * @description
 *
 * This component is used to display a workflow.
 * It manages base workflow functions such as node creation, node deletion, node connection, etc.
 */
const WorkflowBase = ({ isGoodConnection, groupNodeHandlingDefault, onDeleteNode, onNodeDrag, mandatoryProps, ui, uiTopLeft, uiTopRight, uiTopCenter, customOnConnect }) => {
  const { reactFlowInstance, setReactFlowInstance, addSpecificToNode, nodeTypes, nodes, setNodes, onNodesChange, edges, setEdges, onEdgesChange, runNode } = mandatoryProps

  const edgeUpdateSuccessful = useRef(true)
  const { pageId } = useContext(PageInfosContext) // used to get the page infos
  const { updateNode, nodeUpdate, updateEdge, edgeUpdate, node2Delete, node2Run, newConnectionCreated, hasNewConnection } = useContext(FlowFunctionsContext) // used to get the function to update the node
  const { showAvailableNodes, setShowAvailableNodes, updateFlowContent } = useContext(FlowInfosContext) // used to update the flow infos
  const { showResultsPane, setShowResultsPane, isResults, flowResults } = useContext(FlowResultsContext) // used to update the flow infos
  const { showError, setShowError } = useContext(ErrorRequestContext) // used to get the flow infos
  const [hasBeenAnError, setHasBeenAnError] = useState(false) // used to get the flow infos
  const [miniMapState, setMiniMapState] = useState(true) // used to get the flow infos
  const [numberOfNodes, setNumberOfNodes] = useState(0) // used to get the flow infos
  const { fitView } = useReactFlow()

  useEffect(() => {
    if (showError) {
      setHasBeenAnError(true)
    }
  }, [showError])

  // this useEffect is used to update the nodes when the nodeUpdate object changes
  useEffect(() => {
    // if the nodeUpdate object is not empty, update the node
    if (nodeUpdate.id) {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id == nodeUpdate.id) {
            // it's important that you create a new object here in order to notify react flow about the change
            node.data = {
              ...node.data
            }
            // update the internal data of the node
            node.data.internal = nodeUpdate.updatedData
          }
          return node
        })
      )
    }
  }, [nodeUpdate, setNodes])

  // this useEffect is used to update the edges when the edgeUpdate object changes
  useEffect(() => {
    // if the edgeUpdate object is not empty, update the edge
    if (edgeUpdate.id) {
      setEdges((eds) =>
        eds.map((edge) => {
          if (edge.id == edgeUpdate.id) {
            // it's important that you create a new object here in order to notify react flow about the change
            edge = {
              ...edge
            }
            // update the internal data of the edge
            edge.data = edgeUpdate.updatedData
          }
          return edge
        })
      )
    }
  }, [edgeUpdate, setEdges])

  // this useEffect is used to update the flow content when the nodes or edges change
  useEffect(() => {
    if (numberOfNodes != nodes.length) {
      setNumberOfNodes(nodes.length)
      if (nodes.length == 1) {
        console.log("fitView")
        fitView({ minZoom: 0.9, maxZoom: 1 })
      }
    }
    updateFlowContent({
      nodes: nodes,
      edges: edges
    })
  }, [nodes, edges])

  // this useEffect is used to select the correct function to delete a node, either the default one or the one passed as props
  useEffect(() => {
    onDeleteNode ? onDeleteNode(node2Delete) : deleteNode(node2Delete)
  }, [node2Delete])

  // this useEffect is used to run a node when the node2Run object changes
  useEffect(() => {
    runNode(node2Run)
  }, [node2Run])

  // this useEffect is used to update the nodes when the flowResults object changes
  useEffect(() => {
    console.log("updating nodes from ", flowResults)

    /**
     * Recursively set the hasRun state of the nodes
     */
    const setNodesHasRunState = () => {
      const setHasRun = (id) => {
        let ids = id.split("*")
        ids.forEach((id) => {
          let node = nodes.find((node) => node.id == id)
          if (node) {
            node.data.internal.hasRun = true
            updateNode({
              id: node.id,
              updatedData: node.data.internal
            })
          }
        })
      }

      const setHasRunRec = (obj) => {
        console.log("obj", obj)
        Object.keys(obj).forEach((id) => {
          setHasRun(id)
          obj[id].next_nodes && setHasRunRec(obj[id].next_nodes)
        })
      }
      if (Object.keys(flowResults).length > 0) {
        Object.keys(flowResults).forEach((id) => {
          setHasRun(id)
          flowResults[id].next_nodes && setHasRunRec(flowResults[id].next_nodes)
        })
      } else {
        nodes.forEach((node) => {
          node.data.internal.hasRun = false
          updateNode({
            id: node.id,
            updatedData: node.data.internal
          })
        })
      }
    }

    const setHasRunGroupNode = () => {
      const setHasRun = (id, hasRun = true) => {
        let node = nodes.find((node) => node.id == id)
        if (node) {
          node.data.internal.hasRun = hasRun
          updateNode({
            id: node.id,
            updatedData: node.data.internal
          })
        }
      }

      let groupNodes = nodes.filter((node) => node.type == "groupNode")
      console.log("groupNodes", groupNodes)
      groupNodes.forEach((groupNode) => {
        let hasRun = true
        let groupNodeSubNodes = nodes.filter((node) => node.data.internal.subflowId == groupNode.id && node.type != "optimizeIO")
        console.log(groupNode.id, groupNodeSubNodes)

        groupNodeSubNodes.forEach((subNode) => {
          console.log(subNode.id, subNode.data.internal.hasRun)
          if (!subNode.data.internal.hasRun) {
            hasRun = false
          }
        })
        setHasRun(groupNode.id, hasRun)
      })
    }

    /**
     * Recursively set the hasRun state of the edges
     */
    const setEdgesHasRunState = () => {
      // making a list of edges that have run
      let edgesHasRun = []
      const setHasRun = (sourceId, targetId) => {
        // in case of a train model node, we need to manually add the model node because it is a backward relation
        if (sourceId.split("*").length > 1) {
          let ids = sourceId.split("*")
          setHasRun(ids[1], ids[0])
        }
        sourceId = sourceId.split("*")[0]
        targetId = targetId.split("*")[0]

        let edge = edges.find((edge) => edge.source == sourceId && edge.target == targetId)
        edge && edgesHasRun.push(edge.id)

        // in case of a groupNode, another connection has to be added wich is the connection between the groupNode is the target node
        let targetNode = nodes.find((node) => node.id == targetId)
        if (targetNode) {
          let targetIdSubflowId = targetNode.data.internal.subflowId
          if (targetIdSubflowId != "MAIN") {
            let edge = edges.find((edge) => edge.source == sourceId && edge.target == targetIdSubflowId)
            edge && edgesHasRun.push(edge.id)
          }
        }

        // in case of a groupNode, another connection has to be added wich is the connection between the groupNode is the source node
        let sourceNode = nodes.find((node) => node.id == sourceId)
        if (sourceNode) {
          let sourceIdSubflowId = sourceNode.data.internal.subflowId
          if (sourceIdSubflowId != "MAIN") {
            let edge = edges.find((edge) => edge.source == sourceIdSubflowId && edge.target == targetId)
            edge && edgesHasRun.push(edge.id)
          }
        }
      }

      const setHasRunRec = (obj) => {
        Object.keys(obj).forEach((id) => {
          if (obj[id].next_nodes) {
            Object.keys(obj[id].next_nodes).forEach((nextId) => {
              setHasRun(id, nextId)
            })
            obj[id].next_nodes && setHasRunRec(obj[id].next_nodes)
          }
        })
      }

      Object.keys(flowResults).forEach((id) => {
        Object.keys(flowResults[id].next_nodes).forEach((nextId) => {
          setHasRun(id, nextId)
        })
        flowResults[id].next_nodes && setHasRunRec(flowResults[id].next_nodes)
      })
      edges.forEach((edge) => {
        edge.data ? (edge.data.hasRun = edgesHasRun.includes(edge.id)) : (edge.data = { hasRun: edgesHasRun.includes(edge.id) })
        edge.className = edgesHasRun.includes(edge.id) && showResultsPane ? "stroke-hasRun" : showResultsPane ? "stroke-notRun" : ""
        updateEdge({
          id: edge.id,
          updatedData: edge.data
        })
      })
    }

    setNodesHasRunState()
    setHasRunGroupNode()
    setEdgesHasRunState()
  }, [flowResults, showResultsPane, hasNewConnection])

  // when showResultsPane changes, update the nodes draggable property
  useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => {
        // it's important that you create a new object here in order to notify react flow about the change
        node.data = {
          ...node.data
        }
        node.draggable = !showResultsPane
        return node
      })
    )
  }, [showResultsPane])

  /**
   * @param {object} params
   * @param {string} params.source
   * @param {string} params.target
   * @param {string} params.sourceHandle
   * @param {string} params.targetHandle
   *
   * @returns {void}
   *
   * @description
   * This function is called when a connection is created between two nodes.
   * It checks if the connection is valid and if it is, it adds the connection to the edges array.
   * If the connection is not valid, it displays an error message.
   *
   */
  const onConnect = useCallback(
    (params) => {
      console.log("new connection request", params)

      // check if the connection already exists
      let alreadyExists = false
      edges.forEach((edge) => {
        if (edge.source === params.source && edge.target === params.target) {
          alreadyExists = true
        }
      })

      // get the source and target nodes
      let sourceNode = deepCopy(nodes.find((node) => node.id === params.source))
      let targetNode = deepCopy(nodes.find((node) => node.id === params.target))

      // check if sourceNode's outputs is compatible with targetNode's inputs
      let isValidConnection = false
      sourceNode.data.setupParam.output.map((output) => {
        if (targetNode.data.setupParam.input.includes(output)) {
          isValidConnection = true
        }
      })

      // if isGoodConnection is defined, check if the connection is valid again with the isGoodConnection function
      isGoodConnection && (isValidConnection = isValidConnection && isGoodConnection(params))

      // check if the connection creates an infinite loop
      let isLoop = verificationForLoopHoles(params)
      newConnectionCreated() // this is used to update the workflow when a connection is created

      if (!alreadyExists && isValidConnection && !isLoop) {
        setEdges((eds) => addEdge(params, eds))
        customOnConnect && customOnConnect(params)
      } else {
        let message = "Not a valid connection"
        if (alreadyExists) {
          message = "It already exists"
        } else if (isLoop) {
          message = "It creates a loop"
        }
        toast.error(`Connection refused: ${message}`, {
          position: "bottom-right",
          autoClose: 2000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: "light"
        })
      }
    },
    [nodes, edges]
  )

  /**
   *
   * @param {Object} params current new edge infos
   * @returns true if the connection creates a loop
   */
  const verificationForLoopHoles = (params) => {
    let isLoop = params.source == params.target

    // recursively find if the target node is a child of the source node
    const verificationForLoopHolesRec = (node, isLoop) => {
      edges.forEach((edge) => {
        if (edge.source == node.id) {
          let targetNode = deepCopy(nodes.find((node) => node.id === edge.target))
          if (targetNode.id == params.source) {
            isLoop = true
          } else if (targetNode.type != "groupNode") {
            isLoop = verificationForLoopHolesRec(targetNode, isLoop)
          }
        }
      })
      return isLoop
    }

    let targetNode = deepCopy(nodes.find((node) => node.id === params.target))
    isLoop = verificationForLoopHolesRec(targetNode, false)

    return isLoop
  }

  /**
   * @param {object} event
   *
   * @returns {void}
   *
   * @description
   * This function is called when a node is dragged over the workflow.
   * It prevents the default behavior of the event and sets the dropEffect to 'move'.
   *
   */
  const onDragOver = useCallback((event) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = "move"
  }, [])

  /**
   * @param {object} event
   *
   * @returns {void}
   *
   * @description
   * This function is called when a node is dropped on the workflow.
   */
  const onDrop = useCallback(
    (event) => {
      event.preventDefault()
      // get the node type from the dataTransfer set by the onDragStart function at sidebarAvailableNodes.jsx
      let node = null
      try {
        node = JSON.parse(event.dataTransfer.getData("application/reactflow"))
      } catch (error) {
        console.log("error", error)
        toast.error("You cannot drop this element here")
      }
      console.log("node", node)
      if (node) {
        const { nodeType } = node

        if (nodeType in nodeTypes) {
          console.log(pageId)
          let flowWindow = document.getElementById(pageId).getBoundingClientRect()
          const position = reactFlowInstance.project({
            x: event.clientX - flowWindow.x - 300,
            y: event.clientY - flowWindow.y - 25
          })

          // create a new random id for the node
          let newId = getId()
          // if the node is a group node, call the groupNodeHandlingDefault function if it is defined
          if (nodeType === "groupNode" && groupNodeHandlingDefault) {
            groupNodeHandlingDefault(createBaseNode, newId)
          }
          // create a base node with common properties
          let newNode = createBaseNode(position, node, newId)
          // add specific properties to the node
          newNode.draggable = !showResultsPane
          newNode = addSpecificToNode(newNode)
          // add the new node to the nodes array
          setNodes((nds) => nds.concat(newNode))

          console.log("new node created: ", node)
        } else {
          console.log("node type not found: ", nodeType)
        }
      }
    },
    [reactFlowInstance, addSpecificToNode, showResultsPane]
  )

  /**
   *
   * @param {Object} position the drop position of the node ex. {x: 100, y: 100}
   * @param {Object} node the node object containing the nodeType, name and image path
   * @param {String} id the id of the node
   *
   * @description
   * This function creates a base node with common properties
   * all of these propreties can be overrriden by the addSpecificToNode function but they are the same for all nodes so no need to rewrite them
   * @returns {Object} the node object with the common properties
   */
  const createBaseNode = (position, node, id) => {
    const { nodeType, name, image } = node
    // console.log("createBaseNode", nodeType, name, image)
    console.log("node", node)
    let newNode = {
      id: id,
      type: nodeType,
      name: name,
      position,
      data: {
        // here is the data accessible by children components
        internal: {
          name: name,
          img: image,
          type: name.toLowerCase().replaceAll(" ", "_"),
          results: { checked: false, contextChecked: false },
          hasRun: false
        },
        tooltipBy: "node" // this is a default value that can be changed in addSpecificToNode function see workflow.jsx for example
      }
    }
    return newNode
  }

  /**
   *
   * @param {String} nodeId id of the node to delete
   * @description default function to delete a node
   */
  const deleteNode = (nodeId) => {
    setNodes((nds) => nds.filter((node) => node.id !== nodeId))
    setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId))
  }

  /**
   * @description
   * This function is called when an edge is dragged.
   */
  const onEdgeUpdateStart = useCallback(() => {
    edgeUpdateSuccessful.current = false
  }, [])

  /**
   *
   * @param {Object} oldEdge
   * @param {Object} newConnection
   *
   * @returns {void}
   *
   * @description
   * This function is called when an edge is dragged and dropped on another node.
   * It checks if the connection is valid and if it is, it updates the edge.
   * If the connection is not valid, it displays an error message.
   */
  const onEdgeUpdate = (oldEdge, newConnection) => {
    edgeUpdateSuccessful.current = true
    let alreadyExists = false
    edges.forEach((edge) => {
      if (edge.source === newConnection.source && edge.target === newConnection.target) {
        alreadyExists = true
      }
    })
    newConnectionCreated() // this is used to update the workflow when a connection is created
    if (!alreadyExists) {
      console.log("connection changed")
      setEdges((els) => updateEdge(oldEdge, newConnection, els))
    } else {
      toast.error("Connection refused: it already exists", {
        position: "bottom-right",
        autoClose: 2000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "light"
      })
    }
  }

  /**
   * @param {object} event
   *
   * @returns {void}
   *
   * @description
   * This function is called when an edge is dragged.
   * It checks if the connection is valid and if it is, it updates the edge.
   */
  const onEdgeUpdateEnd = useCallback((_, edge) => {
    if (!edgeUpdateSuccessful.current) {
      setEdges((eds) => eds.filter((e) => e.id !== edge.id))
      newConnectionCreated() // this is used to update the workflow when a connection is created
    }
    edgeUpdateSuccessful.current = true
  }, [])

  return (
    <div className="height-100 width-100">
      {/* here is the reactflow component which handles a lot of features listed below */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onInit={setReactFlowInstance}
        nodeTypes={nodeTypes}
        onNodeDrag={onNodeDrag}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onEdgeUpdate={onEdgeUpdate}
        onEdgeUpdateStart={onEdgeUpdateStart}
        onEdgeUpdateEnd={onEdgeUpdateEnd}
        fitView
      >
        <Background />
        {miniMapState && <MiniMap className="minimapStyle" zoomable pannable />}
        <Controls>
          <ControlButton onClick={() => setMiniMapState(!miniMapState)} title="Toggle Minimap">
            <div>
              <i className="pi pi-map"></i>
            </div>
          </ControlButton>
        </Controls>
        {ui}
        <div className="flow-btn-panel-top">
          <Row className="margin-0" style={{ justifyContent: "space-between" }}>
            <Col md="auto" className="left">
              <ToggleButton
                onIcon="pi pi-list"
                offIcon="pi pi-times"
                onLabel=""
                offLabel=""
                checked={!showAvailableNodes}
                onChange={(e) => setShowAvailableNodes(!e.value)}
                className="btn-ctl-available-nodes"
              />
              <ToggleButton
                onLabel="Results mode on"
                offLabel="See results"
                onIcon="pi pi-chart-bar"
                offIcon="pi pi-eye"
                disabled={!isResults}
                checked={showResultsPane}
                onChange={(e) => setShowResultsPane(e.value)}
                severity="success"
                className="btn-show-results"
              />
              {uiTopLeft}
            </Col>
            <Col md="auto" className="center">
              {uiTopCenter}
            </Col>
            <Col md="auto" className="right">
              {uiTopRight}
            </Col>
          </Row>
        </div>

        <div className="flow-btn-panel-left-vertical">
          {hasBeenAnError && (
            <Button
              icon="pi pi-exclamation-circle"
              rounded
              severity="danger"
              aria-label="Cancel"
              tooltip="See last error"
              tooltipOptions={{ showDelay: 1000, hideDelay: 300 }}
              onClick={() => setShowError(true)}
            />
          )}
        </div>
      </ReactFlow>
    </div>
  )
}

export default WorkflowBase
