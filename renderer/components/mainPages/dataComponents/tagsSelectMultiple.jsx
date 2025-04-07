import React, { useState, useEffect } from "react"
import { MultiSelect } from "primereact/multiselect"

/**
 * @typedef {React.FunctionComponent} TagsSelectMultiple
 * @description This component is used to select a tag from the selected datasets
 * @params props.selectedTags - The selected tags
 * @params props.onChange - The function to call when the selected data file changes
 * @params props.selectedDatasets - The selected datasets
 * @params props.disabled - If the component is disabled
 * @params props.placeholder - The placeholder of the component
 * @returns {React.FunctionComponent} The TagsSelectMultiple component
 */
const TagsSelectMultiple = ({ key, onChange, selectedTags, selectedDatasets, disabled, placeholder }) => {
  const [tagsList, setTagsList] = useState([])
  const [localTags, setLocalTags] = useState([])

  /**
   * @description This useEffect is used to set the localTags when the component is mounted
   */
  useEffect(() => {
    if (selectedTags !== undefined && Array.isArray(selectedTags)) {
      setLocalTags(selectedTags)
    }
  }, [selectedTags])

  /**
   * @description This useEffect is used to generate the dataset list from the global data context if it's defined
   * @returns {void} calls the generateDatasetListFromDataContext function
   */
  useEffect(() => {
    if (Array.isArray(selectedDatasets) && selectedDatasets.length > 0) {
      let tags = []
      selectedDatasets.forEach((dataset) => {
        tags = tags.concat(dataset.tags)
      })
      tags = [...new Set(tags)]
      let tagsToShow = tags.map((tag) => {
        return { name: tag, value: tag }
      })
      setTagsList(tagsToShow)
    } else {
      setTagsList([])
    }
  }, [selectedDatasets])

  return (
    <>
      {
        <MultiSelect
          key={key}
          disabled={tagsList.length == 0 || disabled}
          placeholder={placeholder}
          value={localTags}
          onChange={(e) => {
            onChange(e.target.value)
          }}
          options={tagsList}
          optionLabel="name"
          display="chip"
          filter
        />
      }
    </>
  )
}

export default TagsSelectMultiple
