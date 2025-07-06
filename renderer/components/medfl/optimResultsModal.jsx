import React, { useContext, useState } from "react"
import Modal from "react-bootstrap/Modal"
import { JsonView, allExpanded } from "react-json-view-lite"
import { toast } from "react-toastify"

import { UUID_ROOT, DataContext } from "../workspace/dataContext"
import { EXPERIMENTS } from "../workspace/workspaceContext"

import Path from "path"
import { InputText } from "primereact/inputtext"
import { Button } from "primereact/button"
import { MEDDataObject } from "../workspace/NewMedDataObject"

const OptimResultsModal = ({ show, onHide, title, results }) => {
  //states
  const [fileName, setFileName] = useState("")
  const [isFileName, showFileName] = useState(false)

  // context
  const { globalData } = useContext(DataContext)

  const saveOptResults = async () => {
    try {
      let path = Path.join(globalData[UUID_ROOT].path, EXPERIMENTS)

      MEDDataObject.createFolderFromPath(path + "/FL")
      MEDDataObject.createFolderFromPath(path + "/FL/Optimization")

      // do custom actions in the folder while it is unzipped
      await MEDDataObject.writeFileSync({ data: results["data"], date: Date.now() }, path + "/FL/Optimization", fileName, "json")
      await MEDDataObject.writeFileSync({ data: results["data"], date: Date.now() }, path + "/FL/Optimization", fileName, "medflopt")
      showFileName(false)
      toast.success("Optimization results saved successfuly ")
      onHide()
    } catch {
      toast.error("Something went wrong ")
    }
  }
  return (
    <div>
      <Modal show={show} onHide={onHide} size="lg" aria-labelledby="contained-modal-title-vcenter" centered className="modal-settings-chooser">
        <Modal.Header closeButton>
          <Modal.Title id="contained-modal-title-vcenter">{title}</Modal.Title>
        </Modal.Header>
        {/* Display all the options available for the node */}
        <Modal.Body>
          {results["data"] ? (
            <>
              <div className="h4">
                Metric : <span className="text-danger">{results["data"]["Metric"]}</span>
              </div>
              <div className="h4">
                Best Score : <span className="text-danger">{results["data"]["Best Score"]}</span>
              </div>
              <div className="h4">
                Best HyperParameters : <span></span>
              </div>
              <JsonView data={results["data"]["Best Parameters"]} shouldExpandNode={allExpanded} />

           { results["data"]["opt_history"] ? <div>
            <img src={`data:image/png;base64,${results["data"]["opt_history"]}`} alt="Optimization History" />
              <img src={`data:image/png;base64,${results["data"]["parallel_coordinates"]}`} alt="parallel_coordinates" />
              <img src={`data:image/png;base64,${results["data"]["param_importance"]}`} alt="param_importance" />
           
           </div>  : null } </>
          ) : (
            "Loading"
          )}
        </Modal.Body>
        <Modal.Footer>
          {!isFileName ? <Button label="Save results" icon="pi pi-save" onClick={() => showFileName(true)}></Button> : null}
          {isFileName ? (
            <div className="d-flex">
              <div className="p-inputgroup flex-1 me-4">
                <InputText placeholder="File name" onChange={(e) => setFileName(e.target.value)} />
                <Button label="Save results" icon="pi pi-save" className="p-button-primary" onClick={saveOptResults} disabled={fileName == ""}></Button>
              </div>
            </div>
          ) : null}
        </Modal.Footer>
      </Modal>
    </div>
  )
}

export default OptimResultsModal
