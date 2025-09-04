import React from "react"
import ModulePage from "./moduleBasics/modulePage"
import EvaluationPageContent from "../evaluation/evaluationPageContent"

const EvaluationPage = ({ pageId = "evaluation-456" }) => {
  return (
    <>
      <ModulePage pageId={pageId} shadow className="EvaluationPage">
        <EvaluationPageContent />
      </ModulePage>
    </>
  )
}

export default EvaluationPage
