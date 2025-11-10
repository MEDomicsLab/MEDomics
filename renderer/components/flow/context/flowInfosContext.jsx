import React, { createContext, useState } from "react"
// This context is used to store the flowInfos (id and type of the workflow)
const FlowInfosContext = createContext()

/**
 *
 * @param {*} children components that will use the context
 * @description This component is used to provide the flowInfos context to all the components that need it.
 */
function FlowInfosProvider({ children }) {
  const [flowInfos, setFlowInfos] = useState({}) // Initial style
  const [showAvailableNodes, setShowAvailableNodes] = useState(false) // Initial state
  const [flowContent, setFlowContent] = useState({}) // Initial state
  const [flowContentExportable, setFlowContentExportable] = useState({}) // Initial state
  const [sceneName, setSceneName] = useState(null) // Initial state
  const [canRun, setCanRun] = useState(false) // Initial state

  // This function is used to update the flowInfos (id and type of the workflow)
  const updateFlowInfos = (newInfo) => {
    setFlowInfos({ ...newInfo })
  }

  // This function is used to update the flowContent (all the pipelines informations )
  const updateFlowContent = (newInfo) => {
    setFlowContent({ ...newInfo })
    // set canRun to true if no Node has a warning at data.internal.hasWarning
    let canRun = true
    newInfo.nodes.forEach((node) => {
      if (node.data.internal?.hasWarning?.state) {
        canRun = false
      }
    })
    setCanRun(canRun)
  }

  return (
    // in the value attribute we pass the flowInfos and the function to update it.
    // These will be available to all the components that use this context
    <FlowInfosContext.Provider
      value={{
        flowInfos,
        updateFlowInfos,
        flowContent,
        updateFlowContent,
        showAvailableNodes,
        setShowAvailableNodes,
        sceneName,
        setSceneName,
        flowContentExportable,
        setFlowContentExportable,
        canRun,
        setCanRun
      }}
    >
      {children}
    </FlowInfosContext.Provider>
  )
}

export { FlowInfosContext, FlowInfosProvider }
