import React, { useContext } from "react"
import Node from "../../flow/node"
import FlInput from "../flInput"
import { FlowFunctionsContext } from "../../flow/context/flowFunctionsContext"

export default function FlSaveModelNode({ id, data }) {
  // context
  const { updateNode } = useContext(FlowFunctionsContext)

  // state

  const onChangeValue = (nodeType) => {
    data.internal.settings.fileName = nodeType.value

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
              name="File name"
              settingInfos={{
                type: "string",
                tooltip: "Specify the desription of the federated setup"
              }}
              currentValue={data.internal.settings.fileName}
              onInputChange={onChangeValue}
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
