import React, { useContext, useState } from "react"
import Node from "../../flow/node"
import FlInput from "../flInput"
import { FlowFunctionsContext } from "../../flow/context/flowFunctionsContext"
import { DataContext } from "../../workspace/dataContext"
import { LoaderContext } from "../../generalPurpose/loaderContext"
import MedDataObject from "../../workspace/medDataObject"
import { loadCSVFromPath } from "../../../utilities/fileManagementUtils"

export default function FlDatasetrwNode({ id, data }) {
  // context
  const { updateNode } = useContext(FlowFunctionsContext)

  // state
  const [validFrac, setValidFrac] = useState(data.internal.settings.validFrac || null)
  const [testFrac, setTestFrac] = useState(data.internal.settings.testFrac || null)
  const [output, setOutput] = useState(data.internal.settings.output || "")

  const [modalShow, setModalShow] = useState(false)
  const { globalData, setGlobalData } = useContext(DataContext)
  const { setLoader } = useContext(LoaderContext)

  const onChangeValidFrac = (nodeType) => {
    data.internal.settings.validFrac = nodeType.value
    setValidFrac(nodeType.value)

    // Update the node
    updateNode({
      id: id,
      updatedData: data.internal
    })
  }

  const onChangeTestFrac = (nodeType) => {
    data.internal.settings.testFrac = nodeType.value
    setTestFrac(nodeType.value)

    // Update the node
    updateNode({
      id: id,
      updatedData: data.internal
    })
  }

  const onChangeOutput = (nodeType) => {
    data.internal.settings.output = nodeType.value
    setOutput(nodeType.value)

    // Update the node
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
  const onFilesChange = async (inputUpdate) => {
    data.internal.settings[inputUpdate.name] = inputUpdate.value
    if (inputUpdate.value.path != "") {
      setLoader(true)
      let { columnsArray, columnsObject } = await MedDataObject.getColumnsFromPath(inputUpdate.value.path, globalData, setGlobalData)
      let steps = await MedDataObject.getStepsFromPath(inputUpdate.value.path, globalData, setGlobalData)
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

    data.internal.settings.files &&
      loadCSVFromPath(data.internal.settings.files.path, (data) => {
        console.log(data)
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
        nodeBody={<></>}
        // default settings are the default settings of the node, so mandatory settings
        defaultSettings={
          <>
            {/* <FlInput
              name="files"
              settingInfos={{
                type: "data-input",
                tooltip: "<p>Specify a data file (xlsx, csv, json)</p>"
              }}
              currentValue={data.internal.settings.files || {}}
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
            /> */}
            <FlInput
              name="Output"
              settingInfos={{
                type: "text",
                tooltip: "Output of the dataset"
              }}
              currentValue={output}
              onInputChange={onChangeOutput}
              setHasWarning={() => {}}
            />
            <FlInput
              name="Validation fraction"
              settingInfos={{
                type: "float",
                tooltip: "The validation fraction  refers to the proportion of data reserved for evaluating model performance during training, typically separate from both the training and test sets"
              }}
              currentValue={validFrac}
              onInputChange={onChangeValidFrac}
              setHasWarning={() => {}}
            />
            <FlInput
              name="Test fraction"
              settingInfos={{
                type: "float",
                tooltip: "The Test fraction  refers to the proportion of data reserved for testing model performance for each node "
              }}
              currentValue={testFrac}
              onInputChange={onChangeTestFrac}
              setHasWarning={() => {}}
            />
          </>
        }
        // node specific is the body of the node, so optional settings
        nodeSpecific={<></>}
      />
    </>
  )
}
