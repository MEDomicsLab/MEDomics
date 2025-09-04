import { useContext, useEffect, useRef, useState } from "react"
import { getCollectionData } from "../dbComponents/utils"
import FlowPageBase from "../flow/flowPageBase"
import Workflow from "../learning/workflow"
import { DataContext } from "../workspace/dataContext"
import { MEDDataObject } from "../workspace/NewMedDataObject"
import ModulePage from "./moduleBasics/modulePage"

const LearningPage = ({ pageId }) => {
  const [flowType, setFlowType] = useState("learning") // this state has been implemented because of subflows implementation
  const [isExperiment, setIsExperiment] = useState(false) // This state is used to determine if the workflow is an experiment or not
  const { globalData } = useContext(DataContext)

  const workflowRef = useRef()

  const runFromFlowPageBase = (modelToFinalize, modelName='') => {
    if (workflowRef.current) {
      workflowRef.current.triggerAction(modelToFinalize, modelName)
    }
  }

  useEffect(() => {
    const fetchData = async () => {
      let configToLoad = MEDDataObject.getChildIDWithName(globalData, pageId, "metadata.json")
      let jsonContent = await getCollectionData(configToLoad)
      if (!jsonContent || jsonContent.length === 0) {
        setIsExperiment(false)
      } else if (jsonContent[0].isExperiment === undefined) {
        // If the isExperiment field is not defined, we assume it is not an experiment
        setIsExperiment(false)
      }
      else {
        setIsExperiment(jsonContent[0].isExperiment)
      }
    }
    // Check if the scene is an experiment scene
    if (pageId) {
      fetchData()
    }
  }, [pageId])

  return (
    <>
      <ModulePage pageId={pageId}>
        <FlowPageBase workflowType={flowType} id={pageId} isExperiment={isExperiment} runFinalizeAndSave={runFromFlowPageBase}>
          <Workflow id={pageId} workflowType={flowType} setWorkflowType={setFlowType} isExperiment={isExperiment} ref={workflowRef}/>
        </FlowPageBase>
      </ModulePage>
    </>
  )
}

export default LearningPage
