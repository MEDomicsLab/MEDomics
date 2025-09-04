import React, { useContext } from "react"
import ModulePage from "./moduleBasics/modulePage"
import { WorkspaceContext } from "../workspace/workspaceContext"
import { ErrorRequestContext } from "../generalPurpose/errorRequestContext"
import DTale from "../exploratory/dtale"
import SweetViz from "../exploratory/sweetViz"
import YDataProfiling from "../exploratory/yDataProfiling"

/**
 *
 * @returns the exploratory page
 */
const ExploratoryPage = () => {
  const { port } = useContext(WorkspaceContext)
  const { setError } = useContext(ErrorRequestContext)

  return (
    <>
      <div className="exploratory">
        <SweetViz pageId="SweetViz" port={port} setError={setError} />
        <YDataProfiling pageId="ydata-profiling" port={port} setError={setError} />
        <DTale pageId="D-Tale" port={port} setError={setError} />
      </div>
    </>
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
