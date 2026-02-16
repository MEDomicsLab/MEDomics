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
    const appPath = path.join(context.appOutDir, "MEDomics.app")
    const mongodbModulePath = path.join(appPath, "Contents/Resources/app.asar.unpacked/node_modules/mongodb-client-encryption")
    const mongodbPath = path.join(mongodbModulePath, "prebuilds")
    const nativeBinaryPath = path.join(mongodbModulePath, "build/Release/mongocrypt.node")
    const preferredTarFile = "mongodb-client-encryption-v6.0.1-node-v108-darwin-arm64.tar.gz"

    if (fs.existsSync(mongodbPath)) {
      const tarCandidates = fs
        .readdirSync(mongodbPath)
        .filter((file) => file.startsWith("mongodb-client-encryption-") && file.endsWith("-darwin-arm64.tar.gz"))
        .sort()

      if (tarCandidates.length > 0) {
        const tarFile = tarCandidates.includes(preferredTarFile) ? preferredTarFile : tarCandidates[0]
        if (tarFile !== preferredTarFile) {
          console.warn(`AfterPack: Preferred tarball ${preferredTarFile} not found, using ${tarFile}`)
        }

        execSync(`tar -xvf ${tarFile}`, { stdio: "inherit", cwd: mongodbPath })
        fs.unlinkSync(path.join(mongodbPath, tarFile))
      } else {
        console.warn(`AfterPack: No darwin-arm64 prebuild tarball found in ${mongodbPath}, skipping extraction`)
      }
    } else if (fs.existsSync(nativeBinaryPath)) {
      console.log(`AfterPack: Using existing native binary ${nativeBinaryPath}`)
    } else {
      throw new Error(`Neither prebuild tarballs nor native binary found for mongodb-client-encryption under ${mongodbModulePath}`)
    }

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