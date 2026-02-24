import { ipcRenderer } from "electron"
import {
  downloadFile as localDownloadFile,
  loadCSVFromPath as localLoadCSVFromPath,
  loadCSVPath as localLoadCSVPath,
  loadJSONFromPath as localLoadJSONFromPath,
  loadJsonPath as localLoadJsonPath,
  loadJsonSync as localLoadJsonSync,
  loadXLSXFromPath as localLoadXLSXFromPath,
  toLocalPath as localToLocalPath
} from "../fileManagementUtils"

// Local-only deps (safe in Electron renderer; must be gated by isRemote)
const fs = require("fs")
const Papa = require("papaparse")
const dfd = require("../danfo.js")
const XLSX = require("xlsx")

function removeEmptyRows(df, numberOfRowToCheck) {
  let dfLastRows = df.tail(numberOfRowToCheck)
  let indexToDrop = []
  let rowCounts = dfLastRows.count()
  rowCounts.values.forEach((rowCount, index) => {
    if (rowCount <= 1) {
      indexToDrop.push(rowCounts.$index[index])
    }
  })
  return { index: indexToDrop, inplace: true }
}

async function readRemoteFile(filePath, encoding = "utf8") {
  const result = await ipcRenderer.invoke("readRemoteFile", {
    path: normalizeRemotePath(filePath),
    encoding
  })
  if (!result || !result.success) {
    throw new Error(result?.error || "readRemoteFile failed")
  }
  return result.content
}

/**
 * @param {object} workspace WorkspaceContext.workspace
 * @returns {boolean}
 */
export function isRemoteWorkspace(workspace) {
  return !!workspace?.isRemote
}

/**
 * Remote paths should be treated as POSIX-style for SFTP.
 * @param {string} filePath
 */
export function normalizeRemotePath(filePath) {
  return (filePath || "").replace(/\\/g, "/")
}

/**
 * Returns the path separator based on local vs remote workspace.
 * Remote paths should always use POSIX separator.
 * @param {{ isRemote?: boolean }} [opts]
 */
export function getPathSeparator(opts = {}) {
  if (opts.isRemote) return "/"
  return process.platform === "win32" ? "\\" : "/"
}

/**
 * Cross-platform dirname helper that works for both local and remote path styles.
 * For remote, returns POSIX-style dirname.
 * @param {string} filePath
 * @param {{ isRemote?: boolean }} [opts]
 */
export function remoteDirname(filePath, opts = {}) {
  if (!filePath) return ""
  const normalized = opts.isRemote ? normalizeRemotePath(filePath) : filePath
  const separator = normalized.includes("\\") ? "\\" : "/"
  const idx = normalized.lastIndexOf(separator)
  if (idx === -1) return ""
  if (idx === 0) return separator
  return normalized.slice(0, idx)
}

/**
 * Check if a path exists on local disk or remote workspace.
 * Remote requires active SSH tunnel (handled in main).
 * @param {string} filePath
 * @param {{ isRemote?: boolean }} [opts]
 */
export async function pathExists(filePath, opts = {}) {
  const isRemote = !!opts.isRemote
  if (!filePath) return false

  if (isRemote) {
    const status = await ipcRenderer.invoke("checkRemoteFileExists", normalizeRemotePath(filePath))
    return status === "exists"
  }

  return fs.existsSync(filePath)
}

/**
 * lstat for local/remote.
 * @param {string} filePath
 * @param {{ isRemote?: boolean }} [opts]
 * @returns {Promise<{ isDir: boolean, isFile: boolean, stats?: any } | null>}
 */
export async function lstat(filePath, opts = {}) {
  const isRemote = !!opts.isRemote
  if (!filePath) return null

  if (isRemote) {
    const result = await ipcRenderer.invoke("getRemoteLStat", normalizeRemotePath(filePath))
    if (!result || result === "tunnel inactive" || result === "sftp error") return null
    return result
  }

  try {
    const stats = fs.lstatSync(filePath)
    return { isDir: stats.isDirectory(), isFile: stats.isFile(), stats }
  } catch {
    return null
  }
}

/**
 * mkdir -p for local/remote.
 * For remote, this delegates to main's `createRemoteFolder` which can create recursively.
 * @param {string} dirPath
 * @param {{ isRemote?: boolean }} [opts]
 */
export async function mkdirp(dirPath, opts = {}) {
  const isRemote = !!opts.isRemote
  if (!dirPath) throw new Error("mkdirp: dirPath is required")

  if (isRemote) {
    const result = await ipcRenderer.invoke("createRemoteFolder", {
      path: normalizeRemotePath(dirPath),
      recursive: true
    })
    if (!result || !result.success) {
      throw new Error(`mkdirp(remote) failed: ${result?.error || "unknown error"}`)
    }
    return normalizeRemotePath(dirPath)
  }

  await fs.promises.mkdir(dirPath, { recursive: true })
  return dirPath
}

/**
 * rm -rf for local/remote.
 * @param {string} targetPath
 * @param {{ isRemote?: boolean }} [opts]
 */
export async function rmrf(targetPath, opts = {}) {
  const isRemote = !!opts.isRemote
  if (!targetPath) throw new Error("rmrf: targetPath is required")

  if (isRemote) {
    const result = await ipcRenderer.invoke("deleteRemoteFile", { path: normalizeRemotePath(targetPath), recursive: true })
    if (!result || !result.success) {
      throw new Error(`rmrf(remote) failed: ${result?.error || "unknown error"}`)
    }
    return
  }

  fs.rmSync(targetPath, { recursive: true, force: true })
}

/**
 * rename/move for local/remote.
 * @param {string} oldPath
 * @param {string} newPath
 * @param {{ isRemote?: boolean }} [opts]
 */
export async function renamePath(oldPath, newPath, opts = {}) {
  const isRemote = !!opts.isRemote
  if (!oldPath || !newPath) throw new Error("renamePath: oldPath and newPath are required")

  if (isRemote) {
    const result = await ipcRenderer.invoke("renameRemoteFile", {
      oldPath: normalizeRemotePath(oldPath),
      newPath: normalizeRemotePath(newPath)
    })
    if (!result || !result.success) {
      throw new Error(`renamePath(remote) failed: ${result?.error || "unknown error"}`)
    }
    return
  }

  fs.renameSync(oldPath, newPath)
}

/**
 * Load JSON object from path.
 * Local mode delegates to compatibility wrappers for existing behavior.
 * Remote mode loads file over SFTP.
 * @param {string} absPath
 * @param {{ isRemote?: boolean }} [opts]
 * @param {(data: any) => void} [whenLoaded]
 */
export function loadJsonPath(absPath, opts = {}, whenLoaded) {
  const isRemote = !!opts.isRemote
  if (!isRemote) {
    const json = localLoadJsonPath(absPath)
    if (typeof whenLoaded === "function") whenLoaded(json)
    return json
  }

  return readRemoteFile(absPath, "utf8")
    .then((content) => {
      const parsed = JSON.parse(content)
      if (typeof whenLoaded === "function") whenLoaded(parsed)
      return parsed
    })
    .catch((error) => {
      console.error("loadJsonPath(remote) error:", error)
      if (typeof whenLoaded === "function") whenLoaded(null)
      return null
    })
}

/**
 * Load CSV rows from path and invoke callback.
 * @param {string} absPath
 * @param {(rows: any[]) => void} whenLoaded
 * @param {{ isRemote?: boolean }} [opts]
 */
export function loadCSVPath(absPath, whenLoaded, opts = {}) {
  const isRemote = !!opts.isRemote
  if (!isRemote) {
    return localLoadCSVPath(absPath, whenLoaded)
  }

  return readRemoteFile(absPath, "utf8")
    .then((content) => {
      const parsed = Papa.parse(content, { header: true, skipEmptyLines: true })
      whenLoaded(parsed?.data || [])
      return parsed?.data || []
    })
    .catch((error) => {
      console.error("loadCSVPath(remote) error:", error)
      whenLoaded([])
      return []
    })
}

/**
 * Load CSV and normalize similarly to existing loadCSVFromPath behavior.
 * @param {string} filePath
 * @param {(rows: any[]) => void} whenLoaded
 * @param {{ isRemote?: boolean }} [opts]
 */
export function loadCSVFromPath(filePath, whenLoaded, opts = {}) {
  const isRemote = !!opts.isRemote
  if (!isRemote) {
    return localLoadCSVFromPath(filePath, whenLoaded)
  }

  return loadCSVPath(
    filePath,
    (rows) => {
      try {
        const df = new dfd.DataFrame(rows)
        const dfJSON = dfd.toJSON(df)
        whenLoaded(dfJSON)
      } catch {
        whenLoaded(rows)
      }
    },
    { isRemote: true }
  )
}

/**
 * Load JSON dataset from path and invoke callback with dataframe-like JSON.
 * @param {string} filePath
 * @param {(rows: any[]) => void} whenLoaded
 * @param {{ isRemote?: boolean }} [opts]
 */
export function loadJSONFromPath(filePath, whenLoaded, opts = {}) {
  const isRemote = !!opts.isRemote
  if (!isRemote) {
    return localLoadJSONFromPath(filePath, whenLoaded)
  }

  return readRemoteFile(filePath, "utf8")
    .then((content) => {
      const result = JSON.parse(content)
      try {
        const df = new dfd.DataFrame(result)
        df.drop(removeEmptyRows(df, 5))
        const dfJSON = dfd.toJSON(df)
        whenLoaded(dfJSON)
        return dfJSON
      } catch {
        whenLoaded(result)
        return result
      }
    })
    .catch((error) => {
      console.error("loadJSONFromPath(remote) error:", error)
      whenLoaded([])
      return []
    })
}

/**
 * Load XLSX from path and invoke callback with dataframe-like JSON.
 * @param {string} filePath
 * @param {(rows: any[]) => void} whenLoaded
 * @param {{ isRemote?: boolean }} [opts]
 */
export function loadXLSXFromPath(filePath, whenLoaded, opts = {}) {
  const isRemote = !!opts.isRemote
  if (!isRemote) {
    return localLoadXLSXFromPath(filePath, whenLoaded)
  }

  return readRemoteFile(filePath, "base64")
    .then((base64) => {
      const workbook = XLSX.read(Buffer.from(base64, "base64"), { type: "buffer" })
      const firstSheetName = workbook.SheetNames && workbook.SheetNames.length > 0 ? workbook.SheetNames[0] : null
      const rows = firstSheetName ? XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName], { defval: null }) : []
      try {
        const df = new dfd.DataFrame(rows)
        df.drop(removeEmptyRows(df, 5))
        const dfJSON = dfd.toJSON(df)
        whenLoaded(dfJSON)
        return dfJSON
      } catch {
        whenLoaded(rows)
        return rows
      }
    })
    .catch((error) => {
      console.error("loadXLSXFromPath(remote) error:", error)
      whenLoaded([])
      return []
    })
}

/**
 * Convert a path into a local URI when needed by embedded viewers.
 * Delegates to compatibility wrapper implementation.
 * @param {string} path
 */
export function toLocalPath(path) {
  return localToLocalPath(path)
}

/**
 * Trigger browser download of a JSON-serializable object.
 * Delegates to compatibility wrapper implementation.
 * @param {any} exportObj
 * @param {string} exportName
 */
export function downloadFile(exportObj, exportName) {
  return localDownloadFile(exportObj, exportName)
}

/**
 * Open file dialog and load selected JSON.
 * Delegates to compatibility wrapper implementation.
 * @returns {Promise<any>}
 */
export function loadJsonSync() {
  return localLoadJsonSync()
}
