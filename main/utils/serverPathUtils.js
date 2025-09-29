
import os from "os"
import path from "path"

const pathOverrides = {}

export function setPath(alias, value) {
  pathOverrides[alias] = value
}

export function getPath(alias) {
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
