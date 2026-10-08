import React, { use, useContext, useEffect, useRef, useState } from "react"
import Node from "../../flow/node"
import FlInput from "../flInput"
import { Button, Form } from "react-bootstrap"
import CodeEditor from "../../flow/codeEditor"
import { FlowFunctionsContext } from "../../flow/context/flowFunctionsContext"
import { Message } from "primereact/message"
import { loadFileFromPathSync } from "../../../utilities/fileManagementUtils"
import { requestBackend } from "../../../utilities/requests"
import { toast } from "react-toastify"
import { WorkspaceContext } from "../../workspace/workspaceContext"

import { PageInfosContext } from "../../mainPages/moduleBasics/pageInfosContext"

const FlModelNode = ({ id, data }) => {
  const { port } = useContext(WorkspaceContext)
  const { pageId, configPath } = useContext(PageInfosContext)

  // context
  const { updateNode } = useContext(FlowFunctionsContext)

  // states
  const [tlActivated, setTLActivation] = useState(data.internal.settings.activateTl || "false")
  const [noTlModel, setNoTLmodel] = useState(data.internal.settings.noTlModelType || "custom")

  const [modelType, setModelType] = useState(data.internal.settings.modelType || "nn")

  const [optimFile, setOptimFile] = useState(null)
  const isFirstOptimRun = useRef(true)

  // architecture read from the pretrained file ({ num_layers, hidden_size, input_size } or { error })
  const [pthInfo, setPthInfo] = useState(null)

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

  const onModelTypeChange = (e) => {
    setModelType(e.target.value)

    data.internal.settings.modelType = e.target.value

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

    if (inputUpdate.name === "file") readPthModel(inputUpdate.value?.path)
  }

  // Fill 'Number of layers' and 'Hidden size' from the pretrained state_dict
  const readPthModel = (pthPath) => {
    if (!pthPath) {
      setPthInfo(null)
      return
    }
    requestBackend(
      port,
      "/medfl/read-pth/" + pageId,
      { pthPath: pthPath },
      (json) => {
        if (json.error) {
          setPthInfo({ error: json.error.message || json.error.toast || String(json.error) })
          return
        }
        setPthInfo(json.data)
        data.internal.settings["Number of layers"] = json.data.num_layers
        data.internal.settings["Hidden size"] = json.data.hidden_size
        updateNode({
          id: id,
          updatedData: data.internal
        })
      },
      (err) => {
        console.error(err)
        setPthInfo({ error: "Could not read the pretrained model file" })
      }
    )
  }

  // fields come from the file unless it could not be read
  const archFromFile = Boolean(data.internal.settings.file?.path) && !pthInfo?.error

  const onModelInputChange = (inputUpdate) => {
    data.internal.settings[inputUpdate.name] = inputUpdate.value

    updateNode({
      id: id,
      updatedData: data.internal
    })
  }

  useEffect(() => {
     data.internal.settings.modelType = "nn"

     

    // Update the node
    updateNode({
      id: id,
      updatedData: data.internal
    })
  }, [])

  useEffect(() => {
    // optimFile is not persisted, so it is always empty on mount: skip the reset there to keep the saved settings
    if (isFirstOptimRun.current) {
      isFirstOptimRun.current = false
      if (!optimFile?.path) return
    }
    if (optimFile?.path && optimFile?.path != "") {
      loadFileFromPathSync(optimFile?.path)
        .then((results) => {
          const bestParams = results?.data?.["Best Parameters"]
          if (!bestParams) {
            toast.error("This file does not contain optimization results")
            return
          }
          // Optuna saves hidden_size/num_layers/learning_rate/optimizer, grid search saves hidden_dim/lr
          const autofilled = {
            "Number of layers": bestParams.num_layers,
            "Hidden size": bestParams.hidden_size ?? bestParams.hidden_dim,
            "learning rate": bestParams.learning_rate ?? bestParams.lr,
            optimizer: bestParams.optimizer
          }
          Object.entries(autofilled).forEach(([name, value]) => {
            if (value !== undefined) data.internal.settings[name] = value
          })
          data.internal.settings["Model type"] = "Binary classifier"
          updateNode({
            id: id,
            updatedData: data.internal
          })
        })
        .catch((error) => {
          console.error("Failed to read the optimization results:", error)
          toast.error("Could not read the optimization results file")
        })
    } else {
      // the optimization file was unselected: clear the values it filled
      data.internal.settings["Number of layers"] = ""
      data.internal.settings["Hidden size"] = ""
      data.internal.settings["learning rate"] = ""
      data.internal.settings["optimizer"] = ""

      updateNode({
        id: id,
        updatedData: data.internal
      })
    }
  }, [optimFile?.path])

  const readpklmodel = () => {
    requestBackend(
      port,
      "/medfl/read-pkl/" + pageId,
      {
        pklPath: data.internal.settings.file?.path
      },
      (json) => {
        if (json.error) {
          // toast.error?.("Error: " + json.error)
          console.error("WS Agents error:", json.error)
        } else {
          console.log("Model content:", json.data)
          data.internal.settings.optimizer = json.data.params.solver
          data.internal.settings.Threshold = json.data.params.Threshold
          data.internal.settings["Local epochs"] = json.data.params.max_iter

          updateNode({
            id: id,
            updatedData: data.internal
          })
        }
      },
      (err) => {
        console.error(err)
      }
    )
  }

  useEffect(() => {
    if (tlActivated == "true" && (!data.internal.settings.file || data.internal.settings.file?.path == "")) {
      data.internal.hasWarning.state = true
      data.internal.hasWarning.tooltip = "You need to specify a file for the transfer learning"
      updateNode({
        id: id,
        updatedData: data.internal
      })
    } else {
      data.internal.hasWarning.state = false
      data.internal.hasWarning.tooltip = ""
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
              onChange={onModelTypeChange}
              defaultValue={modelType}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
            >
              <option
                key="nn"
                value={"nn"}
                // selected={optionName === selection}
              >
                Neural network
              </option>
              <option
                key="xgboost"
                value={"xgboost"}
                // selected={optionName === selection}
              >
                XGBoost
              </option>
            </Form.Select>
          </>
        }
        // default settings are the default settings of the node, so mandatory settings
        defaultSettings={<></>}
        // node specific is the body of the node, so optional settings
        nodeSpecific={
          <>
            {modelType === "nn" ? (
              <>
                <Form.Select
                  aria-label="transfer learning activation"
                  onChange={onSelectionChange}
                  value={tlActivated}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                  }}
                >
                  <option value="true">Activate Transfer Learning</option>
                  <option value="false">Deactivate Transfer Learning</option>
                </Form.Select>

                {tlActivated === "true" ? (
                  <>
                    <FlInput
                      name="file"
                      settingInfos={{
                        type: "data-input",
                        tooltip: "<p>Specify the pretrained model file (a PyTorch state_dict saved with torch.save(model.state_dict(), path))</p>"
                      }}
                      currentValue={data.internal.settings.file && data.internal.settings.file.id}
                      onInputChange={onFilesChange}
                      setHasWarning={() => {}}
                      acceptedExtensions={["pth", "pt"]}
                    />

                    {pthInfo?.error && <Message severity="error" text={pthInfo.error} />}
                    {pthInfo && !pthInfo.error && (
                      <Message severity="info" text={`Architecture read from the file (${pthInfo.input_size} input features)`} />
                    )}

                    {/* the int inputs are uncontrolled, so the key remounts them when the file fills them */}
                    <FlInput
                      key={"layers-" + data.internal.settings["Number of layers"]}
                      name="Number of layers"
                      settingInfos={{
                        type: "int",
                        tooltip: "<p>Number of hidden layers of the pretrained model (simulation only, read from the state_dict)</p>"
                      }}
                      currentValue={data.internal.settings["Number of layers"] || {}}
                      onInputChange={onModelInputChange}
                      setHasWarning={() => {}}
                      disabled={archFromFile}
                    />

                    <FlInput
                      key={"hidden-" + data.internal.settings["Hidden size"]}
                      name="Hidden size"
                      settingInfos={{
                        type: "int",
                        tooltip: "<p>Hidden layer size of the pretrained model (simulation only, read from the state_dict)</p>"
                      }}
                      currentValue={data.internal.settings["Hidden size"] || {}}
                      onInputChange={onModelInputChange}
                      setHasWarning={() => {}}
                      disabled={archFromFile}
                    />

                    <FlInput
                      name="optimizer"
                      settingInfos={{
                        type: "list",
                        tooltip: "<p>Optimizer used for local training</p>",
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
                        tooltip: "<p>Learning rate of the optimizer</p>"
                      }}
                      currentValue={data.internal.settings["learning rate"] || {}}
                      onInputChange={onModelInputChange}
                      setHasWarning={() => {}}
                    />

                    <FlInput
                      name="Threshold"
                      settingInfos={{
                        type: "float",
                        tooltip: "<p>Classification threshold</p>"
                      }}
                      currentValue={data.internal.settings.Threshold || {}}
                      onInputChange={onModelInputChange}
                      setHasWarning={() => {}}
                    />

                    <FlInput
                      name="Local epochs"
                      settingInfos={{
                        type: "int",
                        tooltip: "<p>Local training epochs for each client</p>"
                      }}
                      currentValue={data.internal.settings["Local epochs"] || {}}
                      onInputChange={onModelInputChange}
                      setHasWarning={() => {}}
                    />
                  </>
                ) : (
                  <>
                    <Form.Select
                      aria-label="model creation method"
                      onChange={onSelectMethodChange}
                      value={noTlModel}
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                      }}
                    >
                      <option value="custom">MEDfl custom model</option>
                      <option value="scratch">Create a model from scratch</option>
                    </Form.Select>

                    {noTlModel === "custom" ? (
                      <div
                        style={{
                          maxHeight: "400px",
                          overflowY: "scroll",
                          display: "flex",
                          flexDirection: "column",
                          gap: 3,
                          paddingRight: 3
                        }}
                      >
                        <div style={{ fontSize: "18px", padding: "10px 0", fontWeight: "bold" }}>Optimization results files</div>

                        <Message severity="info" text="You can autofill the model hyperparameters using saved optimization results." />

                        <FlInput
                          name="files"
                          settingInfos={{
                            type: "data-input",
                            tooltip: "<p>Specify optimization results file</p>",
                            rootDir: "Optimization"
                          }}
                          currentValue={optimFile?.id || ""}
                          onInputChange={(input) => setOptimFile(input.value)}
                          setHasWarning={() => {}}
                          acceptedExtensions={["medflopt"]}
                        />

                        <div style={{ fontSize: "18px", padding: "10px 0", fontWeight: "bold" }}>Neural Network Hyperparameters</div>

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

                        {/* the number inputs are uncontrolled, so the key remounts them when the optimization file fills them */}
                        <FlInput
                          key={"custom-layers-" + data.internal.settings["Number of layers"]}
                          name="Number of layers"
                          settingInfos={{
                            type: "int",
                            tooltip: "<p>Number of hidden layers</p>"
                          }}
                          currentValue={data.internal.settings["Number of layers"] || {}}
                          onInputChange={onModelInputChange}
                          setHasWarning={() => {}}
                        />

                        <FlInput
                          key={"custom-hidden-" + data.internal.settings["Hidden size"]}
                          name="Hidden size"
                          settingInfos={{
                            type: "int",
                            tooltip: "<p>Hidden layer size</p>"
                          }}
                          currentValue={data.internal.settings["Hidden size"] || {}}
                          onInputChange={onModelInputChange}
                          setHasWarning={() => {}}
                        />

                        <FlInput
                          name="optimizer"
                          settingInfos={{
                            type: "list",
                            tooltip: "<p>Optimizer</p>",
                            choices: [{ name: "Adam" }, { name: "SGD" }, { name: "RMSprop" }]
                          }}
                          currentValue={data.internal.settings.optimizer || {}}
                          onInputChange={onModelInputChange}
                          setHasWarning={() => {}}
                        />

                        <FlInput
                          key={"custom-lr-" + data.internal.settings["learning rate"]}
                          name="learning rate"
                          settingInfos={{
                            type: "float",
                            tooltip: "<p>Learning rate of the optimizer</p>"
                          }}
                          currentValue={data.internal.settings["learning rate"] || {}}
                          onInputChange={onModelInputChange}
                          setHasWarning={() => {}}
                        />

                      </div>
                    ) : (
                      <>
                        <CodeEditor />
                        <Button>Create model</Button>
                      </>
                    )}
                  </>
                )}
              </>
            ) : (
              <div
                style={{
                  maxHeight: "400px",
                  overflowY: "scroll",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  paddingRight: 3
                }}
              >
                <div style={{ fontSize: "18px", padding: "10px 0", fontWeight: "bold" }}>XGBoost Parameters</div>

              

                <FlInput
                  name="xgb_mode"
                  settingInfos={{
                    type: "list",
                    tooltip: "<p>Federated XGBoost mode</p>",
                    choices: [{ name: "bagging" }]
                  }}
                  currentValue={data.internal.settings.xgb_mode || {}}
                  onInputChange={onModelInputChange}
                  setHasWarning={() => {}}
                />

              

                <FlInput
                  name="xgb_eval_metric"
                  settingInfos={{
                    type: "list",
                    tooltip: "<p>XGBoost evaluation metric</p>",
                    choices: [{ name: "auc" }, { name: "logloss" }, { name: "rmse" }, { name: "mae" }, { name: "mlogloss" }]
                  }}
                  currentValue={data.internal.settings.xgb_eval_metric || {}}
                  onInputChange={onModelInputChange}
                  setHasWarning={() => {}}
                />

                <FlInput
                  name="xgb_local_num_boost_round"
                  settingInfos={{
                    type: "int",
                    tooltip: "<p>Number of local boosting rounds per federated round</p>"
                  }}
                  currentValue={data.internal.settings.xgb_local_num_boost_round || {}}
                  onInputChange={onModelInputChange}
                  setHasWarning={() => {}}
                />

                <FlInput
                  name="xgb_max_depth"
                  settingInfos={{
                    type: "int",
                    tooltip: "<p>Maximum tree depth</p>"
                  }}
                  currentValue={data.internal.settings.xgb_max_depth || {}}
                  onInputChange={onModelInputChange}
                  setHasWarning={() => {}}
                />

                <FlInput
                  name="xgb_eta"
                  settingInfos={{
                    type: "float",
                    tooltip: "<p>Learning rate, also called eta</p>"
                  }}
                  currentValue={data.internal.settings.xgb_eta || {}}
                  onInputChange={onModelInputChange}
                  setHasWarning={() => {}}
                />

               
              </div>
            )}
          </>
        }
      />
    </>
  )
}

export default FlModelNode
