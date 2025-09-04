import { Button } from "primereact/button"
import { Dropdown } from "primereact/dropdown"
import { ErrorRequestContext } from "../generalPurpose/errorRequestContext"
import ExtractionBioBERT from "./extractionTypes/extractionBioBERT"
import ExtractionTSfresh from "./extractionTypes/extractionTSfresh"
import { InputSwitch } from "primereact/inputswitch"
import { InputText } from "primereact/inputtext"
import { Message } from "primereact/message"
import { PageInfosContext } from "../mainPages/moduleBasics/pageInfosContext"
import ProgressBar from "react-bootstrap/ProgressBar"
import React, { useState, useContext, useEffect } from "react"
import { requestBackend } from "../../utilities/requests"
import { toast } from "react-toastify"
import { ServerConnectionContext } from "../serverConnection/connectionContext"
import { getCollectionData, getCollectionColumnTypes } from "../dbComponents/utils"
import { MEDDataObject } from "../workspace/NewMedDataObject"
import DataTableFromDB from "../dbComponents/dataTableFromDB"
import { DataContext } from "../workspace/dataContext"
import { insertMEDDataObjectIfNotExists } from "../mongoDB/mongoDBUtils"
import { randomUUID } from "crypto"

/**
 *
 * @param {List} extractionTypeList list containing possible types of extraction
 * @param {String} serverUrl path to server
 * @param {String} defaultFilename default name under which the extracted features will be saved
 * @returns {JSX.Element} a page
 *
 * @description
 * This component is a general page used for tabular data extraction (time series and text notes).
 * Its composition depend on the type of extraction choosen.
 *
 */
const ExtractionTabularData = ({ extractionTypeList, serverUrl, defaultFilename }) => {
  const [columnsTypes, setColumnsTypes] = useState({}) // the selected dataset column types
  const [dataframe, setDataframe] = useState([]) // djanfo dataframe of data to extract
  const [datasetsList, setDatasetsList] = useState([]) // list of datasets we can select to proceed to extraction
  const [extractionFunction, setExtractionFunction] = useState(extractionTypeList[0] + "_extraction") // name of the function to use for extraction
  const [extractionProgress, setExtractionProgress] = useState(0) // advancement state in the extraction function
  const [extractionStep, setExtractionStep] = useState("") // current step in the extraction function
  const [extractionJsonData, setExtractionJsonData] = useState({}) // json data depending on extractionType
  const [extractionType, setExtractionType] = useState(extractionTypeList[0]) // extraction type
  const [resultCollectionName, setResultCollectionName] = useState(defaultFilename) // name of the csv file containing extracted data
  const [filenameSavedFeatures, setFilenameSavedFeatures] = useState(null) // name of the csv file containing extracted data
  const [mayProceed, setMayProceed] = useState(false) // boolean set to true if all informations about the extraction (depending on extractionType) have been completed
  const [resultDataset, setResultDataset] = useState(null) // dataset of extracted data used to be display
  const [selectedDataset, setSelectedDataset] = useState(null) // dataset of data to extract used to be display
  const [showProgressBar, setShowProgressBar] = useState(false) // wether to show or not the extraction progressbar
  const [viewResults, setViewResults] = useState(false) // Display result if true and results can be displayed
  const [viewOriginalData, setViewOriginalData] = useState(false) // Display selected dataset if true and results can be displayed

  const { globalData } = useContext(DataContext) // get global data
  const { pageId } = useContext(PageInfosContext) // used to get the pageId
  const { port } = useContext(ServerConnectionContext) // we get the port for server connexion
  const { setError } = useContext(ErrorRequestContext) // used to diplay the errors

  /**
   *
   * @param {CSV File} dataset
   *
   * @description
   * Called when the user select a dataset.
   *
   */
  async function datasetSelected(dataset) {
    try {
      setResultDataset(null)
      const columnsData = await getCollectionColumnTypes(dataset.id)
      console.log("HERE", columnsData)
      setColumnsTypes(columnsData)
      setSelectedDataset(dataset)
      const data = await getCollectionData(dataset.id)
      setDataframe(data)
    } catch (error) {
      console.error("Error:", error)
    }
  }

  /**
   *
   * @param {String} value
   *
   * @description
   * Called when the user select an extraction type.
   *
   */
  const onChangeExtractionType = (value) => {
    setExtractionType(value)
    setExtractionFunction(value + "_extraction")
  }

  /**
   * @description
   * Extract text notes by batch depending on the extraction type specified.
   * Update the progress bar.
   *
   * @returns extractedData
   */
  async function extractDataFromFileList(processingList, resultCollectionIDinDB) {
    let progress = 5
    let chunkSize = 25
    let chunks = []
    let response = {}
    for (let i = 0; i < processingList.length; i += chunkSize) {
      const chunk = processingList.slice(i, i + chunkSize)
      chunks.push(chunk)
    }
    for (const subList of chunks) {
      try {
        const jsonResponse = await new Promise((resolve, reject) => {
          requestBackend(
            port,
            serverUrl + extractionFunction + "/" + pageId,
            {
              relativeToExtractionType: extractionJsonData,
              identifiersList: subList,
              resultCollectionName: resultCollectionIDinDB,
              DBName: "data",
              collectionName: selectedDataset.id,
              pageId: pageId
            },
            (response) => resolve(response),
            (error) => reject(error)
          )
        })
        response = jsonResponse
        progress += (1 / chunks.length) * 95
        setExtractionProgress(progress.toFixed(2))
        if (jsonResponse.error) {
          toast.error(`Extraction failed: ${jsonResponse.error.message}`)
          setError(jsonResponse.error)
        }
      } catch (err) {
        console.error(err)
        toast.error(`Extraction failed: ${err}`)
        return
      }
    }
    return response
  }

  /**
   *
   * @description
   * Run extraction main function.
   *
   */
  const runExtraction = async () => {
    // Insert MEDDataObject in DB
    const object = new MEDDataObject({
      id: randomUUID(),
      name: resultCollectionName + "." + selectedDataset.type,
      type: selectedDataset.type,
      parentID: selectedDataset.parentID,
      childrenIDs: [],
      inWorkspace: false
    })
    const resultCollectionIDinDB = await insertMEDDataObjectIfNotExists(object)
    // Initialize extraction
    setResultDataset(null)
    setMayProceed(false)
    setShowProgressBar(true)
    setExtractionProgress(0)
    setExtractionStep("Extraction")
    const patientIdentifierColumn = extractionJsonData["selectedColumns"]["patientIdentifier"]
    const uniquePatientIdentifiers = Array.from(new Set(dataframe.map((item) => item[patientIdentifierColumn])))
    setExtractionProgress(5)
    // Proceed to extraction
    const jsonResponse = await extractDataFromFileList(uniquePatientIdentifiers, resultCollectionIDinDB)
    if (!jsonResponse.error) {
      toast.success(jsonResponse["collection_length"] + " elements added to " + object.name)
      setFilenameSavedFeatures(object.name)
      setResultDataset({ id: jsonResponse["resultCollectionName"] })
    } else {
      toast.error(`Extraction failed: ${jsonResponse.error.message}`)
      setError(jsonResponse.error)
    }
    setExtractionStep("")
    setMayProceed(true)
    setShowProgressBar(false)
    MEDDataObject.updateWorkspaceDataObject()
  }

  /* Hook called when the global data changes to get the list of dataset to display */
  useEffect(() => {
    if (globalData) {
      let matchingDatasets = MEDDataObject.getMatchingTypesInDict(globalData, ["csv"])
      setDatasetsList(matchingDatasets)
    } else {
      setDatasetsList([])
    }
  }, [globalData])

  return (
    <div>
      <hr></hr>
      <div className="margin-top-bottom-15">
        <div className="center">
          {/* Select Data */}
          <h2>Select Data</h2>
          {datasetsList.length > 0 ? (
            <Dropdown value={selectedDataset} options={datasetsList} optionLabel="name" onChange={(event) => datasetSelected(event.value)} placeholder="Select a dataset" />
          ) : (
            <Dropdown placeholder="No dataset to show" disabled />
          )}
        </div>
      </div>

      <hr></hr>
      <div className="margin-top-bottom-15">
        {/* Display selected data */}
        <div className="center">
          <h2>Selected data</h2>
          <div>
            <p>Display dataset &nbsp;</p>
          </div>
          <div className="margin-top-bottom-15 center">
            <InputSwitch id="switch" checked={viewOriginalData} onChange={(e) => setViewOriginalData(e.value)} />
          </div>
        </div>
        {viewOriginalData &&
          (selectedDataset ? (
            <div>
              <DataTableFromDB data={{ id: selectedDataset.id }} isReadOnly={true} />
            </div>
          ) : (
            <div className="center">
              <p>Nothing to show, select a CSV file first.</p>
            </div>
          ))}
      </div>

      <hr></hr>
      <div className="margin-top-bottom-15">
        <div className="center">
          {/* Extraction Type Selection */}
          <h2>Select an extraction type</h2>
          <div className="margin-top-15">
            <Dropdown value={extractionType} options={extractionTypeList} onChange={(event) => onChangeExtractionType(event.value)} />
          </div>
          <div className="margin-top-15">
            {extractionType == "BioBERT" && <ExtractionBioBERT columnsTypes={columnsTypes} setExtractionJsonData={setExtractionJsonData} setMayProceed={setMayProceed} />}
            {extractionType == "TSfresh" && <ExtractionTSfresh columnsTypes={columnsTypes} setExtractionJsonData={setExtractionJsonData} setMayProceed={setMayProceed} />}
          </div>
        </div>
      </div>

      <hr></hr>
      <div className="margin-top-bottom-15">
        <div className="center">
          {/* Features Extraction */}
          <h2>Extract features</h2>
          {mayProceed == false && showProgressBar == false && <Message severity="warn" text="You must select convenient options for feature generation" />}
          <div className="margin-top-30">
            <div className="flex-container">
              <div>
                Save extracted features as : &nbsp;
                <InputText keyfilter="alphanum" value={resultCollectionName} onChange={(e) => setResultCollectionName(e.target.value)} />
                {selectedDataset?.type && "." + selectedDataset.type}
              </div>
              <div>
                {/* Button activated only if all necessary columns have been selected */}
                <Button disabled={!mayProceed} onClick={runExtraction}>
                  Extract Data
                </Button>
              </div>
            </div>
          </div>
          <div className="margin-top-30 extraction-progress">
            {showProgressBar && (
              <div className="progress-bar-requests">
                <label>{extractionStep}</label>
                <ProgressBar now={extractionProgress} label={`${extractionProgress}%`} />
              </div>
            )}
          </div>
        </div>
      </div>

      <hr></hr>
      <div className="margin-top-bottom-15 center">
        {/* Display extracted data */}
        <h2>Extracted data</h2>
        <div>{resultDataset && <Message severity="success" text={`Features saved under ${filenameSavedFeatures}`} />}</div>
        <div>
          <p>Display result dataset &nbsp;</p>
        </div>
        <div className="margin-top-bottom-15 center">
          <InputSwitch id="switch" checked={viewResults} onChange={(e) => setViewResults(e.value)} />
        </div>
        {viewResults && <div>{resultDataset ? <DataTableFromDB data={resultDataset} isReadOnly={true} /> : <p>Nothing to show, proceed to extraction first.</p>}</div>}
      </div>
    </div>
  )
}

export default ExtractionTabularData
