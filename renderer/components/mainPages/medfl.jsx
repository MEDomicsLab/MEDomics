import React, { useState } from "react"
import ModulePage from "./moduleBasics/modulePage"
import MedflWorkflow from "../medfl/medflWorkflow"
import MedflWelcomePage from "../medfl/medflWelcomePage"
import FLFlowPageBase from "../medfl/flFLowPageBase"

const MEDflPage = ({ pageId, configPath = "" }) => {
  const [displayWelcomeMessage, setWelcomeMessage] = useState(configPath!= "" ? false : true)

  const [flFlowType, setFlFlowType] = useState("fl") // this state has been implemented because of subflows implementation

  return (
    <>
      <ModulePage pageId={pageId} configPath={configPath}>
        {displayWelcomeMessage ? (
          <>
            <MedflWelcomePage changePage={setWelcomeMessage} />
          </>
        ) : (
          <FLFlowPageBase workflowType={flFlowType} id={pageId}>
            <MedflWorkflow id={pageId} workflowType={flFlowType} setWorkflowType={setFlFlowType}  />
          </FLFlowPageBase>
        )}
      </ModulePage>
    </>
  )
}

export default MEDflPage
