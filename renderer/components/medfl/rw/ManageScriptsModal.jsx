import React from "react"
import { Button } from "react-bootstrap"
import Modal from "react-bootstrap/Modal"
import ManageScripts from "./ManageScripts"

export default function ManageScriptsModal({ show, onHide }) {
  return (
    <div>
      <Modal show={show} onHide={onHide} size="xl" aria-labelledby="contained-modal-title-vcenter" centered className="modal-settings-chooser">
        <Modal.Header closeButton>
          <Modal.Title id="contained-modal-title-vcenter">Script Configuration</Modal.Title>
        </Modal.Header>
        {/* Display all the options available for the node */}
        <Modal.Body>
          <ManageScripts />
        </Modal.Body>
        <Modal.Footer>
          {/* <Button onClick={onHide}>Save results</Button> */}
        </Modal.Footer>
      </Modal>
    </div>
  )
}
