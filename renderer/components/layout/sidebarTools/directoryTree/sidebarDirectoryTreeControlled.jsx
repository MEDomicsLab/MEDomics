/* eslint-disable no-undef */
import React, { useContext, useRef, useState, useEffect } from "react"
import { Trash, BoxArrowUpRight, Eraser, FolderPlus, ArrowClockwise, EyeFill, EyeSlashFill, ArrowRepeat } from "react-bootstrap-icons"
import { FiFolder } from "react-icons/fi"
import { Accordion, Stack } from "react-bootstrap"
import { ControlledTreeEnvironment, Tree } from "react-complex-tree"
import { DataContext } from "../../../workspace/dataContext"
import { toast } from "react-toastify"
import { LayoutModelContext } from "../../layoutContext"
import { useContextMenu, Menu, Item, Submenu } from "react-contexify"
import renderItem from "./renderItem"
import { Tooltip } from "primereact/tooltip"
import { WorkspaceContext } from "../../../workspace/workspaceContext"
import { rename, onPaste, onDeleteSequentially, onDrop, createFolder, fromJSONtoTree, evaluateIfTargetIsAChild } from "./utils"
import { MEDDataObject } from "../../../workspace/NewMedDataObject"
import { PiImage, PiNotebook, PiPen } from "react-icons/pi"

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
  const { exec } = require("child_process")

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
  const [isDialogShowing, setIsDialogShowing] = useState(false) // This state is used to know if the dialog is showing or not
  const [dirTree, setDirTree] = useState({}) // We get the directory tree from the workspace
  const [isDropping, setIsDropping] = useState(false) // Set if the item is getting dropped something in (for elements outside of the tree)
  const [isDirectoryTreeFocused, setIsDirectoryTreeFocused] = useState(false); // New state to track focus

  const { globalData, setGlobalData } = useContext(DataContext) // We get the global data from the context to retrieve the directory tree of the workspace, thus retrieving the data files
  const { dispatchLayout, developerMode, isEditorOpen } = useContext(LayoutModelContext)
  const { workspace } = useContext(WorkspaceContext)

  const delayOptions = { showDelay: 750, hideDelay: 0 }

  /**
   * This useEffect hook updates the directory tree when the global data changes.
   */
  useEffect(() => {
    if (globalData) {
      let newTree = fromJSONtoTree({ ...globalData })
      setDirTree(newTree)
      console.log("NEW TREE", newTree)
      console.log("REF", environment.current, tree.current)
    }
  }, [globalData, showHiddenFiles])

  useEffect(() => {
    setExternalSelectedItems && setExternalSelectedItems(selectedItems)
  }, [selectedItems])

  
  /**
   * This useEffect hook sets the external double click item when the double click item changes.
   */
  useEffect(() => {
    if (setExternalDBClick) {
      setExternalDBClick(dbClickedItem)
    }
  }, [dbClickedItem])

  /**
   * This function handles the key press event. It is attached to the document.
   * @param {Object} event - The key press event
   * @returns {void}
   * @note - This function is called when the user presses a key.
   */
  const handleKeyPress = (event) => {
    if (event.key === "Delete" && tree.current.isRenaming === false) {
      if (selectedItems.length > 0) {
        onDeleteSequentially(globalData, workspace.workingDirectory.path, setIsDialogShowing, selectedItems)
      }
    } else if (event.code === "KeyC" && event.ctrlKey) {
      setCopiedItems(selectedItems)
    } else if (event.code === "KeyX" && event.ctrlKey) {
      setCutItems(selectedItems)
    } else if (event.code === "KeyV" && event.ctrlKey) {
      if (copiedItems.length > 0) {
        copiedItems.forEach((item) => {
          onPaste(globalData, item, selectedItems[0])
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
        copiedItems.forEach((item) => {
          onPaste(globalData, item, selectedItems[0])
        })
      }
    } else if (event.code === "KeyH" && event.metaKey) {
      setShowHiddenFiles(!showHiddenFiles)
    }
    // For mac, add Enter key to rename
    // If os is mac and enter key is pressed
    if (navigator.platform.indexOf("Mac") > -1) {
      if (event.code === "Enter" && !isDialogShowing && isDirectoryTreeFocused) {
        // We check if the dialog is showing to avoid renaming when the user is in the process of deleting a file
        if (tree.current !== undefined) {
          if (tree.current.isRenaming) {
            tree.current.completeRenamingItem()
          } else {
            event.preventDefault()
            event.stopPropagation()
            if (selectedItems.length === 1) {
              tree.current.startRenamingItem(selectedItems[0])
            }
          }
        }
      } else if (event.code === "Backspace" && event.metaKey) {
        if (selectedItems.length > 0) {
          onDeleteSequentially(globalData, workspace.workingDirectory.path, setIsDialogShowing, selectedItems)
        }
      }
    }
  }

  /**
   * This useEffect hook attaches an event listener to the document to listen for key presses.
   */
  useEffect(() => {
    if(isEditorOpen) {
      return
    }
    // attach the event listener
    document.addEventListener("keydown", handleKeyPress)
    // remove the event listener
    return () => {
      document.removeEventListener("keydown", handleKeyPress)
    }
  }, [handleKeyPress])

  /**
   * @description This function renames a `MedDataObject` in the workspace.
   * @param {string} id - The ID of the `MedDataObject` to rename
   * @returns {void}
   * @note this function is useful to rename
   */
  function onRename(id) {
    setSelectedItems([id])
    tree.current.startRenamingItem(id)
  }

  /**
   * @description Handles name change in the directory tree
   * @param {TreeItem} item
   * @param {String} newName
   */
  function handleNameChange(item, newName) {
    if (isEditorOpen) {
      toast.error("Please close the editor before renaming")
      return
    }
    rename(globalData, workspace.workingDirectory.path, item, newName)
  }

  /**
   * This function opens a `MedDataObject` in the workspace.
   * @param {string} id - The ID of the `MedDataObject` to open
   * @returns {void}
   * @note - This function is called when the user double-clicks on a file or folder in the directory tree, or when the user right-clicks and selects "Open".
   * @todo - This function should open the file in the default application.
   * @README - This function is not implemented yet.
   */
  function onOpen(id) {
    let dataObjectID = id
    // eslint-disable-next-line no-unused-vars
    let path = globalData[dataObjectID].path
    // NOOP
  }

  /**
   * This function handles the context menu action. It is passed to the render item function to be called when the user clicks on a context menu action.
   * @param {Object} param0 - The context menu action object
   *  @param {string} param0.id - The id of the context menu action
   *  @param {Object} param0.props - The props of the context menu action
   */
  async function handleContextMenuAction({ id, props }) {
    if (developerMode) {
      switch (id) {
        case "openInDataTableFromDBViewer":
          dispatchLayout({ type: "openInDataTableFromDBViewer", payload: props })
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
          onOpen(props.index)
          break
        case "sync":
          MEDDataObject.sync(globalData, props.index, workspace.workingDirectory.path)
          MEDDataObject.updateWorkspaceDataObject()
          break
        case "rename":
          onRename(props.index)
          break
        case "delete":
          onDeleteSequentially(globalData, workspace.workingDirectory.path, setIsDialogShowing, [props.index])
          break
        case "rmFromWs":
          MEDDataObject.deleteObjectAndChildrenFromWorkspace(globalData, props.index, workspace.workingDirectory.path)
          break
        case "revealInFileExplorer":
          if (globalData[props.index]) {
            if (globalData[props.index].path) {
              // eslint-disable-next-line no-undef
              require("electron").shell.showItemInFolder(globalData[props.index].path)
            } else {
              toast.error("Error: No path found. The item is not saved locally")
            }
          } else {
            toast.error("Error: No item selected")
          }
          break
        default:
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
  const onDBClickItem = async (event, item) => {
    if (developerMode) {
      console.log("item", item)
      if (item.type == "medml") {
        dispatchLayout({ type: "openInLearningModule", payload: item })
      } else if (item.type == "medimg") {
        dispatchLayout({ type: "openInExtractionMEDimageModule", payload: item })
      } else if (item.type == "medeval") {
        dispatchLayout({ type: "openInEvaluationModule", payload: item })
      } else if (item.type == "csv" || item.type == "tsv" || item.type == "xlsx" || item.type == "view") {
        dispatchLayout({ type: "openInDataTableFromDBViewer", payload: item })
      } else if (item.type == "py" || item.type == "json" || item.type == "txt" || item.type == "md") {
        dispatchLayout({ type: "openInCodeEditor", payload: item })
      } else if (item.type == "png" || item.type == "jpg" || item.type == "jpeg" || item.type == "gif" || item.type == "svg") {
        dispatchLayout({ type: "openInImageViewer", payload: item })
      } else if (item.type == "pdf") {
        dispatchLayout({ type: "openInPDFViewer", payload: item })
      } else if (item.type == "html") {
        dispatchLayout({ type: "openHtmlViewer", payload: item })
      } else if (item.type == "medmodel") {
        dispatchLayout({ type: "openInModelViewer", payload: item })
      } else {
        console.log("DBCLICKED", event, item)
      }
      setDbClickedItem(item)
    } else {
      toast.error("Error: Developer mode is enabled")
    }
  }

  /**
   * This function displays the context menu.
   * @param {Object} e - The event
   * @param {Object} data - The data object
   * @returns {void}
   */
  function displayMenu(e, data) {
    console.log("DISPLAY MENU", e, data)
    setSelectedItems([data.index])
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
    } else if (data.type == "csv" || data.type == "tsv" || data.type == "xlsx" || data.type == "view") {
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
    } else if (data.type == "py") {
      show({
        id: "MENU_CODE",
        event: e,
        props: data
      })
    } else if (data.type == "ipynb") {
      show({
        id: "MENU_JUPYTER",
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
    } else if (data.type == "txt" || data.type == "md") {
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
   * This function opens a given file in visual code studio.
   * @param {string} filePath - The file path to open
   * @returns {void}
   */
  function openInVSCode(filePath) {
    exec(`code "${filePath}"`, (error, stdout, stderr) => {
      if (error) {
        console.error(`exec error: ${error}`)
        toast.error("Error: Could not open in Visual Studio Code")
        return
      }
      console.log(`stdout: ${stdout}`)
      if (stderr) {
        console.error(`stderr: ${stderr}`)
      }
    })
  }

  function handleDragStart(event) {
    console.log("Drag started", event)
  }

  /**
   * Add event listener to handle if the user clicks outside the directory tree and, if so, deselect the selected items.
   */
  useEffect(() => {
    document.addEventListener("click", handleSelectedItemsBlur)
    document.addEventListener("onDragStart", handleDragStart)
    return () => {
      document.removeEventListener("click", handleSelectedItemsBlur)
      document.removeEventListener("onDragStart", handleDragStart)
    }
  }, [])

  return (
    <>
      <div id="directory-tree-container" className="directory-tree-container">
        <Tooltip className="tooltip-small" target=".add-folder-icon" {...delayOptions} />
        <Tooltip className="tooltip-small" target=".refresh-icon" {...delayOptions} />
        <Tooltip className="tooltip-small" target=".context-menu-icon" {...delayOptions} />
        <Accordion.Item eventKey="dirTree">
          <Accordion.Header /* onClick={() => MedDataObject.updateWorkspaceDataObject()} */>
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
                        createFolder(globalData, selectedItems, workspace.workingDirectory.path)
                      }}
                    >
                      <FolderPlus size={"1rem"} className="context-menu-icon add-folder-icon" data-pr-at="right bottom" data-pr-tooltip="New Folder" data-pr-my="left top" />
                    </a>
                    <a
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        MEDDataObject.updateWorkspaceDataObject()
                        MEDDataObject.verifyLockedObjects(globalData)
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
            <div className="directory-tree" onMouseEnter={() => setIsHovering(true)} onMouseLeave={() => setIsHovering(false)} onFocus={() => setIsDirectoryTreeFocused(true)} onBlur={() => setIsDirectoryTreeFocused(false)}>
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
                    isDropping,
                    dirTree
                  })
                }
                getItemTitle={(item) => item ? item.data : ""}
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
                onSelectItems={(items) => {
                  console.log("onSelectItems", items)
                  setSelectedItems(items)
                }}
                canReorderItems={false}
                canDropOnFolder={true}
                canDropOnNonFolder={false}
                canRename={true}
                canDragAndDrop={true}
                onRenameItem={handleNameChange}
                onDrop={(items, target) => {
                  onDrop(items, target, tree.current, globalData, setGlobalData, workspace.workingDirectory.path, setIsDropping)
                }}
                isHovering={isHovering}
              >
                <Tree treeId="tree-2" rootItem="ROOT" treeLabel="Tree Example" ref={tree} />
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
            <Item id="openInCodeEditor" onClick={handleContextMenuAction}>
              Code editor (default)
            </Item>
            <Item id="openInDataTableFromDBViewer" onClick={handleContextMenuAction}>
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
            <FiFolder size={"1rem"} className="context-menu-icon" />
            Reveal in File Explorer
          </Item>
          <Item id="sync" onClick={handleContextMenuAction}>
            <ArrowRepeat size={"1rem"} className="context-menu-icon" />
            Sync
          </Item>
          <Item id="rename" onClick={handleContextMenuAction}>
            <Eraser size={"1rem"} className="context-menu-icon" />
            Rename
          </Item>
          <Item id="delete" onClick={handleContextMenuAction}>
            <Trash size={"1rem"} className="context-menu-icon" />
            Delete
          </Item>
          <Item id="rmFromWs" onClick={handleContextMenuAction}>
            <Trash size={"1rem"} className="context-menu-icon" />
            Remove from Workspace
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
            <Item id="openInDataTableFromDBViewer" onClick={handleContextMenuAction}>
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
            <FiFolder size={"1rem"} className="context-menu-icon" />
            Reveal in File Explorer
          </Item>
          <Item id="sync" onClick={handleContextMenuAction}>
            <ArrowRepeat size={"1rem"} className="context-menu-icon" />
            Sync
          </Item>
          <Item id="rename" onClick={handleContextMenuAction}>
            <Eraser size={"1rem"} className="context-menu-icon" />
            Rename
          </Item>
          <Item id="delete" onClick={handleContextMenuAction}>
            <Trash size={"1rem"} className="context-menu-icon" />
            Delete
          </Item>
          <Item id="rmFromWs" onClick={handleContextMenuAction}>
            <Trash size={"1rem"} className="context-menu-icon" />
            Remove from Workspace
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
            <FiFolder size={"1rem"} className="context-menu-icon" />
            Reveal in File Explorer
          </Item>
          <Item id="sync" onClick={handleContextMenuAction}>
            <ArrowRepeat size={"1rem"} className="context-menu-icon" />
            Sync
          </Item>
          <Item id="rename" onClick={handleContextMenuAction}>
            <Eraser size={"1rem"} className="context-menu-icon" />
            Rename
          </Item>
          <Item id="delete" onClick={handleContextMenuAction}>
            <Trash size={"1rem"} className="context-menu-icon" />
            Delete
          </Item>
          <Item id="rmFromWs" onClick={handleContextMenuAction}>
            <Trash size={"1rem"} className="context-menu-icon" />
            Remove from Workspace
          </Item>
        </Menu>

        <Menu id="MENU_FOLDER">
          <Item id="revealInFileExplorer" onClick={handleContextMenuAction}>
            <FiFolder size={"1rem"} className="context-menu-icon" />
            Reveal in File Explorer
          </Item>
          <Item id="sync" onClick={handleContextMenuAction}>
            <ArrowRepeat size={"1rem"} className="context-menu-icon" />
            Sync
          </Item>
          <Item id="rename" onClick={handleContextMenuAction}>
            <Eraser size={"1rem"} className="context-menu-icon" />
            Rename
          </Item>
          <Item id="delete" onClick={handleContextMenuAction}>
            <Trash size={"1rem"} className="context-menu-icon" />
            Delete
          </Item>
          <Item id="rmFromWs" onClick={handleContextMenuAction}>
            <Trash size={"1rem"} className="context-menu-icon" />
            Remove from Workspace
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
              <PiPen size={"1rem"} className="context-menu-icon" />
              Code editor (default)
            </Item>
            <Item
              id="openInJupyter"
              onClick={() => {
                console.log("OPEN IN JUPYTER")
              }}
            >
              <PiNotebook size={"1rem"} className="context-menu-icon" />
              Jupyter Notebook
            </Item>
            <Item id="openInVSCode" onClick={() => openInVSCode(globalData[selectedItems[0]].path)}>
              <FiFolder size={"1rem"} className="context-menu-icon" />
              VSCode
            </Item>
          </Submenu>
          <Item id="revealInFileExplorer" onClick={handleContextMenuAction}>
            <FiFolder size={"1rem"} className="context-menu-icon" />
            Reveal in File Explorer
          </Item>
          <Item id="sync" onClick={handleContextMenuAction}>
            <ArrowRepeat size={"1rem"} className="context-menu-icon" />
            Sync
          </Item>
          <Item id="rename" onClick={handleContextMenuAction}>
            <Eraser size={"1rem"} className="context-menu-icon" />
            Rename
          </Item>
          <Item id="delete" onClick={handleContextMenuAction}>
            <Trash size={"1rem"} className="context-menu-icon" />
            Delete
          </Item>
          <Item id="rmFromWs" onClick={handleContextMenuAction}>
            <Trash size={"1rem"} className="context-menu-icon" />
            Remove from Workspace
          </Item>
        </Menu>

        <Menu id="MENU_JUPYTER">
          <Submenu
            className="context-submenu"
            label={
              <>
                <BoxArrowUpRight size={"1rem"} className="context-menu-icon" />
                Open in...
              </>
            }
          >
            <Item
              id="openInJupyter"
              onClick={() => {
                console.log("OPEN IN JUPYTER")
              }}
            >
              <PiNotebook size={"1rem"} className="context-menu-icon" />
              Jupyter Notebook
            </Item>
            <Item id="openInVSCode" onClick={() => openInVSCode(globalData[selectedItems[0]].path)}>
              <FiFolder size={"1rem"} className="context-menu-icon" />
              VSCode
            </Item>
          </Submenu>
          <Item id="revealInFileExplorer" onClick={handleContextMenuAction}>
            <FiFolder size={"1rem"} className="context-menu-icon" />
            Reveal in File Explorer
          </Item>
          <Item id="sync" onClick={handleContextMenuAction}>
            <ArrowRepeat size={"1rem"} className="context-menu-icon" />
            Sync
          </Item>
          <Item id="rename" onClick={handleContextMenuAction}>
            <Eraser size={"1rem"} className="context-menu-icon" />
            Rename
          </Item>
          <Item id="delete" onClick={handleContextMenuAction}>
            <Trash size={"1rem"} className="context-menu-icon" />
            Delete
          </Item>
          <Item id="rmFromWs" onClick={handleContextMenuAction}>
            <Trash size={"1rem"} className="context-menu-icon" />
            Remove from Workspace
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
              <PiImage size={"1rem"} className="context-menu-icon" />
              Image viewer (default)
            </Item>
          </Submenu>
          <Item id="revealInFileExplorer" onClick={handleContextMenuAction}>
            <FiFolder size={"1rem"} className="context-menu-icon" />
            Reveal in File Explorer
          </Item>
          <Item id="sync" onClick={handleContextMenuAction}>
            <ArrowRepeat size={"1rem"} className="context-menu-icon" />
            Sync
          </Item>
          <Item id="rename" onClick={handleContextMenuAction}>
            <Eraser size={"1rem"} className="context-menu-icon" />
            Rename
          </Item>
          <Item id="delete" onClick={handleContextMenuAction}>
            <Trash size={"1rem"} className="context-menu-icon" />
            Delete
          </Item>
          <Item id="rmFromWs" onClick={handleContextMenuAction}>
            <Trash size={"1rem"} className="context-menu-icon" />
            Remove from Workspace
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
            <FiFolder size={"1rem"} className="context-menu-icon" />
            Reveal in File Explorer
          </Item>
          <Item id="sync" onClick={handleContextMenuAction}>
            <ArrowRepeat size={"1rem"} className="context-menu-icon" />
            Sync
          </Item>
          <Item id="rename" onClick={handleContextMenuAction}>
            <Eraser size={"1rem"} className="context-menu-icon" />
            Rename
          </Item>
          <Item id="delete" onClick={handleContextMenuAction}>
            <Trash size={"1rem"} className="context-menu-icon" />
            Delete
          </Item>
          <Item id="rmFromWs" onClick={handleContextMenuAction}>
            <Trash size={"1rem"} className="context-menu-icon" />
            Remove from Workspace
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
            <Item id="openInCodeEditor" onClick={handleContextMenuAction}>
              <PiPen size={"1rem"} className="context-menu-icon" />
              Text editor (default)
            </Item>
          </Submenu>
          <Item id="revealInFileExplorer" onClick={handleContextMenuAction}>
            <FiFolder size={"1rem"} className="context-menu-icon" />
            Reveal in File Explorer
          </Item>
          <Item id="sync" onClick={handleContextMenuAction}>
            <ArrowRepeat size={"1rem"} className="context-menu-icon" />
            Sync
          </Item>
          <Item id="rename" onClick={handleContextMenuAction}>
            <Eraser size={"1rem"} className="context-menu-icon" />
            Rename
          </Item>
          <Item id="delete" onClick={handleContextMenuAction}>
            <Trash size={"1rem"} className="context-menu-icon" />
            Delete
          </Item>
          <Item id="rmFromWs" onClick={handleContextMenuAction}>
            <Trash size={"1rem"} className="context-menu-icon" />
            Remove from Workspace
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
            <FiFolder size={"1rem"} className="context-menu-icon" />
            Reveal in File Explorer
          </Item>
          <Item id="sync" onClick={handleContextMenuAction}>
            <ArrowRepeat size={"1rem"} className="context-menu-icon" />
            Sync
          </Item>
          <Item id="rename" onClick={handleContextMenuAction}>
            <Eraser size={"1rem"} className="context-menu-icon" />
            Rename
          </Item>
          <Item id="delete" onClick={handleContextMenuAction}>
            <Trash size={"1rem"} className="context-menu-icon" />
            Delete
          </Item>
          <Item id="rmFromWs" onClick={handleContextMenuAction}>
            <Trash size={"1rem"} className="context-menu-icon" />
            Remove from Workspace
          </Item>
        </Menu>

        <Menu id="MENU_DEFAULT">
          <Item id="revealInFileExplorer" onClick={handleContextMenuAction}>
            <FiFolder size={"1rem"} className="context-menu-icon" />
            Reveal in File Explorer
          </Item>
          <Item id="sync" onClick={handleContextMenuAction}>
            <ArrowRepeat size={"1rem"} className="context-menu-icon" />
            Sync
          </Item>
          <Item id="rename" onClick={handleContextMenuAction}>
            <Eraser size={"1rem"} className="context-menu-icon" />
            Rename
          </Item>
          <Item id="delete" onClick={handleContextMenuAction}>
            <Trash size={"1rem"} className="context-menu-icon" />
            Delete
          </Item>
          <Item id="rmFromWs" onClick={handleContextMenuAction}>
            <Trash size={"1rem"} className="context-menu-icon" />
            Remove from Workspace
          </Item>
        </Menu>
      </div>
    </>
  )
}

export default SidebarDirectoryTreeControlled
