const os = require("os")
const path = require("path")

const pathOverrides = {}

function setAppPath(alias, value) {
  pathOverrides[alias] = value
}

function getAppPath(alias) {
  if (pathOverrides[alias]) return pathOverrides[alias]

  switch (alias) {
    case "home":
      return os.homedir()
    case "downloads":
      return path.join(os.homedir(), "Downloads")
    case "sessionData":
      // Default to a subfolder in home, or use override
      return pathOverrides["sessionData"] || path.join(os.homedir(), ".medomics", "sessionData")
    // Add more aliases as needed
    default:
      throw new Error("Unknown path alias: " + alias)
  }
}

export { setAppPath, getAppPath }

if (typeof module !== "undefined" && typeof module.exports !== "undefined") {
  module.exports = { setAppPath, getAppPath }
}