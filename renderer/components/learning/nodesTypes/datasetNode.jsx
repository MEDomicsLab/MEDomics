import { Button } from 'primereact/button'
import React, { useContext, useEffect, useRef, useState } from "react"
import { Stack } from "react-bootstrap"
import Form from "react-bootstrap/Form"
import { FlowFunctionsContext } from "../../flow/context/flowFunctionsContext"
import Node from "../../flow/node"
import { LoaderContext } from "../../generalPurpose/loaderContext"
import { getCollectionColumns } from "../../mongoDB/mongoDBUtils"
import Input from "../input"
import ModalSettingsChooser from "../modalSettingsChooser"
import { OverlayPanel } from 'primereact/overlaypanel'

/**
 *
 * @param {string} id id of the node
 * @param {object} data data of the node
 * @returns {JSX.Element} A StandardNode node
 *
 * @description
 * This component is used to display a StandardNode node.
 * it handles the display of the node and the modal
 *
 */
const DatasetNode = ({ id, data }) => {
  const [modalShow, setModalShow] = useState(false) // state of the modal
  const [selection, setSelection] = useState(data.internal.selection || "medomics") // state of the selection (medomics or custom
  const { updateNode } = useContext(FlowFunctionsContext)
  const { setLoader } = useContext(LoaderContext)
  const [tagId, setTagId] = useState(localStorage.getItem("myUUID"))

  useEffect(() => {
    if (!tagId) {
      let uuid = "column_tags"
      localStorage.setItem("myUUID", uuid)
      setTagId(uuid)
    }
  }, [])

  // update the node internal data when the selection changes
  useEffect(() => {
    data.internal.selection = selection
    updateNode({
      id: id,
      updatedData: data.internal
    })
  }, [selection])

  // update the node when the selection changes
  const onSelectionChange = (e) => {
    setSelection(e.target.value)
    data.internal.settings = {}
    data.internal.checkedOptions = []
    data.internal.hasWarning = { state: true, tooltip: <p>Some default fields are missing</p> }
    e.stopPropagation()
    e.preventDefault()
  }

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
  const onFilesChange = async (inputUpdate) => {
    data.internal.settings[inputUpdate.name] = inputUpdate.value
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
   * This function is used to update the node internal data when the tags input changes.
   */
  const onMultipleTagsChange = async (inputUpdate) => {
    data.internal.settings[inputUpdate.name] = inputUpdate.value
    updateNode({
      id: id,
      updatedData: data.internal
    })
  }

  /**
   * 
   * @description
   * This function renders the files in the overlay panel
   */
  const renderSelectedFiles = () => {
    if (selection === "medomics"){
      if (data.internal.settings.files && data.internal.settings.files.length > 0) {
        return (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {data.internal.settings.files.map((file) => (
              <Button key={file.name} raised text label={file.name} style={{width: '100%', height: '40px'}} severity='secondary' icon='pi pi-database' size='normal'/>
            ))}
          </div>
        )} else {
          return <h4>No file selected</h4>
        }
      } else if (selection === "custom"){
        if (data.internal.settings.files && data.internal.settings.files.name != "") {
          return (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <Button raised text label={data.internal.settings.files.name} style={{width: '100%', height: '40px'}} severity='secondary' icon='pi pi-database' size='normal'/>
            </div>
          )
        } else {
          return <h4>No file selected</h4>
        }
    }
  }

  const op = useRef(null);

  return (
    <>
      {/* build on top of the Node component */}
      <OverlayPanel ref={op} style={{width: "300px", transform: "translateY(-100%)", marginBlock: "-30px"}} appendTo={document.body}>
        {renderSelectedFiles()}
      </OverlayPanel>
      <Button 
        style={{width: '100%', height: '10px'}} 
        label='View selected datasets' 
        severity='secondary' 
        icon='pi pi-angle-double-up' 
        size='small' 
        onClick={(e) => op.current.toggle(e)}
      />
      <Node
        key={id}
        id={id}
        data={data}
        setupParam={data.setupParam}
        // the body of the node is a form select (particular to this node)
        nodeBody={
          <>
            <Form.Select
              aria-label="machine learning model"
              onChange={onSelectionChange}
              defaultValue={data.internal.selection}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
            >
              <option
                key="medomics"
                value="medomics"
                // selected={optionName === selection}
              >
                MEDomicsLab standard
              </option>
              <option
                key="custom"
                value="custom"
                // selected={optionName === selection}
              >
                Custom data file
              </option>
            </Form.Select>
          </>
        }
        // default settings are the default settings of the node, so mandatory settings
        defaultSettings={
          <>
            <Stack id="default" direction="vertical" gap={1}>
              {(() => {
                switch (data.internal.selection) {
                  case "medomics":
                    return (
                      <>
                        <Input
                          key={"files"}
                          name="files"
                          settingInfos={{
                            type: "data-input-multiple",
                            tooltip: "<p>Specify a data file (xlsx, csv, json)</p>"
                          }}
                          currentValue={data.internal.settings.files || []}
                          onInputChange={onMultipleFilesChange}
                          setHasWarning={handleWarning}
                        />

                        <Input
                          key={"tags"}
                          name="tags"
                          settingInfos={{
                            type: "tags-input-multiple",
                            tooltip: "<p>Specify a data file (xlsx, csv, json)</p>",
                            selectedDatasets: data.internal.settings.files
                          }}
                          currentValue={data.internal.settings.tags || []}
                          onInputChange={onMultipleTagsChange}
                          setHasWarning={handleWarning}
                        />

                        <Input
                          key={"variables"}
                          name="variables"
                          settingInfos={{
                            type: "variables-input-multiple",
                            tooltip: "<p>Specify a data file (xlsx, csv, json)</p>",
                            selectedDatasets: data.internal.settings.files,
                            selectedTags: data.internal.settings.tags
                          }}
                          currentValue={data.internal.settings.variables || []}
                          onInputChange={onMultipleTagsChange}
                          setHasWarning={handleWarning}
                        />

                        <Input
                          disabled={data.internal.settings.files && data.internal.settings.files.name == ""}
                          name="target"
                          currentValue={data.internal.settings.target}
                          settingInfos={{
                            type: "list",
                            tooltip: "<p>Specify the column name of the target variable</p>",
                            choices: data.internal.settings.columns || {}
                          }}
                          onInputChange={onInputChange}
                          customProps={{
                            filter: true
                          }}
                        />
                      </>
                    )
                  case "custom":
                    return (
                      <>
                        <Input
                          name="files"
                          settingInfos={{
                            type: "data-input",
                            tooltip: "<p>Specify a data file (xlsx, csv, json)</p>"
                          }}
                          currentValue={data.internal.settings.files && data.internal.settings.files.id}
                          onInputChange={onFilesChange}
                          setHasWarning={handleWarning}
                        />
                        <Input
                          disabled={data.internal.settings.files && data.internal.settings.files.name == ""}
                          name="target"
                          currentValue={data.internal.settings.target}
                          settingInfos={{
                            type: "list",
                            tooltip: "<p>Specify the column name of the target variable</p>",
                            choices: data.internal.settings.columns || {}
                          }}
                          onInputChange={onInputChange}
                          customProps={{
                            filter: true
                          }}
                        />
                      </>
                    )
                  default:
                    return null
                }
              })()}
            </Stack>
          </>
        }
        // node specific is the body of the node, so optional settings
        nodeSpecific={
          <>
            {/* the button to open the modal (the plus sign)*/}
            <Button style={{width : "100%"}} severity="secondary" icon="pi pi-plus" onClick={() => setModalShow(true)}/>
            {/* the modal component*/}
            <ModalSettingsChooser show={modalShow} onHide={() => setModalShow(false)} options={data.setupParam.possibleSettings.options} data={data} id={id} />
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
          </>
        }
        // Link to documentation
        nodeLink={"https://medomics-udes.gitbook.io/medomicslab-docs/tutorials/development/learning-module#id-1.-available-nodes"}
      />
    </>
  )
}

export default DatasetNode
