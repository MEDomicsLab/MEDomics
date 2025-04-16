import { Dropdown } from "primereact/dropdown"
import { InputSwitch } from "primereact/inputswitch"; // Import InputSwitch
import { Tooltip } from "primereact/tooltip"
import React, { useContext, useEffect } from "react"
import { Stack } from "react-bootstrap"
import { FlowFunctionsContext } from "../../flow/context/flowFunctionsContext"
import Node from "../../flow/node"
import Input from "../input"

const SplitNode = ({ id, data }) => {
  const { updateNode } = useContext(FlowFunctionsContext)
  const [usePycaretDefaultParams, setUsePycaretDefaultParams] = React.useState(false)
  const [useUserDefinedSettings, setUseUserDefinedSettings] = React.useState(false)

  // Update available options when split type changes
  useEffect(() => {
    updateSplitOptions()
  }, [data.internal.settings.split_type])

  // Function to update options based on split type
  const updateSplitOptions = () => {
    const type = data.internal.settings.split_type
    let options = []

    // Add options specific to the split type
    if (type && type in data.setupParam.possibleSettings) {
      options.push(type)
    }

    // Add stratification for Random Sub-Sampling and Cross-Validation
    if (type === "random_sub_sampling" || type === "cross_validation") {
      options.push("stratification")
    }

    // Update checked options in node data
    data.internal.checkedOptions = options
    updateNode({
      id: id,
      updatedData: data.internal,
    })
  }

  // Handler for input changes for global parameters
  const onGlobalInputChange = (inputUpdate) => {
    data.internal.settings.global[inputUpdate.name] = inputUpdate.value
    updateNode({
      id: id,
      updatedData: data.internal,
    })
  }

  // Handler for input changes for outer splits
  const onOuterInputChange = (inputUpdate) => {
    let splitType = data.internal.settings.outer_split_type
    data.internal.settings.outer[splitType][inputUpdate.name] = inputUpdate.value
    updateNode({
      id: id,
      updatedData: data.internal,
    })
  }

  // Handler for input changes for inner splits
  const onInnerInputChange = (inputUpdate) => {
    let splitType = data.internal.settings.inner_split_type
    data.internal.settings.inner[splitType][inputUpdate.name] = inputUpdate.value
    updateNode({
      id: id,
      updatedData: data.internal,
    })
  }

  // Handler for warnings
  const handleWarning = (hasWarning) => {
    data.internal.hasWarning = hasWarning
    updateNode({
      id: id,
      updatedData: data.internal,
    })
  }

  // Dynamic parameter renderer for Outer or Inner splits
  const renderParams = (level, method) => {
    if (!method) return null
    return Object.entries(data.setupParam?.possibleSettings?.[level]?.[method] || {}).map(
      ([param, infos]) => (
        <React.Fragment key={param}>
          <Input
            name={param}
            settingInfos={infos}
            currentValue={data.internal.settings[level][method][param]}
            onInputChange={level === "outer" ? onOuterInputChange : onInnerInputChange}
          />
        </React.Fragment>
      )
    )
  }

  // Render the user-defined settings
  const renderUserDefinedSettings = (params) => {
    return Object.entries(data.setupParam?.possibleSettings?.outer?.user_defined || {}).map(
      ([param, infos]) => (
        <React.Fragment key={param}>
          <Input
            name={param}
            settingInfos={infos}
            currentValue={data.internal.settings.outer.user_defined[param]}
            onInputChange={onOuterInputChange}
          />
        </React.Fragment>
      )
    )
  }

  return (
    <Node
      key={id}
      id={id}
      data={data}
      color="#EAD196"
      setupParam={data.setupParam}
      nodeLink="/documentation/split"
      defaultSettings={
        <>
          <Tooltip target=".default-params-switch">
            <span>Use PyCaret's default parameters</span>
          </Tooltip>
          <Tooltip target=".user-defined-switch">
            <span>Define your own train-test indices for the split</span>
          </Tooltip>
          {/* -------- Configuration Switches -------- */}
          <div className="p-3 mb-3" style={{ border: "1px solid #ccc", borderRadius: "8px" }}>
            <h6>Split Options</h6>
            <div className="mb-3 d-flex align-items-center justify-content-between">
              <label htmlFor="user-defined-switch" className="me-2">Use user-defined indices</label>
              <InputSwitch
                className="user-defined-switch"
                checked={useUserDefinedSettings}
                onChange={(e) => {
                  if (e.value){
                    data.internal.settings.outer_split_type = "user_defined"
                    if (usePycaretDefaultParams) {
                      setUsePycaretDefaultParams(false)
                    }
                  } else {
                    data.internal.settings.outer_split_type = "cross_validation"
                  }
                  setUseUserDefinedSettings(e.value)
                }}
              />
            </div>
            <div className="d-flex align-items-center justify-content-between">
              <label htmlFor="default-params-switch" className="me-2">Use PyCaret's default parameters</label>
              <InputSwitch
                className="default-params-switch"
                checked={usePycaretDefaultParams}
                onChange={(e) => {
                  if (useUserDefinedSettings && e.value) {
                    setUseUserDefinedSettings(false)
                  }
                  setUsePycaretDefaultParams(e.value)
                }}
              />
            </div>
          </div>

          {/* -------- Global Parameters -------- */}
          <div className="p-3 mb-3" style={{ border: "1px solid #ccc", borderRadius: "8px" }}>
            <h6>General Parameters</h6>
            <Stack direction="vertical" gap={1}>
              {data.internal.settings.global && Object.entries(data.internal.settings.global).filter(
                ([nameParam]) => usePycaretDefaultParams ? nameParam !== "stratify" : true
              ).map(([nameParam, index]) => (
                <React.Fragment key={nameParam}>
                  <Input
                    name={nameParam}
                    settingInfos={data.setupParam?.possibleSettings?.global[nameParam]}
                    currentValue={data.internal.settings.global[nameParam]}
                    onInputChange={onGlobalInputChange}
                  />
                </React.Fragment>
              ))}
            </Stack>
          </div>
      
          {/* -------- Outer Split -------- */}
          {(!useUserDefinedSettings && !usePycaretDefaultParams) && (
            <div className="p-3 mb-3" style={{ border: "1px solid #ccc", borderRadius: "8px" }}>
              <h6>Outer Split</h6>
              <p className="text-muted" style={{ fontSize: "0.85em" }}>
                Outer Splits are used for training and testing the model. The selected method will be used to define the method used for splitting the data into training and testing sets.
              </p>            
              <>
                <Dropdown
                  className="form-select"
                  value={{ name: data.internal.settings.outer_split_type || "" }}
                  onChange={(e) => {
                    data.internal.settings.outer_split_type = e.value.name
                    updateNode({ id, updatedData: data.internal })
                  }}
                  options={Object.entries(data.setupParam?.possibleSettings?.outer_split_type?.choices || {}).filter(
                    ([key]) => key !== "user_defined"
                  ).map(
                    ([key, label]) => ({ name: key })
                  )}
                  placeholder="Select Outer Split method"
                  optionLabel="name"
                />
                {renderParams("outer", data.internal.settings.outer_split_type)}
                </>
              </div>
            )}
            {useUserDefinedSettings && renderUserDefinedSettings(data.internal.settings.outer_split_type)}
        </>
      }
    />
  )
}

export default SplitNode