import React from "react"
import ModulePage from "./moduleBasics/modulePage"
import MED3paHelloWorldPanel from "../med3pa/med3paHelloWorldPanel"
import Med3paConfigForm from "../med3pa/upload_data_page"
const MED3paPage = ({ pageId }) => {
  return (
    <>
      <ModulePage pageId={pageId} shadow={true}>
        <h1 className="center">MED3pa Module</h1>
        <MED3paHelloWorldPanel />
        {/* <Med3paConfigForm /> */}
      </ModulePage>
    </>
  )
}

export default MED3paPage
