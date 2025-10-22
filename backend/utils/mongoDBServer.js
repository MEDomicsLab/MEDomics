import fs from "fs"
import path from "path"
import { exec, spawn, execSync } from "child_process"
let mongoProcess = null


function startMongoDB(workspacePath) {
  const mongoConfigPath = path.join(workspacePath, ".medomics", "mongod.conf")
  if (fs.existsSync(mongoConfigPath)) {
    console.log("Starting MongoDB with config: " + mongoConfigPath)
    let mongod = getMongoDBPath()
    if (process.platform !== "darwin") {
      mongoProcess = spawn(mongod, ["--config", mongoConfigPath])
    } else {
      if (fs.existsSync(getMongoDBPath())) {
        mongoProcess = spawn(getMongoDBPath(), ["--config", mongoConfigPath])
      } else {
        mongoProcess = spawn("/opt/homebrew/Cellar/mongodb-community/7.0.12/bin/mongod", ["--config", mongoConfigPath], { shell: true })
      }
    }
    mongoProcess.stdout.on("data", (data) => {
      console.log(`MongoDB stdout: ${data}`)
    })

    mongoProcess.stderr.on("data", (data) => {
      console.error(`MongoDB stderr: ${data}`)
    })

    mongoProcess.on("close", (code) => {
      console.log(`MongoDB process exited with code ${code}`)
    })

    mongoProcess.on("error", (err) => {
      console.error("Failed to start MongoDB: ", err)
      // reject(err)
    })
  } else {
    const errorMsg = `MongoDB config file does not exist: ${mongoConfigPath}`
    console.error(errorMsg)
  }
}


async function stopMongoDB() {
  return new Promise((resolve, reject) => {
    if (mongoProcess) {
      mongoProcess.on("exit", () => {
        mongoProcess = null
        resolve()
      })
      try {
        mongoProcess.kill()
        resolve()
      } catch (error) {
        console.log("Error while stopping MongoDB ", error)
        // reject()
      }
    } else {
      resolve()
    }
  })
}

function getMongoDBPath() {
  if (process.platform === "win32") {
    // Check if mongod is in the process.env.PATH
    const paths = process.env.PATH.split(path.delimiter)
    for (let i = 0; i < paths.length; i++) {
      const binPath = path.join(paths[i], "mongod.exe")
      if (fs.existsSync(binPath)) {
        console.log("mongod found in PATH")
        return binPath
      }
    }
    // Check if mongod is in the default installation path on Windows - C:\Program Files\MongoDB\Server\<version to establish>\bin\mongod.exe
    const programFilesPath = process.env["ProgramFiles"]
    if (programFilesPath) {
      const mongoPath = path.join(programFilesPath, "MongoDB", "Server")
      // Check if the MongoDB directory exists
      if (!fs.existsSync(mongoPath)) {
        console.error("MongoDB directory not found")
        return null
      }
      const dirs = fs.readdirSync(mongoPath)
      for (let i = 0; i < dirs.length; i++) {
        const binPath = path.join(mongoPath, dirs[i], "bin", "mongod.exe")
        if (fs.existsSync(binPath)) {
          return binPath
        }
      }
    }
    console.error("mongod not found")
    return null
  } else if (process.platform === "darwin") {
    // Check if it is installed in the .medomics directory
    const binPath = path.join(process.env.HOME, ".medomics", "mongodb", "bin", "mongod")
    if (fs.existsSync(binPath)) {
      console.log("mongod found in .medomics directory")
      return binPath
    }
    if (process.env.NODE_ENV !== "production") {
      // Check if mongod is in the process.env.PATH
      const paths = process.env.PATH.split(path.delimiter)
      for (let i = 0; i < paths.length; i++) {
        const binPath = path.join(paths[i], "mongod")
        if (fs.existsSync(binPath)) {
          console.log("mongod found in PATH")
          return binPath
        }
      }
      // Check if mongod is in the default installation path on macOS - /usr/local/bin/mongod
      const binPath = "/usr/local/bin/mongod"
      if (fs.existsSync(binPath)) {
        return binPath
      }
    }
    console.error("mongod not found")
    return null
  } else if (process.platform === "linux") {
    // Check if mongod is in the process.env.PATH
    const paths = process.env.PATH.split(path.delimiter)
    for (let i = 0; i < paths.length; i++) {
      const binPath = path.join(paths[i], "mongod")
      if (fs.existsSync(binPath)) {
        return binPath
      }
    }
    console.error("mongod not found in PATH" + paths)
    // Check if mongod is in the default installation path on Linux - /usr/bin/mongod
    if (fs.existsSync("/usr/bin/mongod")) {
      return "/usr/bin/mongod"
    }
    console.error("mongod not found in /usr/bin/mongod")

    if (fs.existsSync("/home/" + process.env.USER + "/.medomics/mongodb/bin/mongod")) {
      return "/home/" + process.env.USER + "/.medomics/mongodb/bin/mongod"
    }
    return null
  } else {
    return "mongod"
  }
}

export { startMongoDB, stopMongoDB, getMongoDBPath }