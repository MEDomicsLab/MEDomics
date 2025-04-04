import { Dropdown } from "primereact/dropdown"
import React, { useContext, useEffect } from "react"
import { Stack } from "react-bootstrap"
import { FlowFunctionsContext } from "../../flow/context/flowFunctionsContext"
import Node from "../../flow/node"
import Input from "../input"

const SplitNode = ({ id, data }) => {
  const { updateNode } = useContext(FlowFunctionsContext)

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

  // Handler for input changes
  const onInputChange = (inputUpdate) => {
    data.internal.settings[inputUpdate.name] = inputUpdate.value
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
      <>
      <Input
        key={`${level}_${param}`}
        name={`${level}_${param}`}
        settingInfos={infos}
        currentValue={data.internal.settings[`${level}_${param}`]}
        onInputChange={onInputChange}
      />
      </>
    )
  )
}

  return (
    <> 
    <span style={{
      backgroundColor: "#5bc0de",
      color: "white",
      padding: "2px 8px",
      borderRadius: "12px",
      fontSize: "0.8em",
      display: "inline-block",  
      textAlign: "center" 
    }}>
      Selection Node
    </span>
      <Node
        key={id}
        id={id}
        data={data}
        setupParam={data.setupParam}
        nodeLink="/documentation/split"
        defaultSettings={
          <>
            {/* -------- Global Parameters -------- */}
            <div className="p-3 mb-3" style={{ border: "1px solid #ccc", borderRadius: "8px" }}>
              <h6>Global Parameters</h6>
              <Stack direction="vertical" gap={1}>
                {Object.entries(data.internal.settings.global).map(([nameParam, index]) => (
                  <>
                  <Input
                    key={nameParam}
                    name={nameParam}
                    settingInfos={data.setupParam?.possibleSettings?.global[nameParam]}
                    currentValue={data.internal.settings.global[nameParam]}
                    onInputChange={onGlobalInputChange}
                  />
                  </>

                ))}
              </Stack>
            </div>
        
            {/* -------- Outer Split -------- */}
            <div className="p-3 mb-3" style={{ border: "1px solid #ccc", borderRadius: "8px" }}>
              <h6>Outer Split <span className="text-muted">(Optional)</span></h6>
              <p className="text-muted" style={{ fontSize: "0.85em" }}>
                Outer Split is used for external validation.<br />
                Leave empty if you want to disable it.
              </p>
        
              <Dropdown
                className="form-select"
                value={{ name: data.internal.settings.outer_split_type || "" }}
                onChange={(e) => {
                  data.internal.settings.outer_split_type = e.value.name
                  updateNode({ id, updatedData: data.internal })
                }}
                options={Object.entries(data.setupParam?.possibleSettings?.outer_split_type?.choices || {}).map(
                  ([key, label]) => ({ name: key })
                )}
                placeholder="Select Outer Split method"
                optionLabel="name"
              />
        
              {renderParams("outer", data.internal.settings.outer_split_type)}
            </div>
        
            {/* -------- Inner Split -------- */}
            <div className="p-3" style={{ border: "1px solid #ccc", borderRadius: "8px" }}>
              <h6>Inner Split <span className="text-muted">(Optional)</span></h6>
              <p className="text-muted" style={{ fontSize: "0.85em" }}>
                Inner Split is used for model tuning.<br />
                If not specified, PyCaret will automatically apply a default Inner Cross Validation.
              </p>
        
              <Dropdown
                className="form-select"
                value={{ name: data.internal.settings.inner_split_type || "" }}
                onChange={(e) => {
                  data.internal.settings.inner_split_type = e.value.name
                  updateNode({ id, updatedData: data.internal })
                }}
                options={Object.entries(data.setupParam?.possibleSettings?.inner_split_type?.choices || {}).map(
                  ([key, label]) => ({ name: key })
                )}
                placeholder="Select Inner Split method"
                optionLabel="name"
              />
        
              {renderParams("inner", data.internal.settings.inner_split_type)}
            </div>
          </>
        }
      />
    </>
  )
}

export default SplitNode