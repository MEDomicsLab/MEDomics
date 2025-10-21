import React, { useCallback, useContext } from "react"
import Node from "../../flow/node"
import { Button } from "react-bootstrap"
import { PiFloppyDisk } from "react-icons/pi"

// MEDfl context
import { useMEDflContext } from "../../workspace/medflContext"
import FlrwNode from "../../flow/flrwNode"
import { FlowFunctionsContext } from "../../flow/context/flowFunctionsContext"

export default function NetworkNode({ id, data }) {
  // context

  const { groupNodeId, changeSubFlow, hasNewConnection } = useContext(FlowFunctionsContext)

  return (
    <>
      {/* build on top of the Node component */}
      <FlrwNode
        id={id}
        data={data}
        onClickCustom={() => {
          changeSubFlow(id)
        }}
      />
    </>
  )
}
