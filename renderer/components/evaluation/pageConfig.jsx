import React, { useEffect, useState } from "react"
import { Card } from "primereact/card"
import { Button } from "primereact/button"
import { PiFlaskFill } from "react-icons/pi"
import Input from "../learning/input"
import { Tag } from "primereact/tag"
import { Tooltip } from "primereact/tooltip"

/**
 *
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
 * @param {Function} checkForEmptyInput Function to check if model or dataset inputs are not set
 *
 * @returns the configuation page of the evaluation page
 */
const PageConfig = ({
  pageId,
  config,
  updateWarnings,
  setChosenModel,
  setChosenDataset,
  modelHasWarning,
  setModelHasWarning,
  datasetHasWarning,
  setDatasetHasWarning,
  updateConfigClick,
  useMedStandard,
  checkForEmptyInput
}) => {
  // on load check if there is a config

  const [selectedDatasets, setSelectedDatasets] = useState([])

  useEffect(() => {
    setChosenDataset({ selectedDatasets })
    updateWarnings(useMedStandard)
  }, [selectedDatasets])

  // header template
  const header = (
    <div className="center-page">
      <PiFlaskFill style={{ height: "6rem", width: "auto", color: "rgb(0, 50, 200, 0.8)" }} />
    </div>
  )

  // footer template
  const footer = (
    <>
      <Button label="Create evaluation" icon="pi pi-arrow-right" iconPos="right" disabled={checkForEmptyInput() || modelHasWarning.state || datasetHasWarning.state} onClick={updateConfigClick} />
    </>
  )

  return (
    <>
      <div className="center-page config-page">
        <Card title="Evaluation Page Configuration" subTitle="Please fill the following fields" style={{ width: "50%" }} footer={footer} header={header}>
          <div>
            {modelHasWarning.state && (
              <>
                <Tag className={`model-warning-tag-${pageId}`} icon="pi pi-exclamation-triangle" severity="warning" value="" rounded data-pr-position="left" data-pr-showdelay={200} />
                <Tooltip target={`.model-warning-tag-${pageId}`} autoHide={false}>
                  <span>{modelHasWarning.tooltip}</span>
                </Tooltip>
              </>
            )}
            <Input
              name="Choose model to evaluate"
              settingInfos={{ type: "models-input", tooltip: "" }}
              currentValue={config.model?.id}
              onInputChange={(data) => setChosenModel(data.value)}
              setHasWarning={setModelHasWarning}
            />
          </div>
          <div>
            {datasetHasWarning.state && (
              <>
                <Tag className={`dataset-warning-tag-${pageId}`} icon="pi pi-exclamation-triangle" severity="warning" value="" rounded data-pr-position="left" data-pr-showdelay={200} />
                <Tooltip target={`.dataset-warning-tag-${pageId}`} autoHide={false}>
                  <span>{datasetHasWarning.tooltip}</span>
                </Tooltip>
              </>
            )}
            {useMedStandard ? (
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
            ) : (
              <Input
                name="Choose dataset"
                settingInfos={{ type: "data-input", tooltip: "" }}
                currentValue={config.datset}
                onInputChange={(data) => setChosenDataset(data.value)}
                setHasWarning={setDatasetHasWarning}
              />
            )}
          </div>
        </Card>
      </div>
    </>
  )
}

export default PageConfig
