import { Button } from "primereact/button"
import { Dropdown } from "primereact/dropdown"
import { ErrorRequestContext } from "../generalPurpose/errorRequestContext"
import ExtractionDenseNet from "./extractionTypes/extractionDenseNet"
import { InputSwitch } from "primereact/inputswitch"
import { InputText } from "primereact/inputtext"
import { Message } from "primereact/message"
import { PageInfosContext } from "../mainPages/moduleBasics/pageInfosContext"
import ProgressBar from "react-bootstrap/ProgressBar"
import React, { useContext, useRef, useState } from "react"
import { requestBackend } from "../../utilities/requests"
import { toast } from "react-toastify"
import { ServerConnectionContext } from "../serverConnection/connectionContext"
import { MEDDataObject } from "../workspace/NewMedDataObject"
import { randomUUID } from "crypto"
import { insertMEDDataObjectIfNotExists } from "../mongoDB/mongoDBUtils"
import DataTableFromDB from "../dbComponents/dataTableFromDB"

/**
 *
 * @param {List} extractionTypeList list containing possible types of extraction
 * @param {String} serverUrl path to server
 * @param {String} defaultFilename default name under which the extracted features will be saved
 * @returns {JSX.Element} a page
 *
 * @description
 * This component is a general page used for jpg data extraction.
 * Its composition depend on the type of extraction choosen.
 *
 */
const ExtractionJPG = ({ extractionTypeList, serverUrl, defaultFilename }) => {
  const [extractionInitializeFunction, setExtractionInitializeFunction] = useState("initialize_" + extractionTypeList[0] + "_extraction") // name of the function to use for extraction initialization
  const [extractionFunction, setExtractionFunction] = useState(extractionTypeList[0] + "_extraction") // name of the function to use for extraction
  const [extractionJsonData, setExtractionJsonData] = useState({}) // json data depending on extractionType
  const [extractionProgress, setExtractionProgress] = useState(0) // advancement state in the extraction function
  const [extractionStep, setExtractionStep] = useState("") // current step in the extraction function
  const [extractionType, setExtractionType] = useState(extractionTypeList[0]) // extraction type
  const [fileList, setFileList] = useState([]) // list of the images files to extract data from
  const [resultCollectionName, setResultCollectionName] = useState(defaultFilename) // name of the csv file containing extracted data
  const [filenameSavedFeatures, setFilenameSavedFeatures] = useState(null) // name of the csv file containing extracted data
  const [folderDepth, setFolderDepth] = useState(1) // depth to consider when searching jpg data in folders
  const inputFolderRef = useRef(null) // used to select images folder
  const [optionsSelected, setOptionsSelected] = useState(true) // boolean set to true when the options seleted are convenient for extraction
  const [resultDataset, setResultDataset] = useState(null) // dataset of extracted data used to be display
  const [running, setRunning] = useState(false) // boolean set to true when extraction is running
  const [showProgressBar, setShowProgressBar] = useState(false) // wether to show or not the extraction progressbar
  const [viewResults, setViewResults] = useState(false) // Display result if true and results can be displayed

  const { port } = useContext(ServerConnectionContext) // we get the port for server connexion
  const { pageId } = useContext(PageInfosContext) // used to get the pageId
  const { setError } = useContext(ErrorRequestContext) // used to diplay the errors

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
    setExtractionInitializeFunction("initialize_" + value + "_extraction")
  }

  /**
   * @description
   * Run the initialization process for the specified extraction type
   *
   * @returns jsonResponse
   */
  async function initializeExtraction() {
    return new Promise((resolve, reject) => {
      requestBackend(
        port,
        serverUrl + extractionInitializeFunction + "/" + pageId,
        {
          relativeToExtractionType: extractionJsonData
        },
        (response) => resolve(response),
        (error) => reject(error)
      )
    })
  }

  /**
   * @description
   * Extract image data by batch depending on the extraction type specified.
   * Update the progress bar.
   *
   * @returns extractedData
   */
  async function extractDataFromFileList(resultCollectionIDinDB) {
    let progress = 10
    let chunkSize = 100
    let chunks = []
    let response = {}
    for (let i = 0; i < fileList.length; i += chunkSize) {
      const chunk = fileList.slice(i, i + chunkSize)
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
              depth: folderDepth,
              filePathList: subList,
              resultCollectionName: resultCollectionIDinDB,
              DBName: "data",
              pageId: pageId
            },
            (response) => resolve(response),
            (error) => reject(error)
          )
        })
        response = jsonResponse
        progress += (1 / chunks.length) * 90
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
    const object = new MEDDataObject({ id: randomUUID(), name: resultCollectionName + ".csv", type: "csv", parentID: "DATA", childrenIDs: [], inWorkspace: false })
    const resultCollectionIDinDB = await insertMEDDataObjectIfNotExists(object)
    // Initialize extraction
    setResultDataset(null)
    setRunning(true)
    setShowProgressBar(true)
    setExtractionProgress(0)
    setExtractionStep("Initialization")
    // Initialize extraction process
    let jsonInitialization = await initializeExtraction()
    setExtractionProgress(10)
    setExtractionStep("Extracting data")
    if (!jsonInitialization.error) {
      // Extract data
      const jsonResponse = await extractDataFromFileList(resultCollectionIDinDB)
      if (!jsonResponse.error) {
        toast.success(jsonResponse["collection_length"] + " elements added to " + object.name)
        setFilenameSavedFeatures(object.name)
        setResultDataset({ id: jsonResponse["resultCollectionName"] })
      } else {
        toast.error(`Extraction failed: ${jsonResponse.error.message}`)
        setError(jsonResponse.error)
      }
    } else {
      toast.error(`Extraction failed: ${jsonInitialization.error.message}`)
      setError(jsonInitialization.error)
    }
    setExtractionProgress(100)
    setExtractionStep("")
    setShowProgressBar(false)
    setRunning(false)
    MEDDataObject.updateWorkspaceDataObject()
  }

  /**
   *
   * @param {Event} event
   *
   * @description
   * Called while the user select a folder to import in order to get
   * JPG data and folder depth
   */
  function handleSelectedFolder(event) {
    let error = false
    let depth = null
    let files = event.target.files
    let jpgFiles = []
    let keys = Object.keys(files)
    keys.forEach((key) => {
      if (files[key].type == "image/jpeg") {
        jpgFiles.push(files[key].path)
        // Check if all the images are at the same folder depth
        if (depth != null) {
          if (depth != files[key].webkitRelativePath.match(/\//g).length) {
            error = true
          }
        } else {
          depth = files[key].webkitRelativePath.match(/\//g).length
        }
      }
    })
    if (error == false && depth != null) {
      setFileList(jpgFiles)
      setFolderDepth(depth - 1)
      toast.success("Data successfully imported")
    } else {
      toast.error("All your JPG files must be placed at the same folder level")
    }
  }

  return (
    <>
      <div className="margin-top-bottom-15 center">
        <div>
          {/* Select JPG data */}
          <h2>Select JPG data</h2>
          <Message severity="info" text="Your JPG data must be a folder containing one folder by patient" />
          <div className="margin-top-15 margin-bottom-15">
            <input ref={inputFolderRef} directory="" webkitdirectory="" type="file" accept="image/jpeg" onChange={handleSelectedFolder} hidden />
            <Button label="Select your data folder" onClick={() => inputFolderRef.current.click()} />
          </div>
          {fileList.length > 0 ? <Message severity="success" text="Data successfully imported" /> : <Message severity="warn" text="No data imported" />}
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
              {extractionType == "DenseNet" && <ExtractionDenseNet folderDepth={folderDepth} setExtractionJsonData={setExtractionJsonData} setOptionsSelected={setOptionsSelected} />}
            </div>
          </div>
        </div>

        <hr></hr>
        <div className="margin-top-bottom-15">
          <div className="center">
            {/* Features Extraction */}
            <h2>Extract features</h2>
            {optionsSelected == false && <Message severity="warn" text="You must select convenient options for feature generation" />}
            <div className="margin-top-30">
              <div className="flex-container">
                <div>
                  Save extracted features as : &nbsp;
                  <InputText keyfilter="alphanum" value={resultCollectionName} onChange={(e) => setResultCollectionName(e.target.value)} />
                  .csv
                </div>
                <div>
                  {/* Button activated only if all necessary columns have been selected */}
                  <Button disabled={running == true || optionsSelected == false || fileList.length == 0} onClick={runExtraction}>
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
        <div className="margin-top-bottom-15">
          {/* Display extracted data */}
          <div className="center">
            <h2>Extracted data</h2>
            <div>{resultDataset && <Message severity="success" text={`Features saved under ${filenameSavedFeatures}`} />}</div>
            <div>
              <p>Display result dataset &nbsp;</p>
            </div>
            <div className="margin-top-bottom-15 center">
              <InputSwitch id="switch" checked={viewResults} onChange={(e) => setViewResults(e.value)} />
            </div>
            {viewResults == true && <div>{resultDataset ? <DataTableFromDB data={resultDataset} isReadOnly={true} /> : <p>Nothing to show, proceed to extraction first.</p>}</div>}
          </div>
        </div>
      </div>
    </>
  )
}

export default ExtractionJPG
