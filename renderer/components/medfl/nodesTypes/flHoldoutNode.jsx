import React, { useContext, useEffect, useState } from "react"
import { Message } from "primereact/message"
import Path from "path"
import fs from "fs"
import Node from "../../flow/node"
import FlInput from "../flInput"
import { FlowFunctionsContext } from "../../flow/context/flowFunctionsContext"
import { DataContext } from "../../workspace/dataContext"
import { MEDDataObject } from "../../workspace/NewMedDataObject"

// the holdout datasets are picked from DATA/holdout, so they are never mixed up with the training files
const HOLDOUT_FOLDER = "holdout"

// Centralized: one holdout file tests the final model. Federated: each client tests it on its own holdout file
// (selected on the Client node) and the results are aggregated, as in the real-world Federated Holdout node.
export const HOLDOUT_MODES = { centralized: "Centralized", federated: "Federated" }

// Manual: the threshold typed in this node. Optimized: chosen on the training clients' validation data
// (validFrac of the MasterDataset node) before the holdout test, and stored in the saved model.
export const THRESHOLD_SOURCES = { manual: "Manual", optimized: "Optimized on validation data" }
// same labels as threshold_selection.py
export const THRESHOLD_CRITERIA = { youden: "Youden's J", targetSensitivity: "Target sensitivity" }

/**
 * Tests the final federated model of each configuration on holdout data, after training.
 * It can also save that model (.medflmodel in EXPERIMENTS/FL/Models) to test it again later.
 */
export default function FlHoldoutNode({ id, data }) {
  const { updateNode } = useContext(FlowFunctionsContext)
  const { globalData } = useContext(DataContext)

  const settings = data.internal.settings
  const [saveModel, setSaveModel] = useState(settings.saveModel ?? true)
  const [includeClientResults, setIncludeClientResults] = useState(settings.includeClientResults ?? true)
  const [mode, setMode] = useState(settings.mode ?? HOLDOUT_MODES.centralized)
  const federated = mode === HOLDOUT_MODES.federated
  const [thresholdSource, setThresholdSource] = useState(settings.thresholdSource ?? THRESHOLD_SOURCES.manual)
  const [thresholdCriterion, setThresholdCriterion] = useState(settings.thresholdCriterion ?? THRESHOLD_CRITERIA.youden)
  const optimized = thresholdSource === THRESHOLD_SOURCES.optimized

  const update = () => {
    // centralized: a holdout file is mandatory, the run reports an error for this node without it
    data.internal.hasWarning = settings.mode === HOLDOUT_MODES.federated || settings.file?.path ? { state: false } : { state: true, tooltip: `Select a holdout dataset (from DATA/${HOLDOUT_FOLDER})` }
    updateNode({ id: id, updatedData: data.internal })
  }

  // defaults
  useEffect(() => {
    if (settings.threshold === undefined) settings.threshold = 0.5
    if (settings.saveModel === undefined) settings.saveModel = true
    if (settings.mode === undefined) settings.mode = HOLDOUT_MODES.centralized
    if (settings.minimumSamples === undefined) settings.minimumSamples = 10
    if (settings.includeClientResults === undefined) settings.includeClientResults = true
    if (settings.thresholdSource === undefined) settings.thresholdSource = THRESHOLD_SOURCES.manual
    if (settings.thresholdCriterion === undefined) settings.thresholdCriterion = THRESHOLD_CRITERIA.youden
    if (settings.targetSensitivity === undefined) settings.targetSensitivity = 0.9
    update()
  }, [])

  // create DATA/holdout if missing, so the folder to put the holdout files in exists
  useEffect(() => {
    const root = globalData?.["ROOT"]?.path
    if (!root) return
    const folder = Path.join(root, "DATA", HOLDOUT_FOLDER)
    if (!fs.existsSync(folder)) {
      fs.promises
        .mkdir(folder, { recursive: true })
        .then(() => MEDDataObject.updateWorkspaceDataObject())
        .catch((error) => console.error("Could not create the holdout folder:", error))
    }
  }, [globalData?.["ROOT"]?.path])

  const onInputChange = (inputUpdate) => {
    settings[inputUpdate.name] = inputUpdate.value
    if (inputUpdate.name === "mode") setMode(inputUpdate.value)
    if (inputUpdate.name === "thresholdSource") setThresholdSource(inputUpdate.value)
    if (inputUpdate.name === "thresholdCriterion") setThresholdCriterion(inputUpdate.value)
    update()
  }

  const onIncludeClientResultsChange = (checked) => {
    setIncludeClientResults(checked)
    settings.includeClientResults = checked
    update()
  }

  const onSaveModelChange = (checked) => {
    setSaveModel(checked)
    settings.saveModel = checked
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
              name="mode"
              settingInfos={{
                type: "list",
                tooltip:
                  "<p>Centralized: the final model is tested on one holdout file. Federated: each client tests it on its own holdout dataset (selected on the Client node), only aggregate results are pooled.</p>",
                choices: [{ name: HOLDOUT_MODES.centralized }, { name: HOLDOUT_MODES.federated }]
              }}
              currentValue={mode}
              onInputChange={onInputChange}
              setHasWarning={() => {}}
            />

            {!federated && (
              <FlInput
                name="file"
                settingInfos={{
                  type: "data-input",
                  rootDir: HOLDOUT_FOLDER,
                  tooltip: `<p>Holdout dataset (csv in DATA/${HOLDOUT_FOLDER}). It must have the training columns and the same binary target. Do not normalize it: the training normalization is applied automatically.</p>`
                }}
                currentValue={settings.file?.id || ""}
                onInputChange={onInputChange}
                setHasWarning={() => {}}
                acceptedExtensions={["csv"]}
              />
            )}

            <FlInput
              name="thresholdSource"
              settingInfos={{
                type: "list",
                tooltip:
                  "<p>Manual: the threshold below. Optimized: the threshold is chosen on the training clients' validation data (validFrac of the MasterDataset node), never on the test sets or the holdout, then stored in the saved model.</p>",
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
                      tooltip: "<p>Minimal sensitivity on the validation data (between 0 and 1)</p>"
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

            {federated && (
              <>
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
              </>
            )}

            <div className="form-check form-switch m-2 w-100">
              <input className="form-check-input" type="checkbox" role="switch" id={`saveModel-${id}`} checked={saveModel} onChange={(e) => onSaveModelChange(e.target.checked)} />
              <label className="form-check-label" htmlFor={`saveModel-${id}`}>
                Save the final model (to test it again later)
              </label>
            </div>

            {saveModel && (
              <FlInput
                name="modelName"
                settingInfos={{
                  type: "string",
                  tooltip: "<p>Name of the saved model (EXPERIMENTS/FL/Models). Leave empty for an automatic name (scene, configuration, date)</p>"
                }}
                currentValue={settings.modelName || ""}
                onInputChange={onInputChange}
                setHasWarning={() => {}}
              />
            )}

            {federated ? (
              <Message severity="info" text="Binary classification only. Select the holdout dataset of each client on its Client node; clients without one are reported as missing." />
            ) : (
              !settings.file?.path && <Message severity="info" text={`Put your holdout csv files in DATA/${HOLDOUT_FOLDER} to select them here.`} />
            )}
          </>
        }
        nodeSpecific={<></>}
      />
    </>
  )
}
