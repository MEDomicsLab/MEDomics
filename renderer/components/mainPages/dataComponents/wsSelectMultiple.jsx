import { MultiSelect } from "primereact/multiselect"
import React, { useContext, useEffect, useState } from "react"
import { getCollectionTags } from "../../mongoDB/mongoDBUtils"
import { DataContext } from "../../workspace/dataContext"

/**
 * @typedef {React.FunctionComponent} WsSelectMultiple
 * @description This component is used to select a data file from the workspace (DataContext). The data file is then used in the flow.
 * @params props.selectedPath - The path of the selected data file
 * @params props.onChange - The function to call when the selected data file changes
 * @params props.name - The name of the component
 */
const WsSelectMultiple = ({
  key,
  selectedPaths,
  onChange,
  rootDir,
  acceptFolder = false,
  acceptedExtensions = ["all"],
  matchRegex = null,
  disabled,
  placeholder,
  whenEmpty = null,
  setHasWarning = null,
  customProps = {}
}) => {
  const { globalData } = useContext(DataContext) // We get the global data from the context to retrieve the directory tree of the workspace, thus retrieving the data files
  const [datasetList, setDatasetList] = useState([])

  /**
   * @description This useEffect is used to generate the dataset list from the global data context if it's defined
   * @returns {void} calls the generateDatasetListFromDataContext function
   */
  useEffect(() => {
    const processData = async () => {
      if (globalData !== undefined) {
        let ids = Object.keys(globalData)
        let datasetListToShow = await Promise.all(
          ids.map(async (id) => {
            // Only process files in the selected root directory
            if (rootDir != undefined) {
              if (globalData[globalData[id].parentID]) {
                if (rootDir.includes(globalData[globalData[id].parentID].name) || rootDir.includes(globalData[globalData[id].parentID].originalName)) {
                  if (!(!acceptFolder && globalData[id].type == "directory")) {
                    if (acceptedExtensions.includes("all") || acceptedExtensions.includes(globalData[id].type)) {
                      if (!matchRegex || matchRegex.test(globalData[id].name)) {
                        // Initializations
                        let columnsTags = {}
                        let tags = []
                        let tagsCollections = await getCollectionTags(id) // Get the tags of the file from db
                        tagsCollections = await tagsCollections.toArray() // Convert to array
                        // Process the tags and link them to columns: {column_name: [tags]}
                        tagsCollections.map((tagCollection) => {
                          let tempColName = tagCollection.column_name
                          if (tagCollection.column_name.includes("_|_")) {
                            tempColName = tagCollection.column_name.split("_|_")[1]
                          }
                          columnsTags[tempColName] = tagCollection.tags
                          tags = tags.concat(tagCollection.tags)
                        })
                        tags = [...new Set(tags)] // Remove duplicates

                        // Add the file to the list
                        return {
                          key: id,
                          id: id,
                          name: globalData[id].name,
                          tags: tags,
                          columnsTags: columnsTags
                        }
                      }
                    }
                  }
                }
              }
              // else, we want to add any file (or folder) from acceptedExtensions
            } else {
              if (acceptedExtensions.includes(globalData[id].extension) || acceptedExtensions.includes("all")) {
                let columnsTags = {}
                let tags = []
                let tagsCollections = await getCollectionTags(id)
                tagsCollections = await tagsCollections.toArray()
                tagsCollections.map((tagCollection) => {
                  columnsTags[tagCollection.column_name] = tagCollection.tags
                  tags = tags.concat(tagCollection.tags)
                })
                return {
                  key: id,
                  id: id,
                  name: globalData[id].name,
                  tags: tags,
                  columnsTags: columnsTags
                }
              }
            }
            // Return empty list if the item doesn't meet the conditions
            return null
          })
        )

        // Filter out any null values
        datasetListToShow = datasetListToShow.filter((item) => item !== null)

        console.log("datasetListToShow", datasetListToShow)
        setDatasetList(datasetListToShow)

        if (datasetListToShow.length === 0) {
          setHasWarning({ state: true, tooltip: "No data file found in the workspace" })
        }
      }
    }
    processData()
  }, [globalData])

  return (
    <>
      {datasetList.length > 0 ? (
        <MultiSelect
          key={key}
          disabled={disabled}
          placeholder={placeholder}
          value={
            Array.isArray(selectedPaths)
              ? selectedPaths.map((item) => ({
                  ...item,
                  key: item.key || item.id
                }))
              : []
          }
          onChange={(e) => onChange(e.value)}
          options={datasetList}
          optionLabel="name"
          display="chip"
          style={customProps}
          filter
        />
      ) : (
        whenEmpty
      )}
    </>
  )
}

export default WsSelectMultiple
