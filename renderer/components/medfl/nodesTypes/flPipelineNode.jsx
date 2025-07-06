import React, { useContext, useState } from "react"
import Node from "../../flow/node"
import FlInput from "../flInput"
import { FlowFunctionsContext } from "../../flow/context/flowFunctionsContext"

export default function FlPipelineNode({ id, data }) {
  // context
  const { updateNode } = useContext(FlowFunctionsContext)

  // state
  const [description, setDescription] = useState(data.internal.settings.description || "")

  const onChangeDescription = (nodeType) => {
    data.internal.settings.description = nodeType.value
    setDescription(nodeType.value)

    // Update the node
    updateNode({
      id: id,
      updatedData: data.internal
    })
  }

  return (
    <>
      {/* build on top of the Node component */}
      <Node
        key={id}
        id={id}
        data={data}
        setupParam={data.setupParam}
        // the body of the node is a form select (particular to this node)
        nodeBody={<></>}
        // default settings are the default settings of the node, so mandatory settings
        defaultSettings={
          <>
            <FlInput
              name="Pipeline description"
              settingInfos={{
                type: "string",
                tooltip: "Specify the desription of the federated setup"
              }}
              currentValue={description}
              onInputChange={onChangeDescription}
              setHasWarning={() => {}}
            />
          </>
        }
        // node specific is the body of the node, so optional settings
        nodeSpecific={<></>}
      />
    </>
  )
}
