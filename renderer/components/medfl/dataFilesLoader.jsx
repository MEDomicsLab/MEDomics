import React, { useState } from "react"
import DataTableWrapperBPClass from "../dataTypeVisualisation/dataTableWrapperBPClass"
import { loadCSVFromPath } from "../../utilities/fileManagementUtils"
import { Modal } from "react-bootstrap"

export default function DataFilesLoader(props) {
  //  loadCSVFromPath(config.path, whenDataLoaded)
  const [globalData, setGlobalData] = useState(null)

  const dfd = require("../../utilities/danfo.js")

  const whenDataLoaded = (data) => {
    data = new dfd.DataFrame(data)
    data = dfd.toJSON(data, { format: "column" })
    setGlobalData(data)
  }

  !globalData && loadCSVFromPath(props.path, whenDataLoaded)

  return (
    <>
      <Modal show={props.show} onHide={props.onHide} size="lg" aria-labelledby="contained-modal-title-vcenter" centered className="modal-settings-chooser">
        <Modal.Header closeButton>
          <Modal.Title id="contained-modal-title-vcenter">{props.title}</Modal.Title>
        </Modal.Header>
        {/* Display all the options available for the node */}
        <Modal.Body>
          <div style={{ height: 600 }}>
            {globalData && (
              <DataTableWrapperBPClass
                data={globalData}
                tablePropsData={{
                  paginator: true,
                  rows: 10,
                  scrollable: true,
                  scrollHeight: "400px"
                }}
                tablePropsColumn={{
                  sortable: true
                }}
                config={{}}
                globalData={{}}
                setGlobalData={{}}
              />
            )}
          </div>
        </Modal.Body>
        <Modal.Footer></Modal.Footer>
      </Modal>
    </>
  )
}
