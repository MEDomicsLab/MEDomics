import React, { useContext, useState } from "react"
import { Button, Dropdown, Modal } from "react-bootstrap"
import FlInput from "./flInput"
import { Message } from "primereact/message"
import Path from "path"
import { DataContext, UUID_ROOT } from "../workspace/dataContext"
import { EXPERIMENTS, WorkspaceContext } from "../workspace/workspaceContext"
import { MEDDataObject } from "../workspace/NewMedDataObject"

export default function DBCOnfigFileModal({ show, onHide, setFile, configFile, onConfirm }) {
  const { globalData } = useContext(DataContext)

  const [useOldDB, setChoice] = useState("not")
  const { workspace } = useContext(WorkspaceContext)

  const onFilesChange = (inputUpdate) => {
    setFile(inputUpdate.value)
    console.log(inputUpdate.value)
  }
  return (
    <div>
      <Modal show={show} onHide={onHide} size="lg" aria-labelledby="contained-modal-title-vcenter" centered className="modal-settings-chooser">
        <Modal.Header closeButton>
          <Modal.Title id="contained-modal-title-vcenter">Select a Database file</Modal.Title>
        </Modal.Header>
        {/* Display all the options available for the node */}
        <Modal.Body>
          <Message severity="info" text="Specify the name of the DB file, in case you have an existing file you can select it from the workspace" className="w-100 justify-content-start mb-3 " />

          <select
            style={{ width: "100%", borderColor: "#DDD" }}
            className="rounded p-2 mb-3"
            onChange={(e) => {
              console.log(e.target.value)
              setChoice(e.target.value)
            }}
          >
            <option value={"not"}>New DB File</option>
            <option value={"use"}>Existing DB file</option>
          </select>

          {useOldDB == "use" ? (
            <FlInput
              name="DB file"
              settingInfos={{
                type: "data-input",
                tooltip: "<p>Specify a db file</p>"
              }}
              currentValue={configFile || {}}
              onInputChange={onFilesChange}
              setHasWarning={() => {}}
              acceptedExtensions={["db"]}
            />
          ) : (
            <FlInput
              name="DB file name"
              settingInfos={{
                type: "string",
                tooltip: "<p>Specify a db file</p>"
              }}
              currentValue={configFile.name || ""}
              onInputChange={(e) => {
                onFilesChange({ value: { name: e.value, path: workspace.workingDirectory.path + "/EXPERIMENTS/FL/DB/" + e.value + ".db" } })
              }}
              setHasWarning={() => {}}
            />
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button
            onClick={() => {
              let path = Path.join(workspace.workingDirectory.path, EXPERIMENTS)

              MEDDataObject.createFolderFSsync(path + "/FL")
              MEDDataObject.createFolderFSsync(path + "/FL/DB")

              onConfirm()
            }}
          >
            Confirm
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  )
}
