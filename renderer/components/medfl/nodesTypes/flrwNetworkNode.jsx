import React, { useContext, useEffect } from "react"
import Node from "../../flow/node"
import { Button } from "react-bootstrap"
import { PiFloppyDisk } from "react-icons/pi"

// MEDfl context
import { useMEDflContext } from "../../workspace/medflContext"
import { FlowFunctionsContext } from "../../flow/context/flowFunctionsContext"

export default function RwNetworkNode({ id, data }) {
  const { changeSubFlow } = useContext(FlowFunctionsContext)
  const { networkChecked } = useMEDflContext()
  const { updateNode } = useContext(FlowFunctionsContext)

  useEffect(() => {
    if (!networkChecked[id]) {
      data.internal.hasWarning.state = true
      data.internal.hasWarning.tooltip = "You need to validate this network"
      updateNode({
        id: id,
        updatedData: data.internal
      })
    } else {
      data.internal.hasWarning.state = false
      data.internal.hasWarning.tooltip = ""
      updateNode({
        id: id,
        updatedData: data.internal
      })
    }
  }, [networkChecked[id]])
  return (
    <div
      style={{
        border: networkChecked[id] ? "2px solid #13d178ff" : "2px solid #ffc107",
        borderRadius: "8px",
        padding: "1px"
      }}
    >
      {/* build on top of the Node component */}
      <Node
        key={id}
        id={id}
        data={data}
        setupParam={data.setupParam}
        // the body of the node is a form select (particular to this node)

        onClickCustom={() => {
          changeSubFlow(id)
          console.log(id)
        }}
        isGroupNode
      />
    </div>
  )
}
