import React, { useState, useEffect, useCallback } from "react"
import { MultiSelect } from "primereact/multiselect"

/**
 * @typedef {React.FunctionComponent} VarsSelectMultiple
 * @description This component is usedt to select a variable from the selected datasets and tags
 * @params props.selectedVars - The selected variables
 * @params props.onChange - The function to call when the selected variables change
 * @params props.selectedTags - The selected tags
 * @params props.selectedDatasets - The selected datasets
 * @params props.disabled - If the component is disabled
 * @params props.placeholder - The placeholder of the component
 * @returns {React.FunctionComponent} The VarsSelectMultiple component
 */
const VarsSelectMultiple = ({ key, onChange, selectedVars, selectedTags, selectedDatasets, disabled, placeholder }) => {
  const [varsList, setVarsList] = useState([])
  const [localVars, setLocalVars] = useState([])

  /**
   * @description This useEffect is used to set the localVars when the component is mounted
   */
  useEffect(() => {
    if (selectedVars !== undefined && Array.isArray(selectedVars)) {
      setLocalVars(selectedVars)
    }
  }, [])

  /**
   * @description This useEffect is used to set the localVars from the selectedVars
   */
  useEffect(() => {
    if (selectedVars !== undefined && Array.isArray(selectedVars)) {
      setLocalVars(selectedVars)
    }
  }, [selectedVars])

  /**
   * @description This function is used to update the localVars and call the onChange function
   */
  const updateCurrentVars = useCallback(
    (newVars) => {
      let newLocalVars = selectedVars.filter((localVar) => {
        return newVars.map((varToShow) => varToShow.value).includes(localVar)
      })
      setLocalVars(newLocalVars)
      onChange(newLocalVars)
    },
    [selectedVars]
  )

  /**
   * @description This useEffect is used to generate the dataset list from the global data context if it's defined
   * @returns {void} calls the generateDatasetListFromDataContext function
   */
  useEffect(() => {
    if (Array.isArray(selectedDatasets) && selectedDatasets.length > 0) {
      let varsToShow = []
      selectedDatasets.forEach((dataset) => {
        let timePrefix = dataset.name.split("_")[0]
        let columnsTag = dataset.columnsTags

        Object.entries(columnsTag).map(([key, value]) => {
          let isInSelectedTags = false
          selectedTags.forEach((tag) => {
            if (value.includes(tag)) {
              isInSelectedTags = true
            }
          })
          isInSelectedTags && varsToShow.push({ name: key + " | " + timePrefix + "_" + value.join("_"), value: key + "_" + timePrefix })
        })
      })

      updateCurrentVars(varsToShow)
      setVarsList(varsToShow)
    } else {
      setVarsList([])
    }
  }, [selectedDatasets, selectedTags])

  return (
    <>
      {
        <MultiSelect
          key={key}
          disabled={varsList.length == 0 || disabled}
          placeholder={placeholder}
          value={localVars}
          onChange={(e) => {
            onChange(e.target.value)
          }}
          options={varsList}
          optionLabel="name"
          display="chip"
          filter
        />
      }
    </>
  )
}

export default VarsSelectMultiple
