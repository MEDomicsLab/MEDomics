import { Button } from "primereact/button"
import { Dropdown } from "primereact/dropdown"
import { InputText } from "primereact/inputtext"
import { Message } from "primereact/message"
import React, { useContext, useEffect, useState } from "react"
import { Col, Row } from "react-bootstrap"
import { getPathSeparator } from "../../utilities/fileManagementUtils"
import { DataContext } from "../workspace/dataContext"

/**
 * Component for saving datasets with options to set name, extension, and overwrite existing datasets.
 * @param {Object} props - Component props.
 * @param {string} props.newDatasetName - The name of the new dataset.
 * @param {string} props.newDatasetExtension - The extension of the new dataset.
 * @param {Object} props.selectedDataset - The currently selected dataset object.
 * @param {Function} props.setNewDatasetName - Function to set the new dataset name.
 * @param {Function} props.setNewDatasetExtension - Function to set the new dataset extension.
 * @param {Function} props.functionToExecute - Function to execute when creating or overwriting a dataset.
 * @param {boolean} [props.showExtensions=true] - Whether to display file extensions in the input field.
 * @param {boolean} [props.overwriteOption=true] - Whether to include an overwrite option button.
 * @param {boolean} [props.enabled=true] - Whether the component is enabled or disabled.
 * @param {string} [props.pathToCheckInto=null] - The path to check for existing dataset names.
 * @returns {JSX.Element} - The SaveDataset component JSX.
 */
const SaveDataset = ({
  newDatasetName,
  newDatasetExtension,
  selectedDataset,
  setNewDatasetName,
  setNewDatasetExtension,
  functionToExecute,
  showExtensions = true,
  overwriteOption = true,
  enabled = true,
  pathToCheckInto = null
}) => {
  const [nameAlreadyUsed, setNameAlreadyUsed] = useState(false) // True if the entered name for saving the dataset is already used
  const { globalData } = useContext(DataContext) // The global data object

  /**
   * To check if the name is already used
   * @param {String} name - The name to check
   * @returns {Boolean} - True if the name is already used, false otherwise
   */
  const checkIfNameAlreadyUsed = (name) => {
    let alreadyUsed = false
    if (newDatasetName?.length > 0 && selectedDataset) {
      let pathToCheck = ""
      if (pathToCheckInto) {
        pathToCheck = pathToCheckInto + getPathSeparator() + name
      } else {
        let newDatasetPathParent = globalData[selectedDataset.parentID].path
        pathToCheck = newDatasetPathParent + getPathSeparator() + name
      }
      Object.entries(globalData).map((arr) => {
        if (arr[1].path === pathToCheck) {
          alreadyUsed = true
        }
      })
    }
    setNameAlreadyUsed(alreadyUsed)
  }

  /** Hook called when the global data changes */
  useEffect(() => {
    checkIfNameAlreadyUsed(`${showExtensions ? newDatasetName + "." + newDatasetExtension : newDatasetName}`)
  }, [globalData, newDatasetName])

  return (
    <>
      <Row style={{ display: "flex", justifyContent: "space-evenly", flexDirection: "row", marginTop: "1rem", alignItems: "center" }}>
        {overwriteOption && (
          <Col>
            <Button
              label="Overwrite"
              severity={"danger"}
              size="small"
              disabled={!selectedDataset || !enabled}
              onClick={() => {
                functionToExecute(true) // the function must have an overwrite option
              }}
            />
          </Col>
        )}
        <Col style={{ display: "flex", flexDirection: "row", justifyContent: "center", flexGrow: 0, alignItems: "center" }} xs>
          <div className="p-input-group flex-1 dataset-name " style={{ display: "flex", flexDirection: "row" }}>
            <InputText
              className={`${nameAlreadyUsed ? "p-invalid" : ""}`}
              placeholder="Name"
              value={newDatasetName}
              keyfilter={"alphanum"}
              onChange={(e) => {
                setNewDatasetName(e.target.value)
                checkIfNameAlreadyUsed(`${showExtensions ? e.target.value + "." + newDatasetExtension : e.target.value}`)
              }}
            />
            {showExtensions && (
              <span className="p-inputgroup-addon">
                <Dropdown
                  className={`${nameAlreadyUsed ? "p-invalid" : ""}`}
                  panelClassName="dataset-name"
                  value={newDatasetExtension}
                  options={[{ label: ".csv", value: "csv" }]}
                  onChange={(e) => {
                    setNewDatasetExtension(e.target.value)
                    checkIfNameAlreadyUsed(newDatasetName + "." + e.target.value)
                  }}
                />
              </span>
            )}
          </div>
        </Col>
        <Col>
          <Button
            label="Create"
            size="small"
            disabled={nameAlreadyUsed || !selectedDataset || newDatasetName?.length < 1 || !enabled}
            onClick={() => {
              functionToExecute()
            }}
          />
        </Col>
      </Row>
      {/* Warning display */}
      {nameAlreadyUsed && (
        <div className="flex-container">
          <Message severity="warn" text="The entered name already exists." />
        </div>
      )}
    </>
  )
}

export default SaveDataset
