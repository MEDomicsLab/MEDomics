import React, { createContext, useState, useContext } from "react"
import { useEffect } from "react"
import { toast } from "react-toastify"
import { DataContext } from "../workspace/dataContext"
import { overwriteMEDDataObjectProperties, getCollectionSize } from "../mongoDB/mongoDBUtils"

/**
 * @typedef {React.Context} LayoutModelContext
 * @description Context for the layout model
 * @summary This is the context that holds the layout model and the dispatch function for the layout model
 * This context is used by the LayoutProvider to provide the layout model to the rest of the application
 * @see {@link https://react.dev/learn/passing-data-deeply-with-context}
 */
const LayoutModelContext = createContext(null)

/**
 * @typedef {React.FunctionComponent} LayoutContext
 * @description Context function for the layout model
 * @params {Object} children - The children of the LayoutContext - The ones that will be wrapped by the LayoutContext
 * @params {Object} layoutModel - The layout model that will be used by the LayoutContext that is passed by the App component
 * @params {Object} setlayoutModel - The layout model setting function that will be used by the LayoutContext to change the state of the layout model that is passed by the App component
 * @summary This function enables us to wrap the children of the LayoutContext and make to them the layout model and the functions to interact with it available
 * @author Nicolas Longchamps @link
 */
function LayoutModelProvider({ children, layoutModel, setLayoutModel }) {
  const [layoutMainState, setLayoutMainState] = useState(layoutModel)
  const [layoutRequestQueue, setLayoutRequestQueue] = useState([])
  const [developerMode, setDeveloperMode] = useState(false)
  const [isEditorOpen, setIsEditorOpen] = useState(false)

  /**
   * @param {FlexLayout.Model.Action} action - The actions passed on by the flexlayout-react library
   * @param {FlexLayout.Model} model - The model passed on by the flexlayout-react library
   * @returns It translates the actions passed on by the flexlayout-react library into actions that are understood by the rest of the application
   * @summary This function is called in the mainContainerFunctional component in its
   */
  const flexlayoutInterpreter = (action, model) => {
    // Logging for debugging purposes
    console.log("flexlayoutInterpreter", action)
    console.log("flexlayoutInterpreter Model", model)

    // When the function is called, the action is passed as a parameter like this: {type: "FlexLayout_AddTab", payload: {…}}
    switch (action.type) {
      case "FlexLayout_DeleteTab":
        Object.keys(model._idMap).map((key) => {
          // Here we go get the map of ids inside the flexlayout : model._idMap
          // We compare it to the node that is passed on by the action and call the remove function if we find a match
          console.log(key)
          if (key === action.data.node) {
            console.log("GOT IT", model._idMap[key])
            let target = model._idMap[key]
            remove({ type: "remove", payload: { name: target._attributes.name } })
          }
        })
        return console.log("FlexLayout_DeleteTab", action)
      case "FlexLayout_SelectTab":
        // Not implemented yet - Debbuging purposes and to see how the action is passed on
        document.getElementById(action.data.node)
        return console.log("FlexLayout_SelectTab", action)

      default:
        return console.log("FlexLayout_Default", action)
    }
  }
  // }

  /**
   * @param {Object} action - The action passed on by the components that use/modify the layout model
   * @description This function is used to dispatch the actions passed on by the components that use/modify the layout model - [Switch case] It dispaches the actions according to their type
   */
  const { globalData } = useContext(DataContext)
  const dispatchLayout = (action) => {
    if (developerMode) {
      switch (action.type) {
        /*********** OPEN IN *************/
        case "openInDtale":
          return openInDtale(action)
        case "openInExploratoryModule":
          return openInExploratory(action)
        case "openInLearningModule":
          return openInLearning(action)
        case "openInExtractionMEDimageModule":
          return openInExtractionMEDimage(action)
        case "openInEvaluationModule":
          return openInEvaluation(action)
        case "openInIFrame":
          return openInIFrame(action)
        case "openInDataTable":
          return openDataTable(action)
        case "openInDataTableFromDBViewer":
          return openDataTableFromDB(action)
        case "openInCodeEditor":
          return openCodeEditor(action)
        case "openInImageViewer":
          return openImageViewer(action, globalData)
        case "openInPDFViewer":
          return openPDFViewer(action)
        case "openHtmlViewer":
          return openHtmlViewer(action)
        case "openInModelViewer":
          return openModelViewer(action)
        case "openPandasProfiling":
          return openInPandasProfiling(action)
        case "openInMEDflResultsViewer":
          return openInMEDflresults(action)
        case "openInMEDflOptResultsViewer":
          return openInMEDflOptresults(action)
        case "openInMEDflRwResultsViewer":
          return openInMEDflRwresults(action)
        case "openInFlModule":
          return openInFlModule(action)
        case "openInRwFlModule":
          return openInRwFlModule(action)
        case "openInFlClientsModule":
          return openInFlClientsModule(action)

        /*********** OPEN *****************/
        case "openResultsModule":
          return openResults(action)
        case "openApplicationModule":
          return openApplication(action)
        case "openEvaluationModule":
          return openEvaluation(action)
        case "openInputModule":
          return openInput(action)
        case "openExploratoryModule":
          return openExploratory(action)
        case "openExtractionTSModule":
          return openExtractionTS(action)
        case "openExtractionMEDimageModule":
          return openExtractionMEDimage(action)
        case "openExtractionTextModule":
          return openExtractionText(action)
        case "openExtractionImageModule":
          return openExtractionImage(action)
        case "openMEDprofilesViewerModule":
          return openMEDprofilesViewer(action)
        case "openMEDflModule":
          return openMEDfl(action)
        case "openMEDflLandingPageModule":
          return openMEDflLandingPage(action)
        case "openFlClientsModule":
          return openFlCLients(action)
        case "openFlServerModule":
          return openFlServer(action)
        case "openflrwConfigModule":
          return openFlrwConfig(action)
        case "openflRwWorkflowModule":
          return openflRwWorkflow(action)
        case "openMED3paModule":
          return openMED3pa(action)

        case "openSettings":
          return openGeneric(action, "Settings", "Settings")
        case "openInputToolsDB":
          return openInputToolsDB(action, "InputToolsDB")
        case "add":
          return add(action)
        case "remove":
          return remove(action)
        case "DELETE_DATA_OBJECT":
          return removeMedObject(action)
        default:
          console.warn(`Unhandled action type: ${action.type}`)
      }
    } else {
      toast.error("Developer mode is ON, please turn it OFF to use the application")
    }
  }

  /**
   * @summary Function that is called when a medDataObject is deleted to remove all the tabs that are associated with it
   * @params {Object} action - The action passed on by the dispatchLayout function
   */
  function removeMedObject(action) {
    console.log("DELETE_DATA_OBJECT", action)
    let layoutRequestQueueCopy = [...layoutRequestQueue]
    layoutRequestQueueCopy.push(action)
    setLayoutRequestQueue(layoutRequestQueueCopy)
  }

  /**
   * @summary Generic function that adds a tab with an object to the layout model
   * @params {Object} action - The action passed on by the dispatchLayout function
   * @params {String} component - The component to be used in the tab
   */
  function openInTab(action, component) {
    let object = action.payload
    let isAlreadyIn = checkIfIDIsInLayoutModel(object.name, layoutModel)
    if (!isAlreadyIn) {
      const newChild = {
        type: "tab",
        helpText: object.data,
        name: object.data,
        id: object.index,
        component: component,
        config: { id: object.index, name: object.data, extension: object.type, fileSize: getCollectionSize(object.index) }
      }
      let layoutRequestQueueCopy = [...layoutRequestQueue]
      layoutRequestQueueCopy.push({ type: "ADD_TAB", payload: newChild })
      setLayoutRequestQueue(layoutRequestQueueCopy)
    }
  }

  /**
   * @summary Generic function that adds a tab with an object to the layout model
   * @params {Object} action - The action passed on by the dispatchLayout function
   * @params {String} component - The component to be used in the tab
   */
  function openInIFrameTab(action, component) {
    let object = action.payload
    let isAlreadyIn = checkIfIDIsInLayoutModel(object.name, layoutModel)
    if (!isAlreadyIn) {
      const newChild = {
        type: "tab",
        helpText: object.name,
        name: object.name,
        id: object.id,
        component: component,
        config: { path: object.path }
      }
      let layoutRequestQueueCopy = [...layoutRequestQueue]
      layoutRequestQueueCopy.push({ type: "ADD_TAB", payload: newChild })
      setLayoutRequestQueue(layoutRequestQueueCopy)
    }
  }

  /**
   * @summary Generic function that adds a tab with a medDataObject to the layout model
   * @params {Object} action - The action passed on by the dispatchLayout function
   * @params {String} component - The component to be used in the tab
   */
  function openInDotDotDot(action, component, globalData) {
    let medObject = action.payload
    let isAlreadyIn = checkIfIDIsInLayoutModel(medObject.index, layoutModel)
    if (!isAlreadyIn) {
      const newChild = {
        type: "tab",
        helpText: medObject.data,
        name: medObject.data,
        id: medObject.index,
        component: component,
        config: { path: globalData[medObject.index].path, uuid: medObject.index, extension: medObject.type }
      }
      let layoutRequestQueueCopy = [...layoutRequestQueue]
      layoutRequestQueueCopy.push({ type: "ADD_TAB", payload: newChild })
      setLayoutRequestQueue(layoutRequestQueueCopy)

      if (component == "learningPage" || component == "extractionMEDimagePage") {
        const nextlayoutModel = { ...layoutModel }
        // To add a new child to the layout model, we need to add it to the children array (layoutModel.layout.children[x].children)
        // ****IMPORTANT**** For the hook to work, we need to create a new array and not modify the existing one
        const newChildren = [...layoutModel.layout.children[0].children, newChild]
        nextlayoutModel.layout.children[0].children = newChildren
      }
    }
  }

  function openInputToolsDB(action, component) {
    let thoseProps = action.payload.data
    console.log("OPEN INPUT TOOLS DB", thoseProps)
    let isAlreadyIn = checkIfIDIsInLayoutModel(thoseProps.data.uuid, layoutModel)
    overwriteMEDDataObjectProperties(thoseProps.data.uuid, thoseProps.data)
    if (!isAlreadyIn) {
      const newChild = {
        type: "tab",
        helpText: thoseProps.data.path + "/" + thoseProps.data.uuid,
        name: thoseProps.data.name + " Input Tools",
        id: thoseProps.data.name + " Input Tools",
        component: component,
        config: { thoseProps }
      }
      let layoutRequestQueueCopy = [...layoutRequestQueue]
      layoutRequestQueueCopy.push({ type: "ADD_TAB", payload: newChild })
      setLayoutRequestQueue(layoutRequestQueueCopy)

      if (component == "learningPage" || component == "extractionMEDimagePage") {
        const nextlayoutModel = { ...layoutModel }
        // To add a new child to the layout model, we need to add it to the children array (layoutModel.layout.children[x].children)
        // ****IMPORTANT**** For the hook to work, we need to create a new array and not modify the existing one
        const newChildren = [...layoutModel.layout.children[0].children, newChild]
        nextlayoutModel.layout.children[0].children = newChildren
      }
    }
  }

  /**
   * @summary Generic function that adds a tab without a medDataObject to the layout model
   * @params {Object} action - The action passed on by the dispatchLayout function
   */
  function openGeneric(action, type, component = undefined) {
    if (component == undefined) {
      component = type
    }

    let id = type
    let isAlreadyIn = checkIfIDIsInLayoutModel(id, layoutModel)
    if (!isAlreadyIn) {
      const newChild = {
        type: "tab",
        name: type,
        id: component,
        component: component,
        config: { path: null, uuid: id, extension: type }
      }
      let layoutRequestQueueCopy = [...layoutRequestQueue]
      layoutRequestQueueCopy.push({ type: "ADD_TAB", payload: newChild })
      setLayoutRequestQueue(layoutRequestQueueCopy)
    }
  }

  /**
   * @summary Function that adds a tab of the Results Module to the layout model
   * @params {Object} action - The action passed on by the dispatchLayout function
   */
  const openResults = (action) => {
    openGeneric(action, "Results", "resultsPage")
  }

  /**
   * @summary Function that adds a tab of the Application Module to the layout model
   * @params {Object} action - The action passed on by the dispatchLayout function
   */
  const openApplication = (action) => {
    openGeneric(action, "Application", "applicationPage")
  }

  /**
   * @summary Function that adds a tab of the Evaluation Module to the layout model
   * @params {Object} action - The action passed on by the dispatchLayout function
   */
  const openEvaluation = (action) => {
    openGeneric(action, "Evaluation", "evaluationPage")
  }

  /**
   * @summary Function that adds a tab of the Input Module to the layout model
   * @params {Object} action - The action passed on by the dispatchLayout function
   */
  const openInput = (action) => {
    openGeneric(action, "Input Module", "inputPage")
  }

  /**
   * @summary Function that adds a tab of the Exploratory Module to the layout model
   * @params {Object} action - The action passed on by the dispatchLayout function
   */
  const openExploratory = (action) => {
    openGeneric(action, "Exploratory", "exploratoryPage")
  }

  /**
   * @summary Function that adds a tab of the Extraction Time Series Module to the layout model
   * @params {Object} action - The action passed on by the dispatchLayout function
   */
  const openExtractionTS = (action) => {
    openGeneric(action, "Extraction Time Series", "extractionTSPage")
  }

  /**
   * @summary Function that adds a tab of the Extraction MEDimage Module to the layout model
   * @params {Object} action - The action passed on by the dispatchLayout function
   */
  const openExtractionMEDimage = (action) => {
    openGeneric(action, "Extraction MEDimage", "extractionMEDimagePage")
  }

  /**
   * @summary Function that adds a tab of the Extraction Text Module to the layout model
   * @params {Object} action - The action passed on by the dispatchLayout function
   */
  const openExtractionText = (action) => {
    openGeneric(action, "Extraction Text", "extractionTextPage")
  }

  /**
   * @summary Function that adds a tab of the Extraction Image Module to the layout model
   * @params {Object} action - The action passed on by the dispatchLayout function
   */
  const openExtractionImage = (action) => {
    openGeneric(action, "Extraction Image", "extractionImagePage")
  }

  /**
   * @summary Function that adds a tab of the MEDfl Module to the layout model
   * @params {Object} action - The action passed on by the dispatchLayout function
   */
  const openMEDfl = (action) => {
    openGeneric(action, "MEDfl: Simulation", "medflPage")
  }

  /**
   * @summary Function that adds a tab of the MEDfl Module to the layout model
   * @params {Object} action - The action passed on by the dispatchLayout function
   */
  const openMEDflLandingPage = (action) => {
    openGeneric(action, "MEDfl", "medflLandingPage")
  }

  /**
   * @summary Function that adds a tab of the MEDfl Clients Module to the layout model
   * @params {Object} action - The action passed on by the dispatchLayout function
   */
  const openFlCLients = (action) => {
    openGeneric(action, "Manage clients", "flClientsPage")
  }

  const openFlServer = (action) => {
    openGeneric(action, "Manage Server", "flServerPage")
  }

  const openFlrwConfig = (action) => {
    openGeneric(action, "Generate scripts", "flrwConfigPage")
  }

  const openflRwWorkflow = (action) => {
    openGeneric(action, "MEDfl: Real world", "flRwWorkflowPage")
  }
  /**
   * @summary Function that adds a tab of the MED3pa Module to the layout model
   * @params {Object} action - The action passed on by the dispatchLayout function
   */
  const openMED3pa = (action) => {
    openGeneric(action, "MED3pa", "med3paPage")
  }

  /**
   * @summary Function that adds a tab of the Extraction Text Module to the layout model
   * @params {Object} action - The action passed on by the dispatchLayout function
   */
  const openMEDprofilesViewer = (action) => {
    let type = "MEDprofiles Viewer"
    let component = "MEDprofilesViewer"

    let id = type
    let isAlreadyIn = checkIfIDIsInLayoutModel(id, layoutModel)
    if (!isAlreadyIn) {
      const newChild = {
        type: "tab",
        name: type,
        id: component,
        component: component,
        config: { path: null, uuid: id, extension: type, MEDclassesFolder: action.payload.MEDclassesFolder, MEDprofilesBinaryFile: action.payload.MEDprofilesBinaryFile }
      }
      let layoutRequestQueueCopy = [...layoutRequestQueue]
      layoutRequestQueueCopy.push({ type: "ADD_TAB", payload: newChild })
      setLayoutRequestQueue(layoutRequestQueueCopy)
    }
  }

  /**
   * @summary Function that adds a tab of Dtale to the layout model
   * @params {Object} action - The action passed on by the dispatchLayout function
   */
  const openInDtale = (action) => {
    openInDotDotDot(action, "dtale", globalData)
  }

  /**
   * @summary Function that adds a tab of pandasProfiling to the layout model
   * @params {Object} action - The action passed on by the dispatchLayout function
   */
  const openInPandasProfiling = (action) => {
    openInDotDotDot(action, "pandasProfiling", globalData)
  }

  /**
   * @summary Function that adds a tab with a PDF viewer to the layout model
   * @params {Object} action - The action passed on by the dispatchLayout function
   */
  const openPDFViewer = (action) => {
    openInDotDotDot(action, "pdfViewer", globalData)
  }

  /**
   * @summary Function that adds a tab with an image viewer to the layout model
   * @params {Object} action - The action passed on by the dispatchLayout function
   */
  const openImageViewer = (action, globalData) => {
    openInDotDotDot(action, "imageViewer", globalData)
  }

  /**
   * @summary Function that adds a tab with a model viewer to the layout model
   * @params {Object} action - The action passed on by the dispatchLayout function
   */
  const openModelViewer = (action) => {
    openInTab(action, "modelViewer")
  }

  /**
   * @summary Function that adds a tab with a model viewer to the layout model
   * @params {Object} action - The action passed on by the dispatchLayout function
   */
  const openHtmlViewer = (action) => {
    openInTab(action, "htmlViewer")
  }

  /**
   * @summary Function that adds a tab with a data table to the layout model
   * @params {Object} action - The action passed on by the dispatchLayout function, it uses the payload in the action as a JSON object to add a tab containing a data table to the layout model
   */
  const openDataTable = (action) => {
    openInDotDotDot(action, "dataTable", globalData)
  }

  /**
   * @summary Function that adds a tab with a data table to the layout model
   * @params {Object} action - The action passed on by the dispatchLayout function, it uses the payload in the action as a JSON object to add a tab containing a data table to the layout model
   */
  const openDataTableFromDB = async (action) => {
    let object = action.payload

    // Check if the path is null before proceeding. Useful for input tools generated files
    if (!globalData[object.index].path) {
      openInTab(action, "dataTableFromDB")
      return
    }
    // const doesCollectionExists = await collectionExists(object.index)

    // // 16mb max BSON size
    // const maxBSONSize = 16777216
    // const fileSize = await getCollectionSize(object.index)
    // console.log("size", fileSize)

    // if (!doesCollectionExists) {
    //   toast.error("The collection does not exist in the database. Try reloading the page.")
    // } else if (fileSize > maxBSONSize) {
    //   toast.warn("The file is too large to be displayed in the data table, but you can still use it freely in the application.")
    // } else {
    openInTab(action, "dataTableFromDB")
    // }
  }

  /**
   *
   * @summary Function that adds a tab with an iframe to the layout model
   * @params {Object} action - The action passed on by the dispatchLayout function, it uses the payload in the action as a JSON object to add a new child to the layout model
   */
  const openInIFrame = (action) => {
    openInIFrameTab(action, "iframeViewer")
  }

  /**
   * @summary Function that adds a tab with a code editor to the layout model
   * @params {Object} action - The action passed on by the dispatchLayout function
   */
  const openCodeEditor = (action) => {
    openInDotDotDot(action, "codeEditor", globalData)
  }

  /**
   * @summary Function that adds an exploratory page with a medDataObject to the layout model
   * @params {Object} action - The action passed on by the dispatchLayout function
   */
  const openInExploratory = (action) => {
    openInDotDotDot(action, "exploratoryPage", globalData)
  }

  /**
   * @summary Function that adds a Results page with a medDataObject to the layout model
   * @params {Object} action - The action passed on by the dispatchLayout function, it uses the payload in the action as a JSON object to add a new child to the layout model
   */
  const openInEvaluation = (action) => {
    openInTab(action, "evaluationPage")
  }

  /**
   * @summary Function that adds a new child to the layout model
   * @params {Object} action - The action passed on by the dispatchLayout function, it uses the payload in the action as a JSON object to add a new child to the layout model
   */
  const openInLearning = (action) => {
    openInTab(action, "learningPage")
  }

  /**
   * @summary Function that adds a tab with an extraction image page to the layout model
   * @params {Object} action - The action passed on by the dispatchLayout function, it uses the payload in the action as a JSON object to add a new child to the layout model
   */
  const openInExtractionMEDimage = (action) => {
    openInDotDotDot(action, "extractionMEDimagePage", globalData)
  }

  /**
   * @summary Function that adds a tab of MEDfl resuts to the layout model
   * @params {Object} action - The action passed on by the dispatchLayout function, it uses the payload in the action as a JSON object to add a new child to the layout model
   */
  const openInMEDflresults = (action) => {
    openInDotDotDot(action, "medflResultsPage")
  }

  /**
   * @summary Function that adds a tab of MEDfl optimization resuts to the layout model
   * @params {Object} action - The action passed on by the dispatchLayout function, it uses the payload in the action as a JSON object to add a new child to the layout model
   */
  const openInMEDflOptresults = (action) => {
    openInDotDotDot(action, "medflOptResultsPage")
  }

  const openInMEDflRwresults = (action) => {
    openInDotDotDot(action, "medflRwResultsPage")
  }

  /**
   * @summary Function that adds a tab of MEDfl page
   * @params {Object} action - The action passed on by the dispatchLayout function, it uses the payload in the action as a JSON object to add a new child to the layout model
   */
  const openInFlModule = (action) => {
    openInDotDotDot(action, "medflPage")
  }

  /**
   * @summary Function that adds a tab of MEDfl page
   * @params {Object} action - The action passed on by the dispatchLayout function, it uses the payload in the action as a JSON object to add a new child to the layout model
   */
  const openInRwFlModule = (action) => {
    openInDotDotDot(action, "flRwWorkflowPage")
  }

  /**
   * @summary Function that adds a tab of MEDfl clients page
   * @params {Object} action - The action passed on by the dispatchLayout function, it uses the payload in the action as a JSON object to add a new child to the layout model
   */
  const openInFlClientsModule = (action) => {
    openInDotDotDot(action, "flClientsPage")
  }

  /**
   * @summary Function that adds a new child to the layout model
   * @params {Object} action - The action passed on by the dispatchLayout function, it uses the payload in the action as a JSON object to add a new child to the layout model
   */
  const add = (action) => {
    let textString = action.payload

    const nextlayoutModel = { ...layoutModel }
    // To add a new child to the layout model, we need to add it to the children array (layoutModel.layout.children[x].children)
    // ****IMPORTANT**** For the hook to work, we need to create a new array and not modify the existing one
    const newChildren = [...layoutModel.layout.children[0].children, action.payload]
    nextlayoutModel.layout.children[0].children = newChildren
    // setLayoutModel(nextlayoutModel)
    console.log("ADD TEST", textString)
    console.dir(layoutModel)
  }

  /**
   * @summary Function that removes a child from the layout model
   * @description
   * 1. remove is called by the dispatchLayout function from the components in the WorkspaceSidebar component
   * 2. remove is called by the flexlayoutInterpreter function from the mainContainerFunctional component - It is called when a tab is closed
   * @params {Object} action - The action passed on by the dispatchLayout function, it uses the payload in the action as a JSON object to remove a child from the layout model
   */
  const remove = (action) => {
    // Searches the layoutModel for the payload and removes it, iterates over the childen array (layoutModel.layout.children[x].children)
    // and removes the payload if it exists
    console.log("REMOVE TEST", action.payload)
    let textString = action.payload
    const nextlayoutModel = { ...layoutModel }
    /** Here, we iterate through the layout model children, then we filter out the ones specified
     * ****IMPORTANT**** For the hook to work, we need to create a new array and not modify the existing one
     */
    for (let i = 0; i < nextlayoutModel.layout.children.length; i++) {
      nextlayoutModel.layout.children[i].children = nextlayoutModel.layout.children[i].children.filter((child) => child.name !== textString.name)
    }
    // nextlayoutModel.layout.children[0].children = nextlayoutModel.layout.children[0].children.filter((child) => child !== action.payload);
    setLayoutModel(nextlayoutModel)
  }

  useEffect(() => {
    console.log("LAYOUT MODEL", layoutMainState)
  }, [layoutMainState])

  useEffect(() => {
    console.log("LAYOUT REQUEST QUEUE", layoutRequestQueue)
  }, [layoutRequestQueue])
  // Returns the LayoutModelContext.Provider with the layoutModel, the dispatchLayout function and the flexlayoutInterpreter function as values
  // The children are wrapped by the LayoutModelContext.Provider and will have access to the layoutModel, the dispatchLayout function and the flexlayoutInterpreter function
  return (
    <LayoutModelContext.Provider
      value={{ layoutModel, setLayoutModel, dispatchLayout, flexlayoutInterpreter, layoutMainState, setLayoutMainState, layoutRequestQueue, setLayoutRequestQueue, developerMode, setDeveloperMode, isEditorOpen, setIsEditorOpen }}
    >
      {children}
    </LayoutModelContext.Provider>
  )
}

function checkIfIDIsInLayoutModel(id, layoutModel) {
  let isInLayoutModel = false
  console.log("CHECKING IF ID IS IN LAYOUT MODEL", layoutModel, id)
  return isInLayoutModel
}

export { LayoutModelProvider, LayoutModelContext }
