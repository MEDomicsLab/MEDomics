const path = require("path")
const fs = require("fs")
const { execSync } = require("child_process")

exports.default = async function (context) {
  if (process.platform !== "darwin") {
    console.log("Skipping afterPack: Not on macOS")
    return
  }

  require("dotenv").config()
  const DEVELOPER_ID = process.env.DEVELOPER_ID_APP
  if (!DEVELOPER_ID) {
    throw new Error("DEVELOPER_ID environment variable is not set")
  }

  try {
    // Setup paths
    // Get current directory
    const currentPath = process.cwd()
    console.log("Current path:", currentPath)
    const appPath = path.join(context.appOutDir, "MEDomicsLab.app")
    const mongodbPath = path.join(appPath, "Contents/Resources/app.asar.unpacked/node_modules/mongodb-client-encryption/prebuilds")
    const tarFile = "mongodb-client-encryption-v6.0.1-node-v127-darwin-arm64.tar.gz"

    // Change to mongodb prebuilds directory
    process.chdir(mongodbPath)

    // Extract tar.gz
    execSync(`tar -xvf ${tarFile}`)

    // Remove original tar.gz
    fs.unlinkSync(tarFile)

    // Sign the native module
    // execSync(`codesign --force --options runtime --timestamp --sign "${DEVELOPER_ID}" "build/Release/mongocrypt.node"`)

    console.log("AfterPack: Signing completed successfully")

    process.chdir(currentPath)
    console.log("Changed back to:", process.cwd())
  } catch (error) {
    console.error("AfterPack error:", error)
    throw error
  }
}
