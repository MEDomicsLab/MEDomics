import React, { useEffect, useState } from "react"
import ModulePage from "./moduleBasics/modulePage"
import { Col, Row, Stack } from "react-bootstrap"
import Input from "../learning/input"
import { Button } from "primereact/button"
import { SelectButton } from "primereact/selectbutton"
import { requestBackend } from "../../utilities/requests"
import { useContext } from "react"
import { WorkspaceContext } from "../workspace/workspaceContext"
import { ErrorRequestContext } from "../generalPurpose/errorRequestContext"
import { LoaderContext } from "../generalPurpose/loaderContext"
import { ToggleButton } from "primereact/togglebutton"
import { DataContext } from "../workspace/dataContext"
import { Tag } from "primereact/tag"
import { Tooltip } from "primereact/tooltip"
import { MEDDataObject } from "../workspace/NewMedDataObject"
import { getCollectionData } from "../dbComponents/utils"
import { getCollectionColumns, insertMEDDataObjectIfNotExists } from "../mongoDB/mongoDBUtils"
import DataTableFromDB from "../dbComponents/dataTableFromDB"
import { randomUUID } from "crypto"
import { toast } from "react-toastify"
import { shell } from "electron"
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

const Entry = ({ pageId, setRequestSettings, chosenModel, modelMetadata, updateWarnings, mode, setMode, setIsValid2Predict, inputsData, setInputsData }) => {
  const [chosenDataset, setChosenDataset] = useState(null)
  const [datasetHasWarning, setDatasetHasWarning] = useState({ state: true, tooltip: "No dataset selected" })
  const [isColsValid, setIsColsValid] = useState(false)

  const inputOptions = [
    { label: "Manual Sample Entry", value: "unique" },
    { label: "Test File Input", value: "table" }
  ]

  useEffect(() => {
    if (modelMetadata) {
      const columns = modelMetadata.columns
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
  }, [chosenDataset])

  useEffect(() => {
    if (mode === "table") {
      setIsValid2Predict(!datasetHasWarning.state)
    } else {
      setIsValid2Predict(isColsValid)
    }
  }, [mode, datasetHasWarning, isColsValid])

  useEffect(() => {
    setInputsData({})
    updateWarnings(chosenDataset, setDatasetHasWarning)
  }, [chosenModel])

  useEffect(() => {
    setRequestSettings({
      model: chosenModel,
      dataset: chosenDataset,
      data: inputsData,
      type: mode
    })
  }, [chosenModel, chosenDataset, inputsData, mode])

  const handleInputUpdate = (inputUpdate) => {
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
          {modelMetadata.columns.map((columnName, index) => {
            if (columnName !== modelMetadata.target) {
              return (
                <Input
                  key={index}
                  name={columnName}
                  settingInfos={{ type: "string", tooltip: "" }}
                  currentValue={inputsData[columnName] ?? ""}
                  onInputChange={handleInputUpdate}
                />
              )
            }
          })}
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
            name="files"
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
  const [inputsData, setInputsData] = useState({})
  const [predictions, setPredictions] = useState(null)
  const [isValid2Predict, setIsValid2Predict] = useState(false)
  const { port } = useContext(WorkspaceContext)
  const { setError } = useContext(ErrorRequestContext)
  const { setLoader } = useContext(LoaderContext)
  const { globalData } = useContext(DataContext)
  const [modelHasWarning, setModelHasWarning] = useState({ state: true, tooltip: "No model selected" })
  const [mode, setMode] = useState("unique")
  const [requestSettings, setRequestSettings] = useState({})

  // when the chosen model changes, update the model metadata
  useEffect(() => {
    setModelMetadata(null)
    const fetchData = async (metadataObjectID) => {
      setModelMetadata(null)
      const metadata = await getCollectionData(metadataObjectID)
      if (metadata) {
        setModelMetadata(metadata[0])
        updateWarnings()
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
        } else {
          setPredictions(response)
          toast.info('Predictions saved under "DATA/predictions"')
        }
        MEDDataObject.updateWorkspaceDataObject()
        setLoader(false)
      },
      () => {
        setPredictions(null)
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
     * @param {Array} modelData An array of the required columns of the model
     */
    const checkWarnings = (columnsArray, modelData) => {
      let datasetColsString = JSON.stringify(columnsArray)
      let modelColsString = JSON.stringify(modelData)
      if (datasetColsString !== modelColsString && modelData && columnsArray) {
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
                      <p>Needed columns:</p>
                      <ul>
                        {modelData.map((col) => {
                          return <li key={col}>{col}</li>
                        })}
                      </ul>
                    </Col>
                    <Col>
                      <p>Received columns:</p>
                      <ul>
                        {columnsArray.map((col) => {
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

      //   getting colummns of the model
      let modelColumns = modelMetadata.columns
      checkWarnings(columnsArray, modelColumns)
    }
  }

  return (
    <>
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
            />
            <Button label="Predict" outlined severity="success" onClick={() => handlePredictClick()} disabled={!isValid2Predict} />
            {predictions && predictions.collection_id && <DataTableFromDB data={{ id: predictions.collection_id }} isReadOnly={true} />}
          </>
        )}
      </Stack>
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
                  onClick={() => shell.openExternal("https://medomics-udes.gitbook.io/medomicslab-docs/tutorials/deployment/application-module")}
                  style={{ color: "#0056b3", textDecoration: "none", cursor: "pointer" }}
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
