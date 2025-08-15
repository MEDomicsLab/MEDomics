import React, { useState, useContext, useEffect } from "react"
import Node from "../../flow/node"
import Input from "../input"
import { Button } from "react-bootstrap"
import ModalSettingsChooser from "../modalSettingsChooser"
import * as Icon from "react-bootstrap-icons"
import { FlowFunctionsContext } from "../../flow/context/flowFunctionsContext"
import { Stack } from "react-bootstrap"
import { Checkbox } from "primereact/checkbox"

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
  const { updateNode } = useContext(FlowFunctionsContext)
  const [IntegrateTuning, setIntegrateTuning] = useState(data.internal.isTuningEnabled ?? false)
  const [modalTuningBody, setModalTuningBody] = useState(null)

  // Check if isTuningEnabled exists in data.internal, if not initialize it
  useEffect(() => {
    if (!("isTuningEnabled" in data.internal)) {
      data.internal.isTuningEnabled = false
      updateNode({
        id: id,
        updatedData: data.internal
      })
    }
    console.log(data.internal)
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
    setIntegrateTuning(e.checked)
    data.internal.isTuningEnabled = e.checked
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
                        currentValue={data.internal.settings[settingName]}
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
            <div className="flex align-items-center">
              <Checkbox inputId="integrateTuning" checked={IntegrateTuning} onChange={(e) => handleIntegration(e)} />
              <label htmlFor="integrateTuning" className="ml-2" style={{ paddingLeft: "5px" }}>
                Integrate Tuning
              </label>
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
            {data.internal.isTuningEnabled && data.internal.checkedOptionsTuning && data.internal.checkedOptionsTuning.length > 0 && (
              <>
                <hr />
                <div style={{ fontWeight: "bold", margin: "10px 0" }}>Tune Model Options</div>
                {data.internal.checkedOptionsTuning.map((optionName) => {
                  console.log(data)
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
