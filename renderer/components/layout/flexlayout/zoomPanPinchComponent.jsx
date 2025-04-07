/* eslint-disable no-undef */
import React, { useEffect, useState } from "react"
import { Button } from "react-bootstrap"
import { ArrowClockwise, ZoomIn, ZoomOut } from "react-bootstrap-icons"
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch"
import { connectToMongoDB } from "../../mongoDB/mongoDBUtils"

const nativeImage = require("electron").nativeImage

/**
 * @description - This component is the zoom pan pinch component that will be used to zoom in and out of images
 * @returns the zoom pan pinch component
 * @param {Object} props - The props object
 * @param {String} props.imagePath - The path to the image to display
 * @param {Object} props.options - The options object
 * @param {String} props.image - The image to display
 * @param {Number} props.height - The height of the image
 * @param {Number} props.width - The width of the image
 */
const ZoomPanPinchComponent = ({ imagePath = undefined, options = undefined, image = undefined, height=null, width=null, imageID=null }) => {
  const [figure, setFigure] = useState(null)
  const [imageData, setImageData] = useState({})

  /**
   * Fetches an image from MongoDB using the provided imageID.
   * @param {String} imageID - The ID of the image to fetch
   * @returns {Promise<String>} - The Base64-encoded image data
   */
  const getImage = async (imageID) => {
    const db = await connectToMongoDB()
    const collection = db.collection(imageID)
    const result = await collection.find({}).toArray()
    return JSON.stringify(result[0].data)
  }

  /**
   * Gets the dimensions of an image from a Base64 string.
   * @param {String} base64String - The Base64-encoded image data
   * @returns {Promise<{ width: Number, height: Number }>} - The dimensions of the image
   */
  const getImageDimensions = (base64String) => {
    return new Promise((resolve, reject) => {
      // Create an Image object
      const img = new Image()
  
      // Set the src to the Base64 string
      img.src = base64String
  
      // Wait for the image to load
      img.onload = () => { resolve({ width: img.width, height: img.height }) }
  
      // Handle errors
      img.onerror = (error) => { reject(new Error("Failed to load image", error)) }
    })
  }
  
  /**
   * Loads and displays an image from MongoDB or local path.
   */
  const loadAndDisplayImage = async (imageID, image, width, height) => {
    try {
      // We check if the image path is defined
      if (imagePath && !image) {
        image = nativeImage.createFromPath(imagePath).toDataURL()
      }
      if (image){
        if (!height) {
          height = nativeImage.createFromPath(imagePath).getSize().height
        }
        if (!width) {
          width = nativeImage.createFromPath(imagePath).getSize().width
        }
        setFigure(image)
        setImageData({"width": width, "height": height})
        return
      }
      // Await the result of getImage to get the actual image data
      image = await getImage(imageID,)
  
      // Construct the data URL
      const src = `data:image/png;base64,${image.substring(1, image.length - 1)}`
  
      // Get dimensions
      const dimensions = await getImageDimensions(src)
  
      // Update the state
      setFigure(src)
      setImageData({"width": dimensions.width, "height": dimensions.height})
    } catch (error) {
      console.error("Error loading image:", error)
      return <div>Error loading image</div>
    }
  }
  useEffect(() => {
    loadAndDisplayImage(imageID, image, width, height)
  }, [imageID, image])
  

  return (
    <TransformWrapper initialScale={1} initialPositionX={100} initialPositionY={100} {...options} backgroundColor="black">
      {({ zoomIn, zoomOut, resetTransform, ...rest }) => (
        <React.Fragment>
          <div className="tools">
            <Button onClick={() => zoomIn()}>
              <ZoomIn />
            </Button>
            <Button onClick={() => zoomOut()}>
              <ZoomOut />
            </Button>
            <Button onClick={() => resetTransform()}>
              <ArrowClockwise />
            </Button>
          </div>
          <TransformComponent>
            <img className="imageViewer" src={figure} alt="test" width={imageData.width} height={imageData.height} style={{ height: imageData.height, width: imageData.width }} data={rest}/>
          </TransformComponent>
        </React.Fragment>
      )}
    </TransformWrapper>
  )
}

export default ZoomPanPinchComponent
