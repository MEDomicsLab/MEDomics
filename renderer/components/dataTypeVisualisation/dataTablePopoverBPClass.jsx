import React, { useContext, useEffect, useState } from "react"
import { Button, Popover, Menu, MenuItem, InputGroup } from "@blueprintjs/core"
import { Select } from "@blueprintjs/select"
import { Tag } from "react-bootstrap-icons"
import { Stack } from "react-bootstrap"
import { DataContext } from "../workspace/dataContext"
import { Utils as danfoUtils } from "../../utilities/danfo.js"
import { deepCopy } from "../../utilities/staticFunctions"
import { Chip } from "primereact/chip"

const dfUtils = new danfoUtils()

/**
 * Component that renders the popover for the data type selection in the data table and also the filter input
 * Present in the data table header
 * @param {Object} props
 * @param {Object} props.config - The config object of the data table
 * @param {String} props.columnName - The name of the column
 * @param {Array} props.category - The category of the column
 * @param {Function} props.filterColumn - The function to filter the column
 * @param {Function} props.filterValue - The filter value
 * @param {Function} props.getReorderedIndex - The function to get the reordered index
 * @returns {JSX.Element}
 */
const DataTablePopoverBP = (props) => {
  const selectedIcon = {
    // The icon to be displayed in the popover button
    Numerical: "array-floating-point",
    Categorical: "array-numeric",
    Time: "array-timestamp",
    String: "array-string"
  }

  const getTypeFromInferedDtype = (dtype) => {
    // To get the data type from the infered data type
    switch (dtype) {
      case "float32":
        return "Numerical"
      case "int32":
        return "Categorical"
      case "datetime64[ns]":
        return "Time"
      case "string":
        return "String"
      default:
        return "Numerical"
    }
  }

  /**
   * Generate random color
   * @returns {string} - Random color
   * @summary This function is used to generate a random color
   */
  const generateRandomColor = () => {
    let color = "#" + Math.floor(Math.random() * 16777215).toString(16)
    return color
  }

  const getColumnNameFromIndex = (index) => {
    // To get the column name from the index
    let medObject = globalData[props.config.uuid]
    if (medObject) {
      let df = medObject.metadata.columns
      let colName = df[index]
      return colName
    }
    return ""
  }

  const { globalData, setGlobalData } = useContext(DataContext) // The global data object
  const [columnName, setColumnName] = useState(props.columnName) // The name of the column
  const [selectedType, setSelectedType] = useState(getTypeInGlobalData()) // The selected data type
  const [tags, setTags] = useState([]) // The tags for the string data type
  const menuItemOptions = { shouldDismissPopover: false, onClick: (e) => handleDataTypeChange(e), roleStructure: "listoption" } // The options for the menu items
  /**
   * To handle the change in the data type
   * @param {Object} e - The event object
   * @returns {Void}
   */
  const handleDataTypeChange = (e) => {
    setSelectedType(e.target.innerText)
    changeTypeInGlobalData(e.target.innerText)
  }

  /**
   * To change the data type of the column in the global data object
   * @param {String} type
   * @returns {Void}
   */
  const changeTypeInGlobalData = (type) => {
    let globalDataCopy = { ...globalData }
    if (globalDataCopy[props.config.uuid]) {
      if (globalDataCopy[props.config.uuid].metadata.columnsInfo) {
        if (globalDataCopy[props.config.uuid].metadata.columnsInfo[columnName]) {
          globalDataCopy[props.config.uuid].metadata.columnsInfo[columnName].dataType = type
        } else {
          globalDataCopy[props.config.uuid].metadata.columnsInfo[columnName] = {
            dataType: type
          }
        }
      } else {
        globalDataCopy[props.config.uuid].metadata.columnsInfo = {
          [columnName]: {
            dataType: type
          }
        }
      }
      setGlobalData(globalDataCopy)
    }
  }

  /**
   * To get the data type of the column from the global data object
   * @returns {String} - The data type of the column
   */
  function getTypeInGlobalData() {
    let medObject = globalData[props.config.uuid]
    if (medObject) {
      if (medObject.metadata.columnsInfo) {
        if (medObject.metadata.columnsInfo[columnName]) {
          return medObject.metadata.columnsInfo[columnName].dataType
        }
      }
    }
    return "Numerical"
  }

  /**
   * To get the unique values in the column
   * @returns {Array} - The array of unique values
   */
  function getUniqueValues() {
    let medObject = globalData[props.config.uuid]
    if (medObject) {
      let df = medObject.data
      let colName = columnName
      let colData = df.$getColumnData(colName).$data
      let uniqueValues = dfUtils.unique(colData)
      // If unique values contain "", then write it as "[Empty]"
      if (uniqueValues.includes("")) {
        uniqueValues[uniqueValues.indexOf("")] = "[Empty]"
      }

      return uniqueValues
    }
    return []
  }

  /** Hook called when the global data changes to get the registered name of the column in global data */
  useEffect(() => {
    let name = getColumnNameFromIndex(props.getReorderedIndex(props.index))
    setColumnName(name)
  }, [globalData])

  /**
   * To set the selected type to the type of the column if it is already present in the global data object
   * @returns {Void}
   */
  useEffect(() => {
    let medObject = globalData[props.config.uuid]
    let globalDataCopy = { ...globalData }
    if (medObject) {
      if (medObject.metadata.columnsInfo) {
        if (medObject.metadata.columnsInfo[columnName]) {
          if (medObject.metadata.columnsInfo[columnName].dataType) {
            let type = medObject.metadata.columnsInfo[columnName].dataType
            if (Object.keys(selectedIcon).includes(type)) {
              setSelectedType(medObject.metadata.columnsInfo[columnName].dataType)
            } else {
              globalDataCopy[props.config.uuid].metadata.columnsInfo[columnName].dataType = getTypeFromInferedDtype(props.category[0])
              setSelectedType(getTypeFromInferedDtype(props.category[0]))
              setGlobalData(globalDataCopy)
            }
          }
        }
      } else {
        globalDataCopy[props.config.uuid].metadata.columnsInfo = {
          [columnName]: {
            dataType: getTypeFromInferedDtype(props.category[0])
          }
        }
        setGlobalData(globalDataCopy)
      }
    } else {
      // NO OP
    }
  }, [])

  useEffect(() => {
    let newIndex = props.getReorderedIndex(props.index) // Get the new index of the column
    let name = getColumnNameFromIndex(newIndex) // Get the name of the column
    setColumnName(name) // Set the name of the column

    setSelectedType(getTypeInGlobalData()) // Set the selected type to the type of the column
    let globalDataCopy = { ...globalData }
    if (globalDataCopy[props.config.uuid]) {
      let tags = globalDataCopy[props.config.uuid].getColumnsTag()
      if (tags) {
        let tagsDict = tags.tagsDict
        let columnsTag = tags.columnsTag
        let columnTag = columnsTag[name]
        let columnTagToSet = {}
        if (columnTag) {
          columnTag.forEach((tag) => {
            if (tagsDict) {
              if (tagsDict[tag]) {
                columnTagToSet[tag] = tagsDict[tag]
              } else {
                columnTagToSet[tag] = { color: generateRandomColor(tag), fontColor: "white" }
              }
            } else {
              columnTagToSet[tag] = { color: generateRandomColor(tag), fontColor: "white" }
            }
          })
        }
        setTags(columnTagToSet)
      }
    }
  }, [props])

  return (
    <>
      <div direction="vertical" style={{ cursor: "default", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <div
          className="datatable-tags"
          direction="horizontal"
          style={{ overflowX: "auto", padding: "0rem", border: "1px solid transparent", display: "flex", width: "100%", whiteSpace: "nowrap", textAlign: "center" }}
        >
          {tags &&
            Object.keys(tags).map((tag, index) => {
              let color = tags[tag].color
              let fontColor = tags[tag].fontColor
              let style = {
                backgroundColor: color,
                color: fontColor,
                cursor: "default",
                marginRight: "5px",
                textAlign: "center",
                display: "inline-flex",
                alignItems: "strech",
                justifyContent: "center"
              }
              return (
                <div
                  key={"div_chip" + index}
                  style={{ minWidth: "fit-content", width: "100%", display: "inline-flex", flexGrow: "1", alignSelf: "center", justifyContent: "center", alignContent: "center", alignItems: "center" }}
                >
                  <Chip className="custom-token custom-bp-table" key={"chip" + index} label={tag} style={style} />
                </div>
              )
            })}
        </div>
        <Stack direction="horizontal" gap={1} style={{ marginInline: "5px", paddingBottom: "3px" }}>
          <Popover
            content={
              <Menu>
                <MenuItem icon="array-floating-point" text="Numerical" {...menuItemOptions} selected={selectedType == "Numerical"} />
                <MenuItem icon="array-numeric" text="Categorical" {...menuItemOptions} selected={selectedType == "Categorical"} />
                <MenuItem icon="array-timestamp" text="Time" {...menuItemOptions} selected={selectedType == "Time"} />
                <MenuItem icon="array-string" text="String" {...menuItemOptions} selected={selectedType == "String"} />
              </Menu>
            }
            placement="bottom-end"
          >
            <Button active={false} icon={selectedIcon[selectedType]} style={{ padding: "0.25rem", boxSizing: "content-box", minWidth: "1rem", minHeight: "1rem" }} />
          </Popover>
          {selectedType == "Categorical" && ( // If the data type is categorical, then show the select component
            <>
              <Select
                items={getUniqueValues()}
                itemRenderer={(item, { handleClick, modifiers }) => {
                  return (
                    <MenuItem
                      selected={item === props.filterValue(props.index).filterValue}
                      active={modifiers.active}
                      disabled={modifiers.disabled}
                      key={item}
                      onClick={handleClick}
                      text={item}
                      roleStructure="listoption"
                    />
                  )
                }}
                onItemSelect={(item, dict) => {
                  console.log("Item selected", item, props.index, dict)
                  if (props.filterValue(props.index).filterValue !== undefined && props.filterValue(props.index).filterValue !== null) {
                    if (props.filterValue(props.index).filterValue == item) {
                      props.filterColumn(props.index, "")
                    } else {
                      props.filterColumn(props.index, item)
                    }
                  } else {
                    props.filterColumn(props.index, item)
                  }
                }}
                popoverProps={{
                  usePortal: true
                }}
                inputProps={{ value: props.filterValue(props.index).filterValue }}
                popoverContentProps={{
                  style: { maxHeight: "200px", width: "100%", height: "200px", overflow: "auto" }
                }}
                filterable={false}
              >
                <Button
                  rightIcon="caret-down"
                  placeholder="Select value"
                  text={props.filterValue(props.index).filterValue !== "" && props.filterValue(props.index).filterValue ? props.filterValue(props.index).filterValue : "Select value"}
                  style={{ width: "auto", height: "1.5rem" }}
                  small={true}
                />
              </Select>
            </>
          )}{" "}
          {selectedType == "Numerical" && ( // If the data type is numerical, then show this input component
            <>
              <InputGroup
                asyncControl={true}
                disabled={false}
                large={false}
                placeholder={"Filter " + columnName}
                readOnly={false}
                small={true}
                style={{ width: "100%" }}
                value={props.filterValue(props.index).filterValue || ""}
                onValueChange={(value) => {
                  props.filterColumn(props.index, value)
                }}
              />
            </>
          )}
          {selectedType == "String" && ( // If the data type is string, then show this input component
            <>
              <InputGroup
                asyncControl={true}
                disabled={false}
                large={false}
                placeholder={"Filter " + columnName}
                readOnly={false}
                small={true}
                style={{ width: "100%" }}
                rightElement={<Tag style={{ marginInline: "5px" }} />}
                value={props.filterValue(props.index).filterValue || ""}
                onChange={(e) => {
                  props.filterColumn(props.index, e.target.value)
                }}
              />
            </>
          )}
          {selectedType == "Time" && ( // If the data type is time, then show this input component
            <>
              <InputGroup
                asyncControl={true}
                disabled={false}
                large={false}
                placeholder={"Filter " + columnName}
                readOnly={false}
                small={true}
                style={{ width: "100%" }}
                value={deepCopy(props.filterValue(props.index).filterValue) || ""}
                onValueChange={(value) => {
                  props.filterColumn(props.index, value)
                }}
              />
            </>
          )}
        </Stack>
      </div>
    </>
  )
}

export { DataTablePopoverBP }
