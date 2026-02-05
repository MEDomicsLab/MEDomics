import React from "react"
import ModulePage from "./moduleBasics/modulePage"
import ExtractionJPG from "../extractionImage/extractionJPG"
import { shell } from 'electron'

const ExtractionImagePage = ({ pageId }) => {
  return (
    <>
      <ModulePage pageId={pageId} shadow>
        <h1 className="center">Extraction - Images</h1>
        <div style={{ textAlign: "center", marginBottom: "20px", maxWidth: "800px", margin: "0 auto" }}>
          <p>
          The image extraction page takes JPG images as input and extracts embeddings using a selected model.
          </p>
          <p className="gitbook-link">
          📖 Learn more about this process in our
          <u
            onClick={() => shell.openExternal("https://medomics-udes.gitbook.io/medomicslab-docs/tutorials/design/extraction-modules/image-extraction-page")}
            style={{ color: "#4991dfff", textDecoration: "none", cursor: "pointer" }}
          > documentation. 🔗
          </u>
        </p>
        </div>

        <hr></hr>
        <ExtractionJPG extractionTypeList={["DenseNet"]} serverUrl={"/extraction_image/"} defaultFilename={"image_extracted_features"} />
      </ModulePage>
    </>
  )
}

export default ExtractionImagePage
