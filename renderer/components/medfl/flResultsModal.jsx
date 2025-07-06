import React from "react"
import { Button } from "react-bootstrap"
import Modal from "react-bootstrap/Modal"

export default function FlResultsModal({ show, onHide, results, title }) {
  return (
    <div>
      <Modal show={show} onHide={onHide} size="lg" aria-labelledby="contained-modal-title-vcenter" centered className="modal-settings-chooser">
        <Modal.Header closeButton>
          <Modal.Title id="contained-modal-title-vcenter">{title}</Modal.Title>
        </Modal.Header>
        {/* Display all the options available for the node */}
        <Modal.Body>{results}</Modal.Body>
        <Modal.Footer>
          <Button onClick={onHide}>Save results</Button>
        </Modal.Footer>
      </Modal>
    </div>
  )
}
