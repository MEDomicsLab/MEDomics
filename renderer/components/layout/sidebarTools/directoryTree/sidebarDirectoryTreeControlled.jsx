/* eslint-disable no-undef */
import React, { useContext, useRef, useState, useEffect } from "react"
import { Trash, BoxArrowUpRight, Eraser, FolderPlus, ArrowClockwise, EyeFill, EyeSlashFill } from "react-bootstrap-icons"
import { Accordion, Stack } from "react-bootstrap"
import { ControlledTreeEnvironment, Tree } from "react-complex-tree"
import { DataContext } from "../../../workspace/dataContext"
import MedDataObject from "../../../workspace/medDataObject"
import { toast } from "react-toastify"
import { LayoutModelContext } from "../../layoutContext"
import { useContextMenu, Menu, Item, Submenu } from "react-contexify"
import renderItem from "./renderItem"
import { Tooltip } from "primereact/tooltip"
import { confirmDialog } from "primereact/confirmdialog"

/**
 * @description - This component is the sidebar tools component that will be used in the sidebar component
 * @param {Object} props - Props passed from parent component
 * @returns a sidebar item component that can be a file or a folder and that is rendered recursively
 */
const SidebarDirectoryTreeControlled = ({ setExternalSelectedItems, setExternalDBClick }) => {
  const environment = useRef() // This ref is used to get the environment of the directory tree
  const tree = useRef() // This ref is used to get the directory tree
  const MENU_ID = "tree-2" // This is the id of the context menu
  const { show } = useContextMenu() // This is the context menu

  const [focusedItem, setFocusedItem] = useState() // This state is used to keep track of the item that is currently focused
  const [expandedItems, setExpandedItems] = useState([]) // This state is used to keep track of the items that are currently expanded
  const [selectedItems, setSelectedItems] = useState([]) // This state is used to keep track of the items that are currently selected
  const [copiedItems, setCopiedItems] = useState([]) // This state is used to keep track of the items that have been copied
  const [dbClickedItem, setDbClickedItem] = useState([]) // This state is used to keep track of the items that have been copied
  // eslint-disable-next-line no-unused-vars
  const [cutItems, setCutItems] = useState([]) // This state is used to keep track of the items that have been cut
  const [isHovering, setIsHovering] = useState(false) // This state is used to know if the mouse is hovering the directory tree
  const [showHiddenFiles, setShowHiddenFiles] = useState(false) // This state is used to know if the user wants to see hidden files or not
  const [isAccordionShowing, setIsAccordionShowing] = useState(true) // This state is used to know if the accordion is collapsed or not
  const { globalData, setGlobalData } = useContext(DataContext) // We get the global data from the context to retrieve the directory tree of the workspace, thus retrieving the data files
  const { dispatchLayout, developerMode } = useContext(LayoutModelContext)
  const [isDialogShowing, setIsDialogShowing] = useState(false) // This state is used to know if the dialog is showing or not
  const [dirTree, setDirTree] = useState({}) // We get the directory tree from the workspace
  const [isDropping, setIsDropping] = useState(false) // Set if the item is getting dropped something in (for elements outside of the tree)

  useEffect(() => {
    console.log("isDialogShowing", isDialogShowing)
  }, [isDialogShowing])

  useEffect(() => {
    setExternalSelectedItems && setExternalSelectedItems(selectedItems)
  }, [selectedItems])

  /**
   * This function handles the key press event. It is attached to the document.
   * @param {Object} event - The key press event
   * @returns {void}
   * @note - This function is called when the user presses a key.
   */
  const handleKeyPress = (event) => {
    if (event.key === "Delete") {
      if (selectedItems.length > 0) {
        console.log("DELETE", selectedItems[0])
        selectedItems.forEach((item) => {
          onDelete(item)
        })
      }
    } else if (event.code === "KeyC" && event.ctrlKey) {
      setCopiedItems(selectedItems)
    } else if (event.code === "KeyX" && event.ctrlKey) {
      setCutItems(selectedItems)
    } else if (event.code === "KeyV" && event.ctrlKey) {
      if (copiedItems.length > 0) {
        console.log("PASTE", copiedItems)
        copiedItems.forEach((item) => {
          onPaste(item, selectedItems[0])
        })
      }
    } else if (event.code === "KeyH" && event.ctrlKey) {
      setShowHiddenFiles(!showHiddenFiles)
    }
    // Add support for CMD on Mac
    else if (event.code === "KeyC" && event.metaKey) {
      setCopiedItems(selectedItems)
    } else if (event.code === "KeyX" && event.metaKey) {
      setCutItems(selectedItems)
    } else if (event.code === "KeyV" && event.metaKey) {
      if (copiedItems.length > 0) {
        console.log("PASTE", copiedItems)
        copiedItems.forEach((item) => {
          onPaste(item, selectedItems[0])
        })
      }
    } else if (event.code === "KeyH" && event.metaKey) {
      setShowHiddenFiles(!showHiddenFiles)
    }
    // For mac, add Enter key to rename
    // If os is mac and enter key is pressed
    if (navigator.platform.indexOf("Mac") > -1) {
      if (event.code === "Enter" && !isDialogShowing) {
        // We check if the dialog is showing to avoid renaming when the user is in the process of deleting a file
        console.log("ENTER", selectedItems[0], tree.current)
        if (tree.current !== undefined) {
          if (tree.current.isRenaming) {
            tree.current.completeRenamingItem()
          } else {
            event.preventDefault()
            event.stopPropagation()
            if (selectedItems.length === 1) {
              console.log("RENAME", selectedItems[0])
              tree.current.startRenamingItem(selectedItems[0])
            }
          }
        }
      } else if (event.code === "Backspace" && event.metaKey) {
        console.log("BACKSPACE", selectedItems[0])
        onDelete(selectedItems[0])
      }
    }
  }

  /**
   * This useEffect hook attaches an event listener to the document to listen for key presses.
   */
  useEffect(() => {
    // attach the event listener
    document.addEventListener("keydown", handleKeyPress)
    // remove the event listener
    return () => {
      document.removeEventListener("keydown", handleKeyPress)
    }
  }, [handleKeyPress])

  /**
   * This function renames a `MedDataObject` in the workspace.
   * @param {string} uuid - The UUID of the `MedDataObject` to rename
   * @returns {void}
   * @note this function is useful to rename
   */
  function onRename(uuid) {
    setSelectedItems([uuid])
    tree.current.startRenamingItem(uuid)
  }

  /**
   * This function opens a `MedDataObject` in the workspace.
   * @param {string} uuid - The UUID of the `MedDataObject` to open
   * @returns {void}
   * @note - This function is called when the user double-clicks on a file or folder in the directory tree, or when the user right-clicks and selects "Open".
   * @todo - This function should open the file in the default application.
   * @README - This function is not implemented yet.
   */
  function onOpen(uuid) {
    let dataObjectUUID = uuid
    // eslint-disable-next-line no-unused-vars
    let path = globalData[dataObjectUUID].path
    // NOOP
  }

  /**
   * This function pastes a `MedDataObject` in the workspace.
   * @param {string} uuid - The UUID of the `MedDataObject` to paste
   * @param {string} selectedItem - The UUID of the copied `MedDataObject`
   * @returns {void}
   * @note - This function is called when the user pastes a file or folder in the directory tree, either by pressing Ctrl+V or by right-clicking and selecting "Paste".
   */
  function onPaste(uuid, selectedItem) {
    let dataObject = globalData[uuid]
    if (selectedItem == undefined) {
      console.warn("PASTE - selectedItem undefined")
      return
    }

    let selectedItemObject = globalData[selectedItem]
    if (selectedItemObject.type !== undefined) {
      if (selectedItemObject.type == "folder") {
        MedDataObject.copy(dataObject, selectedItemObject, globalData, setGlobalData)
        MedDataObject.updateWorkspaceDataObject(300)
      } else {
        let parentObject = globalData[selectedItemObject.parentID]
        MedDataObject.copy(dataObject, parentObject, globalData, setGlobalData)
        MedDataObject.updateWorkspaceDataObject(300)
      }
    }
  }

  /**
   * This function deletes a `MedDataObject` in the workspace.
   * @param {string} uuid - The UUID of the `MedDataObject` to delete
   * @returns {void}
   * @note - This function is called when the user deletes a file or folder in the directory tree, either by pressing the delete key or by right-clicking and selecting "Delete".
   */
  function onDelete(uuid) {
    // Get the UUID of the `MedDataObject` with the current name from the `globalData` object.
    const namesYouCantDelete = ["UUID_ROOT", "DATA", "EXPERIMENTS"]
    if (uuid == "") {
      toast.warning("Error: UUID not found")
      return
    } else if (uuid == "UUID_ROOT") {
      toast.warning("Error: Cannot delete root")
      return
    } else if (globalData[uuid] == undefined) {
      toast.warning("Error: UUID not found in globalData")
      return
    } else if (boolNameInArray(globalData[uuid].name, namesYouCantDelete)) {
      console.log("Error: This name cannot be deleted")
      toast.error(`Error: ${globalData[uuid].name} cannot be deleted`)
      return
    } else {
      setIsDialogShowing(true)
      confirmDialog({
        message: `Are you sure you want to delete ${globalData[uuid].name}?`,
        header: "Delete Confirmation",
        icon: "pi pi-info-circle",
        closable: false,
        accept: () => {
          // If the user confirms the deletion, we delete the `MedDataObject` with the current name and update the `globalData` object.
          let globalDataCopy = { ...globalData }
          globalDataCopy = MedDataObject.delete(globalDataCopy[uuid], globalData, dispatchLayout)
          setGlobalData(globalDataCopy)
          toast.success(`Deleted ${globalData[uuid].name}`)
          MedDataObject.updateWorkspaceDataObject(300)
          setIsDialogShowing(false)
        },
        reject: () => {
          // If the user cancels the deletion, we do nothing.
          toast.info("Delete cancelled")
          setIsDialogShowing(false)
        }
      })
    }
  }

  /**
   * This function handles the context menu action. It is passed to the render item function to be called when the user clicks on a context menu action.
   * @param {Object} param0 - The context menu action object
   *  @param {string} param0.id - The id of the context menu action
   *  @param {Object} param0.props - The props of the context menu action
   */
  function handleContextMenuAction({ id, props }) {
    if (developerMode) {
      switch (id) {
        case "openInDataTableViewer":
          dispatchLayout({ type: "openInDataTable", payload: props })
          break
        case "openInCodeEditor":
          dispatchLayout({ type: "openInCodeEditor", payload: props })
          break
        case "openInImageViewer":
          dispatchLayout({ type: "openInImageViewer", payload: props })
          break
        case "openInPDFViewer":
          dispatchLayout({ type: "openInPDFViewer", payload: props })
          break
        case "openInTextEditor":
          dispatchLayout({ type: "openInTextEditor", payload: props })
          break
        case "openInModelViewer":
          dispatchLayout({ type: "openInModelViewer", payload: props })
          break
        case "openInLearningModule":
          dispatchLayout({ type: "openInLearningModule", payload: props })
          break
        case "openInEvaluationModule":
          dispatchLayout({ type: "openInEvaluationModule", payload: props })
          break
        case "openInApplicationModule":
          dispatchLayout({ type: "openInApplicationModule", payload: props })
          break
        case "openInPandasProfiling":
          dispatchLayout({ type: "openPandasProfiling", payload: props })
          break
        case "openLearningModule":
          dispatchLayout({ type: "openInLearningModule", payload: props })
          break
        case "openInJSONViewer":
          dispatchLayout({ type: "openInJSONViewer", payload: props })
          break
        case "open":
          onOpen(props.UUID)
          break
        case "rename":
          onRename(props.UUID)
          break
        case "delete":
          onDelete(props.UUID)
          break
        case "revealInFileExplorer":
          if (globalData[props.UUID] !== undefined) {
            if (globalData[props.UUID].path !== undefined) {
              // eslint-disable-next-line no-undef
              require("electron").shell.showItemInFolder(globalData[props.UUID].path)
            } else {
              toast.error("Error: No path found")
            }
          } else {
            toast.error("Error: No item selected")
          }
          break
      }
    } else {
      toast.error("Error: Developer mode is enabled")
    }
  }

  /**
   * This function handles the double click on an item in the directory tree.
   * @param {Object} event - The double click event
   * @param {Object} item - The item that was double clicked
   * @returns {void}
   */
  const onDBClickItem = (event, item) => {
    if (developerMode) {
      if (item.type == "medml" ) {
        dispatchLayout({ type: "openInLearningModule", payload: item })
      } else if (item.type == "medimg") {
        dispatchLayout({ type: "openInExtractionMEDimageModule", payload: item })
      } else if (item.type == "medeval") {
        dispatchLayout({ type: "openInEvaluationModule", payload: item })
      } else if (item.type == "csv" || item.type == "tsv" || item.type == "xlsx") {
        dispatchLayout({ type: "openInDataTable", payload: item })
      } else if (item.type == "json") {
        dispatchLayout({ type: "openInJSONViewer", payload: item })
      } else if (item.type == "py" || item.type == "ipynb") {
        dispatchLayout({ type: "openInCodeEditor", payload: item })
      } else if (item.type == "png" || item.type == "jpg" || item.type == "jpeg" || item.type == "gif" || item.type == "svg") {
        dispatchLayout({ type: "openInImageViewer", payload: item })
      } else if (item.type == "pdf") {
        dispatchLayout({ type: "openInPDFViewer", payload: item })
      } else if (item.type == "html") {
        dispatchLayout({ type: "openHtmlViewer", payload: item })
      } else if (item.type == "txt") {
        dispatchLayout({ type: "openInTextEditor", payload: item })
      } else if (item.type == "medmodel") {
        dispatchLayout({ type: "openInModelViewer", payload: item })
      } else if (item.type == "medflres") {
        dispatchLayout({ type: "openInMEDflResultsViewer", payload: item })
      } else if (item.type == "medflopt") {
        dispatchLayout({ type: "openInMEDflOptResultsViewer", payload: item })
      } else if (item.type == "medflrw") {
        dispatchLayout({ type: "openInMEDflRwResultsViewer", payload: item })
      }else if (item.type == "fl") {
        dispatchLayout({ type: "openInFlModule", payload: item })
      }  else {
        console.log("DBCLICKED", event, item)
      }
      setDbClickedItem(item)
      // console.log("DBCLICKED", event, item)
    } else {
      toast.error("Error: Developer mode is enabled")
    }
  }

  /**
   * This useEffect hook sets the external double click item when the double click item changes.
   */
  useEffect(() => {
    if (setExternalDBClick) {
      setExternalDBClick(dbClickedItem)
    }
  }, [dbClickedItem])

  /**
   * This function displays the context menu.
   * @param {Object} e - The event
   * @param {Object} data - The data object
   * @returns {void}
   */
  function displayMenu(e, data) {
    console.log("DISPLAY MENU", e, data)
    if (data.isFolder) {
      show({
        id: "MENU_FOLDER",
        event: e,
        props: data
      })
    } else if (data.type == "medml") {
      show({
        id: "MENU_MEDML",
        event: e,
        props: data
      })
    } else if (data.type == "csv" || data.type == "tsv" || data.type == "xlsx") {
      show({
        id: "MENU_DATA",
        event: e,
        props: data
      })
    } else if (data.type == "json") {
      show({
        id: "MENU_JSON",
        event: e,
        props: data
      })
    } else if (data.type == "py" || data.type == "ipynb") {
      show({
        id: "MENU_CODE",
        event: e,
        props: data
      })
    } else if (data.type == "png" || data.type == "jpg" || data.type == "jpeg" || data.type == "gif" || data.type == "svg") {
      show({
        id: "MENU_IMAGE",
        event: e,
        props: data
      })
    } else if (data.type == "pdf") {
      show({
        id: "MENU_PDF",
        event: e,
        props: data
      })
    } else if (data.type == "txt") {
      show({
        id: "MENU_TEXT",
        event: e,
        props: data
      })
    } else if (data.type == "pkl") {
      show({
        id: "MENU_MODEL",
        event: e,
        props: data
      })
    } else {
      show({
        id: "MENU_DEFAULT",
        event: e,
        props: data
      })
    }
  }

  /**
   * This function handles the drop of an item in the directory tree.
   * @param {Array} items - The array of items to drop
   * @param {Object} target - The target object
   * @returns {void}
   * @note - This function is called when the user drops an item in the directory tree.
   */
  const onDrop = async (items, target) => {
    const currentItems = tree.current.treeEnvironmentContext.items
    for (const item of items) {
      const parent = Object.values(currentItems).find((potentialParent) => potentialParent.children?.includes(item.index))

      if (!parent) {
        throw Error(`Could not find parent of item "${item.index}"`)
      }

      if (!parent.children) {
        throw Error(`Parent "${parent.index}" of item "${item.index}" did not have any children`)
      }

      if (target.targetType === "item" || target.targetType === "root") {
        if (target.targetItem === parent.index) {
          // NO Operation
        } else {
          let dataObject = globalData[item.UUID]
          if (dataObject.type == "folder") {
            MedDataObject.move(dataObject, globalData[target.targetItem], globalData, setGlobalData)
            MedDataObject.updateWorkspaceDataObject()
          } else {
            MedDataObject.move(dataObject, globalData[target.targetItem], globalData, setGlobalData)
            MedDataObject.updateWorkspaceDataObject()
          }
        }
      } else {
        if (target.parentItem === item.index) {
          // Trying to drop inside itself
          return
        }
        let dataObject = globalData[item.UUID]
        if (target.parentItem === dataObject.parentID) {
          // NO Operation
        } else {
          MedDataObject.move(dataObject, globalData[target.parentItem], globalData, setGlobalData)
          MedDataObject.updateWorkspaceDataObject()
        }
      }
    }
  }

  /**
   * This function renames a `MedDataObject` in the workspace.
   * @param {Object} medObject - The `MedDataObject` to rename
   * @param {string} newName - The new name of the `MedDataObject`
   * @returns {void}
   * @note - This function is called when the user renames a file or folder in the directory tree, either by F2 or by right-clicking and selecting "Rename".
   */
  function handleNameChange(medObject, newName) {
    const namesYouCantRename = ["UUID_ROOT", "DATA", "EXPERIMENTS"]
    if (newName == "") {
      toast.error("Error: Name cannot be empty")
      return
    } else if (medObject.name == newName) {
      toast.error("Error: You really wanted to rename to the same name?")
      return
    } else if (boolNameInArray(newName, namesYouCantRename)) {
      toast.error("Error: This name is reserved and cannot be used")
      return
    } else if (boolNameInArray(medObject.name, namesYouCantRename)) {
      console
      toast.error("Error: This name cannot be changed")
      return
    } else if (boolNameInArray(newName, Object.keys(globalData))) {
      toast.error("Error: This name is already used")
      return
    } else {
      // Check if the new name is the same as the current name.
      // Get the UUID of the `MedDataObject` with the current name from the `globalData` object.
      let dataObject = globalData[medObject.UUID]
      let uuid = medObject.UUID
      // Rename the `MedDataObject` with the new name and update the `globalData` object.
      let renamedDataObject = MedDataObject.rename(dataObject, newName, globalData)
      let globalDataCopy = { ...globalData }
      globalDataCopy[uuid] = renamedDataObject
      setGlobalData(globalDataCopy)
      MedDataObject.updateWorkspaceDataObject()
    }
  }

  function boolNameInArray(name, array) {
    let nameInArray = false
    array.includes(name) ? (nameInArray = true) : (nameInArray = false)
    return nameInArray
  }

  /**
   * This function creates a new folder in the workspace with the name "New Folder" and the parent folder being the selected folder.
   * The button that triggers this function is only visible if the accordion is not collapsed.
   * @param {Array} selectedItems - The array of selected items in the directory tree
   * @returns {void}
   */
  function createFolder(selectedItems) {
    let selectedItem = selectedItems[0]
    let selectedItemObject = globalData[selectedItem]
    let parentObject = undefined
    if (selectedItemObject !== undefined && selectedItemObject.type !== undefined) {
      if (selectedItemObject.type == "folder") {
        parentObject = selectedItemObject
      } else {
        parentObject = globalData[selectedItemObject.parentID]
      }

      MedDataObject.createEmptyFolderFS("New Folder", parentObject.path)
      MedDataObject.updateWorkspaceDataObject()
      tree.current.expandItem(parentObject.getUUID()) // We expand the parent folder so that we see the new folder
    } else {
      toast.error("Error: Please select a folder")
    }
  }

  /**
   * This function reorders the array of folders and files so that the folders are first and the files are last.
   * @param {Array} array - The array of folders and files
   * @param {Object} dataContextObject - The data context object
   * @returns {Array} - The reordered array of folders and files
   */
  function reorderArrayOfFoldersAndFiles(array, dataContextObject) {
    let folders = []
    let files = []
    array.forEach((item) => {
      if (dataContextObject[item] !== undefined) {
        if (!dataContextObject[item].name.startsWith(".") || showHiddenFiles) {
          if (dataContextObject[item].type == "folder") {
            folders.push(item)
          } else {
            files.push(item)
          }
        }
      }
    })
    return folders.concat(files)
  }

  /**
   * This function converts the data context object to a tree object that can be used by the directory tree component.
   * @param {Object} medDataContext - The data context object
   * @returns {Object} - The tree object
   */
  function fromJSONtoTree(medDataContext) {
    const treeToSend = {}
    const namesYouCantRename = ["UUID_ROOT", "DATA", "EXPERIMENTS", ".medomics"] // These names cannot be renamed

    Object.keys(medDataContext).forEach((key) => {
      let medDataItem = medDataContext[key]
      let medDataItemName = medDataItem.name
      if (showHiddenFiles == false) {
        // Check if the name starts with a dot
        let nameStartsWithDot = medDataItemName.startsWith(".")
        let parentNameStartsWithDot = false
        if (medDataItem.parentID !== undefined) {
          let parentID = medDataItem.parentID
          let parentObject = medDataContext[parentID]
          if (parentObject !== undefined) {
            let parentName = parentObject.name
            parentNameStartsWithDot = parentName.startsWith(".")
          }
        }
        if (nameStartsWithDot || parentNameStartsWithDot) {
          return
        }
      }
      if (medDataItem !== undefined && medDataItem.type !== undefined) {
        let itemIsFolder = medDataItem.type === "folder"
        let ableToRename = !boolNameInArray(medDataItemName, namesYouCantRename)
        let treeItem = {
          index: key,
          isFolder: itemIsFolder,
          UUID: key,
          name: medDataItemName,
          type: medDataItem.extension,
          path: medDataItem.path,
          acceptedFiles: medDataItem.acceptedFileTypes,
          children: medDataItem.childrenIDs ? reorderArrayOfFoldersAndFiles(medDataItem.childrenIDs, medDataContext) : [],
          data: medDataItemName,
          canRename: ableToRename,
          canMove: ableToRename
        }
        treeToSend[key] = treeItem
        if (medDataItem.parentID && medDataItem.parentID.length == 0) {
          treeToSend.root.children.push(key)
        }
      }
    })

    return treeToSend
  }

  /**
   * This function handles the blur event on the selected items.
   * @param {Object} event - The blur event
   * @returns {void}
   */
  function handleSelectedItemsBlur(event) {
    if (!evaluateIfTargetIsAChild(event, "directory-tree-container")) {
      setSelectedItems([])
    }
  }

  /**
   * Add event listener to handle if the user clicks outside the directory tree and, if so, deselect the selected items.
   */
  useEffect(() => {
    document.addEventListener("click", handleSelectedItemsBlur)
    return () => {
      document.removeEventListener("click", handleSelectedItemsBlur)
    }
  }, [])

  /**
   * This useEffect hook updates the directory tree when the global data changes.
   */
  useEffect(() => {
    if (globalData) {
      let newTree = fromJSONtoTree({ ...globalData })
      setDirTree(newTree)
    }
  }, [globalData, showHiddenFiles])

  const delayOptions = { showDelay: 750, hideDelay: 0 }

  /**
   * Function to evaluate if the target of an event is a child of a given id
   * @param {Object} event - The event
   * @param {string} id - The id of the parent
   * @returns {boolean} - True if the target is a child of the given id, false otherwise
   */
  function evaluateIfTargetIsAChild(event, id) {
    let target = event.target
    let parent = target.parentElement
    let isChild = false
    while (parent !== null) {
      if (parent.id === id) {
        isChild = true
        break
      }
      parent = parent.parentElement
    }
    return isChild
  }

  return (
    <>
      <div id="directory-tree-container" className="directory-tree-container">
        <Tooltip className="tooltip-small" target=".add-folder-icon" {...delayOptions} />
        <Tooltip className="tooltip-small" target=".refresh-icon" {...delayOptions} />
        <Tooltip className="tooltip-small" target=".context-menu-icon" {...delayOptions} />
        <Accordion.Item eventKey="dirTree">
          <Accordion.Header onClick={() => MedDataObject.updateWorkspaceDataObject()}>
            <Stack direction="horizontal" style={{ flexGrow: "1" }}>
              <p>
                <strong>WORKSPACE</strong>
              </p>
              <div style={{ flexGrow: "5" }} />

              {
                isAccordionShowing && (
                  <>
                    <a
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        createFolder(selectedItems)
                      }}
                    >
                      <FolderPlus size={"1rem"} className="context-menu-icon add-folder-icon" data-pr-at="right bottom" data-pr-tooltip="New Folder" data-pr-my="left top" />
                    </a>
                    <a
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        MedDataObject.updateWorkspaceDataObject()
                      }}
                    >
                      <ArrowClockwise size={"1rem"} className="context-menu-icon refresh-icon" data-pr-at="right bottom" data-pr-tooltip="Refresh" data-pr-my="left top" />
                    </a>
                    <a
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setShowHiddenFiles(!showHiddenFiles)
                      }}
                    >
                      {showHiddenFiles && <EyeFill size={"1rem"} className="context-menu-icon refresh-icon" data-pr-at="right bottom" data-pr-tooltip="Hide hidden files" data-pr-my="left top" />}
                      {!showHiddenFiles && (
                        <EyeSlashFill size={"1rem"} className="context-menu-icon refresh-icon" data-pr-at="right bottom" data-pr-tooltip="Show hidden files" data-pr-my="left top" />
                      )}
                    </a>
                  </>
                ) /* We display the add folder icon only if the mouse is hovering the directory tree and if the accordion is not collapsed*/
              }
            </Stack>
          </Accordion.Header>
          <Accordion.Body className="sidebar-acc-body" onEnter={() => setIsAccordionShowing(true)} onExit={() => setIsAccordionShowing(false)}>
            <div className="directory-tree" onMouseEnter={() => setIsHovering(true)} onMouseLeave={() => setIsHovering(false)}>
              <ControlledTreeEnvironment
                ref={environment}
                items={dirTree}
                renderItem={(json) =>
                  renderItem(json, {
                    show,
                    MENU_ID,
                    displayMenu,
                    isHovering,
                    onDBClickItem,
                    setSelectedItems,
                    setIsDropping,
                    isDropping
                  })
                }
                getItemTitle={(item) => item.data}
                viewState={{
                  ["tree-2"]: {
                    focusedItem,
                    expandedItems,
                    selectedItems
                  }
                }}
                onFocusItem={(item) => setFocusedItem(item.index)}
                onExpandItem={(item) => setExpandedItems([...expandedItems, item.index])}
                onCollapseItem={(item) => setExpandedItems(expandedItems.filter((expandedItemIndex) => expandedItemIndex !== item.index))}
                onSelectItems={(items) => setSelectedItems(items)}
                canReorderItems={true}
                canDropOnFolder={true}
                canRename={true}
                canDragAndDrop={true}
                onRenameItem={handleNameChange}
                onDrop={onDrop}
                isHovering={isHovering}
              >
                <Tree treeId="tree-2" rootItem="UUID_ROOT" treeLabel="Tree Example" ref={tree} />
              </ControlledTreeEnvironment>
            </div>
          </Accordion.Body>
        </Accordion.Item>

        <Menu id={"MENU_JSON"}>
          <Submenu
            className="context-submenu"
            label={
              <>
                <BoxArrowUpRight size={"1rem"} className="context-menu-icon" />
                Open in...
              </>
            }
          >
            <Item id="openInJSONViewer" onClick={handleContextMenuAction}>
              JSON Viewer (default)
            </Item>
            <Item id="openInDataTableViewer" onClick={handleContextMenuAction}>
              DataTable Viewer
            </Item>
            <Item id="openInDtale" onClick={handleContextMenuAction}>
              D-Tale
            </Item>
            <Item id="openInPandasProfiling" onClick={handleContextMenuAction}>
              PandasProfiling
            </Item>
          </Submenu>
          <Item id="revealInFileExplorer" onClick={handleContextMenuAction}>
            {/* <BoxArrowUpRight size={"1rem"} className="context-menu-icon" /> */}
            Reveal in File Explorer
          </Item>
          <Item id="rename" onClick={handleContextMenuAction}>
            <Eraser size={"1rem"} className="context-menu-icon" />
            Rename
          </Item>
          <Item id="delete" onClick={handleContextMenuAction}>
            <Trash size={"1rem"} className="context-menu-icon" />
            Delete
          </Item>
        </Menu>
        <Menu id={"MENU_DATA"}>
          <Submenu
            className="context-submenu"
            label={
              <>
                <BoxArrowUpRight size={"1rem"} className="context-menu-icon" />
                Open in...
              </>
            }
          >
            <Item id="openInDataTableViewer" onClick={handleContextMenuAction}>
              DataTable Viewer (default)
            </Item>
            <Item id="openInDtale" onClick={handleContextMenuAction}>
              D-Tale
            </Item>
            <Item id="openInPandasProfiling" onClick={handleContextMenuAction}>
              PandasProfiling
            </Item>
          </Submenu>
          <Item id="revealInFileExplorer" onClick={handleContextMenuAction}>
            {/* <BoxArrowUpRight size={"1rem"} className="context-menu-icon" /> */}
            Reveal in File Explorer
          </Item>
          <Item id="rename" onClick={handleContextMenuAction}>
            <Eraser size={"1rem"} className="context-menu-icon" />
            Rename
          </Item>
          <Item id="delete" onClick={handleContextMenuAction}>
            <Trash size={"1rem"} className="context-menu-icon" />
            Delete
          </Item>
        </Menu>

        <Menu id={"MENU_MEDML"}>
          <Submenu
            className="context-submenu"
            label={
              <>
                <BoxArrowUpRight size={"1rem"} className="context-menu-icon" />
                Open in...
              </>
            }
          >
            <Item id="openLearningModule" onClick={handleContextMenuAction}>
              Learning module (default)
            </Item>
          </Submenu>
          <Item id="revealInFileExplorer" onClick={handleContextMenuAction}>
            {/* <BoxArrowUpRight size={"1rem"} className="context-menu-icon" /> */}
            Reveal in File Explorer
          </Item>
          <Item id="rename" onClick={handleContextMenuAction}>
            <Eraser size={"1rem"} className="context-menu-icon" />
            Rename
          </Item>
          <Item id="delete" onClick={handleContextMenuAction}>
            <Trash size={"1rem"} className="context-menu-icon" />
            Delete
          </Item>
        </Menu>

        <Menu id="MENU_FOLDER">
          <Item id="revealInFileExplorer" onClick={handleContextMenuAction}>
            {/* <BoxArrowUpRight size={"1rem"} className="context-menu-icon" /> */}
            Reveal in File Explorer
          </Item>
          <Item id="rename" onClick={handleContextMenuAction}>
            <Eraser size={"1rem"} className="context-menu-icon" />
            Rename
          </Item>
          <Item id="delete" onClick={handleContextMenuAction}>
            <Trash size={"1rem"} className="context-menu-icon" />
            Delete
          </Item>
        </Menu>

        <Menu id="MENU_CODE">
          <Submenu
            className="context-submenu"
            label={
              <>
                <BoxArrowUpRight size={"1rem"} className="context-menu-icon" />
                Open in...
              </>
            }
          >
            <Item id="openInCodeEditor" onClick={handleContextMenuAction}>
              Code editor (default)
            </Item>
            <Item
              id="openInJupyter"
              onClick={() => {
                console.log("OPEN IN JUPYTER")
              }}
            >
              Jupyter Notebook
            </Item>
            <Item id="openInVSCode" onClick={() => require("electron").shell.openPath(globalData[selectedItems[0]].path)}>
              {/* <BoxArrowUpRight size={"1rem"} className="context-menu-icon" /> */}
              VSCode
            </Item>
          </Submenu>
          <Item id="revealInFileExplorer" onClick={handleContextMenuAction}>
            {/* <BoxArrowUpRight size={"1rem"} className="context-menu-icon" /> */}
            Reveal in File Explorer
          </Item>
          <Item id="rename" onClick={handleContextMenuAction}>
            <Eraser size={"1rem"} className="context-menu-icon" />
            Rename
          </Item>
          <Item id="delete" onClick={handleContextMenuAction}>
            <Trash size={"1rem"} className="context-menu-icon" />
            Delete
          </Item>
        </Menu>

        <Menu id="MENU_IMAGE">
          <Submenu
            className="context-submenu"
            label={
              <>
                <BoxArrowUpRight size={"1rem"} className="context-menu-icon" />
                Open in...
              </>
            }
          >
            <Item id="openInImageViewer" onClick={handleContextMenuAction}>
              Image viewer (default)
            </Item>
          </Submenu>
          <Item id="revealInFileExplorer" onClick={handleContextMenuAction}>
            {/* <BoxArrowUpRight size={"1rem"} className="context-menu-icon" /> */}
            Reveal in File Explorer
          </Item>
          <Item id="rename" onClick={handleContextMenuAction}>
            <Eraser size={"1rem"} className="context-menu-icon" />
            Rename
          </Item>
          <Item id="delete" onClick={handleContextMenuAction}>
            <Trash size={"1rem"} className="context-menu-icon" />
            Delete
          </Item>
        </Menu>

        <Menu id="MENU_PDF">
          <Submenu
            className="context-submenu"
            label={
              <>
                <BoxArrowUpRight size={"1rem"} className="context-menu-icon" />
                Open in...
              </>
            }
          >
            <Item id="openInPDFViewer" onClick={handleContextMenuAction}>
              PDF viewer (default)
            </Item>
          </Submenu>
          <Item id="revealInFileExplorer" onClick={handleContextMenuAction}>
            {/* <BoxArrowUpRight size={"1rem"} className="context-menu-icon" /> */}
            Reveal in File Explorer
          </Item>
          <Item id="rename" onClick={handleContextMenuAction}>
            <Eraser size={"1rem"} className="context-menu-icon" />
            Rename
          </Item>
          <Item id="delete" onClick={handleContextMenuAction}>
            <Trash size={"1rem"} className="context-menu-icon" />
            Delete
          </Item>
        </Menu>

        <Menu id="MENU_TEXT">
          <Submenu
            className="context-submenu"
            label={
              <>
                <BoxArrowUpRight size={"1rem"} className="context-menu-icon" />
                Open in...
              </>
            }
          >
            <Item>Text editor (default)</Item>
          </Submenu>
          <Item id="revealInFileExplorer" onClick={handleContextMenuAction}>
            {/* <BoxArrowUpRight size={"1rem"} className="context-menu-icon" /> */}
            Reveal in File Explorer
          </Item>
          <Item id="rename" onClick={handleContextMenuAction}>
            <Eraser size={"1rem"} className="context-menu-icon" />
            Rename
          </Item>
          <Item id="delete" onClick={handleContextMenuAction}>
            <Trash size={"1rem"} className="context-menu-icon" />
            Delete
          </Item>
        </Menu>

        <Menu id="MENU_MODEL">
          <Submenu
            className="context-submenu"
            label={
              <>
                <BoxArrowUpRight size={"1rem"} className="context-menu-icon" />
                Open in...
              </>
            }
          >
            <Item id="openInModelViewer" onClick={handleContextMenuAction}>
              Model viewer (default)
            </Item>
            <Item id="openInEvaluationModule" onClick={handleContextMenuAction}>
              Evaluation Module
            </Item>
            <Item id="openInApplicationModule" onClick={handleContextMenuAction}>
              Application Module
            </Item>
          </Submenu>
          <Item id="revealInFileExplorer" onClick={handleContextMenuAction}>
            {/* <BoxArrowUpRight size={"1rem"} className="context-menu-icon" /> */}
            Reveal in File Explorer
          </Item>
          <Item id="rename" onClick={handleContextMenuAction}>
            <Eraser size={"1rem"} className="context-menu-icon" />
            Rename
          </Item>
          <Item id="delete" onClick={handleContextMenuAction}>
            <Trash size={"1rem"} className="context-menu-icon" />
            Delete
          </Item>
        </Menu>

        <Menu id="MENU_DEFAULT">
          <Item id="revealInFileExplorer" onClick={handleContextMenuAction}>
            {/* <BoxArrowUpRight size={"1rem"} className="context-menu-icon" /> */}
            Reveal in File Explorer
          </Item>
          <Item id="rename" onClick={handleContextMenuAction}>
            <Eraser size={"1rem"} className="context-menu-icon" />
            Rename
          </Item>
          <Item id="delete" onClick={handleContextMenuAction}>
            <Trash size={"1rem"} className="context-menu-icon" />
            Delete
          </Item>
        </Menu>
      </div>
    </>
  )
}

export default SidebarDirectoryTreeControlled
