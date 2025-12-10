/* eslint-disable */
import React, { useEffect, useState, useContext } from "react"
import { Image } from "primereact/image"
import { DataContext } from "../../../workspace/dataContext"
import { MEDDataObject } from "../../../workspace/NewMedDataObject"
import { WorkspaceContext } from "../../../workspace/workspaceContext"

/**
 *
 * @param {Object} selectedResults The selected results
 * @returns {JSX.Element} The AnalyseResults component
 */
const AnalyseResults = ({ selectedResults }) => {
  const [images, setImages] = useState([])
  const { globalData } = useContext(DataContext)
  const { workspace } = useContext(WorkspaceContext)

  useEffect(() => {
    const imageExists = Object.entries(globalData).some(([key, _]) => {
      return Object.values(selectedResults.data).includes(key)
    })
    if (!imageExists) {
      setImages([])
      return
    }
    const imagesInfos = Object.entries(selectedResults.data).map(([modelName, collectionId]) => ({ modelName, collectionId }))
    const alreadyInWorkspace = globalData[globalData[Object.entries(selectedResults.data)[0][1]].parentID].inWorkspace

    const downloadImages = async (imagesInfos) => {
      const imagePaths = []
      for (const { modelName, collectionId } of imagesInfos) {
        const medDataObject = globalData[collectionId]
        if (!medDataObject?.inWorkspace) {
          await MEDDataObject.sync(globalData, collectionId, workspace.workingDirectory.path, false)
        }

        const filePath = MEDDataObject.getFullPath(globalData, collectionId, workspace.workingDirectory.path)
        imagePaths.push({ modelName, filePath })
      }

      const imagePromises = imagePaths.map(({ modelName, filePath }) => {
        return new Promise((resolve) => {
          const nativeImage = require("electron").nativeImage
          const image = nativeImage.createFromPath(filePath)
          resolve({
            key: modelName,
            imageUrl: image.toDataURL()
          })
        })
      })

      const results = await Promise.all(imagePromises)
      const images = results.map(({ key, imageUrl }) => (
        <div key={key}>
          <Image src={imageUrl} alt="Image" height="250" indicatorIcon={<h5>{key}</h5>} preview downloadable />
        </div>
      ))
      setImages(images)
    }

    if (imagesInfos.length) {
      downloadImages(imagesInfos)
    }

    return () => {
      // Clean up images from workspace when component unmounts
      imagesInfos.forEach(async ({ collectionId }) => {
        if (!alreadyInWorkspace) {
          MEDDataObject.deleteObjectAndChildrenFromWorkspace(globalData, collectionId, workspace.workingDirectory.path, false)
        }
      })
    }
  }, [selectedResults])

  return (
    <div className="height-100 width-100 flex-grid-gap-1rem">
      {images.map((image) => {
        return image
      })}
    </div>
  )
}

export default AnalyseResults
