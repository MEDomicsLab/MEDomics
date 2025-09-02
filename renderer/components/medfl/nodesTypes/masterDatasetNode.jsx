import React, { useState, useContext, useEffect } from "react"
import Node from "../../flow/node"

import { Button } from "react-bootstrap"
import * as Icon from "react-bootstrap-icons"
import { FlowFunctionsContext } from "../../flow/context/flowFunctionsContext"
import { Stack } from "react-bootstrap"
import { DataContext } from "../../workspace/dataContext"
import { LoaderContext } from "../../generalPurpose/loaderContext"
import ModalSettingsChooser from "../../learning/modalSettingsChooser"
import FlInput from "../flInput"
import { loadCSVFromPath } from "../../../utilities/fileManagementUtils"
import { MEDDataObject } from "../../workspace/NewMedDataObject"

import { getCollectionColumns } from "../../mongoDB/mongoDBUtils"

import Input from "../../learning/input"

export default function MasterDatasetNode({ id, data }) {
  const [modalShow, setModalShow] = useState(false) // state of the modal
  const { updateNode } = useContext(FlowFunctionsContext)
  const { globalData, setGlobalData } = useContext(DataContext)
  const { setLoader } = useContext(LoaderContext)

  // update the node internal data when the selection changes
  useEffect(() => {
    if (data.internal.settings.files && data.internal.settings.files.path == "") {
      data.internal.hasWarning = { state: true, tooltip: <p>No file selected</p> }
    } else {
      data.internal.hasWarning = { state: false }
    }
    updateNode({
      id: id,
      updatedData: data.internal
    })
  }, [])

  /**
   *
   * @param {Object} inputUpdate The input update
   *
   * @description
   * This function is used to update the node internal data when an input changes.
   * Custom to this node, it also updates the global data when the files input changes.
   */
  const onInputChange = (inputUpdate) => {
    data.internal.settings[inputUpdate.name] = inputUpdate.value
    if (inputUpdate.name == "files" || inputUpdate.name == "target") {
      setGlobalData({ ...globalData })
    }
    updateNode({
      id: id,
      updatedData: data.internal
    })
  }

  /**
   *
   * @param {Object} hasWarning The warning object
   *
   * @description
   * This function is used to update the node internal data when a warning is triggered from the Input component.
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
   * @param {Object} inputUpdate The input update
   *
   * @description
   * This function is used to update the node internal data when the files input changes.
   */
  const onMultipleFilesChange = async (inputUpdate) => {
    data.internal.settings[inputUpdate.name] = inputUpdate.value
    data.internal.settings.tags = []
    if (inputUpdate.value.length > 0) {
      data.internal.settings.multipleColumns = []
      inputUpdate.value.forEach(async (inputUpdateValue) => {
        if (inputUpdateValue.name != "") {
          setLoader(true)
          let columnsArray = await getCollectionColumns(inputUpdateValue.id)
          let columnsObject = {}
          columnsArray.forEach((column) => {
            columnsObject[column] = column
          })
          let steps = null //await MedDataObject.getStepsFromPath(inputUpdateValue.path, globalData, setGlobalData)
          setLoader(false)
          let timePrefix = inputUpdateValue.name.split("_")[0]
          steps && (data.internal.settings.steps = steps)
          data.internal.settings.columns = columnsObject
          columnsObject = Object.keys(columnsObject).reduce((acc, key) => {
            acc[timePrefix + "_" + key] = timePrefix + "_" + columnsObject[key]
            return acc
          }, {})
          let lastMultipleColumns = data.internal.settings.multipleColumns ? data.internal.settings.multipleColumns : []
          data.internal.settings.multipleColumns = { ...lastMultipleColumns, ...columnsObject }
          data.internal.settings.target = columnsArray[columnsArray.length - 1]
        }
      })
    } else {
      delete data.internal.settings.target
      delete data.internal.settings.columns
      delete data.internal.settings.tags
      delete data.internal.settings.multipleColumns
    }
    updateNode({
      id: id,
      updatedData: data.internal
    })
  }

  /**
   *
   * @param {Object} inputUpdate The input update
   *
   * @description
   * This function is used to update the node internal data when the files input changes.
   */
  const onFilesChange = async (inputUpdate) => {
    data.internal.settings[inputUpdate.name] = inputUpdate.value
    console.log(data.internal.settings)
    if (inputUpdate.value.id != "") {
      setLoader(true)
      let columnsArray = await getCollectionColumns(inputUpdate.value.id)
      let columnsObject = {}
      columnsArray.forEach((column) => {
        columnsObject[column] = column
      })
      let steps = null
      setLoader(false)
      steps && (data.internal.settings.steps = steps)
      data.internal.settings.columns = columnsObject
      data.internal.settings.target = columnsArray[columnsArray.length - 1]
    } else {
      delete data.internal.settings.target
      delete data.internal.settings.columns
    }
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
        // the body of the node is a form select (particular to this node)
        nodeBody={
          <>
            <div className="center">
              <Button variant="light" className="width-100 btn-contour">
                {data.internal.settings.target ? "Change MasterDataset" : "Select MasterDataset"}
              </Button>
            </div>
          </>
        }
        // default settings are the default settings of the node, so mandatory settings
        defaultSettings={
          <>
            <Stack id="default" direction="vertical" gap={1}>
              <>
                <FlInput
                  name="files"
                  settingInfos={{
                    type: "data-input",
                    tooltip: "<p>Specify a data file (xlsx, csv, json)</p>"
                  }}
                  currentValue={data.internal.settings.files && data.internal.settings.files.id}
                  onInputChange={onFilesChange}
                  setHasWarning={handleWarning}
                  acceptedExtensions={["csv"]}
                />
                <FlInput
                  disabled={data.internal.settings.files && data.internal.settings.files.path == ""}
                  name="target"
                  currentValue={data.internal.settings.target}
                  settingInfos={{
                    type: "list",
                    tooltip: "<p>Specify the column name of the target variable</p>",
                    choices: data.internal.settings.columns
                      ? Object.entries(data.internal.settings.columns).map(([option]) => {
                          return {
                            name: option
                          }
                        })
                      : []
                  }}
                  onInputChange={onInputChange}
                  customProps={{
                    filter: true
                  }}
                />
              </>
            </Stack>
          </>
        }
        // node specific is the body of the node, so optional settings
        nodeSpecific={
          <>
            <>
              {/* the button to open the modal (the plus sign)*/}
              <Button variant="light" className="width-100 btn-contour" onClick={() => setModalShow(true)}>
                <Icon.Plus width="30px" height="30px" className="img-fluid" />
              </Button>
              {/* the modal component*/}
              <ModalSettingsChooser show={modalShow} onHide={() => setModalShow(false)} options={data.setupParam.possibleSettings.options} data={data} id={id} />
              {/* the inputs for the options */}
              {data.internal.checkedOptions.map((optionName) => {
                return (
                  <FlInput
                    key={optionName}
                    name={optionName}
                    settingInfos={data.setupParam.possibleSettings.options[optionName]}
                    currentValue={data.internal.settings[optionName]}
                    onInputChange={onInputChange}
                  />
                )
              })}
            </>
          </>
        }
      />
    </>
  )
}
