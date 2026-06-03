import { shell } from 'electron'
import Image from "next/image"
import { useContext } from "react"
import myimage from "../../../resources/medomics_transparent_bg.png"
import DTale from "../exploratory/dtale"
import SweetViz from "../exploratory/sweetViz"
import YDataProfiling from "../exploratory/yDataProfiling"
import { ErrorRequestContext } from "../generalPurpose/errorRequestContext"
import { WorkspaceContext } from "../workspace/workspaceContext"
import ModulePage from "./moduleBasics/modulePage"


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
        <h1 className="text-center fw-bold text-secondary mt-2" style={{ fontSize: "3rem", letterSpacing: "1px" }}>
          Exploratory Module
        </h1>
        <div className="mx-auto text-center" >
          <Image className="text-center" src={myimage} alt="" style={{ height: "30px", width: "30px" }} />
        </div>
        <h2>🔍 Exploratory Data Analysis (EDA)</h2>
        <p>
          Before training a machine learning model, it is essential to explore and understand the dataset. 
          This page provides three powerful tools, each with a unique role in data exploration:
        </p>

        <p><span className="eda-tool-name">➡ SweetViz :</span> Generates automated reports with dataset characteristics, 
          feature distributions, correlations, and comparisons. Helps quickly detect outliers, missing values, and potential biases.</p>

        <p><span className="eda-tool-name">➡ Y-Data Profiling :</span> Performs a deep statistical audit to analyze feature types, 
          missing values, and relationships, helping detect preprocessing issues before model training.</p>

        <p><span className="eda-tool-name">➡ D-Tale :</span> Provides a spreadsheet-like interactive interface for filtering, 
          sorting, visualizing, and modifying data in real time.</p>

          <p className="gitbook-link">
          📖 Learn how to use these tools in our
          <u
            onClick={() => shell.openExternal("https://medomicslab.gitbook.io/medomics-docs/tutorials/design/exploratory-module")}
            style={{ color: "#4991dfff", textDecoration: "none", cursor: "pointer" }}
          > documentation. 🔗
          </u>
        </p>

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
