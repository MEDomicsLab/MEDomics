import { Button } from "primereact/button"
import { TabPanel, TabView } from "primereact/tabview"
import { Tag } from "primereact/tag"
import { Tooltip } from "primereact/tooltip"
import { useCallback, useContext, useEffect, useRef, useState } from "react"
import { PiFlaskFill } from "react-icons/pi"
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels"
import { toast } from "react-toastify"
import { requestBackend } from "../../utilities/requests"
import { ErrorRequestContext } from "../generalPurpose/errorRequestContext"
import Input from "../learning/input"
import { WorkspaceContext } from "../workspace/workspaceContext"
import Dashboard from "./dashboard"
import PredictPanel from "./predictPanel"

/**
 *@param {Object} run Object containing the run state and the run function
 * @param {String} pageId Id of the page for multi-tabs support
 * @param {Object} config Configuration of the page
 * @param {Function} updateWarnings Function to update the warnings
 * @param {Function} setChosenModel Function to set the chosen model
 * @param {Function} setChosenDataset Function to set the chosen dataset
 * @param {Object} modelHasWarning Object containing the model warning state and tooltip
 * @param {Function} setModelHasWarning Function to set the model warning state and tooltip
 * @param {Object} datasetHasWarning Object containing the dataset warning state and tooltip
 * @param {Function} setDatasetHasWarning Function to set the dataset warning state and tooltip
 * @param {Function} updateConfigClick Function to update the config on click
 *
 * @returns the evaluation page content
 */
const PageEval = ({ run, pageId, config, updateWarnings, setChosenModel, updateConfigClick, setChosenDataset, modelHasWarning, setModelHasWarning, datasetHasWarning, setDatasetHasWarning, useMedStandard }) => {
  const evaluationHeaderPanelRef = useRef(null)
  const [showHeader, setShowHeader] = useState(true)
  const [activeIndex, setActiveIndex] = useState(0) // tab index
  const [isDashboardUpdating, setIsDashboardUpdating] = useState(false)
  const [isPredictUpdating, setIsPredictUpdating] = useState(false)
  const [predictedData, setPredictedData] = useState(undefined) // we use this to store the predicted data
  const [predictError, setPredictError] = useState(undefined) // we use this to store any error from the predict step
  const [dashboardError, setDashboardError] = useState(undefined) // we use this to store any error from the dashboard step
  const { port } = useContext(WorkspaceContext) // we get the port for server connexion
  const { setError } = useContext(ErrorRequestContext)


  // eslint-disable-next-line react-hooks/rules-of-hooks , no-unused-vars
  const [selectedDatasets, setSelectedDatasets] = config.dataset.selectedDatasets ? useState(config.dataset.selectedDatasets) : useState([])

  useEffect(() => {
    setChosenDataset({ selectedDatasets })
    updateWarnings(useMedStandard)
  }, [selectedDatasets])

  // close everything when the page is closed
  useEffect(() => {
    return () => {
      requestBackend(
        port,
        "removeId/" + "dashboard/" + pageId,
        { pageId: pageId },
        (data) => {
          if (data.error) {
            console.error(data)
          }
          console.log("closing", data, "with id:", pageId)
        },
        (error) => {
          console.error(error)
        }
      )
      requestBackend(
        port,
        "removeId/" + "predict/" + pageId,
        { pageId: pageId },
        (data) => {
          if (data.error) {
            console.error(data)
          }
          console.log("closing", data, "with id:", pageId)
        },
        (error) => {
          console.error(error)
        }
      )
    }
  }, [])

  // when the run changes, we start the evaluation processes
  useEffect(() => {
    startCalls2Server()
  }, [run])

  /**
   *
   * @param {Object} modelObjCopies Object containing the paths of the copies of the model
   * @description - This function is used to start the evaluation processes
   */
  const startCalls2Server = useCallback(
    (/* modelObjCopies */) => {
      // start predict
      setIsPredictUpdating(true)
      requestBackend(
        port,
        "evaluation/predict_test/predict/" + pageId,
        { pageId: pageId, ...config, useMedStandard: useMedStandard },
        (data) => {
          console.log("received response:", data)
          setIsPredictUpdating(false)
          if (data.error) {
            if (typeof data.error == "string") {
              data.error = JSON.parse(data.error)
            }
            setError(data.error)
            setPredictError(data.error)
          } else {
            setPredictedData(data)
            startDashboardCall()
            toast.success("Predicted data is ready")
            toast.info("Dashboard is being prepared")
            setActiveIndex(1) // switch to dashboard tab
          }
          console.log("predict_test received data:", data)
        },
        (error) => {
          console.error(error)
          setIsPredictUpdating(false)
        }
      )

      // start dashboard
      const startDashboardCall = () => {
        requestBackend(
          port,
          "evaluation/close_dashboard/dashboard/" + pageId,
          { pageId: pageId },
          () => {
            setIsDashboardUpdating(true)
            // TODO: @NicoLongfield - Let choose sample size
            requestBackend(
              port,
              "evaluation/open_dashboard/dashboard/" + pageId,
              {
                pageId: pageId,
                ...config,
                sampleSizeFrac: 1,
                dashboardName: config.model.name.split(".")[0],
                useMedStandard: useMedStandard
              },
              (data) => {
                console.log("openDashboard received data:", data)
                setIsDashboardUpdating(false)
                if (data.error) {
                  if (typeof data.error == "string") {
                    data.error = JSON.parse(data.error)
                  }
                  setError(data.error)
                  setDashboardError(data.error)
                } else {
                  toast.success("Dashboard is ready")
                }
              },
              (error) => {
                console.log("openDashboard received error:", error)
                setIsDashboardUpdating(false)
              }
            )
          },
          (error) => {
            console.log("closeDashboard received error:", error)
            setError(error)
            setDashboardError(error)
            setIsDashboardUpdating(false)
          }
        )
      }
    },
    [config]
  )

  const updateConfigClickWrapper = () => {
    setPredictError(undefined)
    setDashboardError(undefined)
    setActiveIndex(0) // switch to predict tab
    updateConfigClick()
  }

  // handle resizing of the header when clicking on the button
  useEffect(() => {
    if (evaluationHeaderPanelRef.current) {
      if (showHeader) {
        document.getElementById(`data-panel-id-eval-header-${pageId}`).style.minHeight = "100px"
        evaluationHeaderPanelRef.current.expand()
      } else {
        document.getElementById(`data-panel-id-eval-header-${pageId}`).style.minHeight = "0px"
        evaluationHeaderPanelRef.current.collapse()
      }
    }
  }, [showHeader])

  return (
    <div className="evaluation-content">
      <PanelGroup style={{ height: "100%", display: "flex", flexGrow: 1 }} direction="vertical" id={pageId}>
        {/* Panel is used to create the flow, used to be able to resize it on drag */}
          <>
            <Panel
              order={1}
              ref={evaluationHeaderPanelRef}
              id={`eval-header-${pageId}`}
              defaultSize={10}
              minSize={10}
              maxSize={10}
              collapsible={true}
              collapsibleSize={10}
              className="smooth-transition evaluation-header-parent"
            >
              <div className="evaluation-header">
                <PiFlaskFill style={{ height: "4rem", width: "4rem", color: "rgb(0, 50, 200, 0.8)" }} />
                <div style={{ width: "20rem" }}>
                  {modelHasWarning.state && (
                    <>
                      <Tag className={`model-warning-tag-${pageId}`} icon="pi pi-exclamation-triangle" severity="warning" value="" rounded data-pr-position="bottom" data-pr-showdelay={200} />
                      <Tooltip target={`.model-warning-tag-${pageId}`} autoHide={false}>
                        <span>{modelHasWarning.tooltip}</span>
                      </Tooltip>
                    </>
                  )}
                  <Input
                    name="Choose model to evaluate"
                    settingInfos={{ type: "models-input", tooltip: "" }}
                    currentValue={config.model.id}
                    onInputChange={(data) => setChosenModel(data.value)}
                    setHasWarning={setModelHasWarning}
                  />
                </div>
                <div style={{ width: "20rem" }}>
                  {datasetHasWarning.state && (
                    <>
                      <Tag className={`dataset-warning-tag-${pageId}`} icon="pi pi-exclamation-triangle" severity="warning" value="" rounded data-pr-position="bottom" data-pr-showdelay={200} />
                      <Tooltip target={`.dataset-warning-tag-${pageId}`} autoHide={false}>
                        <span>{datasetHasWarning.tooltip}</span>
                      </Tooltip>
                    </>
                  )}
                  {!useMedStandard ? (
                    <Input
                      name="Choose dataset"
                      settingInfos={{ type: "data-input", tooltip: "" }}
                      currentValue={config.dataset.id}
                      onInputChange={(data) => setChosenDataset(data.value)}
                      setHasWarning={setDatasetHasWarning}
                    />
                  ) : (
                    <div className="med-standard-div">
                      <Input
                        key={"files"}
                        name="files"
                        settingInfos={{
                          type: "data-input-multiple",
                          tooltip: "<p>Specify a data file (xlsx, csv, json)</p>"
                        }}
                        currentValue={selectedDatasets || null}
                        onInputChange={(e) => setSelectedDatasets(e.value)}
                        // onInputChange={onMultipleFilesChange}
                        setHasWarning={setDatasetHasWarning}
                      />
                    </div>
                  )}

                </div>
                <Button
                  style={{ width: "15rem" }}
                  label="Update evaluation"
                  icon="pi pi-refresh"
                  iconPos="right"
                  disabled={modelHasWarning.state || datasetHasWarning.state}
                  onClick={updateConfigClickWrapper}
                />
              </div>
            </Panel>
            <PanelResizeHandle />
          </>
        {/* Panel is used to create the results pane, used to be able to resize it on drag */}
        <Panel id={`eval-body-${pageId}`} minSize={30} order={2} collapsible={true} collapsibleSize={10} className="eval-body">
            <Button className={`btn-show-header ${showHeader ? "opened" : "closed"}`} onClick={() => setShowHeader(!showHeader)}>
              <hr />
              <i className="pi pi-chevron-down"></i>
              <hr />
            </Button>

          <div className="eval-body-content">
            <TabView renderActiveOnly={false} activeIndex={activeIndex} onTabChange={(e) => setActiveIndex(e.index)}>
              <TabPanel key="Predict" header="Predict/Test">
                <PredictPanel isUpdating={isPredictUpdating} setIsUpdating={setIsPredictUpdating} data={predictedData} error={predictError} />
              </TabPanel>
              <TabPanel key="Dash" header="Dashboard">
                <Dashboard isUpdating={isDashboardUpdating} setIsUpdating={setIsDashboardUpdating} errorPrediction={predictError} error={dashboardError} />
              </TabPanel>
            </TabView>
          </div>
        </Panel>
      </PanelGroup>
    </div>
  )
}

export default PageEval
