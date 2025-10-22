const os = require("os")
const path = require("path")
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
      return pathOverrides["sessionData"] || path.join(os.homedir(), ".medomics", "sessionData")
    case "userData": {
      const appName = "medomics"
      let dataDir
      if (process.platform === "win32") {
        dataDir = path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), appName)
      } else if (process.platform === "darwin") {
        dataDir = path.join(os.homedir(), "Library", "Application Support", appName)
      } else {
        dataDir = path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"), appName)
      }
      return isProd ? dataDir : dataDir + " (development)"
    }
    default:
      throw new Error("Unknown path alias: " + alias)
  }
}

module.exports = { setAppPath, getAppPath }
