import React, { useContext, useEffect, useState } from "react"
import Node from "../../flow/node"
import FlInput from "../flInput"
import { FlowFunctionsContext } from "../../flow/context/flowFunctionsContext"

export default function FlShapNode({ id, data }) {
  // context
  const { updateNode } = useContext(FlowFunctionsContext)

  // mandatory setting shown directly
  const [includeClientResults, setIncludeClientResults] = useState(
    data.internal.settings.includeClientResults ?? true
  )

  // controls whether advanced SHAP settings are shown
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(
    data.internal.settings.showAdvancedSettings ?? false
  )

  // advanced SHAP settings
  const [explainer, setExplainer] = useState(
    data.internal.settings.explainer || "gradient"
  )

  const [dataSplit, setDataSplit] = useState(
    data.internal.settings.dataSplit || "validation"
  )

  const [backgroundSize, setBackgroundSize] = useState(
    data.internal.settings.backgroundSize || 100
  )

  const [explanationSize, setExplanationSize] = useState(
    data.internal.settings.explanationSize || 500
  )

  const [minimumSamples, setMinimumSamples] = useState(
    data.internal.settings.minimumSamples || 10
  )

  useEffect(() => {
    data.internal.settings.includeClientResults = includeClientResults
    data.internal.settings.showAdvancedSettings = showAdvancedSettings
    data.internal.settings.explainer = explainer
    data.internal.settings.dataSplit = dataSplit
    data.internal.settings.backgroundSize = backgroundSize
    data.internal.settings.explanationSize = explanationSize
    data.internal.settings.minimumSamples = minimumSamples

    // Update the node
    updateNode({
      id: id,
      updatedData: data.internal
    })
  }, [
    includeClientResults,
    showAdvancedSettings,
    explainer,
    dataSplit,
    backgroundSize,
    explanationSize,
    minimumSamples
  ])

  return (
    <>
      {/* build on top of the Node component */}
      <Node
        key={id}
        id={id}
        data={data}
        setupParam={data.setupParam}
        // the body of the node
        nodeBody={<></>}
        // mandatory/default settings
        defaultSettings={
          <>
            <div className="form-check form-switch m-2 w-100">
              <input
                className="form-check-input"
                type="checkbox"
                role="switch"
                id={`includeClientResults-${id}`}
                checked={includeClientResults}
                onChange={(e) =>
                  setIncludeClientResults(e.target.checked)
                }
              />

              <label
                className="form-check-label"
                htmlFor={`includeClientResults-${id}`}
              >
                Include client results
              </label>
            </div>

            <div className="form-check form-switch m-2 w-100">
              <input
                className="form-check-input"
                type="checkbox"
                role="switch"
                id={`advancedShapSettings-${id}`}
                checked={showAdvancedSettings}
                onChange={(e) =>
                  setShowAdvancedSettings(e.target.checked)
                }
              />

              <label
                className="form-check-label"
                htmlFor={`advancedShapSettings-${id}`}
              >
                Advanced SHAP configuration
              </label>
            </div>

            {showAdvancedSettings && (
              <>
                <FlInput
                  name="Explainer"
                  currentValue={explainer}
                  onInputChange={(v) =>
                    setExplainer(v.value)
                  }
                  settingInfos={{
                    type: "string",
                    tooltip:
                      "SHAP explainer to use. Recommended value: gradient"
                  }}
                  setHasWarning={() => {}}
                />

                <FlInput
                  name="Data split"
                  currentValue={dataSplit}
                  onInputChange={(v) =>
                    setDataSplit(v.value)
                  }
                  settingInfos={{
                    type: "string",
                    tooltip:
                      "Dataset partition used for SHAP: validation, train or test"
                  }}
                  setHasWarning={() => {}}
                />

                <FlInput
                  name="Background size"
                  currentValue={backgroundSize}
                  onInputChange={(v) =>
                    setBackgroundSize(Number(v.value))
                  }
                  settingInfos={{
                    type: "int",
                    tooltip:
                      "Number of local samples used as the SHAP background dataset"
                  }}
                  setHasWarning={() => {}}
                />

                <FlInput
                  name="Explanation size"
                  currentValue={explanationSize}
                  onInputChange={(v) =>
                    setExplanationSize(Number(v.value))
                  }
                  settingInfos={{
                    type: "int",
                    tooltip:
                      "Maximum number of samples explained per client"
                  }}
                  setHasWarning={() => {}}
                />

                <FlInput
                  name="Minimum samples"
                  currentValue={minimumSamples}
                  onInputChange={(v) =>
                    setMinimumSamples(Number(v.value))
                  }
                  settingInfos={{
                    type: "int",
                    tooltip:
                      "Minimum number of samples required for a client to participate in SHAP"
                  }}
                  setHasWarning={() => {}}
                />
              </>
            )}
          </>
        }
        // optional node-specific body
        nodeSpecific={<></>}
      />
    </>
  )
}