import React, { useContext, useState } from "react"
import Node from "../../flow/node"
import FlInput from "../flInput"
import { FlowFunctionsContext } from "../../flow/context/flowFunctionsContext"

export default function FlDatasetrwNode({ id, data }) {
  // context
  const { updateNode } = useContext(FlowFunctionsContext)

  // state
  const [validFrac, setValidFrac] = useState(data.internal.settings.validFrac || null)
  const [testFrac, setTestFrac] = useState(data.internal.settings.testFrac || null)
  const [output, setOutput] = useState(data.internal.settings.output || "")

  const onChangeValidFrac = (nodeType) => {
    data.internal.settings.validFrac = nodeType.value
    setValidFrac(nodeType.value)

    // Update the node
    updateNode({
      id: id,
      updatedData: data.internal
    })
  }

  const onChangeTestFrac = (nodeType) => {
    data.internal.settings.testFrac = nodeType.value
    setTestFrac(nodeType.value)

    // Update the node
    updateNode({
      id: id,
      updatedData: data.internal
    })
  }

  const onChangeOutput = (nodeType) => {
    data.internal.settings.output = nodeType.value
    setOutput(nodeType.value)

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
              name="Output"
              settingInfos={{
                type: "text",
                tooltip: "Output of the dataset"
              }}
              currentValue={output}
              onInputChange={onChangeOutput}
              setHasWarning={() => {}}
            />
            <FlInput
              name="Validation fraction"
              settingInfos={{
                type: "float",
                tooltip: "The validation fraction  refers to the proportion of data reserved for evaluating model performance during training, typically separate from both the training and test sets"
              }}
              currentValue={validFrac}
              onInputChange={onChangeValidFrac}
              setHasWarning={() => {}}
            />
            <FlInput
              name="Test fraction"
              settingInfos={{
                type: "float",
                tooltip: "The Test fraction  refers to the proportion of data reserved for testing model performance for each node "
              }}
              currentValue={testFrac}
              onInputChange={onChangeTestFrac}
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
