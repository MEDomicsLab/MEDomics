const os = require("os")
const path = require("path")
const envPaths = require("env-paths")

const pathOverrides = {}

function setAppPath(alias, value) {
  pathOverrides[alias] = value
}

function getAppPath(alias, isProd = true) {
  if (pathOverrides[alias]) return pathOverrides[alias]

  switch (alias) {
    case "home":
      return os.homedir()
    case "downloads":
      return path.join(os.homedir(), "Downloads")
    case "sessionData":
      // Default to a subfolder in home, or use override
      return pathOverrides["sessionData"] || path.join(os.homedir(), ".medomics", "sessionData")
    case "userData":
      return isProd ? envPaths("medomics").data : envPaths("medomics").data + " (development)"
    default:
      throw new Error("Unknown path alias: " + alias)
  }
}

module.exports = { setAppPath, getAppPath }
