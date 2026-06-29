import ExtractionTabularData from "../extractionTabular/extractionTabularData"
import React from "react"
import ModulePage from "./moduleBasics/modulePage"
import { shell } from 'electron'

const ExtractionTransformerTextPage = ({ pageId }) => {
  return (
    <>
      <ModulePage pageId={pageId} shadow>
        <h1 className="center">Extraction - Text Notes (Transformers)</h1>
        <div style={{ textAlign: "center", marginBottom: "20px", maxWidth: "800px", margin: "0 auto" }}>
          <p>
            The text extraction page takes a dataset containing text notes as input 
            and extracts embeddings using a selected Transformer model from Hugging Face or a local path.
          </p>
          <p className="gitbook-link">
                    📖 Learn more about this process in our
                    <u
                      onClick={() => shell.openExternal("https://medomics-udes.gitbook.io/medomicslab-docs/tutorials/design/extraction-modules/text-extraction-page")}
                      style={{ color: "#4991dfff", textDecoration: "none", cursor: "pointer" }}
                    > documentation. 🔗
                    </u>
          </p>
        </div>
        <ExtractionTabularData extractionTypeList={["TransformerText"]} serverUrl={"/extraction_text/"} defaultFilename={"text_extracted_features"} />
      </ModulePage>
    </>
  )
}

export default ExtractionTransformerTextPage
