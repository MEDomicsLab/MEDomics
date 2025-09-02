import React, { use, useContext, useEffect, useState } from "react"
import Node from "../../flow/node"
import FlInput from "../flInput"
import { Button, Form } from "react-bootstrap"
import CodeEditor from "../../flow/codeEditor"
import { FlowFunctionsContext } from "../../flow/context/flowFunctionsContext"
import { Message } from "primereact/message"
import { loadFileFromPathSync } from "../../../utilities/fileManagementUtils"

const FlModelNode = ({ id, data }) => {
  // context
  const { updateNode } = useContext(FlowFunctionsContext)

  // states
  const [tlActivated, setTLActivation] = useState(data.internal.settings.activateTl || "true")
  const [noTlModel, setNoTLmodel] = useState(data.internal.settings.noTlModelType || "custom")

  const [optimFile, setOptimFile] = useState(null)

  // Handle the Transfer Learning Activation change
  const onSelectionChange = (e) => {
    setTLActivation(e.target.value)

    data.internal.settings.activateTl = e.target.value

    // Update the node
    updateNode({
      id: id,
      updatedData: data.internal
    })
  }

  //Handle the model creation method change
  const onSelectMethodChange = (e) => {
    setNoTLmodel(e.target.value)

    data.internal.settings.noTlModelType = e.target.value

    // Update the node
    updateNode({
      id: id,
      updatedData: data.internal
    })
  }

  const onFilesChange = async (inputUpdate) => {
    data.internal.settings[inputUpdate.name] = inputUpdate.value

    updateNode({
      id: id,
      updatedData: data.internal
    })
  }

  const onModelInputChange = (inputUpdate) => {
    data.internal.settings[inputUpdate.name] = inputUpdate.value

    updateNode({
      id: id,
      updatedData: data.internal
    })
  }

  useEffect(() => {}, [tlActivated])

  useEffect(() => {
    if (optimFile?.path && optimFile?.path != "") {
      loadFileFromPathSync(optimFile?.path).then((results) => {
        console.log("this is the best", results)
        data.internal.settings["learning rate"] = results["data"]["Best Parameters"]["learning_rate"]
        data.internal.settings["Hidden size"] = results["data"]["Best Parameters"]["hidden_size"]
        data.internal.settings["Number of epochs"] = results["data"]["Best Parameters"]["num_epochs"]
        data.internal.settings["Number of layers"] = results["data"]["Best Parameters"]["num_layers"]
        data.internal.settings["optimizer"] = results["data"]["Best Parameters"]["optimizer"]
        data.internal.settings["Model type"] = "Binary classifier"
        updateNode({
          id: id,
          updatedData: data.internal
        })
      })
    } else {
      data.internal.settings["learning rate"] = { value: "" }
      data.internal.settings["Hidden size"] = { value: "" }
      data.internal.settings["Number of epochs"] = { value: "" }
      data.internal.settings["Number of layers"] = { value: "" }
      data.internal.settings["optimizer"] = ""
      data.internal.settings["Model type"] = ""
      data.internal.settings["activateTl"] = tlActivated

      updateNode({
        id: id,
        updatedData: data.internal
      })
    }
  }, [optimFile?.path])

  useEffect(() => {
    if (tlActivated == "true" && (!data.internal.settings.file || data.internal.settings.file.path == "")) {
      data.internal.hasWarning.state = true
      data.internal.hasWarning.tooltip = "You need to specify a file for the transfer learning"
      updateNode({
        id: id,
        updatedData: data.internal
      })
    } else {
      data.internal.hasWarning.state = false
      data.internal.hasWarning.tooltip = ""
      updateNode({
        id: id,
        updatedData: data.internal
      })
    }
  }, [tlActivated, data.internal.settings.file])

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
            <Form.Select
              aria-label="machine learning model"
              onChange={onSelectionChange}
              defaultValue={tlActivated}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
            >
              <option
                key="TL"
                value={"true"}
                // selected={optionName === selection}
              >
                Activate Transfer Learning
              </option>
              <option
                key="NoTL"
                value={"false"}
                // selected={optionName === selection}
              >
                Deactivate Transfer Learning
              </option>
            </Form.Select>
          </>
        }
        // default settings are the default settings of the node, so mandatory settings
        defaultSettings={<></>}
        // node specific is the body of the node, so optional settings
        nodeSpecific={
          <>
            {(() => {
              switch (tlActivated) {
                case "true":
                  return (
                    <>
                      <FlInput
                        name="file"
                        settingInfos={{
                          type: "data-input",
                          tooltip: "<p>Specify a data file (xlsx, csv, json)</p>"
                        }}
                        currentValue={data.internal.settings.file && data.internal.settings.file.id}
                        onInputChange={onFilesChange}
                        setHasWarning={() => {}}
                        acceptedExtensions={["pth"]}
                      />
                      <FlInput
                        name="optimizer"
                        settingInfos={{
                          type: "list",
                          tooltip: "<p>Specify a data file (xlsx, csv, json)</p>",
                          choices: [{ name: "Adam" }, { name: "SGD" }, { name: "RMSprop" }]
                        }}
                        currentValue={data.internal.settings.optimizer || {}}
                        onInputChange={onModelInputChange}
                        setHasWarning={() => {}}
                      />

                      <FlInput
                        name="learning rate"
                        settingInfos={{
                          type: "float",
                          tooltip: "<p>Specify the model type</p>"
                        }}
                        currentValue={data.internal.settings["learning rate"] || {}}
                        onInputChange={onModelInputChange}
                        setHasWarning={() => {}}
                      />
                      <FlInput
                        name="Threshold"
                        settingInfos={{
                          type: "float",
                          tooltip: "<p>Specify the model type</p>"
                        }}
                        currentValue={data.internal.settings.Threshold || {}}
                        onInputChange={onModelInputChange}
                        setHasWarning={() => {}}
                      />
                    </>
                  )
                case "false":
                  return (
                    <>
                      <Form.Select
                        aria-label=""
                        onChange={onSelectMethodChange}
                        defaultValue={noTlModel}
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                        }}
                      >
                        <option
                          key=""
                          value={"custom"}
                          // selected={optionName === selection}
                        >
                          MEDfl custom model
                        </option>
                        <option
                          key=""
                          value={"scratch"}
                          // selected={optionName === selection}
                        >
                          Create a model from scratch
                        </option>
                      </Form.Select>
                      {noTlModel === "custom" ? (
                        <div style={{ maxHeight: "400px", overflowY: "scroll", display: "flex", flexDirection: "column", gap: 3, paddingRight: 3 }}>
                          <div style={{ fontSize: "18px", padding: "10px 0", fontWeight: "bold" }}>Optimization results files</div>
                          <Message severity="info" text="You can autofill the model hyperparameters using a saved optim results" />

                          <FlInput
                            name="files"
                            settingInfos={{
                              type: "data-input",
                              tooltip: "<p>Specify a data file (xlsx, csv, json)</p>",
                              rootDir: "Optimization"
                            }}
                            currentValue={optimFile || {}}
                            onInputChange={(input) => setOptimFile(input.value)}
                            setHasWarning={() => {}}
                          />
                          <div style={{ fontSize: "18px", padding: "10px 0", fontWeight: "bold" }}>Model hyperparameters</div>
                          <FlInput
                            name="Model type"
                            settingInfos={{
                              type: "list",
                              tooltip: "<p>Specify the model type</p>",
                              choices: [{ name: "Binary classifier" }]
                            }}
                            currentValue={data.internal.settings["Model type"] || {}}
                            onInputChange={onModelInputChange}
                            setHasWarning={() => {}}
                          />

                          <FlInput
                            name="Number of layers"
                            settingInfos={{
                              type: "int",
                              tooltip: "<p>Specify the model type</p>"
                            }}
                            currentValue={data.internal.settings["Number of layers"] || {}}
                            onInputChange={onModelInputChange}
                            setHasWarning={() => {}}
                          />
                          <FlInput
                            name="Hidden size"
                            settingInfos={{
                              type: "int",
                              tooltip: "<p>Specify the model type</p>"
                            }}
                            currentValue={data.internal.settings["Hidden size"] || {}}
                            onInputChange={onModelInputChange}
                            setHasWarning={() => {}}
                          />
                          <FlInput
                            name="optimizer"
                            settingInfos={{
                              type: "list",
                              tooltip: "<p>Specify a data file (xlsx, csv, json)</p>",
                              choices: [{ name: "Adam" }, { name: "SGD" }, { name: "RMSprop" }]
                            }}
                            currentValue={data.internal.settings.optimizer || {}}
                            onInputChange={onModelInputChange}
                            setHasWarning={() => {}}
                          />
                          <FlInput
                            name="learning rate"
                            settingInfos={{
                              type: "float",
                              tooltip: "<p>Specify the model type</p>"
                            }}
                            currentValue={data.internal.settings["learning rate"] || {}}
                            onInputChange={onModelInputChange}
                            setHasWarning={() => {}}
                          />
                          {/* <FlInput
                            name="Threshold"
                            settingInfos={{
                              type: "float",
                              tooltip: "<p>Specify the model type</p>"
                            }}
                            currentValue={data.internal.settings["Threshold"] || {}}
                            onInputChange={onModelInputChange}
                            setHasWarning={() => {}}
                          />
                          <Button>Create model</Button> */}
                        </div>
                      ) : (
                        <>
                          <CodeEditor></CodeEditor>

                          <Button>Create model</Button>
                        </>
                      )}
                    </>
                  )
                default:
                  return <>{tlActivated} frwqw</>
              }
            })()}
          </>
        }
      />
    </>
  )
}

export default FlModelNode
