import { randomUUID } from "crypto"
import { shell } from "electron"
import { Badge } from "primereact/badge"
import { Button } from "primereact/button"
import { Card } from "primereact/card"
import { Panel } from "primereact/panel"
import { ProgressSpinner } from 'primereact/progressspinner'
import { SelectButton } from "primereact/selectbutton"
import { Tag } from "primereact/tag"
import { Tooltip } from "primereact/tooltip"
import React, { useContext, useEffect, useState } from "react"
import { Col, Row, Stack } from "react-bootstrap"
import { toast } from "react-toastify"
import { requestBackend } from "../../utilities/requests"
import DataTableFromDB from "../dbComponents/dataTableFromDB"
import { getCollectionData } from "../dbComponents/utils"
import { ErrorRequestContext } from "../generalPurpose/errorRequestContext"
import { LoaderContext } from "../generalPurpose/loaderContext"
import Input from "../learning/input"
import { getCollectionColumns, insertMEDDataObjectIfNotExists } from "../mongoDB/mongoDBUtils"
import { DataContext } from "../workspace/dataContext"
import { MEDDataObject } from "../workspace/NewMedDataObject"
import { WorkspaceContext } from "../workspace/workspaceContext"
import ModulePage from "./moduleBasics/modulePage"

/**
 *
 * @param {string} pageId The id of the page
 * @param {function} setRequestSettings The function to set the request settings
 * @param {Object} chosenModel The chosen model
 * @param {Object} modelMetadata The metadata of the chosen model
 * @param {function} updateWarnings The function to update the warnings
 * @param {string} mode The mode of the entry
 * @param {function} setMode The function to set the mode
 * @param {function} setIsValid2Predict The function to set the isValid2Predict
 * @param {Object} inputsData The inputs data
 * @param {function} setInputsData The function to set the inputs data
 *
 * @returns {React.Component} The entry component
 */
const Entry = ({ pageId, setRequestSettings, chosenModel, modelMetadata, updateWarnings, mode, setMode, setIsValid2Predict, inputsData, setInputsData, modelColumns, imputedColumns }) => {
  const [chosenDataset, setChosenDataset] = useState(null)
  const [datasetHasWarning, setDatasetHasWarning] = useState({ state: true, tooltip: "No dataset selected" })
  const [isColsValid, setIsColsValid] = useState(false)

  const inputOptions = [
    { label: "Manual Sample Entry", value: "unique" },
    { label: "Test File Input", value: "table" }
  ]

  useEffect(() => {
    if (modelMetadata) {
      let columns = modelColumns
      columns = columns.filter((col) => !imputedColumns.includes(col))
      let isValid = true
      columns.forEach((columnName) => {
        if (columnName !== modelMetadata.target) {
          if (!inputsData[columnName] || (typeof inputsData[columnName] === "object" && !inputsData[columnName][0])) {
            isValid = false
          }
        }
      })
      setIsColsValid(isValid)
    }
  }, [inputsData])

  useEffect(() => {
    updateWarnings(chosenDataset, setDatasetHasWarning)
  }, [chosenDataset, chosenModel])

  useEffect(() => {
    if (mode === "table") {
      setIsValid2Predict(!datasetHasWarning.state)
    } else {
      setIsValid2Predict(isColsValid)
    }
  }, [mode, datasetHasWarning, isColsValid])

  useEffect(() => {
    setRequestSettings({
      model: chosenModel,
      dataset: chosenDataset,
      data: inputsData,
      type: mode
    })
  }, [chosenModel, chosenDataset, inputsData, mode])

  const handleInputUpdate = (inputUpdate) => {
    if (!Object.keys(inputsData).includes(inputUpdate.name)) {
      toast.error(`Column ${inputUpdate.name} is not a required column for the model.`)
      return
    }
    const newInputsData = { ...inputsData, [inputUpdate.name]: [inputUpdate.value] }
    setInputsData(newInputsData)
  }

  const onDatasetChange = (inputUpdate) => {
    setChosenDataset(inputUpdate.value)
  }

  return (
    <>
      <div className="mb-3" style={{ width: "100%" }}>
      <div style={{ width: "100%", display: "flex" }}>
        <SelectButton
          className="select-button-full"
          value={mode}
          onChange={(e) => setMode(e.value)}
          options={inputOptions}
          optionLabel="label"
          dataKey="value"
          unselectable={false}
          style={{ width: "100%" }}
        />
      </div>
        <div className="mt-2" style={{ fontStyle: "italic", fontSize: "0.9rem" }}>
          {inputOptions.find((opt) => opt.value === mode)?.description}
        </div>
      </div>

      {mode === "unique" && (
        <div className="columns-filling">
          {modelColumns.map((columnName, index) => {
            if (columnName !== modelMetadata.target) {
              return (
                <div key={index} style={{ 
                  boxShadow: imputedColumns.includes(columnName) 
                    ? 'none' 
                    : '0 0 4px rgba(239, 68, 68, 0.4)',
                  borderRadius: '4px'
                }}>
                  <Input
                    key={index}
                    name={columnName}
                    settingInfos={{ type: "string", tooltip: "" }}
                    currentValue={inputsData[columnName] ?? ""}
                    onInputChange={handleInputUpdate}
                  />
                </div>
              )
            }
          })}
          <label style={{color: "rgba(239, 68, 68, 0.8)"}}>Required columns</label>
        </div>
      )}

      {mode === "table" && (
        <div className="data-input-tag-right">
          {datasetHasWarning.state && (
            <>
              <Tag className={`app-dataset-warning-tag-${pageId}`} icon="pi pi-exclamation-triangle" severity="warning" value="" rounded data-pr-position="bottom" data-pr-showdelay={200} />
              <Tooltip target={`.app-dataset-warning-tag-${pageId}`} autoHide={false}>
                <span>{datasetHasWarning.tooltip}</span>
              </Tooltip>
            </>
          )}
          <Input
            name="File"
            settingInfos={{
              type: "data-input",
              tooltip: "<p>Specify a data file (csv)</p>"
            }}
            currentValue={chosenDataset?.id || {}}
            onInputChange={onDatasetChange}
            setHasWarning={setDatasetHasWarning}
          />
        </div>
      )}
    </>
  )
}


/**
 *
 * @param {String} pageId The id of the page
 * @returns {React.Component} The application page
 */
const ApplicationPage = ({ pageId }) => {
  const [chosenModel, setChosenModel] = useState("")
  const [modelMetadata, setModelMetadata] = useState(null)
  const [modelFeatures, setModelFeatures] = useState([])
  const [optionalColumns, setOptionalColumns] = useState([])
  const [isCalibrated, setIsCalibrated] = useState(false)
  const [inputsData, setInputsData] = useState({})
  const [predictions, setPredictions] = useState(null)
  const [predictedTarget, setPredictedTarget] = useState(null)
  const [predictionScore, setPredictionScore] = useState(null)
  const [isValid2Predict, setIsValid2Predict] = useState(false)
  const [loadingModelColumns, setLoadingModelColumns] = useState(false)
  const { port } = useContext(WorkspaceContext)
  const { setError } = useContext(ErrorRequestContext)
  const { setLoader } = useContext(LoaderContext)
  const { globalData } = useContext(DataContext)
  const [modelHasWarning, setModelHasWarning] = useState({ state: true, tooltip: "No model selected" })
  const [mode, setMode] = useState("unique")
  const [requestSettings, setRequestSettings] = useState({})

  const fetchModelMetadata = async (metadataObjectID) => {
    const metadata = await getCollectionData(metadataObjectID)
    return metadata ? metadata[0] : null
  }

  // when the chosen model changes, update the model metadata
  useEffect(() => {
    setModelMetadata(null)
    const fetchData = async (metadataObjectID) => {
      const metadata = await fetchModelMetadata(metadataObjectID)
      if (metadata) {
        setModelMetadata(metadata)
        updateWarnings()
        await getOptionalColumns()
      } else {
        toast.error('Failed to retrieve model metadata.')
        return
      }
    }
    if (chosenModel.id) {
      const metadataObjectID = MEDDataObject.getChildIDWithName(globalData, chosenModel.id, "metadata.json")
      if (metadataObjectID) {
        fetchData(metadataObjectID)
      }
    }
    updateWarnings()
  }, [chosenModel])

  /**
   *
   * @param {String} type The type of prediction to do
   */
  const getOptionalColumns = async () => {
    if (!chosenModel.id) {
      toast.error('No model selected to retrieve optional columns from.')
      return
    }
    let metadata = null
    if (!modelMetadata) {
      metadata = await fetchModelMetadata(MEDDataObject.getChildIDWithName(globalData, chosenModel.id, "metadata.json"))
      if (metadata) {
        setModelMetadata(metadata)
      } else {
        toast.error('Failed to retrieve model metadata.')
        return
      }
    }
    setLoadingModelColumns(true)
    requestBackend(
      port,
      "application/get_imputed_columns/" + pageId,
      { model: chosenModel },
      (response) => {
        setLoadingModelColumns(false)
        console.log("response", response)
        if (response.error) {
          setError(response.error)
          setPredictions(null)
          setOptionalColumns([])
          setIsCalibrated(false)
          setPredictedTarget(null)
          setPredictionScore(null)
          toast.error('Failed to retrieve optional columns from the model.')
        } else {
          setOptionalColumns(response.imputed_columns)
          let target = null
          if (modelMetadata && Object.keys(modelMetadata).includes("target")) {
            target = modelMetadata.target
          } else if (metadata && Object.keys(metadata).includes("target")) {
            target = metadata.target
          } else {
            throw new Error("Model metadata does not contain target information.")
          }
          setModelFeatures(response.required_columns.filter(col => col !== target))
          setIsCalibrated(response.is_calibrated || false)
          let inputInit = {}
          response.required_columns.filter(col => col !== target).map((col) => {
            inputInit[col] = [undefined]
          })
          setInputsData(inputInit)
        }
      },
      (error) => {
        setPredictions(null)
        setOptionalColumns([])
        setIsCalibrated(false)
        setLoadingModelColumns(false)
        setPredictedTarget(null)
        setPredictionScore(null)
        console.error("Error while retrieving optional columns from the model", error)
        toast.error('Failed to retrieve optional columns from the model.')
      }
    )
  }

  /**
   *
   * @param {String} type The type of prediction to do
   */
  const handlePredictClick = async () => {
    setLoader(true)
    const predictionsFolder = new MEDDataObject({
      id: randomUUID(),
      name: "predictions",
      type: "directory",
      parentID: "DATA",
      childrenIDs: [],
      inWorkspace: false
    })
    const parentId = await insertMEDDataObjectIfNotExists(predictionsFolder)
    requestBackend(
      port,
      "application/predict/" + pageId,
      { entry: requestSettings, parentId: parentId },
      (response) => {
        console.log("response", response)
        if (response.error) {
          setError(response.error)
          setPredictions(null)
          setOptionalColumns([])
          setIsCalibrated(false)
          setPredictedTarget(null)
          setPredictionScore(null)
        } else {
          if (mode === "table") {
            setPredictions(response)
          } else {
            setPredictions(null)
          }
          if (response.pred_target){
            setPredictedTarget(response.pred_target)
          }
          if (response.pred_score){
            setPredictionScore(response.pred_score)
          }
          toast.info('Predictions saved under "DATA/predictions"')
        }
        MEDDataObject.updateWorkspaceDataObject()
        setLoader(false)
      },
      () => {
        setPredictions(null)
        setOptionalColumns([])
        setIsCalibrated(false)
        setPredictedTarget(null)
        setPredictionScore(null)
        setLoader(false)
      }
    )
  }

  /**
   * @description - This function is used to update the warnings
   */
  const updateWarnings = async (chosenDataset, setDatasetHasWarning) => {
    setPredictions(null)

    /**
     *
     * @param {Array} columnsArray An array of the columns of the dataset
     */
    const checkWarnings = (columnsArray) => {
      if (!modelFeatures.every((col) => columnsArray.includes(col)) && modelFeatures && columnsArray) {
        const missingCols = modelFeatures.filter(col => !columnsArray.includes(col))
        setDatasetHasWarning({
          state: true,
          tooltip: (
            <>
              <div className="evaluation-tooltip">
                <h4>This dataset does not respect the model format</h4>
                {/* here is a list of the needed columns */}
                <div style={{ maxHeight: "400px", overflowY: "auto", overflowX: "hidden" }}>
                  <Row>
                    <Col>
                      <p>Missing columns:</p>
                      <ul>
                        {missingCols.map((col) => {
                          return <li key={col}>{col}</li>
                        })}
                      </ul>
                    </Col>
                  </Row>
                </div>
              </div>
            </>
          )
        })
      } else {
        setModelHasWarning({ state: false, tooltip: "" })
      }
    }

    if (modelMetadata && chosenDataset && modelMetadata.columns && chosenDataset.id) {
      //   getting colummns of the dataset
      setLoader(true)
      let columnsArray = await getCollectionColumns(chosenDataset.id)
      setLoader(false)

      // getting colummns of the model
      let modelColumns = modelMetadata.columns.sort()
      columnsArray = columnsArray.sort()
      let missingCols = []
      modelColumns.forEach((col) => {
        if (!columnsArray.includes(col)) {
          missingCols.push(col)
        }
      })
      checkWarnings(columnsArray)
    }
  }

  return (
    <>
    {
      loadingModelColumns ? (
        <div className="text-align center">
          <h3>Loading model's information...</h3>
          <ProgressSpinner />
        </div>
      ): (
      <Stack gap={2}>
        <div className="data-input-tag-right">
          {modelHasWarning.state && (
            <>
              <Tag className={`app-model-warning-tag-${pageId}`} icon="pi pi-exclamation-triangle" severity="warning" value="" rounded data-pr-position="bottom" data-pr-showdelay={200} />
              <Tooltip target={`.app-model-warning-tag-${pageId}`} autoHide={false}>
                <span>{modelHasWarning.tooltip}</span>
              </Tooltip>
            </>
          )}
          <Input
            name="Choose model"
            settingInfos={{ type: "models-input", tooltip: "" }}
            setHasWarning={setModelHasWarning}
            currentValue={chosenModel.id}
            onInputChange={(data) => setChosenModel(data.value)}
          />
        </div>
        {modelMetadata && (
          <>
            {isCalibrated === false ? (
              <Tag className="app-model-uncalibrated-tag" severity="warning" value="This model is uncalibrated" />
            ) : (
              <Tag className="app-model-calibrated-tag" severity="success" value="This model is calibrated" />
            )}
            <Entry
              pageId={pageId}
              setRequestSettings={setRequestSettings}
              chosenModel={chosenModel}
              modelMetadata={modelMetadata}
              updateWarnings={updateWarnings}
              mode={mode}
              setMode={setMode}
              setIsValid2Predict={setIsValid2Predict}
              inputsData={inputsData}
              setInputsData={setInputsData}
              modelColumns={modelFeatures}
              imputedColumns={optionalColumns}
            />
            <Button label="Predict" outlined severity="success" onClick={() => handlePredictClick()} disabled={!isValid2Predict} />
            {mode === "unique" && predictedTarget && predictionScore ? (
              <>
              <Card className="prediction-result-card" style={{display: "flex", justifyContent: "center", alignItems: "center"}}>
                <div className="flex align-items-center">
                  {modelMetadata.model_threshold && <Badge value={`Model's Threshold: ${modelMetadata.model_threshold.toFixed(2)}`} severity="warning" size={"large"} style={{marginRight: "1rem"}} />}
                  <Badge value={`Prediction Score: ${predictionScore}`} severity="info" size={"large"} style={{marginRight: "1rem"}} />
                  <Badge value={`Predicted Target Value: ${predictedTarget}`} severity="success" size={"large"}  />
                </div>
              </Card>
                {/* Warning Section */}
                <Panel header="Understanding the Prediction Score and Threshold" toggleable >
                  <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
                    <li>
                      <strong>Prediction Score = P(Y = 1 | X)</strong>:  
                      This is the model's estimated probability that the target equals 1 for the given input.
                    </li>
                    <li>
                      <strong>Decision Threshold</strong>:  
                      The predicted probability is compared against the model's threshold to determine the final class.  
                      If P(Y=1|X) ≥ threshold → predicted class = 1, otherwise class = 0.
                    </li>
                    <li>
                      <strong>Most machine-learning classifiers output P(Y = 1 | X)</strong>  
                      regardless of the number of features or the modeling method.
                    </li>
                    <li>
                      <strong>Probability Calibration Matters</strong>:  
                      A probability value is meaningful only when the model has been calibrated. If calibration was not performed, 
                      do not interpret the number literally; rely instead on the comparison to the threshold.
                    </li>
                    <li>
                      <strong>The interface will indicate whether your model was calibrated.</strong>
                    </li>
                  </ul>
                </Panel>
                </>
            ) : (
              <>{mode === "table" && predictions && predictions.collection_id && <DataTableFromDB data={{ id: predictions.collection_id }} isReadOnly={true} />}</>
            )}
            
          </>
        )}
      </Stack>
      )
    }
    </>
  )
}

/**
 *
 * @param {string} pageId The id of the page
 *
 * @returns {React.Component} The application page with module page
 */
const ApplicationPageWithModulePage = ({ pageId = "application-456" }) => {
  return (
    <>
      <ModulePage pageId={pageId} shadow>
        <div style={{ padding: "0.5rem" }}>

          <div className="application-introduction">

            <h2>🚀 Model Deployment</h2>

            <p>
              This module allows users to deploy a machine learning model for inference.
              First, you'll have to choose a model. Then, you can select between two input methods:
            </p>

            <p>
              <span className="app-tool-name">→ Manual Sample Entry:</span> Fill in the required feature values manually to test a single sample.
            </p>

            <p>
              <span className="app-tool-name">→ Test File Input:</span> Upload a dataset file (CSV format) to run batch predictions on multiple samples.
            </p>

            <div>
              <p>
                📖 Learn more about this tool in our{' '}
                <u
                  onClick={() => shell.openExternal("https://medomicslab.gitbook.io/medomics-docs/tutorials/deployment/application-module")}
                  style={{ color: "#4991dfff", textDecoration: "none", cursor: "pointer" }}
                >
                  documentation. 🔗
                </u>
              </p>
            </div>

          </div>

          <ApplicationPage pageId={pageId} />

        </div>
      </ModulePage>
    </>
  )
}

export default ApplicationPageWithModulePage
