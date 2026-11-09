import { ipcRenderer } from "electron"
import { requestBackend } from "../../../utilities/requests"

// Roles of the tailnet machines (see go_server/blueprints/medfl/tailscale.go)
export const SERVER_TAG = "tag:server"
export const CLIENT_TAG = "tag:medfl-client"

/**
 * @returns {Promise<Object|null>} the saved Tailscale API credentials of the coordinator, or null
 */
export const getTailscaleCredentials = async () => {
  try {
    const res = await ipcRenderer.invoke("tailscale-get-credentials")
    return res?.credentials || null
  } catch (e) {
    console.error("Failed to read the Tailscale credentials:", e)
    return null
  }
}

/**
 * Sends a request to a Tailscale route of the MEDfl server, with the saved credentials
 * @returns {Promise<Object>} the response, rejected with an Error when it has an error
 */
export const requestTailscale = async (port, topic, pageId, body = {}) => {
  const credentials = body.credentials === undefined ? await getTailscaleCredentials() : body.credentials
  return new Promise((resolve, reject) => {
    requestBackend(
      port,
      topic + (pageId || ""),
      { ...body, credentials },
      (json) => {
        if (json?.error) reject(new Error(typeof json.error === "string" ? json.error : JSON.stringify(json.error)))
        else resolve(json)
      },
      (err) => reject(err instanceof Error ? err : new Error(String(err)))
    )
  })
}

/**
 * Lists the tailnet machines with their MEDfl role ("server", "client" or "other")
 */
export const fetchTailnetDevices = (port, pageId) => requestTailscale(port, "/medfl/devices/", pageId)

/**
 * @returns {Object|undefined} the server machine: the one the server marks, else (older servers) the tag:server one
 */
export const findServerDevice = (devices) => devices.find((d) => d.role === "server") || devices.find((d) => (d.tags || []).includes(SERVER_TAG))

/**
 * @returns {Array} the client machines: the ones the server marks, else (older servers) every machine but the server
 */
export const findClientDevices = (devices, server) => (devices.some((d) => d.role) ? devices.filter((d) => d.role === "client") : devices.filter((d) => d.id !== server?.id))
