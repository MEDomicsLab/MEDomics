import "reactflow/dist/style.css"
import { useContext, useEffect, useRef, useState } from "react"
import SidebarAvailableNodes from "./sidebarAvailableNodes"
import { ReactFlowProvider } from "reactflow"
import { FlowInfosProvider, FlowInfosContext } from "./context/flowInfosContext"
import { FlowResultsContext, FlowResultsProvider } from "./context/flowResultsContext"
import { FlowFunctionsProvider } from "./context/flowFunctionsContext"
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels"
import ResultsPane from "./results/resultsPane"

/**
 *
 * @param {String} pageId Id of the page for multi-tabs support
 * @param {String} workflowType type of the workflow (e.g. "learning", "extraction", "optimize") this is used to load the correct sidebar
 * @param {JSX.Element} workflowJSX JSX element of the workflow
 *
 * @description This component is the base for all the flow pages. It contains the sidebar, the flow and the results pane.
 *
 */
const FlowPageBaseWithFlowInfos = ({ children, workflowType, id, isExperiment, runFinalizeAndSave }) => {
  // here is the use of the context to update the flowInfos
  const [isDragging, setIsDragging] = useState(false)
  const { updateFlowInfos, showAvailableNodes } = useContext(FlowInfosContext)
  const { showResultsPane, setShowResultsPane } = useContext(FlowResultsContext)
  const sidebarPanelRef = useRef(null)
  const resultsPanelRef = useRef(null)

  // this useEffect is used to update the flowInfos when the pageId or the workflowType changes
  useEffect(() => {
    updateFlowInfos({
      type: workflowType
    })
  }, [workflowType])

  // useeffect to collapse the sidebar when showAvailableNodes is false and expand it when it is true
  useEffect(() => {
    if (sidebarPanelRef.current) {
      if (showAvailableNodes) {
        document.getElementById("data-panel-id-sidebar" + id).style.minWidth = "230px"
        sidebarPanelRef.current.expand()
      } else {
        document.getElementById("data-panel-id-sidebar" + id).style.minWidth = "0px"
        sidebarPanelRef.current.collapse()
      }
    }
  }, [showAvailableNodes])

  // useeffect to collapse the results pane when showResultsPane is false and expand it when it is true
  // showResultsPane is controlled by the flowResultsContext
  useEffect(() => {
    if (resultsPanelRef.current) {
      if (showResultsPane) {
        resultsPanelRef.current.expand()
      } else {
        resultsPanelRef.current.collapse()
      }
    }
  }, [showResultsPane])

  return (
    <>
      {/* PanelGroup is used to create the general layout of a flow page */}
      <PanelGroup className="width-100 height-100" style={{ height: "100%", display: "flex", flexGrow: 1 }} direction="horizontal" id={id}>
        {/* Panel is used to create the sidebar, used to be able to resize it on click */}
        <Panel ref={sidebarPanelRef} id={"sidebar" + id} minSize={18.5} maxSize={18.5} defaultSize={0} order={1} collapsible={true} collapsibleSize={5} className="smooth-transition">
          <SidebarAvailableNodes title="Available Nodes" sidebarType={workflowType} experimenting={isExperiment}/>
        </Panel>
        
        <PanelResizeHandle />
        {/* Panel is used to create the flow, used to be able to resize it on drag */}
        <Panel minSize={25} order={2} className="main-scene-panel">
          {/* in this panel, we use another PanelGroup to create the layout of the flow and the results pane */}
          <PanelGroup className="width-100 height-100" style={{ padding: "0" }} direction="vertical">
            {/* Panel is used to create the flow, used to be able to resize it on drag */}
            <Panel order={1}>
              <ReactFlowProvider>{children}</ReactFlowProvider>
            </Panel>
            <PanelResizeHandle
              className="resize-handle-results"
              onDragging={(event) => {
                setIsDragging(!event)
              }}
            />
            {/* Panel is used to create the results pane, used to be able to resize it on drag */}
            <Panel
              ref={resultsPanelRef}
              id="results"
              className={`${isDragging ? "smooth-transition" : ""}`}
              maxSize={75}
              minSize={30}
              defaultSize={0}
              order={2}
              collapsible={true}
              collapsibleSize={50}
              onResize={(size) => {
                size > 5 ? setShowResultsPane(true) : setShowResultsPane(false)
              }}
            >
              <ResultsPane runFinalizeAndSave={runFinalizeAndSave} isExperiment={isExperiment} />
            </Panel>
          </PanelGroup>
        </Panel>
   
      </PanelGroup>
    </>
  )
}

/**
 *
 * @param {*} props all the props of the FlowPageBaseWithFlowInfos component
 * @description This component is composed of the FlowPageBaseWithFlowInfos component and the FlowInfosProvider component.
 * It is also the default export of this file. see components/learning/learningPage.jsx for an example of use.
 * It is used to create all the context providers for the flow page.
 */
const FlowPageBase = (props) => {
  return (
    <FlowInfosProvider>
      <FlowResultsProvider>
        <FlowFunctionsProvider>
          <FlowPageBaseWithFlowInfos {...props} />
        </FlowFunctionsProvider>
      </FlowResultsProvider>
    </FlowInfosProvider>
  )
}
export default FlowPageBase
