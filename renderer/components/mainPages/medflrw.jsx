import React, { useState } from "react"
import ModulePage from "./moduleBasics/modulePage"
import MedflWorkflow from "../medfl/medflWorkflow"
import MedflWelcomePage from "../medfl/medflWelcomePage"
import FLFlowPageBase from "../medfl/flFLowPageBase"
import MedflrwWorkflow from "../medfl/medflrwWorkflow"

const MEDflrwFlowPage = ({ pageId, configPath = "" }) => {
  const [displayWelcomeMessage, setWelcomeMessage] = useState(configPath != "" ? false : true)

  const [flFlowType, setFlFlowType] = useState("rwfl") // this state has been implemented because of subflows implementation

  return (
    <>
      <ModulePage pageId={pageId} configPath={configPath}>
        <FLFlowPageBase workflowType={flFlowType} id={pageId}>
          <MedflrwWorkflow id={pageId} workflowType={flFlowType} setWorkflowType={setFlFlowType} mode="rwfl" />
        </FLFlowPageBase>
      </ModulePage>
    </>
  )
}

export default MEDflrwFlowPage
