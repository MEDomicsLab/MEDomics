import { randomUUID } from "crypto"
import Image from "next/image"
import { InputText } from "primereact/inputtext"
import { useContext, useEffect, useState } from "react"
import { Button, Card, Stack } from "react-bootstrap"
import { FaAlignJustify } from "react-icons/fa"
import { MdDashboard } from "react-icons/md"
import { TbZoom } from "react-icons/tb"
import med3paLogo from "../../../resources/MED3paLogo.png"
import myimage from "../../../resources/medomics_transparent_bg.png"
import { LayoutModelContext } from "../layout/layoutContext"
import { insertMEDDataObjectIfNotExists } from "../mongoDB/mongoDBUtils"
import { DataContext } from "../workspace/dataContext"
import { MEDDataObject } from "../workspace/NewMedDataObject"


// Variable used to store some modularity information about the module
const typeInfo = {
  title: "Evaluation",
  extension: "medeval",
  internalFolders: []
}

export default function EvaluationLandingPage() {
  const [nameEval, setNameEval] = useState("")
  const [experimentList, setExperimentList] = useState([]) // List of .medeval files
  const [loading, setLoading] = useState(false)
  const [pendingOpenId, setPendingOpenId] = useState(null)
  const { dispatchLayout, setLayoutRequestQueue } = useContext(LayoutModelContext)
  const { globalData } = useContext(DataContext)
  
  // We use the useEffect hook to update the experiment list state when the workspace changes
  useEffect(() => {
    let localExperimentList = []
    if (!globalData["EXPERIMENTS"]) return
    for (const experimentId of globalData["EXPERIMENTS"].childrenIDs) {
      if (globalData[experimentId]) {
        localExperimentList.push(globalData[experimentId].name)
      }
    }
    setExperimentList(localExperimentList)
  }, [globalData]) // We log the workspace when it changes

  useEffect(() => {
    if (!pendingOpenId || !globalData[pendingOpenId]) return

    const medObject = globalData[pendingOpenId]
    const openItem = {
      index: pendingOpenId,
      canMove: true,
      isFolder: false,
      children: medObject.childrenIDs || [],
      data: medObject.name,
      canRename: true,
      type: medObject.type || "medeval",
      inWorkspace: medObject.inWorkspace ?? false,
      path: medObject.path ?? null,
      isLocked: medObject.isLocked ?? null,
      usedIn: medObject.usedIn ?? null
    }
    dispatchLayout({ type: "openInEvaluationModule", payload: openItem })
    if (setLayoutRequestQueue) {
      setLayoutRequestQueue((prev) => [...prev, { type: "DELETE_TAB", payload: { id: "evaluationLandingPage" } }])
    } else {
      dispatchLayout({ type: "remove", payload: { name: "Evaluation Module" } })
    }
    setPendingOpenId(null)
  }, [dispatchLayout, globalData, pendingOpenId, setLayoutRequestQueue])

  const createSceneContent = async (sceneName) => {
    setLoading(true)
    
    // Create custom zip file
    const sceneId = randomUUID()
    const sceneFileName = `${sceneName}.medeval`
    let sceneObject = new MEDDataObject({
      id: sceneId,
      name: sceneFileName,
      type: "medeval",
      parentID: "EXPERIMENTS",
      childrenIDs: [],
      inWorkspace: false
    })
    let sceneObjectId = await insertMEDDataObjectIfNotExists(sceneObject)

    // Create hidden metadata file
    const emptyScene = [{ useMedStandard: false }]
    const metadataId = randomUUID()
    let metadataObject = new MEDDataObject({
      id: metadataId,
      name: "metadata.json",
      type: "json",
      parentID: sceneObjectId,
      childrenIDs: [],
      inWorkspace: false
    })
    await insertMEDDataObjectIfNotExists(metadataObject, null, emptyScene)

    // Create internal folders
    const childrenIds = [metadataId]
    for (const folder of typeInfo.internalFolders) {
      const folderId = randomUUID()
      let medObject = new MEDDataObject({
        id: folderId,
        name: folder,
        type: "directory",
        parentID: sceneObjectId,
        childrenIDs: [],
        inWorkspace: false
      })
      await insertMEDDataObjectIfNotExists(medObject)
      childrenIds.push(folderId)
    }

    // Load everything in globalData
    MEDDataObject.updateWorkspaceDataObject()

    setPendingOpenId(sceneObjectId || sceneId)

    // Update loading state
    setLoading(false)
  }

  function choosePage(event, name) {
    event.stopPropagation()
    console.log(`Double clicked ${name}`, event, `open${name}Module`)
    dispatchLayout({ type: `open${name}Module`, payload: { pageId: name } })
  }

  const trimmedName = nameEval.trim()
  const isValidName = /^[A-Za-z0-9_-]+$/.test(trimmedName)
  const existingNames = new Set(experimentList)
  const hasConflict =
    trimmedName !== "" && (existingNames.has(trimmedName) || existingNames.has(`${trimmedName}.medeval`))
  const nameError = trimmedName === ""
    ? ""
    : !isValidName
      ? "Use only letters, numbers, hyphens, or underscores."
      : hasConflict
        ? "This evaluation session already exists."
        : ""
  const isStartDisabled = loading || trimmedName === "" || !isValidName || hasConflict

  return (
    <div className="h-100 w-100">
      <h1 className="text-center  fw-bold text-secondary mt-5" style={{ fontSize: "3rem", letterSpacing: "1px" }}>
        Evaluation Module
      </h1>

      <div className="mx-auto text-center my-4" >
        <Image className="text-center" src={myimage} alt="" style={{ height: "30px", width: "30px" }} />
      </div>

      {/* Description of the Evaluation Module */}
      <div className="mx-auto text-center" style={{ maxWidth: "860px", marginBottom: "40px" }}>
        <h5 className="lh-lg" style={{ fontSize: "1.1rem" }}>
          The Evaluation Module is as a quality-check workspace that tests completed AI models on fresh data, 
          uses interactive dashboards to explain how they make decisions, and flags unreliable predictions to 
          ensure no patient group is left behind.
        </h5>
      </div>

      <div style={{ display: "flex", flexDirection: "vertical", flexGrow: "10", width: "100%", margin: "auto" }}>
          {/* Main Title and Subtitle */}
          <div className="h-100 w-100 d-flex justify-content-center align-items-center">
            <Stack direction="horizontal" gap={4} className="w-100">
              {/* Explainer Dashboard Card */}
              <Card className="flex-fill shadow-sm border-primary h-100 w-50 hover-border-success" style={{ cursor: "pointer" }}>
                <Card.Header className="bg-danger text-white d-flex align-items-center">
                  <TbZoom className="me-2" color="white"/>
                  <h5 className="text-white mb-0">Explainer Dashboard</h5>
                </Card.Header>
                <Card.Body className="d-flex flex-column justify-content-center align-items-center p-4">
                  <MdDashboard className="me-6" size={100} color="red"/>
                  <Card.Text className="mt-3 text-center">
                    Build interactive dashboards to analyze and explain the predictions of your models.
                  </Card.Text>
                  <div 
                    className="p-inputgroup w-full my-3"
                    style={{ margin: "5px", fontSize: "1rem", marginTop: "20px", maxWidth: "300px" }}
                  >
                    <InputText placeholder="Session Name" value={nameEval} onChange={(e) => setNameEval(e.target.value)} />
                    <span className="p-inputgroup-addon">.medeval</span>
                  </div>
                    <Button variant="danger" onClick={() => createSceneContent(trimmedName)} disabled={isStartDisabled}>
                      Start Evaluation
                    </Button>
                  
                  {nameError && (
                    <div className="text-danger small mt-1">{nameError}</div>
                  )}
                </Card.Body>
              </Card>

              {/* MED3pa Card */}
              <Card className="flex-fill shadow-sm border-success h-100 w-50" style={{ cursor: "pointer" }}>
                <Card.Header className="bg-success text-white d-flex align-items-center">
                  <FaAlignJustify className="me-2" color="white"/>
                  <h5 className="text-white mb-0">MED3pa</h5>
                </Card.Header>
                <Card.Body className="d-flex flex-column justify-content-center align-items-center p-4">
                  <Image src={med3paLogo} alt="MED3pa" width={120} height={120} />
                  <Card.Text className="mt-3 text-center">
                    Evaluate models stability and performance and flag unreliable predictions to ensure no patient group is left behind.
                  </Card.Text>
                  <Button variant="success" onClick={(e) => choosePage(e, "MED3pa")}>
                    Start Analysis
                  </Button>
                </Card.Body>
              </Card>
            </Stack>
          </div>
      </div>
    </div>
  )
}
