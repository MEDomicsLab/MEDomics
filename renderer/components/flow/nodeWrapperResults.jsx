import React, { useContext, useState } from "react"
import { FlowResultsContext } from "./context/flowResultsContext"
import { FlowFunctionsContext } from "./context/flowFunctionsContext"
import { Checkbox } from "primereact/checkbox"
import { useEffect } from "react"

/**
 *
 * @param {JSX.Element} children jsx that will be wrapped
 * @param {String} id id of the node
 * @param {Object} data data of the node
 * @returns {JSX.Element} A node wrapped with results related features
 *
 * @description
 * This component is used to wrap a node with results related features.
 */
const NodeWrapperResults = ({ children, id, data }) => {
  const { showResultsPane } = useContext(FlowResultsContext) // used to know if the results pane is displayed
  const { updateNode } = useContext(FlowFunctionsContext) // used to get the function to update the node
  const [checked, setChecked] = useState(null) // used to store the checked state of the checkbox

  // this useEffect is used to update the node when the checked state changes
  useEffect(() => {
    if (checked !== null) {
      let updatedData = data.internal
      updatedData.results.checked = checked
      updateNode({
        id: id,
        updatedData: updatedData
      })
    }
  }, [checked])

  return (
    <>
      {/* if the node is not a model and has run, we display the checkbox */}
      {data.internal.type != "model" && data.internal.hasRun && (
        <div
          className={`node-wrapper-selector ${
            data.internal.results.contextChecked ? "context-checked" : ""
          }`}
          style={{
            top: showResultsPane ? "-2rem" : "0.1rem"
          }}
        >
          <Checkbox
            onChange={(e) => setChecked(e.checked)}
            checked={data.internal.results.checked}
          />
        
        </div>
      )}

      <div className="node-wrapper">{children}</div>
    </>
  )
}

export default NodeWrapperResults
