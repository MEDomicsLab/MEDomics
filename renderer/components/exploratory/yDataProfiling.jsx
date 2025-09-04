import React, { useState, useContext } from "react"
import { Tag } from "primereact/tag"
import { Tooltip } from "primereact/tooltip"
import { Button } from "primereact/button"
import { ToggleButton } from "primereact/togglebutton"
import { Card } from "primereact/card"
import { LayoutModelContext } from "../layout/layoutContext"
import { requestBackend } from "../../utilities/requests"
import { Stack } from "react-bootstrap"
import { toast } from "react-toastify"
import Input from "../learning/input"
import ProgressBarRequests from "../generalPurpose/progressBarRequests"
import { randomUUID } from "crypto"
import { insertMEDDataObjectIfNotExists } from "../mongoDB/mongoDBUtils"
import { DataContext } from "../workspace/dataContext"
import { MEDDataObject } from "../workspace/NewMedDataObject"

/**
 *
 * @param {String} pageId The page id
 * @param {Number} port The port of the backend
 * @param {Function} setError The function to set the error
 * @returns
 */
const YDataProfiling = ({ pageId, port, setError }) => {
  const [mainDataset, setMainDataset] = useState()
  const [compDataset, setCompDataset] = useState()
  const [mainDatasetHasWarning, setMainDatasetHasWarning] = useState({ state: false, tooltip: "" })
  const [compDatasetHasWarning, setCompDatasetHasWarning] = useState({ state: false, tooltip: "" })
  const [compareChecked, setCompareChecked] = useState(false)
  const { dispatchLayout } = useContext(LayoutModelContext)
  const [isCalculating, setIsCalculating] = useState(false)
  const [report, setReport] = useState(null)
  const [progress, setProgress] = useState({ now: 0, currentLabel: 0 })
  const { globalData } = useContext(DataContext)

  var path = require("path")

  /**
   *
   * @param {String} filePath The file path to open
   * @returns The file path to open
   */
  const handleOpenFile = (localReport) => () => {
    const objectToRet = {
      index: localReport.id,
      data: localReport.name,
      extension: localReport.type
    }
    dispatchLayout({ type: "openHtmlViewer", payload: objectToRet })
  }

  /**
   * @description Load the generated report in database
   */
  const setReportInDB = async (htmlFileID) => {
    let globalDataCopy = { ...globalData }
    const ydataprofilingFolder = new MEDDataObject({
      id: randomUUID(),
      name: "ydataProfiling_reports",
      type: "directory",
      parentID: "DATA",
      childrenIDs: [],
      inWorkspace: false
    })
    const parentId = await insertMEDDataObjectIfNotExists(ydataprofilingFolder)
    // Append the new object to a local global data copy to avoid calling MEDDataObject.updateWorkspaceDataObject() twice
    if (parentId == ydataprofilingFolder.id) {
      globalDataCopy[parentId] = ydataprofilingFolder
    }
    let medObjectName =
      compDataset && compareChecked ? 
      path.basename(mainDataset.value.name, ".csv") + 
      "_" + path.basename(compDataset.name, ".csv") + 
      ".html" : path.basename(mainDataset.value.name, ".csv") + 
      ".html"
    medObjectName = MEDDataObject.getUniqueNameForCopy(globalDataCopy, medObjectName, parentId)
    const newReport = new MEDDataObject({
      id: htmlFileID,
      name: medObjectName,
      type: "html",
      parentID: parentId,
      childrenIDs: [],
      inWorkspace: false
    })
    await insertMEDDataObjectIfNotExists(newReport)
    setReport(newReport)
    MEDDataObject.updateWorkspaceDataObject()
  }

  /**
   * @description This function is used to open the html viewer with the given file path
   */
  const generateReport = () => {
    const htmlFileID = randomUUID()
    setIsCalculating(true)
    setReport(null)
    requestBackend(
      port,
      "exploratory/start_ydata_profiling/" + pageId,
      { mainDataset: mainDataset.value, compDataset: compDataset && compareChecked ? compDataset : "", htmlFileID: htmlFileID },
      (response) => {
        console.log(response)
        if (response.error) {
          setError(response.error)
          toast.error("Error generating report")
        } else {
          setReportInDB(htmlFileID)
          toast.success("Report generated successfully")
        }
        setIsCalculating(false)
      },
      (error) => {
        console.log(error)
        setError(error)
        toast.error("Error generating report")
      }
    )
  }

  return (
    <Card
      title={
        <>
          <div className="p-card-title">
            <a
              className="web-server-link"
              onClick={() => {
                require("electron").shell.openExternal("https://docs.profiling.ydata.ai")
              }}
            >
              ydata-profiling
            </a>
          </div>
        </>
      }
    >
      <Stack gap={2}>
        <div className="data-with-warning">
          {mainDatasetHasWarning.state && (
            <>
              <Tag className={`main-dataset-warning-tag-${pageId}`} icon="pi pi-exclamation-triangle" severity="warning" value="" rounded data-pr-position="left" data-pr-showdelay={200} />
              <Tooltip target={`.main-dataset-warning-tag-${pageId}`} autoHide={false}>
                <span>{mainDatasetHasWarning.tooltip}</span>
              </Tooltip>
            </>
          )}
          <div className="input-btn-group">
            <Input
              name="Choose main dataset"
              settingInfos={{ type: "data-input", tooltip: "" }}
              currentValue={mainDataset && mainDataset.value.id}
              onInputChange={(data) => setMainDataset(data)}
              setHasWarning={setMainDatasetHasWarning}
            />
            <Button
              onClick={generateReport}
              className="btn btn-primary"
              label="Generate report"
              icon="pi pi-chart-bar"
              iconPos="right"
              disabled={compareChecked || !mainDataset || mainDatasetHasWarning.state}
            />
          </div>
        </div>
        <ToggleButton className="add-compare" onLabel="Only use one dataset" offLabel="Compare with another dataset" checked={compareChecked} onChange={(e) => setCompareChecked(e.value)} />
        {compareChecked && (
          <div className="data-with-warning">
            {compDatasetHasWarning.state && (
              <>
                <Tag className={`comp-dataset-warning-tag-${pageId}`} icon="pi pi-exclamation-triangle" severity="warning" value="" rounded data-pr-position="left" data-pr-showdelay={200} />
                <Tooltip target={`.comp-dataset-warning-tag-${pageId}`} autoHide={false}>
                  <span>{compDatasetHasWarning.tooltip}</span>
                </Tooltip>
              </>
            )}
            <div className="input-btn-group">
              <Input
                name="Choose second dataset"
                settingInfos={{ type: "data-input", tooltip: "" }}
                currentValue={compDataset && compDataset.value}
                onInputChange={(data) => setCompDataset(data.value)}
                setHasWarning={setCompDatasetHasWarning}
              />
              <Button
                onClick={generateReport}
                className="btn btn-primary"
                label="Generate compare report"
                icon="pi pi-chart-bar"
                iconPos="right"
                disabled={!mainDataset || !compDataset || compDatasetHasWarning.state || mainDatasetHasWarning.state}
              />
            </div>
          </div>
        )}
        {isCalculating && !report && (
          <ProgressBarRequests
            delayMS={500}
            progressBarProps={{ animated: true, variant: "success" }}
            isUpdating={isCalculating}
            setIsUpdating={setIsCalculating}
            progress={progress}
            setProgress={setProgress}
            requestTopic={"exploratory/progress/" + pageId}
          />
        )}
        {report && (
          <div className="finish-btn-group">
            <Button onClick={handleOpenFile(report)} className="btn btn-primary" label="Open generated file" icon="pi pi-chart-bar" iconPos="right" severity="success" />
          </div>
        )}
      </Stack>
    </Card>
  )
}

export default YDataProfiling
