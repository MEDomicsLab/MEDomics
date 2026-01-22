import React, { createContext, useState } from "react"

// This context is used to handle the update of the node
const FlowFunctionsContext = createContext()

/**
 *
 * @param {*} children components that will use the context
 * @description This component is used to provide the context to the children
 * it contains a set of useful functions to update flow related components
 */
function FlowFunctionsProvider({ children }) {
  const [nodeUpdate, setNodeUpdate] = useState({})
  const [edgeUpdate, setEdgeUpdate] = useState({})
  const [groupNodeId, setGroupNodeId] = useState({ id: "MAIN" })
  const [node2Run, setNode2Run] = useState(null)
  const [node2Duplicate, setNode2Duplicate] = useState(null)
  const [node2Delete, setNode2Delete] = useState(null)
  const [hasNewConnection, setHasNewConnection] = useState(false)

  /**
   *
   * @param {Object} nodeUpdateInfos update infos
   *
   * @description
   * This function is used to update the nodeUpdate state.
   * nodeUpdate should have this structure:
   * {
   * 	   id: id of the node to update,
   * 	   updatedData: data to update (will replace old data at data.internal)
   * }
   */
  const updateNode = (nodeUpdateInfos) => {
    setNodeUpdate({ ...nodeUpdateInfos })
  }

  /**
   *
   * @param {Object} edgeUpdateInfos update infos
   *
   * @description
   * This function is used to update the edgeUpdate state.
   * edgeUpdate should have this structure:
   * {
   *      id: id of the edge to update,
   *     updatedData: data to update (will replace old data at data.internal)
   * }
   */
  const updateEdge = (edgeUpdateInfos) => {
    setEdgeUpdate({ ...edgeUpdateInfos })
  }

  /**
   *
   * @param {String} newGroupNodeId id of the new group node
   *
   * @description
   * This function is used to change the subflow displayed in the flow.
   * It is called when the user clicks on a group node.
   * It updates the groupNodeId state.
   * groupNodeId should have this structure:
   * {
   *      id: id of the group node to display
   * }
   */
  const changeSubFlow = (newGroupNodeId) => {
    setGroupNodeId({ id: newGroupNodeId })
  }

  /**
   *
   * @param {String} nodeId id of the node to delete
   */
  const onDeleteNode = (nodeId) => {
    setNode2Delete(nodeId)
  }

  /**
   *
   * @param {String} nodeId id of the node to run
   */
  const runNode = (nodeId) => {
    setNode2Run(nodeId)
  }

  /**
   *
   * @param {String} nodeId id of the node to duplicate
   */
  const onDuplicateNode = (nodeId) => {
    setNode2Duplicate(nodeId)
  }

  const newConnectionCreated = () => {
    setHasNewConnection(!hasNewConnection)
  }

  return (
    // here we provide the updateNode function and the nodeUpdate state to all the components that need it
    <FlowFunctionsContext.Provider
      value={{
        nodeUpdate,
        updateNode,
        edgeUpdate,
        updateEdge,
        groupNodeId,
        changeSubFlow,
        node2Run,
        runNode,
        node2Delete,
        onDeleteNode,
        node2Duplicate,
        setNode2Duplicate,
        onDuplicateNode,
        newConnectionCreated,
        hasNewConnection
      }}
    >
      {children}
    </FlowFunctionsContext.Provider>
  )
}

export { FlowFunctionsContext, FlowFunctionsProvider }
