import FlowCanvas from "../extractionMEDimage/flowCanvas"
import React, { useState } from "react"
import FlowPageBase from "../flow/flowPageBase"
import ModulePage from "./moduleBasics/modulePage"

// Extraction tab referred to in pages/_app.js.
// Shows sideBar nodes in a div on the left of the page,
// then react flow canvas where the nodes can be dropped.
const ExtractionMEDimagePage = ({ pageId }) => {
  // Hook for current module
  const [flowType, setFlowType] = useState("extraction")
  return (
    <>
      <ModulePage pageId={pageId}>
        <FlowPageBase workflowType={flowType} id={pageId}>
          <FlowCanvas id={pageId} workflowType={flowType} setWorkflowType={setFlowType} />
        </FlowPageBase>
      </ModulePage>
    </>
  )
}

export default ExtractionMEDimagePage
