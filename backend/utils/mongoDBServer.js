import fs from "fs"
import path from "path"
import { exec, spawn, execSync } from "child_process"
let mongoProcess = null

let lastMongo = {
  startedAt: null,
  mongodPath: null,
  args: null,
  workspacePath: null,
  configPath: null,
  pid: null,
  stopRequestedAt: null,
  lastExit: null, // { code, signal, at }
  lastError: null, // { message, stack, at }
  stdoutTail: [],
  stderrTail: []
}

const MAX_TAIL_LINES = 200

function pushTail(arr, line) {
  if (!line) return
  arr.push(line)
  if (arr.length > MAX_TAIL_LINES) arr.splice(0, arr.length - MAX_TAIL_LINES)
}

function bufferToLines(data) {
  try {
    return String(data).split(/\r?\n/).filter(Boolean)
  } catch {
    return []
  }
}


function startMongoDB(workspacePath) {
  const mongoConfigPath = path.join(workspacePath, ".medomics", "mongod.conf")
  if (fs.existsSync(mongoConfigPath)) {
    console.log("Starting MongoDB with config: " + mongoConfigPath)
    let mongod = getMongoDBPath()
    if (!mongod) {
      const err = new Error("mongod executable not found")
      lastMongo.lastError = { message: err.message, stack: err.stack, at: new Date().toISOString() }
      console.error("Failed to start MongoDB:", err.message)
      return
    }

    lastMongo.startedAt = new Date().toISOString()
    lastMongo.mongodPath = mongod
    lastMongo.args = ["--config", mongoConfigPath]
    lastMongo.workspacePath = workspacePath
    lastMongo.configPath = mongoConfigPath
    lastMongo.pid = null
    lastMongo.stopRequestedAt = null
    lastMongo.lastExit = null
    lastMongo.lastError = null
    lastMongo.stdoutTail = []
    lastMongo.stderrTail = []

    if (process.platform !== "darwin") {
      mongoProcess = spawn(mongod, ["--config", mongoConfigPath], { windowsHide: true })
    } else {
      if (fs.existsSync(getMongoDBPath())) {
        mongoProcess = spawn(getMongoDBPath(), ["--config", mongoConfigPath], { windowsHide: true })
      } else {
        mongoProcess = spawn("/opt/homebrew/Cellar/mongodb-community/7.0.12/bin/mongod", ["--config", mongoConfigPath], { shell: true })
      }
    }

    lastMongo.pid = mongoProcess?.pid || null

    mongoProcess.stdout.on("data", (data) => {
      for (const line of bufferToLines(data)) {
        pushTail(lastMongo.stdoutTail, line)
      }
      console.log(`MongoDB stdout: ${data}`)
    })

    mongoProcess.stderr.on("data", (data) => {
      for (const line of bufferToLines(data)) {
        pushTail(lastMongo.stderrTail, line)
      }
      console.error(`MongoDB stderr: ${data}`)
    })

    mongoProcess.on("exit", (code, signal) => {
      lastMongo.lastExit = { code, signal, at: new Date().toISOString() }
    })

    mongoProcess.on("close", (code, signal) => {
      const stopNote = lastMongo.stopRequestedAt ? ` (stop requested at ${lastMongo.stopRequestedAt})` : ""
      console.log(`MongoDB process exited with code ${code} signal ${signal || "null"}${stopNote}`)
    })

    mongoProcess.on("error", (err) => {
      lastMongo.lastError = { message: err?.message || String(err), stack: err?.stack || null, at: new Date().toISOString() }
      console.error("Failed to start MongoDB: ", err)
    })
  } else {
    const errorMsg = `MongoDB config file does not exist: ${mongoConfigPath}`
    lastMongo.lastError = { message: errorMsg, stack: null, at: new Date().toISOString() }
    console.error(errorMsg)
  }
}


async function stopMongoDB() {
  return new Promise((resolve) => {
    if (!mongoProcess) return resolve()

    lastMongo.stopRequestedAt = new Date().toISOString()

    const proc = mongoProcess
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      mongoProcess = null
      resolve()
    }

    proc.once("close", () => finish())
    proc.once("error", () => finish())

    try {
      proc.kill()
    } catch (error) {
      console.log("Error while stopping MongoDB ", error)
      finish()
    }

    // Safety: don't hang forever if close never fires
    setTimeout(() => finish(), 5000).unref?.()
  })
}

function getMongoDebugInfo() {
  return {
    running: !!(mongoProcess && mongoProcess.exitCode === null),
    pid: mongoProcess?.pid || lastMongo.pid || null,
    startedAt: lastMongo.startedAt,
    stopRequestedAt: lastMongo.stopRequestedAt,
    mongodPath: lastMongo.mongodPath,
    args: lastMongo.args,
    workspacePath: lastMongo.workspacePath,
    configPath: lastMongo.configPath,
    lastExit: lastMongo.lastExit,
    lastError: lastMongo.lastError,
    stdoutTail: lastMongo.stdoutTail,
    stderrTail: lastMongo.stderrTail
  }
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

export { startMongoDB, stopMongoDB, getMongoDBPath, getMongoDebugInfo }

// Cross-platform check to see if a given TCP port is in use (LISTENING)
async function checkMongoIsRunning(port) {
  if (!port) return false
  const platform = process.platform
  const cmd = platform === "win32"
    ? `netstat -ano | findstr :${port}`
    : `lsof -i:${port} -sTCP:LISTEN -n -P || true`

  try {
    const { stdout } = await new Promise((resolve) => {
      exec(cmd, (err, stdout, stderr) => {
        // Treat any exec error as "not running" but resolve to simplify control flow
        resolve({ stdout: stdout || "", stderr: stderr || "" })
      })
    })
    if (!stdout) return false
    if (platform === "win32") {
      // netstat output contains LISTENING lines for open ports
      return /LISTENING/i.test(stdout)
    }
    // On Unix, any lsof output indicates a process is listening on this port
    return stdout.trim().length > 0
  } catch (_) {
    return false
  }
}

export { checkMongoIsRunning }