import { InputSwitch } from "primereact/inputswitch"
import { Dropdown } from "primereact/dropdown"
import { Panel } from "primereact/panel"
import { useContext, useEffect, useState } from "react"
import { Button, Stack } from "react-bootstrap"
import * as Icon from "react-bootstrap-icons"
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
  const [usePycaretSearchSpace, setUsePycaretSearchSpace] = useState(false) // state of the checkbox
  const { updateNode } = useContext(FlowFunctionsContext)
  const [IntegrateTuning, setIntegrateTuning] = useState(data.internal.isTuningEnabled ?? false)

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
    if (!("useTuningGrid" in Object.keys(data.internal))) {
      data.internal.useTuningGrid = false
      updateNode({
        id: id,
        updatedData: data.internal
      })
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
            <div className="p-2 mb-3" style={{ border: "1px solid #ccc", borderRadius: "8px" }}>
              <div className="mb-1 d-flex align-items-center justify-content-between">
                <label htmlFor="integrateTuning" className="me-2">Integrate Tuning</label>
                <InputSwitch
                  className="integrateTuning"
                  checked={IntegrateTuning}
                  onChange={(e) => handleIntegration(e)}
                />
              </div>
            </div>
            {/* the button to open the modal (the plus sign)*/}
            <Button variant="light" className="width-100 btn-contour" onClick={() => setModalShow(true)}>
              <Icon.Plus width="30px" height="30px" className="img-fluid" />
            </Button>
            {/* the modal component*/}
            <ModalSettingsChooser
              show={modalShow}
              onHide={() => setModalShow(false)}
              options={data.setupParam.possibleSettings.options}
              data={data}
              id={id}
              optionsTuning={data.internal.isTuningEnabled ? data.setupParam.possibleSettingsTuning.options : null}
            />
            {/* the inputs for the options */}
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
            
            {data.internal.isTuningEnabled && data.internal.tuningGrid && Object.keys(data.internal.tuningGrid).length > 0 && (
                <>
                <div className="p-3 mb-3 mt-3" style={{ border: "1px solid #ccc", borderRadius: "8px" }}>
                  <div className="mb-1 d-flex align-items-center" style={{ flexWrap: 'wrap' }}>
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
                  <hr />
                  <div style={{ fontWeight: "bold", margin: "10px 0" }}>Custom Tuning Grid</div>
                  {Object.keys(data.internal.tuningGrid).map((model) => {
                    return (
                      <Panel header={model} key={model} collapsed toggleable>
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
                  </>
                )}
              </>
            )}
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
          </>
        }
        // Link to documentation
        nodeLink={"https://medomics-udes.gitbook.io/medomicslab-docs/tutorials/development/learning-module"}
      />
    </>
  )
}

export default TrainModelNode
