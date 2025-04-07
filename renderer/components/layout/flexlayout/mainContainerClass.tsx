/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
/* eslint-disable camelcase */

import {
  Action,
  Actions,
  BorderNode,
  CLASSES,
  DockLocation,
  DragDrop,
  DropInfo,
  IJsonTabNode,
  ILayoutProps,
  ITabRenderValues,
  ITabSetRenderValues,
  Layout,
  Model,
  Node,
  TabNode,
  TabSetNode
} from "flexlayout-react"
import fs from "fs"
import Image from "next/image"
import * as Prism from "prismjs"
import "prismjs/themes/prism-coy.css"
import * as React from "react"
import * as Icons from "react-bootstrap-icons"
import Iframe from "react-iframe"
import { toast } from "react-toastify"
import { getPathSeparator, loadCSVFromPath, loadJSONFromPath, loadJsonPath, loadXLSXFromPath } from "../../../utilities/fileManagementUtils"
import DataTableWrapperBPClass from "../../dataTypeVisualisation/dataTableWrapperBPClass"
import DataTableFromDB from "../../dbComponents/dataTableFromDB"
import InputToolsComponent from "../../dbComponents/InputToolsComponent"
import MEDprofilesViewer from "../../input/MEDprofiles/MEDprofilesViewer"
import ApplicationPage from "../../mainPages/application"
import EvaluationPage from "../../mainPages/evaluation"
import ExploratoryPage from "../../mainPages/exploratory"
import ExtractionImagePage from "../../mainPages/extractionImage"
import ExtractionMEDimagePage from "../../mainPages/extractionMEDimage"
import ExtractionTextPage from "../../mainPages/extractionText"
import ExtractionTSPage from "../../mainPages/extractionTS"
import HomePage from "../../mainPages/home"
import HtmlViewer from "../../mainPages/htmlViewer"
import LearningPage from "../../mainPages/learning"
import MED3paPage from "../../mainPages/med3pa"
import MEDflPage from "../../mainPages/medfl"
import ModelViewer from "../../mainPages/modelViewer"
import ModulePage from "../../mainPages/moduleBasics/modulePage"
import OutputPage from "../../mainPages/output"
import SettingsPage from "../../mainPages/settings"
import TerminalPage from "../../mainPages/terminal"
import { getCollectionSize, updateMEDDataObjectName, updateMEDDataObjectPath, updateMEDDataObjectType } from "../../mongoDB/mongoDBUtils"
import { DataContext } from "../../workspace/dataContext"
import { MEDDataObject } from "../../workspace/NewMedDataObject"
import { LayoutModelContext } from "../layoutContext"
import { showPopup } from "./popupMenu"
import { TabStorage } from "./tabStorage"
import { Utils } from "./utils"
import ZoomPanPinchComponent from "./zoomPanPinchComponent"
import CodeEditor from "../../flow/codeEditor"
import { confirmDialog } from "primereact/confirmdialog"

var fields = ["Name", "Field1", "Field2", "Field3", "Field4", "Field5"]

interface LayoutContextType {
  layoutRequestQueue: any[]
  setLayoutRequestQueue: (value: any[]) => void
  isEditorOpen: boolean
  setIsEditorOpen: (value: boolean) => void
}

interface DataContextType {
  globalData: any
  setGlobalData: (value: any) => void
}

interface MyComponentProps {
  // add props here
}

interface MyComponentState {
  // add state here
}

/**
 * The main container shell for the flexlayout
 * @summary This is a shell to easily pass variables from multiple contexts to the flexlayout
 * @param props the props
 * @returns the main container
 */
const MainContainer = (props) => {
  const { layoutRequestQueue, setLayoutRequestQueue, isEditorOpen, setIsEditorOpen } = React.useContext(LayoutModelContext) as unknown as LayoutContextType
  const { globalData, setGlobalData } = React.useContext(DataContext) as unknown as DataContextType
  return <MainInnerContainer layoutRequestQueue={layoutRequestQueue} setLayoutRequestQueue={setLayoutRequestQueue} isEditorOpen={isEditorOpen} setIsEditorOpen={setIsEditorOpen} globalData={globalData} setGlobalData={setGlobalData} />
}

/**
 * Main container for the flexlayout
 * @summary This is the main container for the flexlayout. It contains the layout model and the layout itself.
 */
class MainInnerContainer extends React.Component<any, { layoutFile: string | null; model: Model | null; json?: string; adding: boolean; fontSize: string; realtimeResize: boolean }> {
  loadingLayoutName?: string
  nextGridIndex: number = 1
  showingPopupMenu: boolean = false
  htmlTimer?: any = null
  layoutRef?: React.RefObject<Layout>
  saved : {[key: string]: boolean} = {}
  static contextType = LayoutModelContext

  constructor(props: any) {
    super(props)
    this.state = { layoutFile: null, model: null, adding: false, fontSize: "medium", realtimeResize: true }
    this.layoutRef = React.createRef()

    // save layout when unloading page
    window.onbeforeunload = (event: Event) => {
      this.save()
    }
  }

  // Rest of your component code
  preventIOSScrollingWhenDragging(e: Event) {
    if (DragDrop.instance.isActive()) {
      e.preventDefault()
    }
  }

  /**
   * Callback when the component is mounted
   * @returns nothing
   * @summary We load the default layout from local storage
   */
  componentDidMount() {
    this.loadLayout("default", false)
    document.body.addEventListener("touchmove", this.preventIOSScrollingWhenDragging, { passive: false })
    const { layoutRequestQueue, setLayoutRequestQueue } = this.context as LayoutContextType
    if (layoutRequestQueue.length > 0) {
      layoutRequestQueue.forEach((action) => {
        if (action.type === "ADD_TAB") {
          this.addTab(action.tabParams)
        } else if (action.type === "DELETE_DATA_OBJECT") {
          this.deleteDataObject(action.dataObject)
        }
      })
      setLayoutRequestQueue([])
    }
  }

  /**
   * Function to delete the tabs related to a data object
   */
  deleteDataObject = (dataObject: any) => {
    // Print the model and the idMap to the console
    console.log("model", this.state.model)
    console.log("idMap", this.state.model!._idMap)
    let idMap = this.state.model!._idMap as any
    let tabsToDelete = []
    let keys = Object.keys(idMap)
    // Get the tabs related to the data object
    keys.forEach((key) => {
      let uuidToCheck = idMap[key]._attributes.config?.uuid
      // let dataObject = uuidToCheck?.uuid
      console.log("dataObject", dataObject)
      if (uuidToCheck !== undefined && uuidToCheck === dataObject._UUID) {
        tabsToDelete.push(idMap[key])
      }
    })
    // Delete the tabs
    tabsToDelete.forEach((tab) => {
      this.state.model!.doAction(Actions.deleteTab(tab.getId()))
    })
  }

  /**
   * Callback when the model is changed
   * @returns nothing
   * @summary Using a timer to prevent too many updates, we update the json state and save the layout to local storage
   */
  onModelChange = () => {
    console.log("onModelChange")
    if (this.htmlTimer) {
      clearTimeout(this.htmlTimer)
    }
    this.htmlTimer = setTimeout(() => {
      const jsonText = JSON.stringify(this.state.model!.toJson(), null, "\t")
      const html = Prism.highlight(jsonText, Prism.languages.javascript, "javascript")
      this.setState({ json: html })
      this.htmlTimer = null
      this.save()
    }, 500)
  }

  /**
   * Save the layout json to local storage
   * @returns nothing
   */
  save() {
    var jsonStr = JSON.stringify(this.state.model!.toJson(), null, "\t")
    localStorage.setItem(this.state.layoutFile!, jsonStr)
  }

  /**
   * Loads the layout json from local storage
   * @param layoutName the name of the layout
   * @param reload if true, force a reload from local storage
   * @returns nothing
   */
  loadLayout(layoutName: string, reload?: boolean) {
    console.log("loadLayout: ", layoutName, this.state.layoutFile)
    if (this.state.layoutFile !== null) {
      this.save()
    }

    this.loadingLayoutName = layoutName
    let loaded = false
    if (!reload) {
      var json = localStorage.getItem(layoutName)
      if (json != null) {
        this.load(json)
        loaded = true
      }
    }

    if (!loaded) {
      Utils.downloadFile("layouts/" + layoutName + ".layout", this.load, this.error)
    }
  }

  /**
   * Loads the layout json into the flexlayout model
   * @param jsonText the layout json
   * @returns nothing
   */
  load = (jsonText: string) => {
    let json = JSON.parse(jsonText)
    let model = Model.fromJson(json)

    const html = Prism.highlight(jsonText, Prism.languages.javascript, "javascript")
    this.setState({ layoutFile: this.loadingLayoutName!, model: model, json: html })
  }

  /**
   * Sets if the tab can be dropped on the tabset
   * @param dragNode the tab that is being dragged
   * @param dropInfo the info on where the drag is over
   * @returns true if the tab can be dropped on the tabset
   */
  allowDrop = (dragNode: TabNode | TabSetNode, dropInfo: DropInfo) => {
    let dropNode = dropInfo.node

    // prevent non-border tabs dropping into borders
    if (dropNode.getType() === "border" && (dragNode.getParent() == null || dragNode.getParent()!.getType() != "border")) return false

    // prevent border tabs dropping into main layout
    if (dropNode.getType() !== "border" && dragNode.getParent() != null && dragNode.getParent()!.getType() == "border") return false

    return true
  }

  /**
   * Callback for when an error occurs loading the json config file
   * @param reason the reason for the error
   * @returns nothing
   */
  error = (reason: string) => {
    alert("Error loading json config file: " + this.loadingLayoutName + "\n" + reason)
  }

  /**
   * Callback for adding a tab with drag and drop
   * @param event the mouse event
   * @returns nothing
   * @summary We add a tab with drag and drop
   */
  onAddDragMouseDown = (event: React.MouseEvent | React.TouchEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    event.preventDefault()
    this.layoutRef!.current!.addTabWithDragAndDrop(
      undefined,
      {
        component: "grid",
        icon: "images/article.svg",
        name: "Grid " + this.nextGridIndex++
      },
      this.onAdded
    )
  }

  /**
   * Callback for a direct click on the add button
   * @param event the mouse event
   * @returns nothing
   * @summary When the add button is clicked, we add a tab to the active tabset
   */
  onAddActiveClick = (event: React.MouseEvent) => {
    this.layoutRef!.current!.addTabToActiveTabSet({
      component: "grid",
      icon: "images/article.svg",
      name: "Grid " + this.nextGridIndex++
    })
  }

  /**
   * Callback for the add button in the tabset toolbar
   * @param node the node that was clicked
   * @returns nothing
   */
  onAddFromTabSetButton = (node: TabSetNode | BorderNode) => {
    this.layoutRef!.current!.addTabToTabSet(node.getId(), {
      component: "grid",
      name: "Grid " + this.nextGridIndex++
    })
  }

  /**
   * Callback for an indirect click on the add button
   * @param event the mouse event
   * @returns nothing
   * @summary When the add button is clicked, we add a tab with drag and drop
   */
  onAddIndirectClick = (event: React.MouseEvent) => {
    this.layoutRef!.current!.addTabWithDragAndDropIndirect(
      "Add grid\n(Drag to location)",
      {
        component: "grid",
        name: "Grid " + this.nextGridIndex++
      },
      this.onAdded
    )
    this.setState({ adding: true })
  }

  /**
   * Sets the realtimeResize state
   * @param event the change event
   * @returns nothing
   * @summary When realtimeResize is true, the layout will resize in real time as the user drags the splitter. When realtimeResize is false, the layout will only resize when the user releases the splitter.
   */
  onRealtimeResize = (event: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({
      realtimeResize: event.target.checked
    })
  }

  /**
   * Callback when a tab is dragged over a tabset
   * @param dragNode the tab that is being dragged
   * @param dropInfo the info on where the drag is over
   * @returns custom renderer for drag rect
   * @summary When a tab is dragged over a tabset, we render a custom drag rect that says "DROP ME!!!"
   */
  onRenderDragRect = (content: React.ReactElement | undefined, node?: Node, json?: IJsonTabNode) => {
    return (
      <>
        {content}
        <div style={{ whiteSpace: "pre" }}>
          <br />
          DROP ME!!!
          <br />
        </div>
      </>
    )
  }

  /**
   * Callback when a tab is right clicked
   * @param node the node that was clicked
   * @param event the mouse event
   * @returns nothing
   */
  onContextMenu = (node: TabNode | TabSetNode | BorderNode, event: React.MouseEvent<HTMLElement, MouseEvent>) => {
    if (!this.showingPopupMenu) {
      event.preventDefault()
      event.stopPropagation()
      console.log(node, event)
      showPopup(
        node instanceof TabNode ? "Tab: " + node.getName() : "Type: " + node.getType(),
        this.layoutRef!.current!.getRootDiv(),
        event.clientX,
        event.clientY,
        ["Option 1", "Option 2"],
        (item: string | undefined) => {
          console.log("selected: " + item)
          this.showingPopupMenu = false
        }
      )
      this.showingPopupMenu = true
    }
  }

  /**
   * Callback when an aux mouse button is clicked on a tab
   * @param node the node that was clicked
   * @param event the mouse event
   * @returns nothing
   */
  onAuxMouseClick = (node: TabNode | TabSetNode | BorderNode, event: React.MouseEvent<HTMLElement, MouseEvent>) => {
    console.log(node, event)
  }

  /**
   * Callback when a tab is dragged out of the main layout
   * @param dockPopout callback to dock the tab
   * @param showPopout callback to show the tab
   * @returns custom renderer for floating tab placeholder
   */
  onRenderFloatingTabPlaceholder = (dockPopout: () => void, showPopout: () => void) => {
    return (
      <div className={CLASSES.FLEXLAYOUT__TAB_FLOATING_INNER}>
        <div>Custom renderer for floating tab placeholder</div>
        <div>
          <a href="#" onClick={showPopout}>
            {"show the tab"}
          </a>
        </div>
        <div>
          <a href="#" onClick={dockPopout}>
            {"dock the tab"}
          </a>
        </div>
      </div>
    )
  }

  /**
   * Callback when an external tab is dragged onto the main layout
   * @param e the drag event
   * @returns dragText, json and onDrop callback
   * @summary It is not being used at the moment
   */
  onExternalDrag = (e: React.DragEvent) => {
    console.log("onExternaldrag ", e.dataTransfer.types)
    // Check for supported content type
    const validTypes = ["text/uri-list", "text/html", "text/plain"]
    if (e.dataTransfer.types.find((t) => validTypes.indexOf(t) !== -1) === undefined) return
    // Set dropEffect (icon)
    e.dataTransfer.dropEffect = "link"
    return {
      dragText: "Drag To New Tab",
      json: {
        type: "tab",
        component: "multitype"
      },
      onDrop: (node?: Node, event?: Event) => {
        if (!node || !event) return // aborted drag
        if (node instanceof TabNode && event instanceof DragEvent) {
          const dragEvent = event as DragEvent
          if (dragEvent.dataTransfer) {
            if (dragEvent.dataTransfer.types.indexOf("text/uri-list") !== -1) {
              const data = dragEvent.dataTransfer!.getData("text/uri-list")
              this.state.model!.doAction(Actions.updateNodeAttributes(node.getId(), { name: "Url", config: { data, type: "url" } }))
            } else if (dragEvent.dataTransfer.types.indexOf("text/html") !== -1) {
              const data = dragEvent.dataTransfer!.getData("text/html")
              this.state.model!.doAction(Actions.updateNodeAttributes(node.getId(), { name: "Html", config: { data, type: "html" } }))
            } else if (dragEvent.dataTransfer.types.indexOf("text/plain") !== -1) {
              const data = dragEvent.dataTransfer!.getData("text/plain")
              this.state.model!.doAction(Actions.updateNodeAttributes(node.getId(), { name: "Text", config: { data, type: "text" } }))
            }
          }
        }
      }
    }
  }

  /**
   * Callback when a tab is dragged onto a tabset
   * @param dragging the tab that is being dragged
   * @param over the tab that is dragged over
   * @param x the x location of the mouse
   * @param y the y location of the mouse
   * @param location the relative location of the mouse compared to the over node
   * @param refresh callback when the drag is complete
   * @returns tabStorageImpl if defined
   */
  onTabDrag = (dragging: TabNode | IJsonTabNode, over: TabNode, x: number, y: number, location: DockLocation, refresh: () => void) => {
    const tabStorageImpl = over.getExtraData().tabStorage_onTabDrag as ILayoutProps["onTabDrag"]
    if (tabStorageImpl) {
      return tabStorageImpl(dragging, over, x, y, location, refresh)
    }
    return undefined
  }

  /**
   * Callback when the show layout button is clicked
   * @param event the click event
   */
  onShowLayoutClick = (event: React.MouseEvent) => {
    console.log(JSON.stringify(this.state.model!.toJson(), null, "\t"))
  }

  /**
   * Callback when a new tab is added
   */
  onAdded = () => {
    this.setState({ adding: false })
  }

  /**
   * Callback when a table cell is clicked
   * @param node the node that was clicked
   * @param event the mouse event
   */
  onTableClick = (node: Node, event: Event) => {
    console.log("onTableClick", node, event)
  }

  /**
   * Update savedCode state
   * @param savedCode the new value of savedCode
   */
  updateSavedCode = (savedCode: boolean, nodeId: string) => {
    const fileName = this.state.model?.getNodeById(nodeId)?.getHelpText()
    this.saved[nodeId] = savedCode
    if (fileName) this.state.model!.doAction(Actions.renameTab(nodeId, fileName + (savedCode ? "" : "*")))
  }

  /**
   * Callback when an action is dispatched by flexlayout.
   * @param action action that was dispatched
   * @returns optionally return a Action to replace the action or null to not dispatch action
   * @description here we catch RENAME_TAB actions and update the medDataObject name
   */
  onAction = (action: Action) => {
    const { isEditorOpen, setIsEditorOpen } = this.props as LayoutContextType
    console.log("MainContainer action: ", action, this.layoutRef, this.state.model, this.saved)
    if (action.type === Actions.RENAME_TAB) {
      if(isEditorOpen) {
        console.error("Please close the editor before renaming")
        toast.error("Please close the editor before renaming")
        return Actions.RENAME_TAB
      }
      const { globalData, setGlobalData } = this.props as DataContextType
      let newName = action.data.text
      let medObject = globalData[action.data.node]
      console.log("medObject", medObject)
      if (medObject) {
        // Check name is not empty
        if (newName == "") {
          toast.error("Error: Name cannot be empty")
          return Actions.RENAME_TAB
        }
        // Check if the name keeps the original extension
        if (medObject.type != "directory") {
          const newNameParts = newName.split(".")
          if (medObject.type != newNameParts[newNameParts.length - 1]) {
            toast.error("Invalid Name")
            return Actions.RENAME_TAB
          }
        }
        // Check if the new name is different from the original
        if (medObject.name == newName) {
          toast.warning("Warning: same name")
          return Actions.RENAME_TAB
        }
        // Check if the name is not DATA or EXPERIMENTS
        if (["ROOT", "DATA", "EXPERIMENTS"].includes(newName)) {
          toast.error("Error: This name is reserved and cannot be used")
          return Actions.RENAME_TAB
        }
        // update the medDataObject name
        let success = updateMEDDataObjectName(medObject.id, newName)
        if (!success) {
          toast.error("Failed to update MEDDataObject name of the file")
          console.error("Failed to update MEDDataObject name")
          return action
        }
        // Update the path
        let oldPath = medObject.path
        let newPath = oldPath.split(getPathSeparator()).slice(0, -1).join(getPathSeparator()) + getPathSeparator() + newName
        success = updateMEDDataObjectPath(medObject.id, newPath)
        if (!success) {
          toast.error("Failed to update MEDDataObject path of the file")
          console.error("Failed to update MEDDataObject path")
          return null
        }
        // Update the local filename
        if (medObject.inWorkspace) {
          fs.renameSync(oldPath, newPath)
          // Update the workspace data object
          MEDDataObject.updateWorkspaceDataObject()
        }
      }
    } else if (action.type === Actions.DELETE_TAB && this.saved[action.data.node] === false) {
      return confirmDialog({
        closable: false,
        message: `You have unsaved changes in the code editor. Are you sure you want to close the tab?`,
        header: "Unsaved changes",
        icon: "pi pi-exclamation-triangle",
        accept: () => {
          this.updateSavedCode(true, action.data.node)
          this.state.model!.doAction(action)
        },
        reject: () => {
          return null // Return null to cancel the action
        },
      })
    } else if (action.type === Actions.DELETE_TAB) {
      setIsEditorOpen(false)
    }
    return action
  }

  /**
   * The most important function of the class
   * It is called for each node and must return a react component to display
   * @param node the node to display
   * @param node.component the type of the node -> Used to differentiate the node type
   * @param node.getExtraData() the extra data that was added to the node
   * @param node.getConfig() the config that was added to the node
   * @returns the react component to display
   */
  factory = (node: TabNode) => {
    const { isEditorOpen, setIsEditorOpen } = this.props as LayoutContextType
    var component = node.getComponent()

    /**
     * We use the component name to differentiate the node type
     */
    if (component === "json") {
      return <pre style={{ tabSize: "20px" }} dangerouslySetInnerHTML={{ __html: this.state.json! }} />
    } else if (component === "grid") {
      if (node.getExtraData().data == null) {
        // create data in node extra data first time accessed
        node.getExtraData().data = this.makeFakeData()
      }
      return <SimpleTable fields={fields} onClick={this.onTableClick.bind(this, node)} data={node.getExtraData().data} />
    } else if (component === "sub") {
      var model = node.getExtraData().model
      if (model == null) {
        node.getExtraData().model = Model.fromJson(node.getConfig().model)
        model = node.getExtraData().model
        // save submodel on save event
        node.setEventListener("save", (p: any) => {
          this.state.model!.doAction(Actions.updateNodeAttributes(node.getId(), { config: { model: node.getExtraData().model.toJson() } }))
        })
      }

      return <Layout model={model} factory={this.factory} />
    } else if (component === "text") {
      try {
        return <div dangerouslySetInnerHTML={{ __html: node.getConfig().text }} />
      } catch (e) {
        console.log(e)
      }
    } else if (component === "multitype") {
      try {
        const config = node.getConfig()
        if (config.type === "url") {
          return <iframe title={node.getId()} src={config.data} style={{ display: "block", border: "none", boxSizing: "border-box" }} width="100%" height="100%" />
        } else if (config.type === "html") {
          return <div dangerouslySetInnerHTML={{ __html: config.data }} />
        } else if (config.type === "text") {
          return (
            <textarea
              style={{
                position: "absolute",
                width: "100%",
                height: "100%",
                resize: "none",
                boxSizing: "border-box",
                border: "none"
              }}
              defaultValue={config.data}
            />
          )
        }
      } catch (e) {
        return <div>{String(e)}</div>
      }
    } else if (component === "tabstorage") {
      return <TabStorage tab={node} layout={this.layoutRef!.current!} />
    } else if (component === "jsonViewer") {
      const config = node.getConfig()
      if (node.getExtraData().data == null) {
        node.getExtraData().data = loadJsonPath(config.path)
      }
      const jsonText = JSON.stringify(node.getExtraData().data, null, "\t")
      const html = Prism.highlight(jsonText, Prism.languages.javascript, "javascript")
      return (
        <ModulePage pageId={"jsonViewer-" + config.path} shadow>
          <pre style={{ tabSize: "20px" }} dangerouslySetInnerHTML={{ __html: html }} />
        </ModulePage>
      )
    } else if (component === "dataTable") {
      const config = node.getConfig()
      if (node.getExtraData().data == null) {
        const dfd = require("danfojs-node")
        const whenDataLoaded = (data) => {
          const { globalData, setGlobalData } = this.props as DataContextType
          let globalDataCopy = globalData
          if (globalDataCopy[config.uuid] !== undefined) {
            globalDataCopy[config.uuid].setData(new dfd.DataFrame(data))
            setGlobalData(globalDataCopy)
          }
          node.getExtraData().data = dfd.toJSON(globalDataCopy[config.uuid].data, { format: "column" })
        }
        let extension = config.extension
        if (extension === undefined) {
          extension = config.path.split(".").pop()
        }
        config.name = node.getName()
        if (extension === "csv") loadCSVFromPath(config.path, whenDataLoaded)
        else if (extension === "json") loadJSONFromPath(config.path, whenDataLoaded)
        else if (extension === "xlsx") loadXLSXFromPath(config.path, whenDataLoaded)
      }
      return (
        <>
          <DataTableWrapperBPClass
            data={node.getExtraData().data}
            tablePropsData={{
              paginator: true,
              rows: 10,
              scrollable: true,
              scrollHeight: "400px"
            }}
            tablePropsColumn={{
              sortable: true
            }}
            config={{ ...config }}
            globalData={this.props.globalData}
            setGlobalData={this.props.setGlobalData}
          />
        </>
      )
    } else if (component === "dataTableFromDB") {
      const config = node.getConfig()
      if (!config.fileSize || typeof config.fileSize.then === "function") {
        getCollectionSize(config.id)
          .then((size) => {
            config.fileSize = size

            this.forceUpdate() // Force a re-render to update the component with the new fileSize
          })
          .catch((error) => {
            console.error("Error getting collection size:", error)
          })
      }

      // toast message saying the file will be read only
      if (config.extension === "view") {
        toast.info("File opened in read-only mode.")
      }

      if (node.getExtraData().data == null) {
        const whenDataLoaded = (data) => {
          node.getExtraData().data = data
        }
        // const { M, setGlobalData } = this.props as DataContextType
      }

      return (
        <>
          <DataTableFromDB data={config} isReadOnly={config.extension === "view"} />
        </>
      )
    } else if (component === "learningPage") {
      if (node.getExtraData().data == null) {
        const config = node.getConfig()

        return <LearningPage pageId={config.id} />
      }
    } else if (component === "InputToolsDB") {
      if (node.getExtraData().data == null) {
        const config = node.getConfig().thoseProps
        if (config.thoseProps !== null) {
          return <InputToolsComponent {...config} />
        } else {
          return <InputToolsComponent {...config} />
        }
      }
    } else if (component === "inputPage") {
      if (node.getExtraData().data == null) {
        const config = node.getConfig().thoseProps
        return <InputToolsComponent {...config} />
      }
    } else if (component === "iFramePage") {
      if (node.getExtraData().data == null) {
        const config = node.getConfig()

        return <iframe title={node.getId()} src={config.path} style={{ display: "block", border: "none", boxSizing: "border-box" }} width="100%" height="100%" />
      }
    } else if (component === "exploratoryPage") {
      if (node.getExtraData().data == null) {
        const config = node.getConfig()
        if (config.path !== null) {
          return <ExploratoryPage pageId={config.uuid} />
        } else {
          return <ExploratoryPage pageId={"ExploratoryPage"} />
        }
      }
    } else if (component === "imageViewer") {
      if (node.getExtraData().data == null) {
        const config = node.getConfig()
        console.log("imageViewer config", config)
        if (config.path) {
          const nativeImage = require("electron").nativeImage
          const image = nativeImage.createFromPath(config.path)

          let height = image.getSize().height / 3
          let width = image.getSize().width / 3

          return <ZoomPanPinchComponent imagePath={config.path} image={image.toDataURL()} width={width} height={height} options={""} />
        } else if (config.uuid){
          return <ZoomPanPinchComponent imageID={config.uuid} />
        } else {
          return <h4>IMAGE VIEWER - Could not load image</h4>
        }
      }
    } else if (component === "evaluationPage") {
      if (node.getExtraData().data == null) {
        const config = node.getConfig()
        return <EvaluationPage pageId={config.id} />
      }
    } else if (component === "extractionTextPage") {
      if (node.getExtraData().data == null) {
        const config = node.getConfig()
        if (config.path !== null) {
          return <ExtractionTextPage pageId={config.uuid} />
        } else {
          return <ExtractionTextPage pageId={"ExtractionTextPage"} />
        }
      }
    } else if (component === "MEDprofilesViewer") {
      if (node.getExtraData().data == null) {
        const config = node.getConfig()
        if (config.path !== null) {
          return <MEDprofilesViewer pageId={config.uuid} MEDclassesFolder={config?.MEDclassesFolder} MEDprofilesBinaryFile={config?.MEDprofilesBinaryFile} />
        } else {
          return <MEDprofilesViewer pageId={"MEDprofilesViewer"} MEDclassesFolder={config?.MEDclassesFolder} MEDprofilesBinaryFile={config?.MEDprofilesBinaryFile} />
        }
      }
    } else if (component === "extractionImagePage") {
      if (node.getExtraData().data == null) {
        const config = node.getConfig()
        if (config.path !== null) {
          return <ExtractionImagePage pageId={config.uuid} />
        } else {
          return <ExtractionImagePage pageId={"ExtractionImagePage"} />
        }
      }
    } else if (component === "extractionMEDimagePage") {
      if (node.getExtraData().data == null) {
        const config = node.getConfig()
        if (config.path !== null) {
          return <ExtractionMEDimagePage pageId={config.uuid} />
        } else {
          return <ExtractionMEDimagePage pageId={"ExtractionMEDimagePage"} />
        }
      }
    } else if (component === "extractionTSPage") {
      if (node.getExtraData().data == null) {
        const config = node.getConfig()
        if (config.path !== null) {
          return <ExtractionTSPage pageId={config.uuid} />
        } else {
          return <ExtractionTSPage pageId={"ExtractionTSPage"} />
        }
      }
    } else if (component === "medflPage") {
      if (node.getExtraData().data == null) {
        const config = node.getConfig()
        if (config.path !== null) {
          return <MEDflPage pageId={config.uuid} />
        } else {
          return <MEDflPage pageId={"MEDflPage"} />
        }
      }
    } else if (component === "med3paPage") {
      if (node.getExtraData().data == null) {
        const config = node.getConfig()
        if (config.path !== null) {
          return <MED3paPage pageId={config.uuid} />
        } else {
          return <MED3paPage pageId={"MED3paPage"} />
        }
      }
    } else if (component === "applicationPage") {
      if (node.getExtraData().data == null) {
        const config = node.getConfig()
        if (config.path !== null) {
          return <ApplicationPage pageId={config.uuid} />
        } else {
          return <ApplicationPage pageId={"EvaluationPage"} />
        }
      }
    } else if (component === "terminal") {
      if (node.getExtraData().data == null) {
        const config = node.getConfig()

        return <TerminalPage />
      }
    } else if (component === "output") {
      if (node.getExtraData().data == null) {
        const config = node.getConfig()

        return <OutputPage />
      }
    } else if (component === "modelViewer") {
      if (node.getExtraData().data == null) {
        const config = node.getConfig()
        console.log("config", config)
        return <ModelViewer pageId={config.id} />
      }
    } else if (component === "htmlViewer") {
      if (node.getExtraData().data == null) {
        return <HtmlViewer config={node.getConfig()} />
      }
    } else if (component === "iframeViewer") {
      if (node.getExtraData().data == null) {
        const config = node.getConfig()
        console.log("config", config)
        return <Iframe url={config.path} width="100%" height="100%" />
      }
    } else if (component === "codeEditor") {
      if (node.getExtraData().data == null) {
        const config = node.getConfig()
        setIsEditorOpen(true)
        return <CodeEditor id={config.uuid} path={config.path} updateSavedCode={this.updateSavedCode}/>
      }
    } else if (component === "Settings") {
      return <SettingsPage />
    } else if (component !== "") {
      if (node.getExtraData().data == null) {
        const config = node.getConfig()
        return <h4>{component?.toUpperCase()} - Not Implemented Yet</h4>
      }
    }

    return null
  }

  titleFactory = (node: TabNode) => {
    if (node.getId() === "custom-tab") {
      return {
        titleContent: <div>(Added by titleFactory) {node.getName()}</div>,
        name: "the name for custom tab"
      }
    }
    return
  }

  /**
   * Function that sets the icon for the tab
   * @param node the node to display
   * @returns the react component icon to display
   */
  iconFactory = (node: TabNode) => {
    if (node.getId() === "custom-tab") {
      return (
        <>
          <span style={{ marginRight: 3 }}>:)</span>
        </>
      )
    }
    return this.returnIconFromComponent(node.getComponent() as string, node.getConfig())
  }

  /**
   * Function that returns the icon for the tab
   * @param component the component name
   * @param config the config for the component
   * @returns the react component icon to display
   */
  returnIconFromComponent(component: string, config?: any) {
    if (config !== undefined && config !== null && config !== "" && config?.path !== undefined && config?.path !== null && config?.path !== "") {
      let extension = config.path.split(".").pop()
      let iconToReturn = null
      switch (extension) {
        case "csv":
          return <Icons.FiletypeCsv />
        case "json":
          return <Icons.FiletypeJson />
        case "txt":
          return <Icons.FiletypeTxt />
        case "md":
          return <Icons.FiletypeMd />
        case "pdf":
          return <Icons.FiletypePdf />
        case "png":
          return <Icons.FiletypePng />
        case "jpg":
          return <Icons.FiletypeJpg />
        case "jpeg":
          return <Icons.FiletypeJpg />
        case "py":
          return <Icons.FiletypePy />
        case "ipynb":
          return <Icons.FiletypePy />
        case "html":
          return <Icons.FiletypeHtml />
        case "xlsx":
          return <Icons.FiletypeXlsx />
        case "xls":
          return <Icons.FiletypeXls />
      }
      let icon = <span style={{ marginRight: 3 }}>{iconToReturn}</span>
      return icon
    } else {
      if (component === "InputToolsDB" || component === "inputPage" || component === "dataTableFromDB") {
        return <span style={{ marginRight: 3 }}>🛢️</span>
      }
      if (component === "exploratoryPage") {
        return <span style={{ marginRight: 3 }}>🔎</span>
      }
      if (component === "evaluationPage") {
        return <span style={{ marginRight: 3 }}>✅</span>
      }
      if (component === "resultsPage") {
        return <span style={{ marginRight: 3 }}>📊</span>
      }
      if (component === "learningPage") {
        return <span style={{ marginRight: 3 }}>📖</span>
      }
      if (component === "extractionTextPage") {
        return <span style={{ marginRight: 3 }}>📄</span>
      }
      if (component === "extractionImagePage") {
        return <span style={{ marginRight: 3 }}>📷</span>
      }
      if (component === "extractionMEDimagePage") {
        return <span style={{ marginRight: 3 }}>📷</span>
      }
      if (component === "extractionTSPage") {
        return <span style={{ marginRight: 3 }}>📈</span>
      }
      if (component === "medflPage") {
        return <span style={{ marginRight: 3 }}>🌐</span>
      }
      if (component === "med3paPage") {
        return <span style={{ marginRight: 3 }}>👥</span>
      }
      if (component === "MEDprofilesViewer") {
        return <span style={{ marginRight: 3 }}>📊</span>
      }
      if (component === "terminal") {
        return <span style={{ marginRight: 3 }}>🖥️</span>
      }
      if (component === "output") {
        return <span style={{ marginRight: 3 }}>🏁</span>
      }
      if (component === "applicationPage") {
        return <span style={{ marginRight: 3 }}>📦</span>
      }
      if (component === "Settings") {
        return <span style={{ marginRight: 3 }}>⚙️</span>
      }
    }
  }

  /**
   * Callback when the layout is changed
   * @param event the change event
   * @returns nothing
   */
  onSelectLayout = (event: React.FormEvent) => {
    var target = event.target as HTMLSelectElement
    this.loadLayout(target.value)
  }

  /**
   * Callback when the reload button is clicked
   * @param event the click event
   * @returns nothing
   */
  onReloadFromFile = (event: React.MouseEvent) => {
    this.loadLayout(this.state.layoutFile!, true)
  }

  /**
   * Callback when the theme is changed
   * @param event the change event
   * @returns nothing
   */
  onThemeChange = (event: React.FormEvent) => {
    var target = event.target as HTMLSelectElement
    let flexlayout_stylesheet: any = window.document.getElementById("flexlayout-stylesheet")
    let index = flexlayout_stylesheet.href.lastIndexOf("/")
    let newAddress = flexlayout_stylesheet.href.substr(0, index)
    flexlayout_stylesheet.setAttribute("href", newAddress + "/" + target.value + ".css")
    let page_stylesheet = window.document.getElementById("page-stylesheet")
    page_stylesheet!.setAttribute("href", target.value + ".css")
    this.forceUpdate()
  }

  /**
   * Callback when the font size is changed
   * @param event the change event
   * @returns nothing
   */
  onSizeChange = (event: React.FormEvent) => {
    var target = event.target as HTMLSelectElement
    this.setState({ fontSize: target.value })
  }

  /**
   * Callback when a tab is rendered
   * @param node the node that was rendered
   * @param renderValues the render values
   * @returns nothing
   */
  onRenderTab = (node: TabNode, renderValues: ITabRenderValues) => {}

  onRenderTabSet = (node: TabSetNode | BorderNode, renderValues: ITabSetRenderValues) => {
    if (this.state.layoutFile === "default") {
      if (node instanceof TabSetNode) {
        /**
         * Add a button to the tabset header
         * Not being used at the moment
         */
      }
    }
  }

  /**
   * Callback when a tabset placeholder is rendered
   * @summary We render the HomePage component when a tabset is empty
   * @param node the node that was rendered
   * @param renderValues the render values
   * @returns React.Component (HomePage)
   */
  onTabSetPlaceHolder(node: TabSetNode) {
    return <HomePage />
  }

  /**
   * Callback when the component is updated
   * @param prevProps the previous props
   * @param prevState the previous state
   * @param prevContext the previous context
   * @returns nothing
   * @summary We handle the layoutRequestQueue here
   * @description The layoutRequestQueue is used to add tabs from the context
   */
  componentDidUpdate(prevProps: MyComponentProps, prevState: MyComponentState, prevContext: LayoutContextType) {
    const { layoutRequestQueue, setLayoutRequestQueue } = this.props as LayoutContextType
    const prevLayoutRequestQueue = prevContext ? prevContext.layoutRequestQueue : []
    if (layoutRequestQueue.length > 0 && prevLayoutRequestQueue !== layoutRequestQueue) {
      console.log("layoutRequestQueue", layoutRequestQueue)
      layoutRequestQueue.forEach((action) => {
        this.handleContextAction(action)
      })
      setLayoutRequestQueue([])
    }
  }

  /**
   * Function to add a tab from the context
   * @param tabParams the parameters of the tab
   * @returns nothing
   */
  addTab = (tabParams: any) => {
    // Your code to add a tab with custom parameters
    console.log("addTab", tabParams)
    let tabExists = this.checkIfTabIDExists(tabParams.id)
    if (tabExists) {
      console.log("tab already exists")
      // We select the tab that already exists and set it to active
      this.state.model!.doAction(Actions.selectTab(tabParams.id))
    } else {
      // We add the tab to the active tabset
      this.saved[tabParams.id] = true
      this.layoutRef!.current!.addTabToActiveTabSet(tabParams)
    }
  }

  /**
   * Function to handle the actions from the context
   */
  handleContextAction = (action: any) => {
    switch (action.type) {
      case "ADD_TAB":
        this.addTab(action.payload)
        break
      case "DELETE_DATA_OBJECT":
        this.deleteDataObject(action.payload)
        break
      default:
        break
    }
    this.save()
  }

  /**
   * Function to check if the tab exists
   * @param tabID the id of the tab
   * @returns boolean, true if the tab exists
   */
  checkIfTabIDExists = (tabID: string) => {
    let tabExists = false
    this.state.model!.getNodeById(tabID) ? (tabExists = true) : (tabExists = false)
    return tabExists
  }

  /**
   * Renders the component
   */
  render() {
    let contents: React.ReactNode = "loading ..."

    if (this.state.model !== null) {
      contents = (
        <Layout
          ref={this.layoutRef}
          model={this.state.model}
          factory={this.factory}
          font={{ size: this.state.fontSize }}
          onAction={this.onAction}
          onModelChange={this.onModelChange}
          titleFactory={this.titleFactory}
          iconFactory={this.iconFactory}
          onRenderTab={this.onRenderTab}
          onRenderTabSet={this.onRenderTabSet}
          onRenderDragRect={this.onRenderDragRect}
          onRenderFloatingTabPlaceholder={this.onRenderFloatingTabPlaceholder}
          onExternalDrag={undefined} //this.onExternalDrag}
          realtimeResize={false} //this.state.realtimeResize}
          onTabDrag={this.onTabDrag}
          onContextMenu={this.onContextMenu}
          onAuxMouseClick={this.onAuxMouseClick}
          onTabSetPlaceHolder={this.onTabSetPlaceHolder}
          supportsPopout={false}
        />
      )
    }

    return (
      <div className="flexlayout-app">
        <div className="flexlayout-contents">{contents}</div>
      </div>
    )
  }

  /**
   * Functions that returns fake data
   */
  makeFakeData() {
    var data = []
    var r = Math.random() * 50
    for (var i = 0; i < r; i++) {
      var rec: { [key: string]: any } = {}
      rec.Name = this.randomString(5, "ABCDEFGHIJKLMNOPQRSTUVWXYZ")
      for (var j = 1; j < fields.length; j++) {
        rec[fields[j]] = (1.5 + Math.random() * 2).toFixed(2)
      }
      data.push(rec)
    }
    return data
  }

  /**
   * Function that returns a random string
   * @param len the length of the string
   * @param chars the characters to use
   * @returns a random string
   */
  randomString(len: number, chars: string) {
    var a = []
    for (var i = 0; i < len; i++) {
      a.push(chars[Math.floor(Math.random() * chars.length)])
    }

    return a.join("")
  }
}

/**
 * Component that renders a simple table
 * @param fields the fields of the table
 * @param data the data of the table
 * @param onClick the callback when a cell is clicked
 * @returns the react component to display
 */
class SimpleTable extends React.Component<{ fields: any; data: any; onClick: any }, any> {
  shouldComponentUpdate() {
    return true
  }

  render() {
    var headercells = this.props.fields.map(function (field: any) {
      return <th key={field}>{field}</th>
    })

    var rows = []
    for (var i = 0; i < this.props.data.length; i++) {
      var row = this.props.fields.map((field: any) => <td key={field}>{this.props.data[i][field]}</td>)
      rows.push(<tr key={i}>{row}</tr>)
    }

    return (
      <table className="simple_table" onClick={this.props.onClick}>
        <tbody>
          <tr>{headercells}</tr>
          {rows}
        </tbody>
      </table>
    )
  }
}

/**
 * Returns the box to display the image in the console
 * @param width the width of the box
 * @param height the height of the box
 * @returns the box to display the image in the console
 */
function getBox(width, height) {
  return {
    string: "+",
    style: "font-size: 1px; padding: " + Math.floor(height / 2) + "px " + Math.floor(width / 2) + "px; line-height: " + height + "px;"
  }
}

/**
 * Function that shows the image in the console
 * @param url the url of the image
 * @param scale the scale of the image
 * @returns nothing
 * @todo not being used at the moment, not finished yet
 */
function showImage(url, scale) {
  scale = scale || 1
  var img = new Image()

  img.src = url
}

export { MainContainer }
