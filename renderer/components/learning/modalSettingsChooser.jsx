import React, { useContext } from "react"
import Modal from "react-bootstrap/Modal"
import Button from "react-bootstrap/Button"
import CheckOption from "./checkOption"
import { useState, useEffect } from "react"
import { FlowFunctionsContext } from "../flow/context/flowFunctionsContext"

/**
 *
 * @param {boolean} show state of the modal
 * @param {function} onHide function executed when the modal is closed
 * @param {object} options options to display in the modal
 * @param {string} id id of the node
 * @param {object} data data of the node
 * @returns {JSX.Element} A ModalSettingsChooser modal
 *
 * @description
 * This component is used to display a ModalSettingsChooser modal.
 * it handles the display of the modal and the available options
 */
const ModalSettingsChooser = ({ show, onHide, options, id, data, optionsTuning = null }) => {
  const [checkedUpdate, setCheckedUpdate] = useState(null)
  const [checkedUpdateTuning, setCheckedUpdateTuning] = useState(null)
  const { updateNode } = useContext(FlowFunctionsContext)
  const settings = data.setupParam?.possibleSettings?.[data.internal.selection]?.options
  const option = settings?.[checkedUpdate.optionName]

  // update the node when a setting is checked or unchecked from the modal
  useEffect(() => {
    if (!checkedUpdate) return;
  
    const settings = data.setupParam?.possibleSettings?.[data.internal.selection]?.options;
    const option = settings?.[checkedUpdate.optionName];
  
    if (checkedUpdate.checked) {
      if (!data.internal.checkedOptions.includes(checkedUpdate.optionName)) {
        data.internal.checkedOptions.push(checkedUpdate.optionName);
      }
  
      if (
        option &&
        "default_val" in option &&
        data.internal.settings[checkedUpdate.optionName] !== option.default_val
      ) {
        data.internal.settings[checkedUpdate.optionName] = option.default_val;
      }
    } else {
      data.internal.checkedOptions = data.internal.checkedOptions.filter((name) => name !== checkedUpdate.optionName);
      delete data.internal.settings[checkedUpdate.optionName];
    }
  
    updateNode({
      id,
      updatedData: data.internal,
    });
  }, [checkedUpdate]);
  

  // update the node when a setting is checked or unchecked from the modal
  useEffect(() => {
    if (checkedUpdateTuning != null) {
      if (checkedUpdateTuning.checked) {
        !data.internal.checkedOptionsTuning.includes(checkedUpdateTuning.optionName) && data.internal.checkedOptionsTuning.push(checkedUpdateTuning.optionName)
      } else {
        data.internal.checkedOptionsTuning = data.internal.checkedOptionsTuning.filter((optionName) => optionName != checkedUpdateTuning.optionName)
        delete data.internal.settingsTuning[checkedUpdateTuning.optionName]
      }
      updateNode({
        id: id,
        updatedData: data.internal
      })
    }
  }, [checkedUpdateTuning])

  return (
    // Base modal component built from react-bootstrap
    <Modal show={show} onHide={onHide} size="lg" aria-labelledby="contained-modal-title-vcenter" centered className="modal-settings-chooser">
      <Modal.Header closeButton>
        <Modal.Title id="contained-modal-title-vcenter">{data.setupParam.title + " options"}</Modal.Title>
      </Modal.Header>
      {/* Display all the options available for the node */}
      <Modal.Body>
        {Object.entries(options).map(([optionName, optionInfos], i) => {
          return (
            <CheckOption key={optionName + i} optionName={optionName} optionInfos={optionInfos} updateCheckState={setCheckedUpdate} defaultState={data.internal.checkedOptions.includes(optionName)} />
          )
        })}
        {/* Display all the options available for the tuning */}
        {optionsTuning && (
          <>
            <h3>Tuning options</h3>
            {Object.entries(optionsTuning).map(([optionName, optionInfos], i) => {
              return (
                <CheckOption
                  key={optionName + i}
                  optionName={optionName}
                  optionInfos={optionInfos}
                  updateCheckState={setCheckedUpdateTuning}
                  defaultState={data.internal.checkedOptionsTuning.includes(optionName)}
                />
              )
            })}
          </>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button onClick={onHide}>Save</Button>
      </Modal.Footer>
    </Modal>
  )
}

export default ModalSettingsChooser
