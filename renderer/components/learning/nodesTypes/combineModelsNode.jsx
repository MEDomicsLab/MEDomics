/**
 * CombineModelsNode.jsx
 * ----------------------------------------------------------
 * A “Split-Node-like” component that lets the user combine
 * the models coming from a **Combine models** workflow step
 * using either:
 *   • blend_models (PyCaret → soft/hard voting)
 *   • stack_models (PyCaret → stacking with meta-model)
 *
 * - The user toggles Blend / Stack with 2 InputSwitch widgets.
 * - Only the option-set that corresponds to the active
 *   strategy is displayed in the overlay panel.
 * - A (very optional) post-processing dropdown lets the user
 *   apply an Ensemble or Calibration step on the fly.
 *
 * Internal data layout expected
 * ─────────────────────────────
 * data.internal = {
 *   name, type, img …,
 *   settings : {
 *     strategy      : "blend_models" | "stack_models",
 *     post_process  : "" | "ensemble_model" | "calibrate_model",
 *     blend_models  : { …PyCaret blend kwargs… },
 *     stack_models  : { …PyCaret stack kwargs… }
 *   },
 *   checkedOptions : []          // unused here (kept for uniformity)
 * }
 * ----------------------------------------------------------
 */

import { useContext, useEffect, useState } from "react"
import { Stack, Button }        from "react-bootstrap"
import { InputSwitch }          from "primereact/inputswitch"
import { Dropdown }             from "primereact/dropdown"
import Node                     from "../../flow/node"
import { FlowFunctionsContext } from "../../flow/context/flowFunctionsContext"
import Input                    from "../input"
import * as Icon                from "react-bootstrap-icons"

const STRATEGIES = {
  BLEND : "blend_models",
  STACK : "stack_models",
}

const POST_PROCESS_CHOICES = [
  { name: "None",           value: "" },
  { name: "Ensemble",       value: "ensemble_model" },
  { name: "Calibrate",      value: "calibrate_model" },
]

const CombineModelsNode = ({ id, data }) => {
  const { updateNode } = useContext(FlowFunctionsContext)

  /* ---------- local state ---------- */
  const [useBlend, setUseBlend] = useState(
    data.internal.settings.strategy === STRATEGIES.BLEND
  )
  const [useStack, setUseStack] = useState(
    data.internal.settings.strategy === STRATEGIES.STACK
  )

  /* ---------- helpers ---------- */
  const propagate = (newInternal) =>
    updateNode({ id, updatedData: newInternal })

  const onParamChange = (strategy, inputUpdate) => {
    data.internal.settings[strategy][inputUpdate.name] = inputUpdate.value
    propagate(data.internal)
  }

  /* ---------- switch handler ---------- */
  const switchStrategy = (strategy) => {
    data.internal.settings.strategy = strategy
    setUseBlend(strategy === STRATEGIES.BLEND)
    setUseStack(strategy === STRATEGIES.STACK)
    propagate(data.internal)
  }

  /* ---------- node panel renderer ---------- */
  const renderStrategyParams = (strategy) => {
    const opts =
      data.setupParam?.possibleSettings?.combine_models?.options?.[strategy] ||
      {}
    return (
      <Stack direction="vertical" gap={1}>
        {Object.entries(opts).map(([name, infos]) => (
          <Input
            key={name}
            name={name}
            settingInfos={infos}
            currentValue={data.internal.settings[strategy][name]}
            onInputChange={(u) => onParamChange(strategy, u)}
          />
        ))}
      </Stack>
    )
  }

  /* ---------- default update on first mount ---------- */
  useEffect(() => {
    if (!data.internal.settings.strategy) switchStrategy(STRATEGIES.BLEND)
  }, [])

  /* ---------- UI ---------- */
  return (
    <Node
      id={id}
      data={data}
      color="#CDEAC0"
      nodeLink="https://pycaret.gitbook.io"
      /* ---------- overlay content ---------- */
      defaultSettings={
        <>
          {/* ======= Strategy selector ======= */}
          <div
            className="p-3 mb-3"
            style={{ border: "1px solid #ccc", borderRadius: "8px" }}
          >
            <h6>Strategy</h6>
            <div className="d-flex align-items-center justify-content-between">
              <span className="me-2">Blend models</span>
              <InputSwitch
                checked={useBlend}
                onChange={(e) =>
                  e.value ? switchStrategy(STRATEGIES.BLEND) : null
                }
              />
            </div>
            <div className="d-flex align-items-center justify-content-between">
              <span className="me-2">Stack models</span>
              <InputSwitch
                checked={useStack}
                onChange={(e) =>
                  e.value ? switchStrategy(STRATEGIES.STACK) : null
                }
              />
            </div>
          </div>

          {/* ======= Post-processing ======= */}
          <div
            className="p-3 mb-3"
            style={{ border: "1px solid #ccc", borderRadius: "8px" }}
          >
            <h6>Optional post-processing</h6>
            <Dropdown
              className="form-select"
              value={POST_PROCESS_CHOICES.find(
                (el) => el.value === data.internal.settings.post_process
              )}
              options={POST_PROCESS_CHOICES}
              optionLabel="name"
              onChange={(e) => {
                data.internal.settings.post_process = e.value.value
                propagate(data.internal)
              }}
              placeholder="None"
            />
          </div>

          {/* ======= Dynamic parameters ======= */}
          {data.internal.settings.strategy === STRATEGIES.BLEND &&
            renderStrategyParams(STRATEGIES.BLEND)}

          {data.internal.settings.strategy === STRATEGIES.STACK &&
            renderStrategyParams(STRATEGIES.STACK)}
        </>
      }
    />
  )
}

export default CombineModelsNode
