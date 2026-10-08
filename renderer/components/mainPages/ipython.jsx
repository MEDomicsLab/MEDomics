import React from "react"
import dynamic from "next/dynamic"
import ModulePage from "./moduleBasics/modulePage"

// Dynamically import TerminalManager with SSR disabled, but configure for IPython
const IPythonTerminalManager = dynamic(() => import("../terminal/TerminalManager"), {
  ssr: false,
  loading: () => (
    <div style={{ 
      height: '100%', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      backgroundColor: '#1f1f1f',
      color: '#ffffff'
    }}>
      Loading IPython...
    </div>
  )
})

/**
 * @description IPython page component that provides IPython terminal instances
 * Uses the Python environment from .medomics home folder
 * @param {String} pageId The id of the page
 * @returns The IPython page component using terminal infrastructure
 */
const IPythonPage = ({ pageId = "ipython" }) => {

  return (
    <>
      <ModulePage pageId={pageId} style={{ backgroundColor: "#1f1f1f", top: "-20px" }}>
        <IPythonTerminalManager pageId={pageId} useIPython={true} />
      </ModulePage>
    </>
  )
}

export default IPythonPage
