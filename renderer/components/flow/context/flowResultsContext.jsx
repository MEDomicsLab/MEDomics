import { createContext, useState, useContext } from "react"
import { FlowInfosContext } from "./flowInfosContext"
import { MEDDataObject } from "../../workspace/NewMedDataObject"
import { WorkspaceContext } from "../../workspace/workspaceContext"
import { toast } from "react-toastify"
import { randomUUID } from "crypto"
import { insertMEDDataObjectIfNotExists, overwriteMEDDataObjectContent } from "../../mongoDB/mongoDBUtils"

// This context is used to store the flowResults (id and type of the workflow)
const FlowResultsContext = createContext()

/**
 *
 * @param {*} children components that will use the context
 * @description This component is used to provide the flowResults context to all the components that need it.
 */
function FlowResultsProvider({ children }) {
  const [flowResults, setFlowResults] = useState({}) // Initial style
  const [showResultsPane, setShowResultsPane] = useState(false) // Initial state
  const [isResults, setIsResults] = useState(false) // Initial state
  const [selectedResultsId, setSelectedResultsId] = useState(null) // Initial state
  const [pipelineNames, setPipelineNames] = useState([]) // Initial state for pipeline names
  const { sceneName } = useContext(FlowInfosContext)
  const { workspace } = useContext(WorkspaceContext)

  // Helper function to recursively find and update a key
  const updateKeyInObject = (obj, targetKey, newValue) => {
    const updatedObj = { ...obj }
    const updatedVal = { ...newValue }

    for (const key in updatedObj) {
      if (key.includes("*") && key.includes(targetKey)) {
        updatedObj[key] = updatedVal[key] // Update if key matches
      } else if (typeof updatedObj[key] === 'object' && updatedObj[key] !== undefined && updatedObj[key] !== null) {
        // Recurse into nested objects/arrays
        updatedObj[key] = updateKeyInObject(updatedObj[key], targetKey, updatedVal[key])
      }
    }

    return updatedObj
  }

  // This function is used to update the flowResults
  const updateFlowResults = async (newResults, finalizing = false, finalizedNode = null) => {
    if (!newResults || Object.keys(newResults).length === 0) return
    const isValidFormat = (results) => {
      let firstKey = Object.keys(results)[0]
      return results[firstKey].results ? true : false
    }
    if (isValidFormat(newResults)) {
      if (finalizing) {
        // If we are finalizing the results, we only update the results of the finalized node
        if (finalizedNode) {
          newResults = updateKeyInObject(flowResults, finalizedNode, newResults)
          setFlowResults((prevResults) => updateKeyInObject(prevResults, finalizedNode, newResults))
        }
      } else {
        setFlowResults({ ...newResults })
      }
      setIsResults(true)
    } else {
      toast.error("The results are not in the correct format")
    }
  }

  // This function is used to save the flowResults to the mongo database
  const saveFlowResults = async (sceneFolderId, newResults) => {
    if (!newResults) return false
    if (workspace.hasBeenSet && sceneName) {
      if (Object.keys(newResults).length === 0) {
        toast.error("There are no results to save")
        return false
      }
      const isValidFormat = (results) => {
        let firstKey = Object.keys(results)[0]
        return results[firstKey].results ? true : false
      }
      if (!isValidFormat(newResults)) {
        toast.error("The results are not in the correct format")
        return false
      }
      let resultsFolder = new MEDDataObject({
        id: randomUUID(),
        name: sceneName + ".medmlres",
        type: "medmlres",
        parentID: sceneFolderId,
        childrenIDs: [],
        inWorkspace: false
      })
      let resultsFolderID = await insertMEDDataObjectIfNotExists(resultsFolder)
      let resultsObject = new MEDDataObject({
        id: randomUUID(),
        name: "results.json",
        type: "json",
        parentID: resultsFolderID,
        childrenIDs: [],
        inWorkspace: false
      })
      let resultsObjectID = await insertMEDDataObjectIfNotExists(resultsObject, null, [newResults])
      // If MEDDataObject already existed we need to overwrite its content
      if (resultsObjectID != resultsObject.id) {
        await overwriteMEDDataObjectContent(resultsObjectID, [newResults])
      }
      MEDDataObject.updateWorkspaceDataObject()
      return true
    }
    return false
  }

  return (
    // in the value attribute we pass the flowResults and the function to update it.
    // These will be available to all the components that use this context
    <FlowResultsContext.Provider
      value={{
        flowResults,
        updateFlowResults,
        saveFlowResults,
        showResultsPane,
        setShowResultsPane,
        pipelineNames,
        setPipelineNames,
        isResults,
        setIsResults,
        selectedResultsId,
        setSelectedResultsId
      }}
    >
      {children}
    </FlowResultsContext.Provider>
  )
}

export { FlowResultsContext, FlowResultsProvider }
