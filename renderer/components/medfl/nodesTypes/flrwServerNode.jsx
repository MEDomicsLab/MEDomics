import React, { useContext, useState } from "react"
import Node from "../../flow/node"
import FlInput from "../flInput"
import { FlowFunctionsContext } from "../../flow/context/flowFunctionsContext"
import ClientInfos from "../rw/ClientInfos"
import FlrwNode from "../../flow/flrwNode"

export default function FlrwServerNode({ id, data }) {
  // context
  const { updateNode } = useContext(FlowFunctionsContext)

  // state
  const [nRounds, setNrounds] = useState(data.internal.settings.nRounds || null)
  const [activeDP, setDP] = useState(data.internal.settings.diffPrivacy || "Deactivate")
  const [delta, setDelta] = useState(data.internal.settings.delta || null)

  const onChangeRounds = (nodeType) => {
    data.internal.settings.nRounds = nodeType.value
    setNrounds(nodeType.value)

    // Update the node
    updateNode({
      id: id,
      updatedData: data.internal
    })
  }

  const onChangeDP = (nodeType) => {
    data.internal.settings.diffPrivacy = nodeType.value
    setDP(nodeType.value)

    // Update the node
    updateNode({
      id: id,
      updatedData: data.internal
    })
  }
  const onChangeInput = (nodeType, name) => {
    data.internal.settings[name] = nodeType.value

    // Update the node
    updateNode({
      id: id,
      updatedData: data.internal
    })
  }
  return (
    <>
      {/* build on top of the Node component */}
      <FlrwNode
        key={id}
        id={id}
        data={data}
        setupParam={data.setupParam}
        // the body of the node is a form select (particular to this node)
        nodeBody={<>
        
        </>}
        // default settings are the default settings of the node, so mandatory settings
        defaultSettings={
          <>
            <ClientInfos device={data.device} onClose={() => {}} />
          </>
        }
        // node specific is the body of the node, so optional settings
        nodeSpecific={<></>}
      />
    </>
  )
}
