import { ipcRenderer } from "electron"

// Local-only deps (safe in Electron renderer; must be gated by isRemote)
const fs = require("fs")

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
