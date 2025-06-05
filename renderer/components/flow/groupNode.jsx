/********************************************************************
 * GroupModelsNode.jsx
 * ---------------------------------------------------------------
 *  • Two exclusive InputSwitches in the node face itself.
 *  • Sidebar shows the detailed parameters of the active algorithm.
 ********************************************************************/
import { InputSwitch } from "primereact/inputswitch"
import { Stack } from "react-bootstrap"
import { useContext, useEffect } from "react"
import Node from "./node"
import { FlowFunctionsContext } from "../flow/context/flowFunctionsContext"                    // already used elsewhere

/* helpers -------------------------------------------------------- */
const algoLabel = { blend_models: "Blend", stack_models: "Stack" }

/* component ------------------------------------------------------ */
const GroupModelsNode = ({ id, data }) => {
  const { updateNode } = useContext(FlowFunctionsContext)

  /* ---------- make sure internal.settings is initialised -------- */
  useEffect(() => {
    if (!data.internal.settings) data.internal.settings = {}
    if (!("optimize_fct" in data.internal.settings))
      data.internal.settings.optimize_fct = "blend_models"   // default
    updateNode({ id, updatedData: data.internal })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const currentAlgo = data.internal.settings.optimize_fct

  /* ---------- toggle handler (mutually exclusive) --------------- */
  const handleToggle = (algoKey, value) => {
    if (!value) return                                // ignore OFF
    data.internal.settings.optimize_fct = algoKey     // set new algo
    updateNode({ id, updatedData: data.internal })
  }

  /* ---------- param block for sidebar --------------------------- */
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

  /* ---------- small switches rendered in the node face ---------- */
  const nodeBody = (
    <Stack direction="horizontal" className="justify-content-around">
      {["stack_models", "blend_models"].map((key) => (
        <div key={key} className="text-center">
          <small>{algoLabel[key]}</small>
          <InputSwitch
            checked={currentAlgo === key}
            onChange={(e) => handleToggle(key, e.value)}
          />
        </div>
      ))}
    </Stack>
  )

  /* ---------- render ------------------------------------------- */
  return (
    <Node
      id={id}
      data={data}
      isGroupNode
      nodeBody={nodeBody}           /* visible on the canvas */
      nodeSpecific={nodeSpecific}   /* visible in sidebar */
      /* no defaultSettings here – nothing mandatory */
    />
  )
}

export default GroupModelsNode
