import { InputSwitch } from "primereact/inputswitch"
import { useContext, useEffect } from "react"
import { Stack } from "react-bootstrap"
import { FlowFunctionsContext } from "../../flow/context/flowFunctionsContext"
import Node from "../../flow/node"
import Input from "../input"


const CombineModelsNode = ({ id, data }) => {
  const { updateNode } = useContext(FlowFunctionsContext)

  // make sure internal.settings is initialised
  useEffect(() => {
    if (!data.internal.settings) data.internal.settings = {}
    if (!("optimize_fct" in data.internal.settings))
      data.internal.settings.optimize_fct = "blend_models"   // default
    updateNode({ id, updatedData: data.internal })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const currentAlgo = data.internal.settings.optimize_fct

  // toggle handler (mutually exclusive)
  const handleToggle = (algoKey, value) => {
    if (!value) return                                // ignore OFF
    data.internal.settings.optimize_fct = algoKey     // set new algo
    updateNode({ id, updatedData: data.internal })
  }

  // param block for sidebar
  const paramSpec =
    data.setupParam?.possibleSettings?.options?.[currentAlgo] || {}

  const nodeSpecific = (
    <Stack direction="vertical" gap={1}>
      {Object.entries(paramSpec).map(([name, spec]) => (
        <Input
          key={name}
          name={name}
          settingInfos={spec}
          currentValue={data.internal.settings[name]}
          onInputChange={({ name, value }) => {
            data.internal.settings[name] = value
            updateNode({ id, updatedData: data.internal })
          }}
        />
      ))}
    </Stack>
  )

  // small switches rendered in the node face
  const nodeBody = (
    <Stack direction="horizontal" className="align-items-center justify-content-between">
      <span style={{ fontWeight: currentAlgo === 'stack_models' ? 'bold' : 'normal' }}>
        Stack
      </span>
      <InputSwitch
        checked={currentAlgo === 'blend_models'}
        onChange={(e) => handleToggle(e.value ? 'blend_models' : 'stack_models', true)}
        className="mx-2"
      />
      <span style={{ fontWeight: currentAlgo === 'blend_models' ? 'bold' : 'normal' }}>
        Blend
      </span>
    </Stack>
  )

  // render
  return (
    <>
    {console.log("debug data", data)}
    <Node
      id={id}
      data={data}
      isGroupNode
      nodeBody={nodeBody}
      nodeSpecific={nodeSpecific}
    />
    </>
  )
}

export default CombineModelsNode
