import React from "react"
import dynamic from "next/dynamic"
import ModulePage from "./moduleBasics/modulePage"

// Dynamically import TerminalManager with SSR disabled
const TerminalManager = dynamic(() => import("../terminal/TerminalManager"), {
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
      Loading Terminal...
    </div>
  )
})

/**
 * @description Terminal page component that provides multiple terminal instances
 * @param {String} pageId The id of the page
 * @returns The terminal page component with multiple terminal support
 */
const TerminalPage = ({ pageId = "terminal" }) => {

  return (
    <>
      <ModulePage pageId={pageId} style={{ backgroundColor: "#1f1f1f", top: "-20px" }}>
        <TerminalManager pageId={pageId} />
      </ModulePage>
    </>
  )
}

export default TerminalPage
