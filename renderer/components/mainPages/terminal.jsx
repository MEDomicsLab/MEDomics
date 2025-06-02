import React, { useEffect, useState } from "react"
import ModulePage from "./moduleBasics/modulePage"

//
/**
 * @description This is the terminal page that displays the log events from the main process and is used for debugging
 * @param {String} pageId The id of the page
 * @returns The terminal page component
 */
const TerminalPage = ({ pageId = "terminal" }) => {

  return (
    <>
      <ModulePage pageId={pageId} style={{ backgroundColor: "#1f1f1f", top: "-20px" }}>
        <div className="terminal" style={{ backgroundColor: "#1f1f1f", padding: "1rem 1rem", top: "20px", width: "100%" }}>
          
        </div>
      </ModulePage>
    </>
  )
}

export default TerminalPage
