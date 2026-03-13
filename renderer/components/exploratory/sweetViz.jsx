import React, { useState, useContext } from "react"
import { LayoutModelContext } from "../layout/layoutContext"
import { Stack } from "react-bootstrap"
import { Tag } from "primereact/tag"
import { Tooltip } from "primereact/tooltip"
import { Card } from "primereact/card"
import Input from "../learning/input"
import { Button } from "primereact/button"
import { ToggleButton } from "primereact/togglebutton"
import ProgressBarRequests from "../generalPurpose/progressBarRequests"
import { getCollectionColumns } from "../mongoDB/mongoDBUtils"
import { toast } from "react-toastify"
import { WorkspaceContext } from "../workspace/workspaceContext"
import { openExploratoryReportInIframe, resolveExploratoryExpressPort, resolveExploratoryReportUrl } from "./exploratoryRemoteUtils"

/**
 *
 * @param {String} pageId The page id
 * @param {Number} port The port of the backend
 * @param {Function} setError The function to set the error
 *
 * @returns A card with the sweetviz module
 */
const SweetViz = ({ pageId, setError }) => {
  const [mainDataset, setMainDataset] = useState()
  const [compDataset, setCompDataset] = useState()
  const [mainDatasetHasWarning, setMainDatasetHasWarning] = useState({ state: false, tooltip: "" })
  const [compDatasetHasWarning, setCompDatasetHasWarning] = useState({ state: false, tooltip: "" })
  const [compareChecked, setCompareChecked] = useState(false)
  const { dispatchLayout } = useContext(LayoutModelContext)
  const [isCalculating, setIsCalculating] = useState(false)
  const [progress, setProgress] = useState({ now: 0, currentLabel: 0 })
  const [mainDatasetTarget, setMainDatasetTarget] = useState()
  const [mainDatasetTargetChoices, setMainDatasetTargetChoices] = useState()
  const [reportUrl, setReportUrl] = useState("")
  const { workspace } = useContext(WorkspaceContext)

  /**
   * @description Change the selected target
   * @param {Object} inputUpdate The input update
   */
  const onTargetChange = (inputUpdate) => {
    setMainDatasetTarget(inputUpdate.value)
  }

  /**
   * @description This function is used to update the main dataset, target and target choices
   * @param {Object} inputUpdate The input update
   */
  const onDatasetChange = async (inputUpdate) => {
    setMainDataset(inputUpdate)
    if (inputUpdate.value.id != "") {
      let columns = await getCollectionColumns(inputUpdate.value.id)
      let columnsDict = {}
      columns.forEach((column) => {
        columnsDict[column] = column
      })
      setMainDatasetTargetChoices(columnsDict)
      setMainDatasetTarget(columnsDict[columns[columns.length - 1]])
    }
  }

  const openReportInIframe = (url) => {
    openExploratoryReportInIframe({ dispatchLayout, url, name: "SweetViz", idPrefix: "sweetviz" })
  }

  /**
   * @description This function is used to open the html viewer with the given file path
   */
  const generateReport = () => {
    setIsCalculating(true)
    setReportUrl("")
    ;(async () => {
      try {
        const isRemoteMode = !!workspace?.isRemote
        const expressPort = await resolveExploratoryExpressPort(isRemoteMode)
        const response = await window.backend.requestExpress({
          method: "post",
          port: expressPort,
          path: "/exploratory/sweetviz/start",
          body: {
            pageId,
            mainDataset: mainDataset.value,
            compDataset: compDataset && compareChecked ? compDataset : "",
            target: mainDatasetTarget
          },
          timeout: 180000
        })
        const payload = response?.data || {}
        if (!payload.success) {
          throw new Error(payload.error || "Error generating report")
        }
        const url = resolveExploratoryReportUrl({ reportPath: payload.reportPath, localExpressPort: expressPort, isRemoteMode, reportType: "SweetViz" })
        setReportUrl(url)
        toast.success("Report generated successfully")
      } catch (error) {
        console.error(error)
        setError(error?.message || "Error generating report")
        toast.error("Error generating report")
      } finally {
        setIsCalculating(false)
      }
    })()
  }

  return (
    <Card
      title={
        <>
          <div className="p-card-title">
            <a
              className="web-server-link"
              onClick={() => {
                require("electron").shell.openExternal("https://github.com/fbdesignpro/sweetviz")
              }}
            >
              SweetViz
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
              onInputChange={onDatasetChange}
              setHasWarning={setMainDatasetHasWarning}
            />
            <Input
              disabled={mainDataset && mainDataset.path == ""}
              name="target"
              currentValue={mainDatasetTarget}
              settingInfos={{
                type: "list",
                tooltip: "<p>Specify the column name of the target variable</p>",
                choices: mainDatasetTargetChoices || {}
              }}
              onInputChange={onTargetChange}
              customProps={{
                filter: true
              }}
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
        {isCalculating && !reportUrl && (
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
        {reportUrl && (
          <div className="finish-btn-group">
            <Button onClick={() => openReportInIframe(reportUrl)} className="btn btn-primary" label="Open generated report" icon="pi pi-chart-bar" iconPos="right" severity="success" />
          </div>
        )}
      </Stack>
    </Card>
  )
}

export default SweetViz
