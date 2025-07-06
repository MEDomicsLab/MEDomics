import React from "react"
import { Button, Modal } from "react-bootstrap"
import FlInput from "./flInput"
import { Message } from "primereact/message"

export default function DBCOnfigFileModal({ show, onHide, setFile, configFile }) {
  const onFilesChange = (inputUpdate) => {
    setFile(inputUpdate.value)
    console.log(inputUpdate.value)
  }
  return (
    <div>
      <Modal show={show} onHide={onHide} size="lg" aria-labelledby="contained-modal-title-vcenter" centered className="modal-settings-chooser">
        <Modal.Header closeButton>
          <Modal.Title id="contained-modal-title-vcenter">Select a Database configuration file</Modal.Title>
        </Modal.Header>
        {/* Display all the options available for the node */}
        <Modal.Body>
          <Message severity="info" text="Select a config.ini file " className="w-100 justify-content-start mb-3 " />

          <FlInput
            name="DB config file"
            settingInfos={{
              type: "data-input",
              tooltip: "<p>Specify a config file (ini)</p>"
            }}
            currentValue={configFile || {}}
            onInputChange={onFilesChange}
            setHasWarning={() => {}}
            acceptedExtensions={["ini"]}
          />
        </Modal.Body>
        <Modal.Footer>
          <Button onClick={onHide}>Cancel</Button>
        </Modal.Footer>
      </Modal>
    </div>
  )
}
