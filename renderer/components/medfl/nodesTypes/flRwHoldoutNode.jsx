import React, { useContext, useEffect, useState } from "react"
import { Message } from "primereact/message"
import Node from "../../flow/node"
import FlInput from "../flInput"
import { FlowFunctionsContext } from "../../flow/context/flowFunctionsContext"
import { THRESHOLD_SOURCES, THRESHOLD_CRITERIA } from "./flHoldoutNode"

export const DEFAULT_HOLDOUT_FILE = "holdout.csv"

/**
 * Federated holdout test of the real-world mode: after the last round, each client tests the final global model
 * on its own holdout file (in the client data folder, next to dataset.csv) and the server aggregates the results.
 * Only aggregate numbers leave the clients.
 */
export default function FlRwHoldoutNode({ id, data }) {
  const { updateNode } = useContext(FlowFunctionsContext)

  const settings = data.internal.settings
  const [includeClientResults, setIncludeClientResults] = useState(settings.includeClientResults ?? true)
  const [thresholdSource, setThresholdSource] = useState(settings.thresholdSource ?? THRESHOLD_SOURCES.manual)
  const [thresholdCriterion, setThresholdCriterion] = useState(settings.thresholdCriterion ?? THRESHOLD_CRITERIA.youden)
  const optimized = thresholdSource === THRESHOLD_SOURCES.optimized

  const update = () => {
    const fileName = String(settings.holdoutFileName || "").trim()
    data.internal.hasWarning =
      fileName && !fileName.toLowerCase().endsWith(".csv")
        ? { state: true, tooltip: "The holdout file must be a .csv file" }
        : fileName === "dataset.csv"
          ? { state: true, tooltip: "dataset.csv is the training dataset of the clients" }
          : { state: false }
    updateNode({ id: id, updatedData: data.internal })
  }

  // defaults
  useEffect(() => {
    if (settings.holdoutFileName === undefined) settings.holdoutFileName = DEFAULT_HOLDOUT_FILE
    if (settings.threshold === undefined) settings.threshold = 0.5
    if (settings.minimumSamples === undefined) settings.minimumSamples = 10
    if (settings.includeClientResults === undefined) settings.includeClientResults = true
    if (settings.thresholdSource === undefined) settings.thresholdSource = THRESHOLD_SOURCES.manual
    if (settings.thresholdCriterion === undefined) settings.thresholdCriterion = THRESHOLD_CRITERIA.youden
    if (settings.targetSensitivity === undefined) settings.targetSensitivity = 0.9
    if (settings.numBins === undefined) settings.numBins = 100
    update()
  }, [])

  const onInputChange = (inputUpdate) => {
    settings[inputUpdate.name] = inputUpdate.value
    if (inputUpdate.name === "thresholdSource") setThresholdSource(inputUpdate.value)
    if (inputUpdate.name === "thresholdCriterion") setThresholdCriterion(inputUpdate.value)
    update()
  }

  const onIncludeClientResultsChange = (checked) => {
    setIncludeClientResults(checked)
    settings.includeClientResults = checked
    update()
  }

  return (
    <>
      {/* build on top of the Node component */}
      <Node
        key={id}
        id={id}
        data={data}
        setupParam={data.setupParam}
        nodeBody={<></>}
        defaultSettings={
          <>
            <FlInput
              name="holdoutFileName"
              settingInfos={{
                type: "string",
                tooltip:
                  "<p>Name of the holdout csv on each client, in the client data folder (next to dataset.csv). It must have the training columns and the binary 0/1 target, and must not contain training patients. Clients without this file are reported as missing.</p>"
              }}
              currentValue={settings.holdoutFileName ?? DEFAULT_HOLDOUT_FILE}
              onInputChange={onInputChange}
              setHasWarning={() => {}}
            />

            <FlInput
              name="thresholdSource"
              settingInfos={{
                type: "list",
                tooltip:
                  "<p>Manual: the threshold below. Optimized: after the last round, each client sends the score histograms of its validation split (never used for training) and the server chooses the threshold on them, never on the holdout. Requires MEDfl 2.0.11 or later on the clients and a validation fraction above 0.</p>",
                choices: [{ name: THRESHOLD_SOURCES.manual }, { name: THRESHOLD_SOURCES.optimized }]
              }}
              currentValue={thresholdSource}
              onInputChange={onInputChange}
              setHasWarning={() => {}}
            />

            {optimized ? (
              <>
                <FlInput
                  name="thresholdCriterion"
                  settingInfos={{
                    type: "list",
                    tooltip:
                      "<p>Youden's J: best balance of sensitivity and specificity. Target sensitivity: the highest threshold reaching the target sensitivity (the best specificity under that constraint).</p>",
                    choices: [{ name: THRESHOLD_CRITERIA.youden }, { name: THRESHOLD_CRITERIA.targetSensitivity }]
                  }}
                  currentValue={thresholdCriterion}
                  onInputChange={onInputChange}
                  setHasWarning={() => {}}
                />
                {thresholdCriterion === THRESHOLD_CRITERIA.targetSensitivity && (
                  <FlInput
                    name="targetSensitivity"
                    settingInfos={{
                      type: "float",
                      tooltip: "<p>Minimal sensitivity on the pooled validation data (between 0 and 1)</p>"
                    }}
                    currentValue={settings.targetSensitivity ?? 0.9}
                    onInputChange={onInputChange}
                    setHasWarning={() => {}}
                  />
                )}
              </>
            ) : (
              <FlInput
                name="threshold"
                settingInfos={{
                  type: "float",
                  tooltip: "<p>Decision threshold: a probability at or above it is predicted as positive</p>"
                }}
                currentValue={settings.threshold ?? 0.5}
                onInputChange={onInputChange}
                setHasWarning={() => {}}
              />
            )}

            <FlInput
              name="numBins"
              settingInfos={{
                type: "int",
                tooltip:
                  "<p>Number of score histogram bins sent by each client (at least 2). More bins give a finer pooled ROC curve and AUC and, with an optimized threshold, a finer threshold (it is a bin edge: steps of 1 / bins, e.g. 0.01 with 100 bins). 200 to 500 is a good choice when optimizing.</p>"
              }}
              currentValue={settings.numBins ?? 100}
              onInputChange={onInputChange}
              setHasWarning={() => {}}
            />

            <FlInput
              name="minimumSamples"
              settingInfos={{
                type: "int",
                tooltip: "<p>Clients with fewer usable holdout rows do not send results (privacy safeguard)</p>"
              }}
              currentValue={settings.minimumSamples ?? 10}
              onInputChange={onInputChange}
              setHasWarning={() => {}}
            />

            <div className="form-check form-switch m-2 w-100">
              <input
                className="form-check-input"
                type="checkbox"
                role="switch"
                id={`includeClientResults-${id}`}
                checked={includeClientResults}
                onChange={(e) => onIncludeClientResultsChange(e.target.checked)}
              />
              <label className="form-check-label" htmlFor={`includeClientResults-${id}`}>
                Include client results
              </label>
            </div>

            <Message severity="info" text="Binary classification only. Each client tests the final model on its own holdout file; only aggregate results are sent." />
          </>
        }
        nodeSpecific={<></>}
      />
    </>
  )
}
