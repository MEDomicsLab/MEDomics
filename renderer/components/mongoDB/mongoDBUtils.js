const { MongoClient } = require("mongodb")
const fs = require("fs")
const Papa = require("papaparse")
import { getTunnelState } from "../../utilities/tunnelState"
import axios from "axios"

function getMongoUri() {
  const tunnel = getTunnelState()
  if (tunnel && tunnel.tunnelActive && tunnel.localDBPort) {
    return `mongodb://localhost:${tunnel.localDBPort}`
  }
  return "mongodb://localhost:54017"
}

const dbName = "data" // Remplacez par le nom de votre base de données

let client

/**
 * @description Establish a connection to MongoDB data database
 * @returns Connection to the data database
 */
export async function connectToMongoDB() {
  if (!client) {
    client = new MongoClient(getMongoUri(), { useNewUrlParser: true, useUnifiedTopology: true })
    await client.connect()
  }
  return client.db(dbName)
}

/**
 * @description Update the name of a MEDDataObject specified by id in the DB
 * @param {String} id Id of the MEDDataObject to update
 * @param {String} newName New name for the MEDDataObject to update
 * @returns bool true if succeed
 */
export async function updateMEDDataObjectName(id, newName) {
  const db = await connectToMongoDB()
  const result = await db.collection("medDataObjects").updateOne({ id: id }, { $set: { name: newName } })
  return result.modifiedCount > 0
}

/**
 * @description Update the type of a MEDDataObject specified by id in the DB
 * @param {String} id Id of the MEDDataObject to update
 * @param {String} newType New type for the MEDDataObject to update
 * @returns bool true if succeed
 */
export async function updateMEDDataObjectType(id, newType) {
  const db = await connectToMongoDB()
  // Check if type has alphabetic characters only
  if (newType.match(/[a-z]/)) {
    console.error("Type can only contain alphabetic characters")
    return false
  }
  const result = await db.collection("medDataObjects").updateOne({ id: id }, { $set: { type: newType } })
  return result.modifiedCount > 0
}

/**
 * @description Update the usedIn list of a MEDDataObject specified by id in the DB
 * @param {String} id Id of the MEDDataObject to update
 * @param {String} usedIn New name for the MEDDataObject to update
 * @returns bool true if succeed
 */
export async function updateMEDDataObjectUsedInList(id, usedIn) {
  const db = await connectToMongoDB()
  const result = await db.collection("medDataObjects").updateOne({ id: id }, { $set: { usedIn: usedIn } })
  return result.modifiedCount > 0
}

/**
 * @description Update the path of a MEDDataObject specified by id in the DB
 * @param {String} id Id of the MEDDataObject to update
 * @param {String} newPath New path for the MEDDataObject to update
 * @returns bool true if succeed
 */
export async function updateMEDDataObjectPath(id, newPath) {
  const db = await connectToMongoDB()
  const result = await db.collection("medDataObjects").updateOne({ id: id }, { $set: { path: newPath } })
  return result.modifiedCount > 0
}

/**
 * @description Insert a MEDDataObject in the database if not exists
 * @param {MEDDataObject} medData MEDDataObject to insert in the database
 * @param {String} path path of the data we want to import in the database
 * @param {Json} jsonData the data to insert in MongoDB
 * @param {Int} copyId if we insert a copy of a MEDDataObject we copy its data too
 * @returns id the id of the MEDDataObject in the DB
 */
export async function insertMEDDataObjectIfNotExists(medData, path = null, jsonData = null, copyId = null) {
  const db = await connectToMongoDB()
  const collection = db.collection("medDataObjects")

  // Check if MEDDataObject exists in the DB
  const existingObjectByID = await collection.findOne({ id: medData.id })
  if (existingObjectByID) {
    // If object already in the DB we stop here
    return existingObjectByID.id
  }

  const existingObjectByAttributes = await collection.findOne({ name: medData.name, type: medData.type, parentID: medData.parentID })
  if (existingObjectByAttributes) {
    // If object already in the DB we stop here
    return existingObjectByAttributes.id
  }

  // Add path to medData if not null and not already present
  if (path !== null && path !== undefined && typeof path === "string" && path.trim() !== "" && !medData.path) {
    medData.path = path
  }

  // Insert MEDdataObject if not exists
  const result = await collection.insertOne(medData)
  console.log(`MEDDataObject inserted with _id: ${result.insertedId}`)

  // Add the id of the inserted object to the childrenIDs of its parent
  if (medData.parentID) {
    const parent = await collection.findOne({ id: medData.parentID })
    if (parent) {
      let children = parent.childrenIDs || []

      // Check if the child is already in the parent's childrenIDs
      if (!children.includes(medData.id)) {
        // Fetch the actual child objects to sort them
        const childrenObjects = await collection.find({ id: { $in: children } }).toArray()
        childrenObjects.push(medData)

        // Sort the children objects first by type (directories first) and then alphabetically by name
        childrenObjects.sort((a, b) => {
          if (a.type === b.type) {
            return a.name.localeCompare(b.name)
          }
          return a.type === "directory" ? -1 : 1
        })

        // Extract the sorted ids
        children = childrenObjects.map((child) => child.id)

        // Update the parent with the sorted children ids
        await collection.updateOne({ id: medData.parentID }, { $set: { childrenIDs: children } })
      }
    }
  }

  // Insert MEDdataObject data (if contains data)
  if (jsonData) {
    const dataCollection = db.collection(medData.id)
    const result = await dataCollection.insertMany(jsonData)
    console.log(`Data inserted with ${result.insertedCount} documents`)
  } else if (path) {
    const tunnel = getTunnelState()
    if (tunnel && tunnel.tunnelActive && tunnel.localDBPort) { // run remotely
      axios.post(`http://${tunnel.host}:3000/insert-object-into-collection`, { objectPath: path, medDataObject: medData })
        .then(response => {
          if (response.data.success) {
            console.log(`${medData.type} object successfully inserted remotely.`)
          } else {
            console.error(`Failed to insert ${medData.type} : ` + response.data.error)
          }
        })
        .catch(err => {
          console.error(`Failed to insert ${medData.type} : ` + (err && err.message ? err.message : String(err)))
        })
    } else { // run locally
      switch (medData.type) {
        case "csv":
          await insertCSVIntoCollection(path, medData.id)
          break
        case "html":
          await insertHTMLIntoCollection(path, medData.id)
          break
        case "png":
          await insertPNGIntoCollection(path, medData.id)
          break
        case "pkl":
          await insertPKLIntoCollection(path, medData.id)
          break
        case "jpg":
          await insertJPGIntoCollection(path, medData.id)
          break
        default:
          break
      }
    }
  } else if (copyId) {
    // Copy the data from the collection of the object being copied
    const sourceCollection = db.collection(copyId)
    const targetCollection = db.collection(medData.id)

    const documentsToCopy = await sourceCollection.find({}).toArray()
    if (documentsToCopy.length > 0) {
      const result = await targetCollection.insertMany(documentsToCopy)
      console.log(`Copied ${result.insertedCount} documents from collection ${copyId} to ${medData.id}`)
    } else {
      console.log(`No documents found in collection ${copyId} to copy`)
    }
  }
  return medData.id
}

/**
 * @description Insert a PKL file in the database based on the associated MEDDataObject id
 * @param {String} filePath path of the file to import in the database
 * @param {String} collectionName name of the collection in which we want to import the data
 */
async function insertPKLIntoCollection(filePath, collectionName) {
  const db = await connectToMongoDB()
  const collection = db.collection(collectionName)

  const pklContent = fs.readFileSync(filePath)
  const document = { pklContent: pklContent }

  const result = await collection.insertOne(document)
  console.log(`PKL data inserted with _id: ${result.insertedId}`)
  return result
}

/**
 * Uploads a large CSV file to MongoDB by storing it in chunks.
 * Ensures only valid columns are inserted (based on first row).
 *
 * @param {String} filePath - The path to the CSV file.
 * @param {String} collectionName - The name of the MongoDB collection.
 */
async function insertBigCSVIntoCollection(filePath, collectionName) {
  const db = await connectToMongoDB()
  const collection = db.collection(collectionName)

  let allowedColumns = null
  const batchSize = 1000 // Represents the number of rows that will be inserted in the MongoDB every step.
  let batch = []

  Papa.parse(fs.createReadStream(filePath), {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
    step: (results, parser) => {
      const row = results.data

      // We look at the columns and then we know which ones we want (makes it so no new useless columns gets added)
      if (!allowedColumns && Object.keys(row).length > 0) {
        allowedColumns = Object.keys(row)
      }

      // Filter out any keys not in allowedColumns (usually not necessary since header:true)
      const cleanedRow = Object.fromEntries(Object.entries(row).filter(([key]) => allowedColumns.includes(key)))
      batch.push(cleanedRow)

      // Once the batch size is reached (number of rows is reached), pause parsing and insert the batch.
      if (batch.length >= batchSize) {
        parser.pause()
        collection
          .insertMany(batch)
          .then(() => {
            // Clear the batch and resume parsing
            batch = []
            parser.resume()
          })
          .catch((error) => {
            console.error("Error inserting batch:", error)
            parser.abort()
          })
      }
    },
    complete: () => {
      // When parsing is complete, check if any rows remain to be inserted.
      if (batch.length > 0) {
        collection
          .insertMany(batch)
          .then(() => {
            console.log("Final batch inserted")
            console.log("CSV parsing complete")
          })
          .catch((error) => {
            console.error("Error inserting final batch:", error)
          })
      } else {
        console.log("CSV parsing complete")
      }
    },
    error: (error) => {
      console.error("Error parsing CSV:", error)
    }
  })
}

/**
 * @description Insert a CSV file in the database based on the associated MEDDataObject id
 * @param {String} filePath path of the file to import in the database
 * @param {String} collectionName name of the collection in which we want to import the data
 * (which corresponds to the MEDDataObject id)
 * @returns
 */
async function insertCSVIntoCollection(filePath, collectionName) {
  console.log(`Inserting CSV file into collection: ${collectionName} from path: ${filePath}`)
  const db = await connectToMongoDB()
  const collection = db.collection(collectionName)

  const fileSize = fs.statSync(filePath).size
  const maxBSONSize = 16 * 1024 * 1024 // 16MB

  if (fileSize <= maxBSONSize) {
    return new Promise((resolve, reject) => {
      Papa.parse(fs.createReadStream(filePath), {
        header: true,
        dynamicTyping: true, // Automatically convert numeric fields to numbers
        complete: async (results) => {
          try {
            console.log("CSV parsing results: ", results)
            if (results.data.length == 0) {
              console.warn("CSV file is empty or has no valid rows.")
              resolve(null)
              return
            } 
            const result = await collection.insertMany(results.data)
            console.log(`CSV data inserted with ${result.insertedCount} documents`)
            resolve(result)
          } catch (error) {
            reject(error)
          }
        },
        error: (error) => {
          reject(error)
        }
      })
    })
  } else {
    await insertBigCSVIntoCollection(filePath, collectionName)
  }
}

/**
 * @description Insert an HTML file in the database based on the associated MEDDataObject id
 * @param {String} filePath path of the file to import in the database
 * @param {String} collectionName name of the collection in which we want to import the data
 * (which corresponds to the MEDDataObject id)
 * @returns
 */
async function insertHTMLIntoCollection(filePath, collectionName) {
  const db = await connectToMongoDB()
  const collection = db.collection(collectionName)

  const htmlContent = fs.readFileSync(filePath, "utf8")
  const document = { htmlContent: htmlContent }

  const result = await collection.insertOne(document)
  console.log(`HTML data inserted with _id: ${result.insertedId}`)
  return result
}

/**
 * @description Insert a PNG file in the database based on the associated MEDDataObject id
 * @param {*} filePath
 * @param {*} collectionName
 * @returns
 */
async function insertPNGIntoCollection(filePath, collectionName) {
  const db = await connectToMongoDB()
  const collection = db.collection(collectionName)

  const imageBuffer = fs.readFileSync(filePath)
  const document = { path: filePath, data: imageBuffer }

  const result = await collection.insertOne(document)
  console.log(`PNG data inserted with _id: ${result.insertedId}`)
  return result
}

/**
 * @description Insert a JPG file in the database based on the associated MEDDataObject id
 * @param {*} filePath
 * @param {*} collectionName
 * @returns
 */
async function insertJPGIntoCollection(filePath, collectionName) {
  const db = await connectToMongoDB()
  const collection = db.collection(collectionName)

  const imageBuffer = fs.readFileSync(filePath)
  const document = { path: filePath, data: imageBuffer }

  const result = await collection.insertOne(document)
  console.log(`JPG data inserted with _id: ${result.insertedId}`)
  return result
}

/**
 * @description Overwrite a MEDDataObject specified by id in the DB
 * @param {String} id Id of the MEDDataObject to overwrite
 * @param {Object} newData New data to overwrite the MEDDataObject
 * @returns bool true if succeed
 */
export async function overwriteMEDDataObjectProperties(id, newData) {
  const db = await connectToMongoDB()
  const result = await db.collection("medDataObjects").updateOne({ id: id }, { $set: newData })
  return result.modifiedCount > 0
}

/**
 * @description overwrite a MEDDataObject data in the DataBase
 * @param {String} id id of the MEDDataObject data to overwrite
 * @param {Json} jsonData the new data for the MEDDataObject
 */
export async function overwriteMEDDataObjectContent(id, jsonData) {
  try {
    const db = await connectToMongoDB()
    const collection = db.collection(id)
    await collection.deleteMany({})
    await collection.insertMany(jsonData)
    return true
  } catch (error) {
    console.error("Error in overwriteMEDDataObjectContent", error)
    return false
  }
}

/**
 * @description Delete a MEDDataObject from the database and its associated content
 * @param {String} id id of the MEDDataObject to delete
 */
export async function deleteMEDDataObject(id) {
  const db = await connectToMongoDB()
  const collection = db.collection("medDataObjects")

  // Find the MEDDataObject to delete
  const medDataObject = await collection.findOne({ id })
  if (!medDataObject) {
    console.log(`MEDDataObject with id ${id} not found`)
    return
  }

  // Recursively delete children MEDDataObjects
  async function deleteChildren(objectId) {
    const parentObject = await collection.findOne({ id: objectId })
    if (parentObject && parentObject.childrenIDs && parentObject.childrenIDs.length > 0) {
      for (const childId of parentObject.childrenIDs) {
        await deleteChildren(childId)
      }
    }
    // Delete the object itself
    await collection.deleteOne({ id: objectId })
    console.log(`MEDDataObject with id ${objectId} deleted`)

    // Delete the associated content collection if exists
    const dataCollection = db.collection(objectId)
    const collections = await db.listCollections({ name: objectId }).toArray()
    if (collections.length > 0) {
      await dataCollection.drop()
      console.log(`Collection with id ${objectId} deleted`)
    }
  }

  // Start the recursive deletion from the specified object
  await deleteChildren(id)

  // Update the parent to remove the deleted object from childrenIDs
  if (medDataObject.parentID) {
    const parent = await collection.findOne({ id: medDataObject.parentID })
    if (parent) {
      const children = parent.childrenIDs || []
      const updatedChildren = children.filter((childID) => childID !== id)

      await collection.updateOne({ id: medDataObject.parentID }, { $set: { childrenIDs: updatedChildren } })
      console.log(`Parent MEDDataObject with id ${medDataObject.parentID} updated`)
    }
  }
}

/**
 * @description Get columns of a collection specified by id
 * @param {String} collectionId Id of the collection to retrieve columns from
 * @returns {Array} An array of column names
 */
export async function getCollectionColumns(collectionId, dropId = false) {
  try {
    const db = await connectToMongoDB()
    const collection = db.collection(collectionId)
    const document = dropId ? await collection.findOne({}, { projection: { _id: 0 } }) : await collection.findOne({})

    return document ? Object.keys(document) : [] // Return column names or empty array
  } catch (error) {
    console.error("Error fetching collection columns:", error)
    return [] // Return empty array to avoid breaking UI
  }
}

/**
 * @description Get the tags of a collection specified by id
 * @param {String} collectionId Id of the collection to retrieve tags from
 * @returns {Array} An array of tags
 */
export async function getCollectionTags(collectionId) {
  let tagsUUID = localStorage.getItem("tagsUUID") ? localStorage.getItem("tagsUUID") : "column_tags"
  const db = await connectToMongoDB()
  const collection = db.collection(tagsUUID)

  // eslint-disable-next-line camelcase
  const result = await collection.find({ collection_id: collectionId })

  return result
}

/**
 * @description Download the content of a MongoDB collection to a file.
 * @param {String} collectionId The ID of the collection.
 * @param {String} filePath The path where the file should be saved.
 * @param {String} type The type of file to be downloaded (csv or html).
 */
export async function downloadCollectionToFile(collectionId, filePath, type) {
  const db = await connectToMongoDB()
  const collection = db.collection(collectionId)

  // Exclude the _id field
  const documents = await collection.find({}, { projection: { _id: 0 } }).toArray()

  if (documents.length === 0) {
    console.error(`No documents found in collection ${collectionId}`)
    return
  }

  if (type === "csv") {
    const csv = Papa.unparse(documents)
    fs.writeFileSync(filePath, csv)
    console.log(`Collection ${collectionId} has been downloaded as CSV to ${filePath}`)
  } else if (type === "html") {
    // Check if documents have the 'content' field
    const htmlDocuments = documents.map((doc) => doc.htmlContent).filter((content) => content)
    if (htmlDocuments.length === 0) {
      console.error(`No valid HTML content found in collection ${collectionId}`)
      return
    }
    const htmlContent = htmlDocuments.join("\n")
    fs.writeFileSync(filePath, htmlContent)
    console.log(`Collection ${collectionId} has been downloaded as HTML to ${filePath}`)
  } else if (type === "json") {
    fs.writeFileSync(filePath, JSON.stringify(documents, null, 2))
    console.log(`Collection ${collectionId} has been downloaded as JSON to ${filePath}`)
  } else if (type === "png") {
    // Check if documents have the 'data' field
    const imageDocument = documents.find((doc) => doc.data)
    if (!imageDocument) {
      console.error(`No valid PNG content found in collection ${collectionId}`)
      return
    }
    const imageBuffer = Buffer.from(imageDocument.data.buffer)
    fs.writeFileSync(filePath, imageBuffer)
    console.log(`Collection ${collectionId} has been downloaded as PNG to ${filePath}`)
  } else {
    throw new Error("Unsupported file type")
  }
}

/**
 * @description Check if a collection exists in the database
 * @param {*} collectionName
 * @returns
 */
export async function collectionExists(collectionName) {
  const db = await connectToMongoDB()
  const collections = await db.listCollections({ name: collectionName }).toArray()
  return collections.length > 0
}

/**
 * @description Get the MEDDataObject specified by name from the DB
 * @param {*} name
 * @returns
 */
export async function findMEDDataObjectByName(name) {
  const db = await connectToMongoDB()
  const collection = db.collection("medDataObjects")
  const query = { name: name }
  const document = await collection.findOne(query)
  return document
}

/**
 * @description Get MEDDataObjects specified by name from the DB in case of multiple objects with identical names
 * @param {*} name
 * @returns
 */
export async function findMEDDataObjectsByName(name) {
  const db = await connectToMongoDB()
  const collection = db.collection("medDataObjects")
  const query = { name: name }
  const documents = await collection.find(query)
  return documents
}

/**
 * @description Get the MEDDataObject specified by path from the DB
 * @param {*} path // path of the MEDDataObject
 * @param {*} type // type of the MEDDataObject
 * @returns
 */
export async function findMEDDataObjectByPath(path, type = null) {
  const db = await connectToMongoDB()
  const collection = db.collection("medDataObjects")
  let query = null
  if (!type) {
    query = { path: path }
  } else {
    query = { path: path, type: type }
  }
  const document = await collection.findOne(query)
  return document
}

/**
 * @description Get the MEDDataObject specified by id from the DB
 * @param {*} id
 * @returns
 */
export async function getPathFromMEDDataObject(id) {
  const db = await connectToMongoDB()
  const collection = db.collection("medDataObjects")
  const query = { id: id }
  const document = await collection.findOne(query)
  return document.path
}

/**
 * @description Get the size of a collection specified by id
 * @param {*} collectionId
 * @returns
 */
export async function getCollectionSize(collectionId) {
  const db = await connectToMongoDB()
  const stats = await db.command({ collStats: collectionId })
  return stats.size
}

/**
 * @description Get all the collections in the database
 * @returns
 */
export async function getAllCollections() {
  const db = await connectToMongoDB()
  return await db.listCollections().toArray()
}


export async function insertObjectIntoCollection(data) {
  switch (data.medDataObject.type) {
    case "csv":
      await insertCSVIntoCollection(data.objectPath, data.medDataObject.id)
      break
    case "html":
      await insertHTMLIntoCollection(data.objectPath, data.medDataObject.id)
      break
    case "png":
      await insertPNGIntoCollection(data.objectPath, data.medDataObject.id)
      break
    case "pkl":
      await insertPKLIntoCollection(data.objectPath, data.medDataObject.id)
      break
    case "jpg":
      await insertJPGIntoCollection(data.objectPath, data.medDataObject.id)
      break
    default:
      break
  }
}