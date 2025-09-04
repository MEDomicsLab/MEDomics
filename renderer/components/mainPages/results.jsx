import React from "react"
import LearningPage from "./learning"
import ModulePage from "./moduleBasics/modulePage"
/**
 *
 * @returns {JSX.Element} The ResultsPage component
 */
const ResultsPage = ({ pageId = "results123" }) => {
  return (
    <>
      <ModulePage pageId={pageId}>
        <div style={{ display: "flex", flexWrap: "wrap" }}>
          <div style={{ width: "50%" }}>
            <LearningPage pageId="1" />
          </div>
          <div style={{ width: "50%" }}>
            {" "}
            <LearningPage pageId="2" />
          </div>
          <div style={{ width: "50%" }}>
            <LearningPage pageId="3" />
          </div>
          <div style={{ width: "50%" }}>
            {" "}
            <LearningPage pageId="4" />
          </div>
        </div>
      </ModulePage>
    </>
  )
}

export default ResultsPage
