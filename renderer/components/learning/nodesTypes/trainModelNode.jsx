import { shell } from "electron"
import { InputSwitch } from "primereact/inputswitch"
import { Panel } from "primereact/panel"
import { useContext, useEffect, useState } from "react"
import { Button, Stack } from "react-bootstrap"
import * as Icon from "react-bootstrap-icons"
import { AiOutlineInfoCircle } from "react-icons/ai"
import { FlowFunctionsContext } from "../../flow/context/flowFunctionsContext"
import Node from "../../flow/node"
import HyperParameterInput from "../HyperParameterInput"
import Input from "../input"
import ModalSettingsChooser from "../modalSettingsChooser"

/**
 *
 * @param {string} id id of the node
 * @param {object} data data of the node
 * @param {string} type type of the node
 * @returns {JSX.Element} A StandardNode node
 *
 * @description
 * This component is used to display a StandardNode node.
 * it handles the display of the node and the modal
 *
 */
const TrainModelNode = ({ id, data }) => {
  const [modalShow, setModalShow] = useState(false) // state of the modal
  const [usePycaretSearchSpace, setUsePycaretSearchSpace] = useState(true) // state of the checkbox
  const [modalShowTuning, setModalShowTuning] = useState(false)
  const { updateNode } = useContext(FlowFunctionsContext)
  const [IntegrateTuning, setIntegrateTuning] = useState(data.internal.isTuningEnabled ?? false)
  const [optimizeThresh, setOptimizeThresh] = useState(data.internal.isOptimizeThreshold ?? false)
  const [ensembleEnabled, setEnsembleEnabled] = useState(data.internal.settings.isEnsembleEnabled ?? false)
  const [calibrateEnabled, setCalibrateEnabled] = useState(data.internal.settings.isCalibrateEnabled ?? false)

  // Check if isTuningEnabled exists in data.internal, if not initialize it
  useEffect(() => {
    if (data.internal.tuningGrid && Object.keys(data.internal.tuningGrid).length > 0) {
      Object.keys(data.internal.tuningGrid).map((model) => {
        data.internal[model] = {}
        data.internal[model].custom_grid = {}
      })
    }
    if (!("isTuningEnabled" in Object.keys(data.internal))) {
      data.internal.isTuningEnabled = false
      updateNode({
        id: id,
        updatedData: data.internal
      })
    }
    if (!("optimizeThreshold" in Object.keys(data.internal))) {
      data.internal.optimizeThreshold = false
      data.internal.threshOptimizationMetric = "Accuracy"
      updateNode({
        id: id,
        updatedData: data.internal
      })
    }
    if (!("useTuningGrid" in Object.keys(data.internal))) {
      data.internal.useTuningGrid = false
      updateNode({
        id: id,
        updatedData: data.internal
      })
    }

    if (!("isEnsembleEnabled" in Object.keys(data.internal))) {
      data.internal.isEnsembleEnabled = false
      updateNode({
        id: id,
        updatedData: data.internal
      })
    }

    if (!("isCalibrateEnabled" in Object.keys(data.internal))) {
      data.internal.isCalibrateEnabled = false
      updateNode({
        id: id,
        updatedData: data.internal
      })
    }

    if (!("settingsEnsembling" in data.internal)) {
      data.internal.settingsEnsembling = {}
    }
  
    // saving it for later
    if (!("settingsCalibration" in data.internal)) {
      data.internal.settingsCalibration = {}
    }
  }, [])

  /**
   *
   * @param {Object} inputUpdate the object containing the name and the value of the input
   * @description
   * This function is used to update the settings of the node
   */
  const onInputChange = (inputUpdate) => {
    data.internal.settings[inputUpdate.name] = inputUpdate.value
    updateNode({
      id: id,
      updatedData: data.internal
    })
  }

  /**
   *
   * @param {Object} inputUpdate the object containing the name and the value of the input
   * @description
   * This function is used to update the settings of the node
   */
  const onInputChangeTuning = (inputUpdate) => {
    data.internal.settingsTuning[inputUpdate.name] = inputUpdate.value
    updateNode({
      id: id,
      updatedData: data.internal
    })
  }

  /**
   * 
   * @param {Object} inputUpdate the object containing the name and the value of the input
   * @description
   * This function is used to update the threshold optimization settings of the node
   */
  const onInputChangeThreshold = (inputUpdate) => {
    data.internal.threshOptimizationMetric = inputUpdate.value
    updateNode({
      id: id,
      updatedData: data.internal
    })
  }

  /**
   * * @param {Object} inputUpdate the object containing the name and the value of the input
   * * @description
   * This function is used to update the ensembling settings of the node
   */
  const onInputChangeEnsemble = (inputUpdate) => {
    data.internal.settingsEnsembling[inputUpdate.name] = inputUpdate.value
    updateNode({
      id: id,
      updatedData: data.internal
    })
  }

  /**
   * @param {Object} inputUpdate the object containing the name and the value of the input
   * @description This function is used to update the calibration settings of the node
   * */
  const onInputChangeCalibration = (inputUpdate) => {
    data.internal.settingsCalibration[inputUpdate.name] = inputUpdate.value
    updateNode({
      id: id,
      updatedData: data.internal
    })
  }

  /**
   * @param {Object} inputUpdate the object containing the name and the value of the input
   * @description This function is used to update the tuning settings of the node
   * */
  const onTuningParamChange = (model, inputUpdate) => {
    if (!Object.keys(data.internal).includes(model)) {
      data.internal[model] = {}
      data.internal[model].custom_grid = {}
    }
    data.internal[model].custom_grid[inputUpdate.name] = inputUpdate.value
    updateNode({
      id: id,
      updatedData: data.internal
    })
  }

  /**
   *
   * @param {Object} hasWarning an object containing the state of the warning and the tooltip
   * @description
   * This function is used to handle the warning of the node
   */
  const handleWarning = (hasWarning) => {
    data.internal.hasWarning = hasWarning
    updateNode({
      id: id,
      updatedData: data.internal
    })
  }

  /**
   *
   * @param {Object} e the event of the checkbox
   * @description
   * This function is used to handle the checkbox for enabling the tuning
   */
  const handleIntegration = (e) => {
    setIntegrateTuning(e.value)
    data.internal.isTuningEnabled = e.value
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
        // no body for this node (particular to this node)
        // default settings are the default settings of the node, so mandatory settings
        defaultSettings={
          <>
            {"default" in data.setupParam.possibleSettings && (
              <>
                <Stack direction="vertical" gap={1}>
                  {Object.entries(data.setupParam.possibleSettings.default).map(([settingName, setting]) => {
                    return (
                      <Input
                        setHasWarning={handleWarning}
                        key={settingName}
                        name={settingName}
                        settingInfos={setting}
                        currentValue={data.internal[settingName]}
                        onInputChange={onInputChange}
                      />
                    )
                  })}
                </Stack>
              </>
            )}
          </>
        }
        // node specific is the body of the node, so optional settings
        nodeSpecific={
          <>
            {/* === GENERAL OPTIONS WRAPPER BOX === */}
            <div style={{
              border: "1px solid #e0e0e0",          // bordure grise très claire
              borderRadius: "10px",                 // coins arrondis
              backgroundColor: "#fcfcfc",           // fond légèrement différent
              padding: "10px 12px",
              marginBottom: "12px",
              boxShadow: "0 1px 2px rgba(0,0,0,0.05)" // petite ombre douce
            }}>
            {/* === TRAINING OPTIONS SECTION === */}
            <div className="p-2 mb-1 d-flex justify-content-between align-items-center"
                style={{ border: "1px solid #ccc", borderRadius: "8px" }}>
              <span className="text-muted" style={{ fontSize: "0.9rem" }}>General Options</span>
              <Button
                variant="light"
                className="btn-contour ms-2"
                onClick={() => setModalShow(true)}
              >
                <Icon.Plus width="20px" height="20px" />
              </Button>
            </div>

            {/* the inputs for the options */}
            {data.internal.checkedOptions.length > 0 && (
              <>
                {/*<label>Global Options:</label>*/}
                {data.internal.checkedOptions.map((optionName) => {
                  return (
                    <Input
                      key={optionName}
                      name={optionName}
                      settingInfos={data.setupParam.possibleSettings.options[optionName]}
                      currentValue={data.internal.settings[optionName]}
                      onInputChange={onInputChange}
                    />
                  )
                })}
              </>
            )}
            </div>

            {/* THRESHOLD OPTIMIZATION SECTION */}
            <div className="p-2 mb-1" style={{ border: "1px solid #ccc", borderRadius: "8px" }}>
              <div className="mb-1 d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center">
                  <label className="me-2">Optimize Threshold</label>
                  <AiOutlineInfoCircle
                    className="btn-info-node"
                    onClick={() => {
                      shell.openExternal("https://pycaret.readthedocs.io/en/stable/api/classification.html#pycaret.classification.optimize_threshold")
                  }}
                  />
                </div>
                <InputSwitch
                  checked={optimizeThresh}
                  onChange={(e) => {
                    const newState = e.value
                    setOptimizeThresh(newState)
                    data.internal.optimizeThreshold = newState
                    updateNode({ id, updatedData: data.internal })
                  }}
                />
              </div>

              {/* Optimize Threshold Options */}
              {optimizeThresh && (
                <div>
                  {/* optimization metric */}
                  <Input
                    key={"string"}
                    name="Optimization Metric"
                    settingInfos={{
                      type: "string",
                      tooltip: "<span>Metric to be used for selecting best model.</span>",
                    }}
                    currentValue={data.internal.threshOptimizationMetric || "Accuracy"}
                    onInputChange={onInputChangeThreshold}
                    setHasWarning={handleWarning}
                  />
                </div>
              )}
            </div>
            
            {/* === INTEGRATE TUNING SECTION === */}
            <div style={{ border: "1px solid #ccc", borderRadius: "8px" }}>
              <div className="p-2 mb-1 d-flex justify-content-between align-items-center">
                <div className="d-flex align-items-center">
                  <label htmlFor="integrateTuning" className="me-2 mb-0">Tune Model</label>
                  <AiOutlineInfoCircle
                    className="btn-info-node"
                    onClick={() => {
                      shell.openExternal("https://pycaret.readthedocs.io/en/stable/api/classification.html#pycaret.classification.tune_model")
                  }}
                  />
                </div>
                <InputSwitch
                  className="integrateTuning"
                  checked={IntegrateTuning}
                  onChange={(e) => {
                    setIntegrateTuning(e.value)
                    data.internal.isTuningEnabled = e.value
                    updateNode({ id, updatedData: data.internal })
                  }}
                />
              </div>
              {data.internal.isTuningEnabled && data.internal.tuningGrid && Object.keys(data.internal.tuningGrid).length > 0 && (
                <>
                <div
                    className="p-2 mb-2 d-flex justify-content-between align-items-center"
                    style={{ border: "1px solid #ccc", borderRadius: "8px" }}
                  >
                    <span className="text-muted" style={{ fontSize: "0.9rem" }}>
                      Tuning Options
                    </span>
                    <Button
                      variant="light"
                      className="btn-contour ms-2"
                      onClick={() => setModalShowTuning(true)}
                    >
                      <Icon.Plus width="20px" height="20px" />
                    </Button>
                </div>
                <div className="p-3 mb-3 mt-3">
                  <div className="mb-1 d-flex align-items-center">
                    <label 
                      htmlFor="user-defined-switch" 
                      className="me-2"
                      style={{ 
                        whiteSpace: 'normal',
                        flex: '1 1 70%', // Allows wrapping and takes majority space
                        minWidth: '200px' // Ensures reasonable minimum width
                      }}
                    >
                      Use Pycaret's default hyperparameter search space
                    </label>
                    <div style={{ flex: '0 0 auto' }}>
                      <InputSwitch
                        className="user-defined-switch"
                        checked={usePycaretSearchSpace}
                        onChange={(e) => {
                          data.internal.useTuningGrid = !e.value
                          setUsePycaretSearchSpace(e.value)
                        }}
                      />
                    </div>
                  </div>
                </div>
                {!usePycaretSearchSpace && (
                  <>
                  <div style={{ 
                    backgroundColor: "#e7f3ff",  // bleu clair doux
                    border: "1px solid #b6daff", // bordure bleu clair
                    border: "1px solid #ccc", 
                    borderRadius: "8px", 
                    padding: "12px", 
                    marginBottom: "12px" 
                  }}>
                  <div style={{ fontWeight: "bold", margin: "10px 0" }}>Custom Tuning Grid</div>
                  {Object.keys(data.internal.tuningGrid).map((model) => {
                    const header = (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "left"}}>
                        <span>{data.internal.modelsInfo[model].name}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <label style={{ fontWeight: "bold", fontStyle: "italic", fontSize: "0.9rem" }}>
                            ID: {data.internal.modelsInfo[model].nameID}
                          </label>
                        </div>
                      </div>
                    )
                    return (
                      <Panel header={header} key={model} collapsed toggleable>
                        {Object.keys(data.internal.tuningGrid[model].options).filter((setting => data.internal.tuningGrid[model].hasOwnProperty(setting))).map((setting) => {
                        return (
                          <HyperParameterInput
                            name={setting}
                            model={model}
                            paramInfo={data.internal.tuningGrid[model].options[setting]}
                            currentValue={data.internal.tuningGrid[model].options[setting].default_val}
                            currentGridValues={data.internal[model] ? data.internal[model]?.custom_grid[setting] : null}
                            onParamChange={onTuningParamChange}
                          />
                        )
                        
                      })}

                    </Panel>
                  )
                  })}
                  </div>
                  </>
                )}
              </>
              )}
            </div>
            {data.internal.isTuningEnabled && data.internal.checkedOptionsTuning && data.internal.checkedOptionsTuning.length > 0 && (
              <>
                <hr />
                <div style={{ fontWeight: "bold", margin: "10px 0" }}>Tune Model Options</div>
                {data.internal.checkedOptionsTuning.map((optionName) => {
                  return (
                    <Input
                      key={optionName}
                      name={optionName}
                      settingInfos={data.setupParam.possibleSettingsTuning.options[optionName]}
                      currentValue={data.internal.settingsTuning[optionName]}
                      onInputChange={onInputChangeTuning}
                    />
                  )
                })}
              </>
            )}

            {/* ENSEMBLE SECTION */}
            <div className="p-2 mb-1" style={{ border: "1px solid #ccc", borderRadius: "8px" }}>
              <div className="mb-1 d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center">
                  <label className="me-2">Ensemble Model</label>
                  <AiOutlineInfoCircle
                    className="btn-info-node"
                    onClick={() => {
                      shell.openExternal("https://pycaret.readthedocs.io/en/stable/api/classification.html#pycaret.classification.ensemble_model")
                  }}
                  />
                </div>
                <InputSwitch
                  checked={ensembleEnabled}
                  onChange={(e) => {
                    const newState = e.value
                    setEnsembleEnabled(newState)
                    data.internal.ensembleEnabled = newState
                    updateNode({ id, updatedData: data.internal })
                  }}
                />
                
              </div>

              {/* Ensemble Options */}
              {ensembleEnabled && data.internal.ensembleOptions && Object.keys(data.internal.ensembleOptions).length > 0 && (
                <div>
                  {/* the inputs for the options */}
                  {Object.keys(data.internal.ensembleOptions).map((optionName) => {
                    return (
                      <Input
                        key={optionName}
                        name={optionName}
                        settingInfos={data.internal.ensembleOptions[optionName]}
                        currentValue={data.internal.settingsEnsembling[optionName]}
                        onInputChange={onInputChangeEnsemble}
                        setHasWarning={handleWarning}
                      />
                    )
                  })}
                </div>
              )}
            </div>

            {/* CALIBRATE SECTION */}
            <div className="p-2 mb-1" style={{ border: "1px solid #ccc", borderRadius: "8px" }}>
              <div className="mb-1 d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center">
                  <label className="me-2">Calibrate Model</label>
                  <AiOutlineInfoCircle
                    className="btn-info-node"
                    onClick={() => {
                      shell.openExternal("https://pycaret.readthedocs.io/en/stable/api/classification.html#pycaret.classification.calibrate_model")
                    }}
                  />
                </div>
                <InputSwitch
                  checked={calibrateEnabled}
                  onChange={(e) => {
                    const newState = e.value
                    setCalibrateEnabled(newState)
                    data.internal.calibrateEnabled = newState
                    updateNode({ id, updatedData: data.internal })
                  }}
                />
              </div>

              {/* Calibrate Options */}
              {calibrateEnabled && data.internal.calibrateOptions && Object.keys(data.internal.calibrateOptions).length > 0 && (
                <div>
                  {/* the inputs for the options */}
                  {Object.keys(data.internal.calibrateOptions).map((optionName) => {
                    return (
                      <Input
                        key={optionName}
                        name={optionName}
                        settingInfos={data.internal.calibrateOptions[optionName]}
                        currentValue={data.internal.settingsCalibration[optionName]}
                        onInputChange={onInputChangeCalibration}
                        setHasWarning={handleWarning}
                      />
                    )
                  })}
                </div>
              )}

              {/* champs dynamiques calibrate */}
              {calibrateEnabled && data.internal.checkedOptionsCalibrate?.map((optionName) => {
                const setting = data.setupParam.possibleSettings.options?.calibrate?.options?.[optionName]
                return setting ? (
                  <Input
                    key={optionName}
                    name={optionName}
                    settingInfos={setting}
                    currentValue={data.internal.settings?.[optionName]}
                    onInputChange={onInputChange}
                    setHasWarning={handleWarning}
                  />
                ) : null
              })}
            </div>

            {/* the modal component*/}
            <ModalSettingsChooser
              show={modalShow}
              onHide={() => setModalShow(false)}
              options={data.setupParam.possibleSettings.options}
              data={data}
              id={id}
              optionsTuning={data.internal.isTuningEnabled ? data.setupParam.possibleSettingsTuning.options : null}
            />
            
            <ModalSettingsChooser
              show={modalShowTuning}
              onHide={() => setModalShowTuning(false)}
              options={{}}
              optionsTuning={data.setupParam.possibleSettingsTuning.options}
              data={data}
              id={id}
              title="Tuning Options"
            />

          </>
        }
        // Link to documentation
        nodeLink={"https://medomics-udes.gitbook.io/medomicslab-docs/tutorials/development/learning-module"}
      />
    </>
  )
}

export default TrainModelNode
