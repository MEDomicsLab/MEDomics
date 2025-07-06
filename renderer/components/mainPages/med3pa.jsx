import React from "react"
import ModulePage from "./moduleBasics/modulePage"
import MEDflHelloWorldPanel from "../medfl/medflHelloWorldPanel"

const MED3paPage = ({ pageId }) => {
  return (
    <>
      <ModulePage pageId={pageId} shadow={true}>
        <h1 className="center">MED3pa Module</h1>
        {/* <MED3paHelloWorldPanel /> */}
        <MEDflHelloWorldPanel />
      </ModulePage>
    </>
  )
}

export default MED3paPage
