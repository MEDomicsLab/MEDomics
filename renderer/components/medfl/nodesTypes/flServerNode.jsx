import React, { useContext, useState } from "react"
import Node from "../../flow/node"
import FlInput from "../flInput"
import { FlowFunctionsContext } from "../../flow/context/flowFunctionsContext"
import ClientInfos from "../rw/ClientInfos"

export default function FlServerNode({ id, data }) {
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
      <Node
        key={id}
        id={id}
        data={data}
        setupParam={data.setupParam}
        // the body of the node is a form select (particular to this node)
        nodeBody={<></>}
        // default settings are the default settings of the node, so mandatory settings
        defaultSettings={
          !data.device ? (
            <>
              <FlInput
                name="Server rounds"
                settingInfos={{
                  type: "int",
                  tooltip: "Specify the number of federated rounds"
                }}
                currentValue={data.internal.settings.nRounds}
                onInputChange={(value) => {
                  onChangeInput(value, "nRounds")
                }}
                setHasWarning={() => {}}
              />
              <FlInput
                name="Diffirential privacy"
                settingInfos={{
                  type: "list",
                  tooltip: "Specify the number of federated rounds",
                  choices: [{ name: "Activate" }, { name: "Deactivate" }]
                }}
                currentValue={data.internal.settings.diffPrivacy}
                onInputChange={(value) => {
                  onChangeInput(value, "diffPrivacy")
                }}
                setHasWarning={() => {}}
              />
              {data.internal.settings.diffPrivacy == "Activate" ? (
                <>
                  <FlInput
                    name="DELAT"
                    settingInfos={{
                      type: "float",
                      tooltip: ""
                    }}
                    currentValue={data.internal.settings.delta}
                    onInputChange={(value) => {
                      onChangeInput(value, "delta")
                    }}
                    setHasWarning={() => {}}
                  />
                  <FlInput
                    name="ALPHA"
                    settingInfos={{
                      type: "float",
                      tooltip: ""
                    }}
                    currentValue={data.internal.settings.alpha}
                    onInputChange={(value) => {
                      onChangeInput(value, "alpha")
                    }}
                    setHasWarning={() => {}}
                  />
                </>
              ) : null}
            </>
          ) : (
            <>
              <ClientInfos device={data.device} onClose={() => {}} />
            </>
          )
        }
        // node specific is the body of the node, so optional settings
        nodeSpecific={<></>}
      />
    </>
  )
}
