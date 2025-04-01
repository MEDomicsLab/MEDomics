import ExtractionTabularData from "../extractionTabular/extractionTabularData"
import React from "react"
import ModulePage from "./moduleBasics/modulePage"
import { shell } from 'electron'

const ExtractionTSPage = ({ pageId }) => {
  return (
    <>
      <ModulePage pageId={pageId} shadow={true}>
        <h1 className="center">Extraction - Time Series</h1>
        <div style={{ textAlign: "center", marginBottom: "20px", maxWidth: "800px", margin: "0 auto" }}>
          <p>
            The time series extraction page takes a CSV file containing time series as input 
            and extracts embeddings using a selected model.
          </p>
          <p className="gitbook-link">
          📖 Learn more about this process in our
          <u
            onClick={() => shell.openExternal("https://medomics-udes.gitbook.io/medomicslab-docs/tutorials/design/extraction-modules/time-series-extraction-page")}
            style={{ color: "#0056b3", textDecoration: "none", cursor: "pointer" }}
          > documentation. 🔗
          </u>
        </p>
        </div>
        <ExtractionTabularData extractionTypeList={["TSfresh"]} serverUrl={"/extraction_ts/"} defaultFilename={"ts_extracted_features"} />
      </ModulePage>
    </>
  )
}

export default ExtractionTSPage
