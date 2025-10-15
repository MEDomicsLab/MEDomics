import { Dropdown } from "primereact/dropdown"
import { InputSwitch } from "primereact/inputswitch"
import { Message } from "primereact/message"
import { Tooltip } from "primereact/tooltip"
import { useContext, useEffect, useState } from "react"
import { Stack } from "react-bootstrap"
import { FlowFunctionsContext } from "../../flow/context/flowFunctionsContext"
import Node from "../../flow/node"
import { getCollectionTags, getCollectionRowTags } from "../../mongoDB/mongoDBUtils"
import Input from "../input"

const SplitNode = ({ id, data }) => {
  const { updateNode } = useContext(FlowFunctionsContext)
  const [useUserDefinedSettings, setUseUserDefinedSettings] = useState(false)
  const [useTags, setUseTags] = useState(false)

  // Update available options when split type changes
  useEffect(() => {
    if (!data.internal.settings.columns){
      handleWarning({ state: true, tooltip: <p>No columns available for stratification. Please select a dataset with columns.</p> })
    }
    if (data.internal.settings?.global?.stratify_columns.length === 0){
      handleWarning({ state: true, tooltip: <p>Please select the stratification columns.</p> })
    }
  }, [data.internal.settings])

  const handleStratificationWarning = () => {
  const sc = data.internal.settings.global?.stratify_columns
  const hasStratCols = Array.isArray(sc)
    ? sc.filter(Boolean).length > 0
    : (typeof sc === "string" ? sc.trim() !== "" : false)

  const usedTags = data.internal.settings.useTags && (
    (data.internal.settings.global.columnsTags && data.internal.settings.global.columnsTags.length > 0) ||
    (data.internal.settings.global.rowsTags && data.internal.settings.global.rowsTags.length > 0)
  )

  // Only blocking case: "Use tags" is enabled but no tags are selected
  if (data.internal.settings.useTags && !usedTags) {
    return { state: true, tooltip: <p>You enabled "Use tags" but no tags are selected.</p> }
  }

  // If user selected stratification columns → informational (non-blocking)
  if (hasStratCols) {
    return {
      state: false, //do not block the Launch button
      tooltip: (
        <p>
          Selecting stratification columns is optional. An inappropriate choice
           may cause errors when starting
          training (e.g., empty classes per fold).
        </p>
      )
    }
  }

  // No stratification columns and no tags → no warning
  return { state: false }
}


  // Handler for input changes for global parameters
  const onGlobalInputChange = (inputUpdate) => {
    if (!data.internal.settings.global.columnsTags) {
      data.internal.settings.global.columnsTags = []
    }
    if (!data.internal.settings.global.rowsTags) {
      data.internal.settings.global.rowsTags = []
    }
    if (!data.internal.settings.global.columnsTagsMapped) {
      data.internal.settings.global.columnsTagsMapped = {}
    }
    if (!data.internal.settings.global.rowsTagsMapped) {
      data.internal.settings.global.rowsTagsMapped = {}
    }
    data.internal.settings.global[inputUpdate.name] = inputUpdate.value
    data.internal.hasWarning = handleStratificationWarning()
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

  // Handler for warnings
  const handleWarning = (hasWarning) => {
    data.internal.hasWarning = hasWarning
    updateNode({
      id: id,
      updatedData: data.internal,
    })
  }

  // Dynamic parameter renderer for Outer splits
  const renderParams = (method) => {
    if (!method) return null
    return Object.entries(data.setupParam?.possibleSettings.outer?.[method] || {}).map(
      ([param, infos]) => (
          <Input
            name={param}
            settingInfos={infos}
            currentValue={data.internal.settings.outer[method][param]}
            onInputChange={onOuterInputChange}
          />
      )
    )
  }

  useEffect(() => {
    if (!data.internal.settings.columns || Object.keys(data.internal.settings.columns).length === 0) return

    // Set the default value for stratification
    const columnsArray = Object.keys(data.internal.settings.columns)
    data.setupParam.possibleSettings.global.stratify_columns.default_val = columnsArray.length > 0 ? columnsArray[columnsArray.length - 1] : ""
    // Set the choices for stratification
    data.setupParam.possibleSettings.global.stratify_columns.choices = columnsArray.length > 0 ? columnsArray : [""]
    // Update warning state
    if (columnsArray.length > 0){
      data.internal.hasWarning = { state: false }
    }
  
    // Update the node
    updateNode({
      id,
      updatedData: {
        ...data.internal,
        settings: {
          ...data.internal.settings,
          global: {
            ...data.internal.settings.global,
            columnsTagsMapped: data.internal.settings.columnsTagsMapped || {},
            columnsTags: data.internal.settings.columnsTags || [],
            rowsTagsMapped: data.internal.settings.rowsTagsMapped || {},
            rowsTags: data.internal.settings.rowsTags || [],
            stratify_columns: "",
          },
        },
      },
    })
  }, [data.internal.settings.columns])

  useEffect(() => {
    if (!data.internal.settings.files || data.internal.settings.files.length === 0) return

    // Normalize files to array if needed
    const files = Array.isArray(data.internal.settings.files) 
      ? data.internal.settings.files 
      : [data.internal.settings.files]
    
    // Initialize tags related properties
    const newSettings = {
      ...data.internal.settings,
      columnsTagsMapped: {},
      columnsTags: [],
      rowsTagsMapped: {},
      rowsTags: [],
    }
    let hasChanged = false

    // Fetch collection tags for each file
    const fetchCollectionTags = async () => {
      for (const file of files) {
        if (file.id) {
          try {
            // Column tags
            let columnTagsCollections = await getCollectionTags(file.id)
            columnTagsCollections = await columnTagsCollections.toArray()
            let columnsTagsMap = {}
            let columnTags = []
            columnTagsCollections.map((columnTagsCollection) => {
              columnsTagsMap[columnTagsCollection.column_name] = columnTagsCollection.tags
              columnTags = columnTags.concat(columnTagsCollection.tags)
            })
            newSettings.columnsTagsMapped = {
              ...newSettings.columnsTagsMapped,
              ...columnsTagsMap,
            }
            newSettings.columnsTags = [
              ...(newSettings.columnsTags || []),
              ...columnTags,
            ]
            // Row tags
            let rowTagsCollections = await getCollectionRowTags(file.id)
            let rowsTagsMap = {}
            let rowsTags = []
            rowTagsCollections.forEach(tag => {
              tag.data.forEach(item => {
                item.groupNames.forEach(groupName => {
                  rowsTags.push(groupName)
                  rowsTagsMap[item._id.toString()] = groupName
                })
              })
            })
            rowsTags = [...new Set(rowsTags)]
            newSettings.rowsTags = [
              ...(newSettings.rowsTags || []),
              ...rowsTags,
            ]
            newSettings.rowsTagsMapped = {
              ...newSettings.rowsTagsMapped,
              ...rowsTagsMap,
            }
          } catch (error) {
            console.error("Error fetching collection tags:", error)
            newSettings.columnsTagsMapped = {}
            newSettings.columnsTags = []
            newSettings.rowsTagsMapped = {}
            newSettings.rowsTags = []
          }
        }
      }
      // Only update if something changed
      if (JSON.stringify(data.internal.settings.columnsTagsMapped) !== JSON.stringify(newSettings.columnsTagsMapped)) {
        newSettings.global.columnsTags = newSettings.columnsTags
        newSettings.global.columnsTagsMapped = newSettings.columnsTagsMapped
        hasChanged = true
      }
      if (JSON.stringify(data.internal.settings.rowsTagsMapped) !== JSON.stringify(newSettings.rowsTagsMapped)) {
        newSettings.global.rowsTags = newSettings.rowsTags
        newSettings.global.rowsTagsMapped = newSettings.rowsTagsMapped
        hasChanged = true
      }
      if (hasChanged) {
        updateNode({
          id,
          updatedData: {
            ...data.internal,
            settings: newSettings
          }
        })
      }
    }
    fetchCollectionTags()
  }, [data.internal.settings.files])
  

  // Render the user-defined settings
  const renderUserDefinedSettings = (params) => {
    return Object.entries(data.setupParam?.possibleSettings?.outer?.user_defined || {}).map(
      ([param, infos]) => (
          <Input
            name={param}
            settingInfos={infos}
            currentValue={data.internal.settings.outer.user_defined[param]}
            onInputChange={onOuterInputChange}
          />
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
          <Tooltip target=".user-defined-switch">
            <span>Define your own train-test indices for the split</span>
          </Tooltip>
          <Tooltip target=".use-tags-switch">
            <span>Use column or row tags for stratification instead of columns</span>
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
                  } else {
                    data.internal.settings.outer_split_type = "cross_validation"
                  }
                  setUseUserDefinedSettings(e.value)
                }}
              />
            </div>
          </div>

          {/* -------- Outer Split -------- */}
          {(!useUserDefinedSettings) && (
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
              {renderParams(data.internal.settings.outer_split_type)}
              </>
            </div>
          )}

          {/* -------- General Parameters -------- */}
          {!useUserDefinedSettings && (
            <div
              className="p-3 mb-3"
              style={{ border: "1px solid #ccc", borderRadius: "8px" }}
            >
              <h6>General Parameters</h6>

              <Stack direction="vertical" gap={1}>
                <div className="mb-3 d-flex align-items-center justify-content-between">
                  <label htmlFor="use-tags-switch" className="me-2">Use tags for stratification</label>
                  <InputSwitch
                    className="use-tags-switch"
                    checked={useTags}
                    onChange={(e) => {
                      data.internal.settings.useTags = e.value
                      data.internal.hasWarning = handleStratificationWarning()
                      setUseTags(e.value)
                      updateNode({
                        id: id,
                        updatedData: data.internal,
                      })
                      
                    }}
                  />
                </div>

                {(useTags && data.internal.settings.columnsTags && data.internal.settings.columnsTags.length > 0) && (
                  <div className="mb-3">
                    <label htmlFor="Columns Tags" className="me-2">Column Tags</label>
                    <Tooltip target=".tags-tooltip" />
                    <span className="tags-tooltip" data-pr-tooltip="A column tag is a label assigned to 
                      multiple columns in the dataset. 
                      It can be used to group columns based on certain criteria (e.g. gene expression data). 
                      Use tags to specify which columns to include in the stratification process without manually 
                      selecting each column.">
                      <i className="pi pi-info-circle" style={{ marginRight: "5px" }}/>
                    </span>
                    <Input
                      key={"tags"}
                      name="columnsTags"
                      settingInfos={{
                        type: "tags-input-multiple",
                        tooltip: "<p>Select by tags the columns to use for stratification</p>",
                        selectedDatasets: [{tags: data.internal.settings.columnsTags}]
                      }}
                      currentValue={data.internal.settings.global.columnsTags}
                      onInputChange={onGlobalInputChange}
                      setHasWarning={handleWarning}
                    />
                  </div>
                )}
                {(useTags && data.internal.settings.rowsTags && data.internal.settings.rowsTags.length > 0) && (
                  <div className="mb-3">
                    <label htmlFor="Row Tags" className="me-2">Row Tags</label>
                    <Tooltip target=".tags-tooltip" />
                    <span className="tags-tooltip" data-pr-tooltip="A row tag is a label assigned to
                      multiple rows in the dataset.
                      It can be used to group rows based on certain criteria (e.g. old vs young patients).
                      Use tags to specify which rows to include in the stratification process without manually
                      defining the group.">
                      <i className="pi pi-info-circle" style={{ marginRight: "5px" }}/>
                    </span>
                    <Input
                      key={"tags"}
                      name="rowsTags"
                      settingInfos={{
                        type: "tags-input-multiple",
                        tooltip: "<p>Select by tags the columns to use for stratification</p>",
                        selectedDatasets: [{tags: data.internal.settings.rowsTags}]
                      }}
                      currentValue={data.internal.settings.global.rowsTags}
                      onInputChange={onGlobalInputChange}
                      setHasWarning={handleWarning}
                    />
                  </div>
                )}
                {(useTags && (!data.internal.settings.columnsTags || data.internal.settings.columnsTags.length === 0)) && (
                  <Message 
                    severity="warn"
                    text="No column tags found in the selected dataset."
                    style={{
                        borderWidth: '0 0 0 6px',
                    }}
                  />
                )}
                {(useTags && (!data.internal.settings.rowsTags || data.internal.settings.rowsTags.length === 0)) && (
                  <Message
                    severity="warn"
                    text="No row tags found in the selected dataset."
                    style={{
                        borderWidth: '0 0 0 6px',
                    }}
                  />
                )}
                {(() => {
                  const sc = data.internal.settings.global?.stratify_columns
                  const hasStratCols = Array.isArray(sc)
                    ? sc.filter(Boolean).length > 0
                    : (typeof sc === "string" ? sc.trim() !== "" : false)

                  if (!hasStratCols) return null
                  return (
                    <Message
                      severity="warn"
                      text="Selecting stratification columns is optional. An inappropriate choice may cause errors during training (e.g., empty classes per fold)."
                      style={{ borderWidth: '0 0 0 6px' }}
                    />
                  )
                })()}

                {data.internal.settings.global && Object.entries(data.internal.settings.global).filter(
                  ([nameParam]) => !nameParam.toLowerCase().includes("tags")
                ).map(([nameParam, index]) => {
                    const infos = {
                      ...data.setupParam?.possibleSettings?.global[nameParam],
                    }

                    // Swap the dummy columns for the real dataset columns
                    if (data.internal.settings.columns) {
                      const columnsArray = Object.keys(data.internal.settings.columns)
                      if (columnsArray.length > 0 && nameParam === "stratify_columns") {
                        if (typeof data.internal.settings.global[nameParam] === "object" && !data.internal.settings.global[nameParam].every(r=>columnsArray.includes(r))) {
                          data.internal.settings.global[nameParam] = columnsArray[columnsArray.length - 1]
                        }
                      }
                    } else if (nameParam === "stratify_columns") {
                      return <Message
                        key={nameParam}
                        severity="warn"
                        text="No columns available for stratification. Please connect a dataset node."
                        style={{
                            borderWidth: '0 0 0 6px',
                        }}
                      />
                    }
                    
                    return (
                        <Input
                          key={nameParam}
                          name={nameParam}
                          settingInfos={infos}                
                          currentValue={data.internal.settings.global[nameParam]}
                          onInputChange={onGlobalInputChange}
                        />
                    )
                  })}
              </Stack>
            </div>
          )}
            {useUserDefinedSettings && renderUserDefinedSettings(data.internal.settings.outer_split_type)}
        </>
      }
    />
  )
}

export default SplitNode