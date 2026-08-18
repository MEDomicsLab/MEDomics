import { useContext } from "react"
import DTale from "../exploratory/dtale"
import SweetViz from "../exploratory/sweetViz"
import YDataProfiling from "../exploratory/yDataProfiling"
import { ErrorRequestContext } from "../generalPurpose/errorRequestContext"
import { WorkspaceContext } from "../workspace/workspaceContext"
import ModuleLandingShell, { ModuleGuideText } from "./moduleBasics/ModuleLandingShell"
import ModulePage from "./moduleBasics/modulePage"


/**
 *
 * @returns the exploratory page
 */
const ExploratoryPage = () => {
  const { port } = useContext(WorkspaceContext)
  const { setError } = useContext(ErrorRequestContext)

  return (
    <ModuleLandingShell
      title="Exploratory Module"
      description="Explore and understand your dataset before training a machine learning model."
      className="exploratory"
      documentation={{
        url: "https://medomicslab.gitbook.io/medomics-docs/tutorials/design/exploratory-module",
        label: "Exploratory Module documentation",
      }}
      infoContent={
        <ModuleGuideText>
          <p>
            The Exploratory Module helps you understand your data, detect potential issues,
            and make informed decisions for preprocessing and model selection.
          </p>
          <p><strong>SweetViz:</strong> Automated reports with distributions, correlations, and comparisons.</p>
          <p><strong>Y-Data Profiling:</strong> Deep statistical audit of feature types, missing values, and relationships.</p>
          <p className="mb-0"><strong>D-Tale:</strong> Spreadsheet-like interface for filtering, sorting, and visualizing data in real time.</p>
        </ModuleGuideText>
      }
    >
      <SweetViz pageId="SweetViz" port={port} setError={setError} />
      <YDataProfiling pageId="ydata-profiling" port={port} setError={setError} />
      <DTale pageId="D-Tale" port={port} setError={setError} />
    </ModuleLandingShell>
  )
}

/**
 *
 * @param {String} pageId The page id
 * @returns the exploratory page with the module page
 */
const ExploratoryPageWithModulePage = ({ pageId = "exploratory-id" }) => {
  return (
    <ModulePage pageId={pageId} shadow>
      <ExploratoryPage pageId={pageId} />
    </ModulePage>
  )
}

export default ExploratoryPageWithModulePage
