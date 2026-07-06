/* eslint-disable camelcase */
/**
 * MongoDB helpers for the MED3pa module.
 * Sessions are written by pythonCode/modules/med3pa/run_med3pa_analysis.py,
 * patients by apply_med3pa_model.py, deployments by the Analysis Workspace page.
 */
import { connectToMongoDB } from "../mongoDB/mongoDBUtils"

const SESSIONS = "med3pa_sessions"
const DEPLOYMENTS = "med3pa_deployments"
const PATIENTS = "med3pa_patients"

/**
 * @description List saved MED3pa sessions (without the heavy result payloads)
 * @returns {Array} session summaries sorted by creation date (newest first)
 */
export async function listSessions() {
  const db = await connectToMongoDB()
  return await db
    .collection(SESSIONS)
    .find({}, { projection: { _id: 0, name: 1, created_at: 1, status: 1, base_model: 1, dataset: 1, target_column: 1, dataset_size: 1 } })
    .sort({ created_at: -1 })
    .toArray()
}

/**
 * @description Get a full MED3pa session document (config + results) by name
 * @param {String} name session name
 * @returns {Object|null} the session document
 */
export async function getSession(name) {
  const db = await connectToMongoDB()
  return await db.collection(SESSIONS).findOne({ name: name }, { projection: { _id: 0 } })
}

/**
 * @description Create (or overwrite) a deployed MED3pa model from a session at a chosen declaration rate
 * @param {Object} deployment {name, session_name, dr_threshold, min_confidence_level, base_model_id, base_model_name, mpc_strategy, columns}
 * @returns {Boolean} true if inserted
 */
export async function createDeployment(deployment) {
  const db = await connectToMongoDB()
  const doc = { ...deployment, created_at: new Date().toISOString() }
  await db.collection(DEPLOYMENTS).replaceOne({ name: deployment.name }, doc, { upsert: true })
  return true
}

/**
 * @description List deployed MED3pa models
 * @returns {Array} deployment documents sorted by creation date (newest first)
 */
export async function listDeployments() {
  const db = await connectToMongoDB()
  return await db.collection(DEPLOYMENTS).find({}, { projection: { _id: 0 } }).sort({ created_at: -1 }).toArray()
}

/**
 * @description List patients scanned by deployed models, optionally filtered by patient id substring
 * @param {String|null} filterId substring to match against patient_id (case-insensitive)
 * @param {Number} limit maximum number of records to return
 * @returns {Array} patient prediction documents (newest first)
 */
export async function listPatients(filterId = null, limit = 500) {
  const db = await connectToMongoDB()
  const query = filterId ? { patient_id: { $regex: filterId, $options: "i" } } : {}
  return await db.collection(PATIENTS).find(query, { projection: { _id: 0 } }).sort({ created_at: -1 }).limit(limit).toArray()
}

/**
 * @description Get a single patient prediction record by patient id (most recent one)
 * @param {String} patientId the patient identifier
 * @returns {Object|null} the patient document
 */
export async function getPatient(patientId) {
  const db = await connectToMongoDB()
  return await db.collection(PATIENTS).find({ patient_id: patientId }, { projection: { _id: 0 } }).sort({ created_at: -1 }).limit(1).next()
}

/**
 * @description Counts used by the Overview page KPIs
 * @returns {Object} {sessions, deployments, patients}
 */
export async function getOverviewStats() {
  const db = await connectToMongoDB()
  const [sessions, deployments, patients] = await Promise.all([
    db.collection(SESSIONS).countDocuments({}),
    db.collection(DEPLOYMENTS).countDocuments({}),
    db.collection(PATIENTS).countDocuments({})
  ])
  return { sessions, deployments, patients }
}

/**
 * @description Recent activity feed for the Overview page: latest sessions, deployments and patient batches
 * @param {Number} limit max entries
 * @returns {Array} [{type, title, description, date}]
 */
export async function getRecentActivity(limit = 8) {
  const db = await connectToMongoDB()
  const sessions = await db.collection(SESSIONS).find({}, { projection: { _id: 0, name: 1, created_at: 1, dataset: 1 } }).sort({ created_at: -1 }).limit(limit).toArray()
  const deployments = await db.collection(DEPLOYMENTS).find({}, { projection: { _id: 0, name: 1, created_at: 1, session_name: 1, dr_threshold: 1 } }).sort({ created_at: -1 }).limit(limit).toArray()
  const activity = [
    ...sessions.map((s) => ({
      type: "session",
      title: "Analysis completed",
      description: `Session '${s.name}' finished on dataset '${s.dataset?.name ?? "?"}'.`,
      date: s.created_at
    })),
    ...deployments.map((d) => ({
      type: "deployment",
      title: "Model deployed",
      description: `'${d.name}' created from session '${d.session_name}' at DR = ${d.dr_threshold}%.`,
      date: d.created_at
    }))
  ]
  activity.sort((a, b) => (a.date < b.date ? 1 : -1))
  return activity.slice(0, limit)
}
