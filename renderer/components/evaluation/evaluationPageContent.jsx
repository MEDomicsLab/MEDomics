import React, { useContext, useEffect, useState } from "react"
import { Col, Row } from "react-bootstrap"
import { toast } from "react-toastify"
import { requestBackend } from "../../utilities/requests"
import { getCollectionData } from "../dbComponents/utils"
import { LoaderContext } from "../generalPurpose/loaderContext"
import { PageInfosContext } from "../mainPages/moduleBasics/pageInfosContext"
import { getCollectionColumns, getCollectionRows, overwriteMEDDataObjectContent } from "../mongoDB/mongoDBUtils"
import { DataContext } from "../workspace/dataContext"
import { MEDDataObject } from "../workspace/NewMedDataObject"
import { WorkspaceContext } from "../workspace/workspaceContext"
import PageConfig from "./pageConfig"
import PageEval from "./pageEval"

/**
 * @description - This component is the evaluation page content component, it handles medeval config and evaluation
 * @returns the evaluation page content
 */
const EvaluationPageContent = () => {
  const { pageId } = useContext(PageInfosContext)
  const [chosenModel, setChosenModel] = useState({})
  const [chosenDataset, setChosenDataset] = useState({})
  const [modelHasWarning, setModelHasWarning] = useState({ state: false, tooltip: "" })
  const [datasetHasWarning, setDatasetHasWarning] = useState({ state: false, tooltip: "" })
  const [evalConfig, setEvalConfig] = useState({})
  const { globalData } = useContext(DataContext)
  const { setLoader } = useContext(LoaderContext)
  const { port } = useContext(WorkspaceContext) // we get the port for server connexion
  const [run, setRun] = useState(false)
  const stripIdCols = (cols = []) => (cols || []).filter(c => c !== '_id' && c !== 'id')

  useEffect(() => {
    const fetchData = async () => {
      let config = {}
      if (chosenModel.id && chosenModel.name) {
        config = { ...evalConfig, model: chosenModel }
      }
      let configToLoadID = MEDDataObject.getChildIDWithName(globalData, pageId, "metadata.json")
      let configToLoad = await getCollectionData(configToLoadID)
      // Get the model's metadata if a model is selected
      if (chosenModel.id && chosenModel.name && Object.keys(chosenModel).length > 0) {
        let modelMetadataID = MEDDataObject.getChildIDWithName(globalData, chosenModel.id, "metadata.json")
        let modelData = await getCollectionData(modelMetadataID)
        if (config) {
          config = {...config, ...configToLoad[0], ...modelData[0]}
        }
      } else {
          config = {...config, ...configToLoad[0]}
      }
      setEvalConfig(config)
    }
    if (globalData && pageId) {
      fetchData()
    }
  }, [pageId, chosenModel])

  // handle updating the config when the chosen dataset changes
  useEffect(() => {
    if (!chosenDataset.selectedDatasets || (chosenDataset.selectedDatasets?.length > 0 && chosenDataset.selectedDatasets[0].name && chosenDataset.selectedDatasets[0].id)) {
      let config = { ...evalConfig }
      config["dataset"] = chosenDataset
      setEvalConfig(config)
    }
  }, [chosenDataset])

  // when the config changes, we update the warnings
  useEffect(() => {
    if (Object.keys(evalConfig).length > 0) {
      updateWarnings(evalConfig.useMedStandard)
    }
  }, [evalConfig])

  /**
   * @description - This function is used to update the config WHEN THE USER CLICKS ON THE UPDATE CONFIG BUTTON
   */
  const updateConfigClick = async () => {
    let config = { ...evalConfig }
    config["isSet"] = true
    setEvalConfig(config)
    let configToLoadID = MEDDataObject.getChildIDWithName(globalData, pageId, "metadata.json")
    let success = await overwriteMEDDataObjectContent(configToLoadID, [config])
    if (success) {
      toast.success("Config has been saved successfully")
      requestBackend(
        port,
        "evaluation/close_dashboard/dashboard/" + pageId,
        { pageId: pageId },
        () => {
          setRun(!run)
        },
        (error) => {
          console.log("closeDashboard received error:", error)
        }
      )
    }
  }

  /**
   * @description - This function is used to update the warnings
   */
  const updateWarnings = async (useMedStandard) => {
    /**
     *
     * @param {Array} datasetData An array of the columns of the dataset
     * @param {Array} modelData An array of the required columns of the model
     */
    const checkWarnings = async (datasetData, modelData, useMedStandard) => {
      // sort the arrays alphabetically and numerically
      let isValid = true
      let isValidDatasetsSelected = true
      let modelCols = modelData.columns

      let columnsArray_ = []
      let selectedDatasetsTx = []
      let modelDatasetsTx = []

      if (useMedStandard) {
        let selectedDatasets = datasetData.selectedDatasets
        let wantedVariables = modelData.selectedVariables

        // getting a list of unique values ot T1, T2, ... representing selected datasets time points
        wantedVariables.forEach((wantedVariable) => {
          // getting last element of split list
          let datasetTx = wantedVariable.split("_")[wantedVariable.split("_").length - 1]
          !modelDatasetsTx.includes(datasetTx) && modelDatasetsTx.push(datasetTx)
        })

        // verify if selected datasets are the wanted combinations of Tx

        selectedDatasets.forEach((dataset) => {
          let datasetTx = dataset.name.split("_")[0]
          !selectedDatasetsTx.includes(datasetTx) && selectedDatasetsTx.push(datasetTx)
        })

        isValidDatasetsSelected = modelDatasetsTx.sort().join(",") == selectedDatasetsTx.sort().join(",")
      } else {
        let columnsArray = await getCollectionColumns(datasetData.id)
        let cleanDatasetCols = stripIdCols(columnsArray)
        let cleanModelCols   = stripIdCols(modelCols || [])

        columnsArray_ = cleanDatasetCols
        modelCols     = cleanModelCols

        const datasetColsString = JSON.stringify(cleanDatasetCols.sort())
        const modelColsString   = JSON.stringify(cleanModelCols.sort())
        isValid = (cleanModelCols && cleanDatasetCols)
          ? (datasetColsString === modelColsString)
          : true
      }
      setLoader(false)

      if (!isValid || !isValidDatasetsSelected) {
        if (!isValidDatasetsSelected) {
          setDatasetHasWarning({
            state: true,
            tooltip: (
              <div className="evaluation-tooltip">
                <h4>This dataset does not respect the model format</h4>
                <p>You chose a wrong combination of timepoints (Tx)</p>
                <div style={{ maxHeight: "400px", overflowY: "auto", overflowX: "hidden" }}>
                  <Row>
                    <Col>
                      <p>Needed timepoints:</p>
                      <ul>
                        {modelDatasetsTx.sort().map((col) => {
                          return <li key={col}>{col}</li>
                        })}
                      </ul>
                    </Col>
                    <Col>
                      <p>Received timepoints:</p>
                      <ul>
                        {selectedDatasetsTx.sort().map((col) => {
                          return <li key={col}>{col}</li>
                        })}
                      </ul>
                    </Col>
                  </Row>
                </div>
              </div>
            )
          })
        } else {
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
                          {modelCols.map((col) => {
                            return <li key={col}>{col}</li>
                          })}
                        </ul>
                      </Col>
                      <Col>
                        <p>Received columns:</p>
                        <ul>
                          {columnsArray_.map((col) => {
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
        }
      } else {
        setModelHasWarning({ state: false, tooltip: "" })
        setDatasetHasWarning({ state: false, tooltip: "" })
      }
    }

    if (
      evalConfig &&
      evalConfig.model &&
      evalConfig.dataset &&
      Object.keys(evalConfig.model).length > 0 &&
      Object.keys(evalConfig.dataset).length > 1 &&
      evalConfig.model.name != "No selection" &&
      evalConfig.dataset.name != "No selection"
    ) {
      let modelMetadataID = MEDDataObject.getChildIDWithName(globalData, evalConfig.model.id, "metadata.json")
      if (modelMetadataID) {
        let modelData = await getCollectionData(modelMetadataID)
        if (modelData) {
          await checkWarnings(evalConfig.dataset, modelData[0], useMedStandard)
        }
      }
    }
  }

  /**
   *
   * @returns the evaluation step: either the config step or the evaluation step
   */
  const getEvaluationStep = () => {
    if (evalConfig.isSet) {
      return (
        <PageEval
          useMedStandard={evalConfig.useMedStandard}
          run={run}
          pageId={pageId}
          config={evalConfig}
          updateWarnings={updateWarnings}
          setDatasetHasWarning={setDatasetHasWarning}
          datasetHasWarning={datasetHasWarning}
          setModelHasWarning={setModelHasWarning}
          modelHasWarning={modelHasWarning}
          updateConfigClick={updateConfigClick}
          setChosenModel={setChosenModel}
          setChosenDataset={setChosenDataset}
        />
      )
    } else {
      return (
        <PageConfig
          useMedStandard={evalConfig.useMedStandard}
          run={run}
          pageId={pageId}
          config={evalConfig}
          updateWarnings={updateWarnings}
          setDatasetHasWarning={setDatasetHasWarning}
          datasetHasWarning={datasetHasWarning}
          setModelHasWarning={setModelHasWarning}
          modelHasWarning={modelHasWarning}
          updateConfigClick={updateConfigClick}
          setChosenModel={setChosenModel}
          setChosenDataset={setChosenDataset}
        />
      )
    }
  }

  return <>{evalConfig && getEvaluationStep()}</>
}

export default EvaluationPageContent
