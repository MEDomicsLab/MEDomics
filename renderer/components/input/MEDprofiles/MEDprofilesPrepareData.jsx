import { randomUUID } from "crypto"
import { DataFrame } from "../../../utilities/danfo.js"
import { Button } from "primereact/button"
import { DataView } from "primereact/dataview"
import { Dropdown } from "primereact/dropdown"
import { InputText } from "primereact/inputtext"
import { Message } from "primereact/message"
import { MultiSelect } from "primereact/multiselect"
import { ProgressSpinner } from "primereact/progressspinner"
import React, { useContext, useEffect, useState } from "react"
import ProgressBar from "react-bootstrap/ProgressBar"
import { toast } from "react-toastify"
import { loadCSVPath } from "../../../utilities/fileManagementUtils"
import { requestBackend } from "../../../utilities/requests"
import { ErrorRequestContext } from "../../generalPurpose/errorRequestContext"
import { LayoutModelContext } from "../../layout/layoutContext"
import { PageInfosContext } from "../../mainPages/moduleBasics/pageInfosContext"
import { insertMEDDataObjectIfNotExists } from "../../mongoDB/mongoDBUtils"
import { DataContext } from "../../workspace/dataContext"
import { MEDDataObject } from "../../workspace/NewMedDataObject"
import { WorkspaceContext } from "../../workspace/workspaceContext"
import path from "path"

/**
 *
 * @returns {JSX.Element} a page
 *
 * @description
 * Component of the input module as an Accordion, MEDprofilesPrepareDara allows the user to
 * creates MEDclasses from a master table, instantiate his master table data as MEDprofiles,
 * and finally open the generated data in MEDprofilesViewer.
 *
 */
const MEDprofilesPrepareData = () => {
  const [binaryFileList, setBinaryFileList] = useState([]) // list of available binary files
  const [binaryFilename, setBinaryFilename] = useState("MEDprofiles_bin.pkl") // name under which the MEDprofiles binary file will be saved
  const [generatedClassesFolder, setGeneratedClassesFolder] = useState(null) // folder containing the generated MEDclasses
  const [generatedMEDprofilesFile, setGeneratedMEDprofilesFile] = useState(null) // file containing the generated MEDprofiles binary file
  const [instantiatingMEDprofiles, setInstantiatingMEDprofiles] = useState(false) // boolean telling if the process of instantiating MEDprofiles is running
  const [loadingMasterTables, setLoadingMasterTables] = useState(false) // boolean telling if the csv analyse for mastertable is processing
  const [loadingSubMasterTables, setLoadingSubMasterTables] = useState(false) // boolean telling if the csv analyse for submaster is processing
  const [masterFilename, setMasterFilename] = useState("master_table.csv") // name under which the created master_table will be saved
  const [masterTableFileList, setMasterTableFileList] = useState([]) // list of csv data matching the "MasterTable" format
  const [matchingIdColumns, setMatchingIdColumns] = useState(true) // boolean false if the selected submaster tables doesn't have the same id columns types
  const [MEDprofilesFolderPath, setMEDprofilesFolderPath] = useState(null) // MEDprofiles folder path
  const [progressNumber, setProgressNumber] = useState(0) // Progress number
  const [progressStep, setProgressStep] = useState("") // Progress step
  const [rootDataFolder, setRootDataFolder] = useState(null) // DATA folder
  const [selectedMasterTable, setSelectedMasterTable] = useState(null) // dataset of data to extract used to be display
  const [selectedSubMasterTableFiles, setSelectedSubMasterTableFiles] = useState(null) // selected csv for master table creation
  const [subMasterTableFileList, setSubMasterTableFileList] = useState([]) // list of csv data matching the "Sub-MasterTable" format
  const [showProgressBar, setShowProgressBar] = useState(false) // wether to show or not the extraction progressbar

  const { dispatchLayout } = useContext(LayoutModelContext) // used to open the MEDprofiles Viewer tab
  const { globalData } = useContext(DataContext) // we get the global data from the context to retrieve the directory tree of the workspace, thus retrieving the data files
  const { port } = useContext(WorkspaceContext) // we get the port for server connexion
  const { pageId } = useContext(PageInfosContext) // used to get the pageId
  const { setError } = useContext(ErrorRequestContext) // used to diplay the errors

  /**
   * @description This functions gets the MEDclasses folder if found in globalData and update generatedClassesFolder.
   * */
  async function getGeneratedClassesFolder() {
    let keys = Object.keys(globalData)
    let MEDClassesFolder = null
    keys.forEach((key) => {
      if (globalData[key].type == "directory" && globalData[key].name == "MEDclasses" && globalData[key].path.includes("DATA")) {
        MEDClassesFolder = globalData[key]
      }
    })
    setGeneratedClassesFolder(MEDClassesFolder)
  }

  /**
   * @description
   * This functions get all binary files from the DataContext DATA folder and update binaryFileList.
   */
  function getBinaryFileList() {
    let keys = Object.keys(globalData)
    let tmpList = []
    keys.forEach((key) => {
      if (globalData[key].type == "pkl" && globalData[key].parentID == getMEDprofilesFolderId()) {
        tmpList.push(globalData[key])
      }
    })
    setBinaryFileList(tmpList)
  }

  /**
   *
   * @param {List[String]} iDList
   * @param {Function} setter
   *
   * @description
   * This functions is called when csvFilePaths matching
   * master and submaster format have been returned.
   *
   */
  function getListOfGeneratedElement(iDList, setter) {
    let keys = Object.keys(globalData)
    let tmpList = []
    keys.forEach((key) => {
      if (iDList.includes(globalData[key].id)) {
        tmpList.push(globalData[key])
      }
    })
    setter(tmpList)
  }

  /**
   * @description
   * Open the MEDprofilesViewerPage, depending on generatedClassesFolder and generatedMEDprofilesFile
   */
  function openMEDprofilesViewer() {
    dispatchLayout({
      type: `openMEDprofilesViewerModule`,
      payload: {
        pageId: "MEDprofilesViewer",
        MEDclassesFolder: generatedClassesFolder,
        MEDprofilesBinaryFile: generatedMEDprofilesFile
      }
    })
  }

  /**
   *
   * @param {String} name
   *
   * @description
   * Called when the user change the name under which the master table
   * file will be saved.
   *
   */
  const handleMasterFilenameChange = (name) => {
    if (name.match("^[a-zA-Z0-9_]+.csv$") != null) {
      setMasterFilename(name)
    }
  }

  /**
   *
   * @param {String} name
   *
   * @description
   * Called when the user change the name under which the master table
   * file will be saved.
   *
   */
  const handleBinaryFilenameChange = (name) => {
    if (name.match("^[a-zA-Z0-9_]+.pkl$") != null) {
      setBinaryFilename(name)
    }
  }

  /**
   * @description
   * Calls the create_master_table method in the MEDprofiles server
   */
  const createMasterTable = async () => {
    // Check if the master table already exists
    if (masterFilename) {
      let keys = Object.keys(globalData)
      let masterTableExists = false
      keys.forEach((key) => {
        if (globalData[key].type == "csv" && globalData[key].name == masterFilename) {
          masterTableExists = true
        }
      })
      if (masterTableExists) {
        toast.warn(`Master table ${masterFilename} already exists in the database, please choose another name.`)
        return
      }
    }
    // Create the MEDDataObject
    const id = randomUUID()
    const object = new MEDDataObject({
      id: id,
      name: masterFilename,
      type: "csv",
      parentID: getMastersTablesFolderId() === null ? "ROOT" : getMastersTablesFolderId(),
      path: getMastersTablesFolderId() === null ? path.join("ROOT", masterFilename) : path.join(globalData[getMastersTablesFolderId()].path, masterFilename),
      childrenIDs: [],
      inWorkspace: false
    })

    // Get IDs of the selected csv files to create the master table
    let keys = Object.keys(selectedSubMasterTableFiles)
    let csvCollections = []
    keys.forEach((key) => {
      csvCollections.push(selectedSubMasterTableFiles[key].id)
    })

    // Run creation process
    requestBackend(
      port,
      "/MEDprofiles/create_master_table/" + pageId,
      {
        id: id,
        csvCollections: csvCollections
      },
      (jsonResponse) => {
        console.log("createMasterTable received results:", jsonResponse)
        if (!jsonResponse.error) {
          toast.success("Master table created and added to database.")
          setSelectedSubMasterTableFiles(null)
        } else {
          toast.error(`Creation failed: ${jsonResponse.error.message}`)
          setError(jsonResponse.error)
        }
      },
      function (err) {
        console.error(err)
        toast.error(`Creation failed: ${err}`)
      }
    )

    // Insert the new MEDDataObject in the database
    await insertMEDDataObjectIfNotExists(object)
    MEDDataObject.updateWorkspaceDataObject()
    getMasterSubMasterCsv()
  }

  /**
   * @description
   * This function calls the create_MEDclasses method in the MEDprofiles server
   */
  const createMEDclasses = async () => {
    // Run extraction process
    requestBackend(
      port,
      "/MEDprofiles/create_MEDclasses/" + pageId,
      {
        masterTableID: selectedMasterTable.id,
        MEDprofilesFolderPath: MEDprofilesFolderPath
      },
      (jsonResponse) => {
        console.log("received results:", jsonResponse)
        if (!jsonResponse.error) {
          MEDDataObject.updateWorkspaceDataObject()
        } else {
          toast.error(`Creation failed: ${jsonResponse.error.message}`)
          setError(jsonResponse.error)
        }
      },
      function (err) {
        console.error(err)
        toast.error(`Creation failed: ${err}`)
      }
    )
  }

  /**
   * @description
   * This functions returns the master tables folder id if it exists.
   */
  const getMastersTablesFolderId = () => {
    let keys = Object.keys(globalData)
    let folderId = null
    keys.forEach((key) => {
      if (globalData[key].type == "directory" && globalData[key].name == "master_tables" && globalData[key].parentID == getMEDprofilesFolderId()) {
        folderId = globalData[key].id
      }
    })
    if (folderId == null) {
      createMEDprofilesFolder()
    }
    return folderId
  }

  /**
   * @description
   * This functions returns the MEDprofiles folder id if it exists.
   */
  const getMEDprofilesFolderId = () => {
    if (MEDprofilesFolderPath == null) {
      checkMEDprofilesFolder()
    }
    let folderId = null
    Object.keys(globalData).forEach((key) => {
      if (globalData[key].type == "directory" && globalData[key].name == "MEDprofiles" && globalData[key].parentID == "DATA") {
        folderId = globalData[key].id
      }
    })
    return folderId
  }
  /**
   * @description
   * This function checks if the MEDprofiles folder exists and creates it if it doesn't.
   */
  const checkMEDprofilesFolder = () => {
    let folderExists = false
    let folderId = null
    Object.keys(globalData).forEach((key) => {
      // Check MEDprofiles folder
      if (globalData[key].type == "directory" && globalData[key].name == "MEDprofiles" && globalData[key].parentID == "DATA") {
        setMEDprofilesFolderPath(globalData[key].path)
        folderId = globalData[key].id
      }
      // Check master_tables folder
      if (globalData[key].type == "directory" && globalData[key].name == "master_tables" && globalData[key].parentID == folderId) {
        folderExists = true
      }
    })
    return folderExists
  }

  /**
   * @description
   * This function calls the create_MEDprofiles_folder method in the MEDprofiles server
   */
  const createMEDprofilesFolder = async () => {
    return new Promise((resolve, reject) => {
      // Run extraction process
      requestBackend(
        port,
        "/MEDprofiles/create_MEDprofiles_folder/" + pageId,
        {
          rootDataFolder: rootDataFolder.path
        },
        async (jsonResponse) => {
          console.log("received results:", jsonResponse)
          if (!jsonResponse.error) {
            MEDDataObject.updateWorkspaceDataObject()
            setMEDprofilesFolderPath(jsonResponse["MEDprofiles_folder"])
            resolve()
          } else {
            toast.error(`Creation failed: ${jsonResponse.error.message}`)
            setError(jsonResponse.error)
            setLoadingMasterTables(false)
            setLoadingSubMasterTables(false)
            reject(jsonResponse.error)
          }
        },
        (err) => {
          console.error(err)
          toast.error(`Creation failed: ${err}`)
          reject(err)
        }
      )
    })
  }

  /**
   * @description
   * This function returns the root workspace directory path.
   * @returns {String} the root workspace directory path
   */
  const getRootWorkspacePath = () => {
    let keys = Object.keys(globalData)
    let rootWorkspacePath = null
    keys.forEach((key) => {
      if (globalData[key].type == "directory" && globalData[key].id == "ROOT") {
        rootWorkspacePath = globalData[key].path
      }
    })
    return rootWorkspacePath
  }

  /**
   * @description
   * This function calls the get_master_csv method in the MEDprofiles server
   * It updates list of masterTableFileList and submasterTableFileList
   */
  const getMasterSubMasterCsv = () => {
    // Get IDs of the csv files in the database
    let csvEntries = Object.values(globalData).filter((entry) => entry.type === "csv")
    let csvCollections = csvEntries.map((entry) => entry.id)

    // Run extraction process
    requestBackend(
      port,
      "/MEDprofiles/get_master_csv/" + pageId,
      {
        csvCollections: csvCollections
      },
      (jsonResponse) => {
        if (!jsonResponse.error) {
          console.log("received results:", jsonResponse)
          if (!jsonResponse["master_csv"] || jsonResponse["master_csv"].length == 0) {
            console.warn("No csv matching the master table format found in the selected folder")
          } else {
            getListOfGeneratedElement(jsonResponse["master_csv"], setMasterTableFileList)
          }
          if (!jsonResponse["submaster_csv"] || jsonResponse["submaster_csv"].length == 0) {
            console.warn("No csv matching the submaster table format found in the selected folder")
          } else {
            getListOfGeneratedElement(jsonResponse["submaster_csv"], setSubMasterTableFileList)
          }
        } else {
          toast.error(`Loading csv matching formats failed: ${jsonResponse.error.message}`)
          setError(jsonResponse.error)
        }
        setLoadingMasterTables(false)
        setLoadingSubMasterTables(false)
      },
      function (err) {
        console.error(err)
        toast.error(`Loading csv matching formats failed: ${err}`)
        setLoadingMasterTables(false)
        setLoadingSubMasterTables(false)
      }
    )
  }

  /**
   * @description
   * Run the initialization process for MEDprofiles instantiation.
   * Allows to create the binary file and to get the patient list.
   * @returns jsonResponse
   */
  async function initializeMEDprofilesInstantiation() {
    return new Promise((resolve, reject) => {
      requestBackend(
        port,
        "/MEDprofiles/initialize_MEDprofiles_instantiation/" + pageId,
        {
          masterTableID: selectedMasterTable.id,
          MEDprofilesFolderPath: MEDprofilesFolderPath
        },
        (response) => resolve(response),
        (error) => reject(error)
      )
    })
  }

  /**
   * @description
   * Extract text notes by batch depending on the extraction type specified.
   * Update the progress bar.
   *
   * @returns extractedData
   */
  async function runMEDprofilesInstantiation(processingList) {
    // Check if a pickle file already
    if (binaryFilename) {
      let pklFileExists = false
      Object.keys(globalData).forEach((key) => {
        if (globalData[key].type == "pkl" && globalData[key].name == binaryFilename) {
          pklFileExists = true
        }
      })
      if (pklFileExists) {
        toast.warn(`Binary file ${binaryFilename} already exists in the database, please choose another name.`)
        return
      }
    }
    // If object not in the DB we create it
    let object = new MEDDataObject({
      id: randomUUID(),
      name: binaryFilename,
      type: "pkl",
      parentID: getMEDprofilesFolderId(),
      childrenIDs: [],
      path: path.join(MEDprofilesFolderPath, binaryFilename),
      inWorkspace: false
    })
    let progress = 10
    let chunkSize = 25
    let chunks = []
    let lastChunk = false
    for (let i = 0; i < processingList.length; i += chunkSize) {
      const chunk = processingList.slice(i, i + chunkSize)
      chunks.push(chunk)
    }
    for (const subList of chunks) {
      // check if last chunk
      if (subList === chunks[chunks.length - 1]) {
        lastChunk = true
      }
      // Ensure generatedClassesFolder is defined and has a path
      if (!generatedClassesFolder || !generatedClassesFolder.path) {
        await getGeneratedClassesFolder()
      }
      if (!generatedClassesFolder || !generatedClassesFolder.path) {
        toast.error("Generated MEDclasses folder not found. Please ensure it exists before proceeding.")
        return
      }
      try {
        const jsonResponse = await new Promise((resolve, reject) => {
          progress += (1 / chunks.length) * 80
          setProgressNumber(progress.toFixed(2))
          requestBackend(
            port,
            "/MEDprofiles/instantiate_MEDprofiles/" + pageId,
            {
              masterTableID: selectedMasterTable.id,
              MEDclassesFolder: generatedClassesFolder.path,
              pickleFileObject: object,
              patientList: subList,
              rootDir: getRootWorkspacePath(),
              lastChunk: lastChunk
            },
            (response) => resolve(response),
            (error) => reject(error)
          )
        })
        if (jsonResponse.error) {
          console.error(jsonResponse.error)
          toast.error(`Instantiation failed: ${jsonResponse.error.message}`)
          setError(jsonResponse.error)
          return
        }
      } catch (err) {
        console.error(err)
        toast.error(`Instantiation failed: ${err}`)
        return
      }
    }
    MEDDataObject.updateWorkspaceDataObject()

    return object
  }

  /**
   * @description
   * This function calls the instantiate_MEDprofiles method in the MEDprofiles server
   */
  const instantiateMEDprofiles = async () => {
    // Create MEDclasses
    await createMEDclasses()

    // Set the progress information
    setInstantiatingMEDprofiles(true)
    setShowProgressBar(true)
    setProgressNumber(0)
    setProgressStep("Initialization")

    // Initialize instantiation process
    let jsonInitialization = await initializeMEDprofilesInstantiation()

    // Run MEDprofiles instantiation process
    setProgressStep("Instantiating data")
    if (jsonInitialization.patient_list) {
      // If no error, run the instantiation process
      let processingList = jsonInitialization["patient_list"]
      let pklObject = await runMEDprofilesInstantiation(processingList)
      // add the new object to the database
      if (pklObject) {
        await insertMEDDataObjectIfNotExists(pklObject)
        toast.success("Instantiation completed")
      }
    } else if (jsonInitialization.error) {
      toast.error(`Instantiation failed: ${jsonInitialization.error.message}`)
      setError(jsonInitialization.error)
    } else {
      toast.error("Instantiation failed: invalid dataset")
    }
    setShowProgressBar(false)
    setInstantiatingMEDprofiles(false)
  }

  // Look of items in the MEDclasses DataView
  const MEDclassesDisplay = (element) => {
    let name = globalData[element]?.name
    let style = {
      border: "1px solid #dfe1e5",
      borderRadius: "10px",
      padding: "10px",
      margin: "10px 0",
      backgroundColor: "#f9f9f9",
      boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
      textAlign: "center",
      transition: "background-color 0.3s ease",
      cursor: "pointer"
    }
    if (name) {
      if (name.includes(".")) {
        return (
          <div style={style} onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#e0f7fa")} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#f9f9f9")}>
            <span style={{ fontWeight: "bold", fontSize: "16px", color: "#333" }}>{name.split(".").slice(0, -1).join(".")}</span>
          </div>
        )
      } else {
        return
      }
    }
  }

  // Called when the page is loaded in order to fill all the options
  useEffect(() => {
    setLoadingMasterTables(true)
    setLoadingSubMasterTables(true)
    setSubMasterTableFileList([])
    setMasterTableFileList([])
    setSelectedSubMasterTableFiles(null)
    setSelectedMasterTable(null)
    getMasterSubMasterCsv()
    getBinaryFileList()
    getGeneratedClassesFolder()
  }, [])

  // Called while global data is updated in order to get the DATA folder, to update the available fields (csv filesm pkl, etc.)
  // and create the MEDprofiles folder if it doesn't exist
  useEffect(() => {
    if (globalData !== undefined) {
      setLoadingMasterTables(true)
      setLoadingSubMasterTables(true)
      setSubMasterTableFileList([])
      setMasterTableFileList([])
      setSelectedSubMasterTableFiles(null)
      setSelectedMasterTable(null)
      getMasterSubMasterCsv()
      getBinaryFileList()
      getGeneratedClassesFolder()
      let keys = Object.keys(globalData)
      keys.forEach((key) => {
        if (globalData[key].type == "directory" && globalData[key].name == "DATA" && (globalData[key].parentID == "UUID_ROOT" || globalData[key].parentID == "ROOT")) {
          if (globalData[key] !== rootDataFolder) {
            setRootDataFolder(globalData[key])
          }
        }
      })
    }
  }, [globalData])

  // Called while rootDataFolder is updated in order to create the MEDprofiles folder
  useEffect(() => {
    if (rootDataFolder) {
      if (!checkMEDprofilesFolder()) {
        createMEDprofilesFolder()
      }
    }
  }, [rootDataFolder])

  // Called while selectedSubMasterTableFiles is updated in order to update matchingIdColumns
  useEffect(() => {
    if (selectedSubMasterTableFiles && selectedSubMasterTableFiles.length > 1) {
      let idTypes = []
      let keys = Object.keys(selectedSubMasterTableFiles)

      // Load the CSV file in order to check if the data is matching the required format
      const loadCSVFile = (MEDdata) => {
        // Create a promise for each CSV file
        return new Promise((resolve) => {
          loadCSVPath(MEDdata.path, (data) => {
            let dataframe = new DataFrame(data)
            if (dataframe.$dtypes && dataframe.$dtypes.length > 0) {
              idTypes.push(dataframe.$dtypes[0])
            } else {
              console.warn("DataFrame has no dtypes or is empty for", MEDdata.path)
              idTypes.push(undefined)
            }
            resolve()
          })
        })
      }

      // Create a promises array for all the csv files
      const promises = keys.map((key) => loadCSVFile(selectedSubMasterTableFiles[key]))

      // Wait for all the csv files to have been examinated
      Promise.all(promises)
        .then(() => {
          setMatchingIdColumns(idTypes.every((value) => value === idTypes[0]))
          console.log(
            "TYPES",
            idTypes,
            idTypes.every((value) => value === idTypes[0])
          )
        })
        .catch((error) => {
          toast.error("Error while loading MEDdata :", error)
        })
    } else {
      setMatchingIdColumns(true)
    }
  }, [selectedSubMasterTableFiles])

  return (
    <>
      <div className="margin-top-15 margin-bottom-15 center">
        <Message
          content={
            <div>
              <i className="pi pi-info-circle" />
              &nbsp; This tool is an implementation of the
              <i>
                <b>
                  <a href="https://github.com/MEDomics-UdeS/MEDprofiles" target="_blank">
                    {" "}
                    MEDprofiles package
                  </a>
                </b>
              </i>
              .
            </div>
          }
        />
      </div>
      <div>
        <hr></hr>
        <div className="margin-top-15">
          <h5 className="align-center">Create or Select your master table</h5>
          <div className="align-center">
            <Message severity="info" text="Only the files matching the required format will be shown" />
          </div>
          <div className="align-center">{!matchingIdColumns && <Message severity="warn" text="Your selected csv for master table creation contains different types for identifier columns" />}</div>
        </div>
        <div className="margin-top-15 flex-container">
          <div className="mergeToolMultiSelect">
            {subMasterTableFileList?.length > 0 ? (
              <MultiSelect
                style={{ maxWidth: "200px" }}
                value={selectedSubMasterTableFiles}
                onChange={(e) => setSelectedSubMasterTableFiles(e.value)}
                options={subMasterTableFileList}
                optionLabel="name"
                className="w-full md:w-14rem margintop8px"
                display="chip"
                placeholder="Select CSV files"
              />
            ) : loadingSubMasterTables == true ? (
              <MultiSelect placeholder="Loading..." disabled />
            ) : (
              <MultiSelect placeholder="No CSV files to show" disabled />
            )}
          </div>
          <div>
            Save master table as : &nbsp;
            <InputText value={masterFilename} onChange={(e) => handleMasterFilenameChange(e.target.value)} />
          </div>
          <div>
            <Button
              label="Create Master Table"
              raised
              loading={loadingMasterTables}
              disabled={!selectedSubMasterTableFiles || selectedSubMasterTableFiles?.length < 1 || !matchingIdColumns}
              onClick={createMasterTable}
            />
          </div>
          <div className="vertical-divider"></div>
          <div>{loadingMasterTables == true && <ProgressSpinner style={{ width: "40px", height: "40px" }} />}</div>
          <div>
            {masterTableFileList.length > 0 ? (
              <Dropdown value={selectedMasterTable} options={masterTableFileList} optionLabel="name" onChange={(event) => setSelectedMasterTable(event.value)} placeholder="Select a master table" />
            ) : loadingMasterTables == true ? (
              <Dropdown placeholder="Loading..." disabled />
            ) : (
              <Dropdown placeholder="No CSV files to show" disabled />
            )}
          </div>
        </div>
      </div>
      {generatedClassesFolder?.childrenIDs && (
        <div className="card data-view">
          <DataView value={generatedClassesFolder.childrenIDs} itemTemplate={MEDclassesDisplay} paginator rows={5} header="Generated MEDclasses" style={{ textAlign: "center" }} />
        </div>
      )}
      <hr></hr>
      <div className="margin-top-15 flex-container">
        <div>
          Save MEDprofiles binary file as : &nbsp;
          <InputText value={binaryFilename} onChange={(e) => handleBinaryFilenameChange(e.target.value)} />
        </div>
        <div>
          <Button label="Instantiate MEDprofiles" raised disabled={!selectedMasterTable || instantiatingMEDprofiles} onClick={instantiateMEDprofiles} />
        </div>
      </div>
      <div className="margin-top-15 extraction-progress">
        {showProgressBar && (
          <div className="progress-bar-requests">
            <label>{progressStep}</label>
            <ProgressBar now={progressNumber} label={`${progressNumber}%`} />
          </div>
        )}
      </div>
      <hr></hr>
      <h5 className="margin-top-15 align-center">Visualize your MEDprofiles data</h5>
      <div className="margin-top-15 flex-container">
        <div>
          MEDprofiles binary file : &nbsp;
          {binaryFileList.length > 0 ? (
            <Dropdown
              style={{ width: "250px" }}
              value={generatedMEDprofilesFile}
              options={binaryFileList}
              onChange={(event) => setGeneratedMEDprofilesFile(event.value)}
              optionLabel="name"
              placeholder="Select your MEDprofiles binary file"
            />
          ) : (
            <Dropdown placeholder="No file to show" disabled />
          )}
        </div>
        <div>
          <Button raised disabled={!generatedMEDprofilesFile} onClick={openMEDprofilesViewer} label="Open MEDprofiles Viewer" />
        </div>
      </div>
    </>
  )
}

export default MEDprofilesPrepareData
