import React, { useContext, useEffect, useState } from "react"
import { WorkspaceContext } from "../../../workspace/workspaceContext"
import { loadJsonPath } from "../../../../utilities/fileManagementUtils"
import { MEDDataObject } from "../../../workspace/NewMedDataObject"
import { DataContext } from "../../../workspace/dataContext"
import Path from "path"
import { sceneDescription as learningSceneDescription } from "../../../../public/setupVariables/learningNodesParams"
import { sceneDescription as extractionMEDimageSceneDescription } from "../../../../public/setupVariables/extractionMEDimageNodesParams"
import FileCreationBtn from "../fileCreationBtn"
import { randomUUID } from "crypto"
import { insertMEDDataObjectIfNotExists } from "../../../mongoDB/mongoDBUtils"
import { toast } from "react-toastify"   

const typeInfo = {
  learning: {
    title: "Learning",
    ...learningSceneDescription
  },
  extractionMEDimage: {
    title: "Extraction MEDimage",
    ...extractionMEDimageSceneDescription
  }
}

const FlowSceneSidebar = ({ type }) => {
  const { workspace } = useContext(WorkspaceContext)
  const [experimentList, setExperimentList] = useState([])
  const { globalData } = useContext(DataContext)
  const isProd = process.env.NODE_ENV === "production"

  useEffect(() => {
    let localExperimentList = []
    if (!globalData["EXPERIMENTS"]) return
    for (const experimentId of globalData["EXPERIMENTS"].childrenIDs) {
      localExperimentList.push(globalData[experimentId].name)
    }
    setExperimentList(localExperimentList)
  }, [workspace, globalData])

  const checkIsNameValid = (name) => {
    return name != "" && !experimentList.includes(name) && !name.includes(" ")
  }

  const createEmptyScene = async (name, isExperiment = false) => {
    createSceneContent("EXPERIMENTS", name, typeInfo[type].extension, isExperiment)
  }

  const createSceneContent = async (parentId, sceneName, extension, isExperiment) => {
    let sceneFolder = new MEDDataObject({
      id: randomUUID(),
      name: sceneName,
      type: "directory",
      parentID: parentId,
      childrenIDs: [],
      inWorkspace: false
    })
    let sceneFolderId = await insertMEDDataObjectIfNotExists(sceneFolder)

    for (const folder of typeInfo[type].externalFolders) {
      if (isExperiment && folder === "models") continue
      let medObject = new MEDDataObject({
        id: randomUUID(),
        name: folder,
        type: "directory",
        parentID: sceneFolderId,
        childrenIDs: [],
        inWorkspace: false
      })
      await insertMEDDataObjectIfNotExists(medObject)
    }

    let sceneObject = new MEDDataObject({
      id: randomUUID(),
      name: sceneName + "." + extension,
      type: extension,
      parentID: sceneFolderId,
      childrenIDs: [],
      inWorkspace: false
    })
    let sceneObjectId = await insertMEDDataObjectIfNotExists(sceneObject)

    let emptyScene = [loadJsonPath(isProd ? Path.join(process.resourcesPath, "baseFiles", "emptyScene.json") : "./baseFiles/emptyScene.json")]
    emptyScene[0] = {
      ...emptyScene[0],
      isExperiment: isExperiment,
    }

    let metadataObject = new MEDDataObject({
      id: randomUUID(),
      name: "metadata.json",
      type: "json",
      parentID: sceneObjectId,
      childrenIDs: [],
      inWorkspace: false
    })
    await insertMEDDataObjectIfNotExists(metadataObject, null, emptyScene)

    let backendMetadataObject = new MEDDataObject({
      id: randomUUID(),
      name: "backend_metadata.json",
      type: "json",
      parentID: sceneObjectId,
      childrenIDs: [],
      inWorkspace: false
    })
    await insertMEDDataObjectIfNotExists(backendMetadataObject, null, emptyScene)

    for (const folder of typeInfo[type].internalFolders) {
      let medObject = new MEDDataObject({
        id: randomUUID(),
        name: folder,
        type: "directory",
        parentID: sceneObjectId,
        childrenIDs: [],
        inWorkspace: false
      })
      await insertMEDDataObjectIfNotExists(medObject)
    }

    // Load everything in globalData
    MEDDataObject.updateWorkspaceDataObject()

    toast.success(isExperiment ? "Experimental scene created in Experiments" : "Scene created in Experiments")
  }

  return (
    <>
      <FileCreationBtn
        label="Create scene"
        piIcon="pi-plus"
        createEmptyFile={createEmptyScene}
        checkIsNameValid={checkIsNameValid}
        type={type}
      />
    </>
  )
}

export default FlowSceneSidebar
