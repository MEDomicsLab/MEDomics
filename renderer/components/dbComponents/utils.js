const MongoClient = require("mongodb").MongoClient
const mongoUrl = "mongodb://127.0.0.1:54017"

/**
 * @description Check if a database exists
 * @param {String} collectionName
 * @param {String} dbname
 */
export const collectionExists = async (collectionName, dbname = "data") => {
  const client = new MongoClient(mongoUrl)
  try {
    await client.connect()
    const db = client.db(dbname)
    const collections = await db.listCollections().toArray()
    return collections.some((collection) => collection.name === collectionName)
  } catch (error) {
    console.error("Error checking if collection exists:", error)
    throw error
  } finally {
    await client.close()
  }
}

/**
 * @description Get data from collectionName in dbname
 * @param {String} collectionName
 * @param {Number} first
 * @param {Number} rows
 * @param {String} dbname
 * @returns {Array} fetchedData
 */
export const getCollectionData = async (collectionName, first = null, rows = null, dbname = "data") => {
  const client = new MongoClient(mongoUrl)
  let fetchedData = []
  try {
    await client.connect()
    const db = client.db(dbname)
    const collection = db.collection(collectionName)
    if (!first && rows) {
      fetchedData = await collection.find({}).limit(rows).toArray()
    } else if (first && rows) {
      fetchedData = await collection.find({}).skip(first).limit(rows).toArray()
    }
    else {
      fetchedData = await collection.find({}).toArray()
    }
    // Convert Date objects to strings
    fetchedData = fetchedData.map((item) => {
      let keys = Object.keys(item)
      let values = Object.values(item)
      let dataObject = {}
      for (let i = 0; i < keys.length; i++) {
        // Check if the value is a Date object
        if (values[i] instanceof Date) {
          // If it is, convert it to a string
          dataObject[keys[i]] = values[i].toISOString()
        } else {
          dataObject[keys[i]] = values[i]
        }
      }
      return dataObject
    })

    return fetchedData
  } catch (error) {
    console.error("Error fetching data:", error)
    throw error
  } finally {
    await client.close()
  }
}

/**
 * 
 * @param {String} collectionName 
 * @param {*Object} filter 
 * @param {*integer} first 
 * @param {*integer} rows 
 * @param {*Object} sortCriteria 
 * @param {*String} dbname 
 * @returns {Array} fetchedDataFiltered
 */
export const getCollectionDataFilterd = async (collectionName, filter, first = null, rows = null, sortCriteria = null, dbname = "data") => {
  const client = new MongoClient(mongoUrl)
  let fetchedData = []
  try {
    await client.connect()
    const db = client.db(dbname)
    const collection = db.collection(collectionName)
    if (!first && rows) {
      fetchedData = sortCriteria ? await collection.find(filter).sort(sortCriteria).limit(rows).toArray() : await collection.find(filter).limit(rows).toArray()
    } else if (first && rows) {
      fetchedData = sortCriteria ? await collection.find(filter).sort(sortCriteria).skip(first).limit(rows).toArray() : await collection.find(filter).skip(first).limit(rows).toArray()
    }
    else {
      fetchedData = sortCriteria ? await collection.find(filter).sort(sortCriteria).toArray() : await collection.find(filter).toArray()
    }

    // Convert Date objects to strings
    fetchedData = fetchedData.map((item) => {
      let keys = Object.keys(item)
      let values = Object.values(item)
      let dataObject = {}
      for (let i = 0; i < keys.length; i++) {
        // Check if the value is a Date object
        if (values[i] instanceof Date) {
          // If it is, convert it to a string
          dataObject[keys[i]] = values[i].toISOString()
        } else {
          dataObject[keys[i]] = values[i]
        }
      }
      return dataObject
    })

    return fetchedData
  } catch (error) {
    console.error("Error fetching data:", error)
    throw error
  } finally {
    await client.close()
  }
}

/**
 * @description Get documents count with filter use
 */
export const getCollectionDataCount = async (collectionName, filter, dbname = "data") => {
  const client = new MongoClient(mongoUrl)
  try {
    await client.connect()
    const db = client.db(dbname)
    const collection = db.collection(collectionName)
    const count = await collection.countDocuments(filter)
    return count
  } catch (error) {
    console.error("Error fetching data:", error)
    throw error
  } finally {
    await client.close()
  }
}

/**
 * @description Get the types of each column in a collection
 * @param {String} dbname
 * @param {String} collectionName
 * @returns columnTypes
 */
export const getCollectionColumnTypes = async (collectionName, dbname = "data") => {
  const client = new MongoClient(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true })
  try {
    await client.connect()
    const db = client.db(dbname)
    const collection = db.collection(collectionName)

    // Sample a number of documents to determine column types
    const sampleSize = 100
    const sampleDocs = await collection.aggregate([{ $sample: { size: sampleSize } }]).toArray()

    // Determine column types
    const columnTypes = {}

    sampleDocs.forEach((doc) => {
      Object.keys(doc).forEach((key) => {
        let type

        const value = doc[key]
        if (typeof value === "string") {
          // Check if the string is a date
          const date = new Date(value)
          if (!isNaN(date.getTime())) {
            type = "date"
          } else {
            type = "string"
          }
        } else if (typeof value === "number") {
          // Check if the number is an integer or float
          type = Number.isInteger(value) ? "integer" : "float"
        } else {
          // Fallback to typeof for other types
          type = typeof value
        }

        if (!columnTypes[key]) {
          columnTypes[key] = new Set()
        }

        columnTypes[key].add(type)
      })
    })

    // Convert sets to arrays
    Object.keys(columnTypes).forEach((key) => {
      columnTypes[key] = Array.from(columnTypes[key])
    })

    return columnTypes
  } catch (error) {
    console.error("Error determining column types:", error)
    throw error
  } finally {
    await client.close()
  }
}
