/* eslint-disable no-unused-vars */
import { Button } from "primereact/button"
import { Chip } from "primereact/chip"
import { Chips } from "primereact/chips"
import { InputText } from "primereact/inputtext"
import { Message } from "primereact/message"
import { MultiSelect } from "primereact/multiselect"
import { OverlayPanel } from "primereact/overlaypanel"
import { TreeSelect } from "primereact/treeselect"
import React, { useContext, useEffect, useRef, useState } from "react"
import { PlusSquare } from "react-bootstrap-icons"
import { toast } from "react-toastify"
import { requestBackend } from "../../../utilities/requests"
import { getCollectionColumns } from "../../mongoDB/mongoDBUtils"
import { ServerConnectionContext } from "../../serverConnection/connectionContext"
import { DataContext } from "../../workspace/dataContext"

/**
 * @description
 * This component is used to create and apply tags to dataset columns.
 * It allows the user to select the datasets to tag, create tags, and apply them to the selected columns.
 */
const GroupingTaggingToolsDB = () => {
  const [options, setOptions] = useState([])
  const { globalData } = useContext(DataContext)
  const [selectedCollections, setSelectedCollections] = useState([])
  const [tagsDict, setTagsDict] = useState({})
  const [tempTagName, setTempTagName] = useState("")
  const [currentTag, setCurrentTag] = useState("")
  const [treeSelectData, setTreeSelectData] = useState([])
  const [columnsByCollection, setColumnsByCollection] = useState([])
  const [selectedColumnsToTag, setSelectedColumnsToTag] = useState([])
  const [selectedTags, setSelectedTags] = useState([])
  const [loading, setLoading] = useState(false)
  const { port } = useContext(ServerConnectionContext)
  const op = useRef(null)
  const [tagId, setTagId] = useState(localStorage.getItem("myUUID"))

  // Generate a unique id for the tag
  useEffect(() => {
    if (!tagId) {
      let uuid = "column_tags"
      localStorage.setItem("myUUID", uuid)
      setTagId(uuid)
    }
  }, [])

  // Fetch columns data for selected collections
  useEffect(() => {
    const fetchColumnsData = async () => {
      const columnsData = []
      for (const collection of selectedCollections) {
        const columns = await getCollectionColumns(collection)
        columnsData[collection] = columns
      }
      setColumnsByCollection(columnsData)
    }

    if (selectedCollections.length > 0) {
      fetchColumnsData()
    }
  }, [selectedCollections])

  // Update the treeSelectData when selectedCollections change
  useEffect(() => {
    setSelectedColumnsToTag([])
    const updatedTreeSelectData = treeSelectData.filter((item) => selectedCollections.includes(item.key))
    setTreeSelectData(updatedTreeSelectData)
  }, [selectedCollections])

  // Update the treeSelectData when columnsByCollection change
  useEffect(() => {
    const treeFinalData = selectedCollections.map((collection) => ({
      label: globalData[collection].name,
      key: globalData[collection].name,
      children: columnsByCollection[collection].map((columnName) => ({
        label: columnName,
        key: `${globalData[collection].name}-${columnName}`,
        selectable: true
      }))
    }))
    setSelectedColumnsToTag([])
    setTreeSelectData(treeFinalData)
  }, [columnsByCollection])

  // Update the options when globalData or selectedCollections change
  useEffect(() => {
    const fetchData = async () => {
      try {
        const allEntries = Object.values(globalData)
        const csvEntries = allEntries.filter((entry) => entry.type === "csv")
        const newOptions = csvEntries.map(({ id, name }) => ({
          label: name,
          value: id
        }))
        setOptions(newOptions)
      } catch (error) {
        toast.error("Failed to fetch collection data.")
      }
    }
    fetchData()
  }, [globalData, selectedCollections])

  // Handle the change of selected collections
  const handleSelectChange = (newSelection) => {
    setSelectedCollections(newSelection)
  }

  // Add a tag to the tags dictionary
  const addTagToTagsDict = (tag, color, newTagsDict, protect) => {
    if (newTagsDict[tag]) {
      toast.error(`Tag ${tag} already exists.`)
    } else {
      newTagsDict[tag] = { color: color, fontColor: "black", datasets: {}, protect: protect !== "undefined" ? protect : false }
    }
    return newTagsDict
  }

  // Handle the creation of tags
  const handleTagsCreation = (e) => {
    let innerTagsList = e.value
    if (innerTagsList.length > 0) {
      let newTagsDict = {}
      innerTagsList.forEach((tag) => {
        if (tagsDict[tag]) {
          newTagsDict[tag] = tagsDict[tag]
        } else {
          newTagsDict[tag] = { fontColor: "white", color: generateRandomColor(), datasets: {}, protect: true }
        }
      })
      setTagsDict(newTagsDict)
    }
  }

  // Generate a random color
  const generateRandomColor = () => {
    let color = "#" + Math.floor(Math.random() * 16777215).toString(16)
    return color
  }

  // Custom chip for tags
  const customChip = (option) => {
    let style = { padding: "0px 5px", backgroundColor: tagsDict[option].color, color: tagsDict[option].fontColor }

    return <Chip className="custom-token" label={option} style={style}></Chip>
  }

  // Handle the change of color for a tag
  const handleChangeColor = (tag, e) => {
    const newTagsDict = { ...tagsDict, [tag]: { ...tagsDict[tag], color: e.target.value } }
    setTagsDict(newTagsDict)
  }

  // Handle the toggle of font color for a tag
  const handleToggleFontColor = (tag) => {
    const newFontColor = tagsDict[tag].fontColor === "black" ? "white" : "black"
    const newTagsDict = { ...tagsDict, [tag]: { ...tagsDict[tag], fontColor: newFontColor } }
    setTagsDict(newTagsDict)
  }

  // Handle the deletion of a tag
  const handleDeleteTag = (tag) => {
    const { [tag]: oldTag, ...rest } = tagsDict
    setTagsDict(rest)
    setSelectedTags(selectedTags.filter((selectedTag) => selectedTag !== tag))
  }

  // Handle the change of tag name
  const handleChangeTagName = (tag, event) => {
    setCurrentTag(tag)
    setTempTagName(tag)
    op.current.toggle(event)
  }

  // Handle the confirmation of tag name change
  const handleTagChangeConfirm = () => {
    if (tempTagName && !tagsDict[tempTagName]) {
      let newTagsDict = {}
      Object.keys(tagsDict).forEach((key) => {
        if (key === currentTag) {
          newTagsDict[tempTagName] = { ...tagsDict[currentTag] }
        } else {
          newTagsDict[key] = tagsDict[key]
        }
      })
      setTagsDict(newTagsDict)
    }
    op.current.hide()
  }

  // Apply tags to columns (backend logic here)
  const applyTagsToColumns = async (selectedColumns, selectedTags) => {
    let jsonToSend = {}
    jsonToSend = {
      newCollectionName: tagId,
      collections: selectedCollections,
      columns: selectedColumns,
      tags: selectedTags,
    }
    console.log("id", tagId)
    setLoading(true)
    requestBackend(
      port,
      "/input/create_tags/",
      jsonToSend,
      (jsonResponse) => {
        console.log("jsonResponse", jsonResponse)
        if (jsonResponse.error) {
          toast.error("Error detected while creating tags.")
          console.log("error while creating tags", jsonResponse.error)
          return
        }
        toast.success("Tags created successfully.")
        setLoading(false)
      },
      (error) => {
        toast.error("Error detected while creating tags.")
        console.log("error while creating tags", error)
        setLoading(false)
      }
    )
  }

  // Handle the selection of a tag
  const handleTagSelection = (selectedTag) => {
    if (selectedColumnsToTag.length < 1) {
      toast.error("Please select columns to tag.")
      return
    }
    setSelectedTags(selectedTag)
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
        <div>
          <div className="margin-top-15 margin-bottom-15 center">
            <Message text="The Grouping/Tagging tool enables you to create and apply tags to dataset columns." />
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", marginBottom: "15px" }}>
            <div style={{ display: "flex", flexDirection: "column", marginRight: "20px" }}>
              <h6 style={{ paddingBottom: "0.25rem", margin: "0rem", marginInline: "0.5rem", height: "1.5rem" }}>Datasets to tag</h6>
              <MultiSelect
                display="chip"
                filter 
                value={selectedCollections}
                options={options}
                onChange={(e) => handleSelectChange(e.value)}
                placeholder={"Select Collections"}
                style={{ width: "280px", marginTop: "0.25rem" }}
              />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", marginBottom: "0.25rem" }}>
                <h6 style={{ margin: "0rem", paddingRight: "0.5rem" }}>Create your tags</h6>
                <Button
                  className="checkmarkButton"
                  style={{ width: "fit-content", height: "fit-content", padding: "0.15rem" }}
                  onClick={() => {
                    let newTagsDict = { ...tagsDict }
                    newTagsDict = addTagToTagsDict("demographics", "#4c9eff", newTagsDict, true)
                    newTagsDict = addTagToTagsDict("radiographics", "#4ec9b0", newTagsDict, true)
                    newTagsDict = addTagToTagsDict("radiomics", "#f9b115", newTagsDict, true)
                    newTagsDict = addTagToTagsDict("pathology", "#f93e3e", newTagsDict, true)
                    newTagsDict = addTagToTagsDict("therapy", "#a832a8", newTagsDict, true)
                    setTagsDict(newTagsDict)
                  }}
                  tooltip="Add default tags"
                  tooltipOptions={{ position: "top" }}
                >
                  <PlusSquare size={15} />
                </Button>
              </div>
              <div style={{ display: "flex", alignItems: "flex-start" }}>
                <Chips
                  className="w-full md:w-14rem margintop8px small-token token-bg-transparent"
                  value={Object.keys(tagsDict)}
                  removable={false}
                  onChange={(e) => {
                    handleTagsCreation(e)
                  }}
                  itemTemplate={customChip}
                  style={{ width: "100%", marginTop: "0.15rem" }}
                  placeholder={Object.keys(tagsDict).length > 0 ? "" : "Tag Name"}
                />
                <div style={{ display: "flex", flexDirection: "column", marginLeft: "20px" }}>
                  {Object.keys(tagsDict).map((tag) => (
                    <div key={tag} style={{ display: "flex", alignItems: "center", marginBottom: "10px" }}>
                      <div style={{ width: "150px" }}>
                        <Chip
                          label={tag}
                          style={{
                            backgroundColor: tagsDict[tag].color,
                            color: tagsDict[tag].fontColor,
                            padding: "2px 6px",
                            fontSize: "12px",
                            fontWeight: "bold",
                            textAlign: "center"
                          }}
                        />
                      </div>
                      <div style={{ marginLeft: "10px", marginRight: "10px" }}>
                        <input type="color" value={tagsDict[tag].color} onChange={() => handleChangeColor(tag, event)} style={{ width: "40px", height: "30px", padding: "2px" }} />
                      </div>
                      <Button icon="pi pi-refresh" onClick={() => handleToggleFontColor(tag)} className="margin-left-10" style={{ padding: "4px 8px", fontSize: "12px", marginLeft: "10px" }} />
                      <Button
                        icon="pi pi-pencil"
                        onClick={(event) => handleChangeTagName(tag, event)}
                        className="margin-left-10"
                        style={{ padding: "4px 8px", fontSize: "12px", marginLeft: "10px" }}
                      />
                      <Button icon="pi pi-trash" onClick={() => handleDeleteTag(tag)} className="margin-left-10" style={{ padding: "4px 8px", fontSize: "12px", marginLeft: "10px" }} />
                      <OverlayPanel ref={op} dismissable>
                        <div>
                          <InputText placeholder="Change Tag Name" type="text" value={tempTagName} onChange={(e) => setTempTagName(e.target.value)} />
                          <Button onClick={handleTagChangeConfirm}>Confirm</Button>
                        </div>
                      </OverlayPanel>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", marginRight: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "465px" }}>
            {/* Column Selection Title */}
            <h6 style={{ margin: "0rem", height: "1.5rem" }}>Select columns to tag</h6>
            {/* Tag Selection Title */}
            <h6 style={{ margin: "0rem", height: "1.5rem" }}>Select tags to apply</h6>
          </div>

          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", marginTop: "10px" }}>
            {/* TreeSelect for Columns */}
            <TreeSelect
              value={selectedColumnsToTag}
              options={treeSelectData}
              onChange={(e) => setSelectedColumnsToTag(e.value)}
              placeholder="Select Collections and Columns"
              selectionMode="checkbox"
              display="chip"
              filter
              panelClassName="groupingToolTree"
              style={{ width: "300px", height: "50px", marginRight: "20px" }}
            />
            {/* MultiSelect for Tags */}
            <MultiSelect
              value={selectedTags}
              options={Object.keys(tagsDict).map((key) => ({ label: key, value: key }))}
              onChange={(e) => handleTagSelection(e.value)}
              placeholder="Select Tags"
              style={{ width: "300px", height: "50px", marginRight: "20px" }}
            />
            {/* Apply Button */}
            <Button
              icon={"pi pi-check"}
              onClick={() => applyTagsToColumns(selectedColumnsToTag, selectedTags)}
              className="p-button-success"
              style={{ width: "100px" }}
              tooltip="Apply tags to selected columns"
              loading={loading}
              tooltipOptions={{ position: "top" }}
              disabled={Object.keys(selectedColumnsToTag).length === 0 || selectedTags.length === 0}
            />
          </div>
        </div>
      </div>
    </>
  )
}

export default GroupingTaggingToolsDB
