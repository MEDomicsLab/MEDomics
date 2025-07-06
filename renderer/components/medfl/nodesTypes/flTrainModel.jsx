import React, { useContext, useEffect } from "react"
import Node from "../../flow/node"
import FlInput from "../flInput"
import { FlowFunctionsContext } from "../../flow/context/flowFunctionsContext"
import { toast } from "react-toastify"

export default function FlTrainModelNode({ id, data }) {
  // context
  const { updateNode } = useContext(FlowFunctionsContext)

  const onChangeValue = (nodeType) => {
    if (nodeType.value != "Use GPU" || checkWebGL()) {
      data.internal.settings.clientRessources = nodeType.value

      // Update the node
      updateNode({
        id: id,
        updatedData: data.internal
      })
    }
  }

  const checkWebGL = () => {
    let GPUcheck = true

    try {
      const canvas = document.createElement("canvas")
      const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl")
      if (gl && gl instanceof WebGLRenderingContext) {
        toast.success("Your machine has a GPU!")
      } else {
        toast.warning("Your machine does not have a GPU!")
        GPUcheck = false
      }
    } catch (e) {
      toast.warning("Your machine does not have a GPU!")
      GPUcheck = false
    }

    return GPUcheck
  }
  useEffect(() => {}, [])

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
              name="Client ressources"
              settingInfos={{
                type: "list",
                tooltip: "Specify the desription of the federated setup",
                choices: [{ name: "Use GPU" }, { name: " Use only CPU" }]
              }}
              currentValue={data.internal.settings.clientRessources}
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
