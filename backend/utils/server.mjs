// When running the backend standalone (node ./backend/expressServer.mjs)
// the project may be a mixed ESM/CommonJS workspace and importing the
// top-level `medomics.dev.js` can fail. Provide local defaults here so
// the backend can run independently. If you need to sync values, update
// them manually or implement a small shared JSON config.
export const PORT_FINDING_METHOD = { FIX: 0, AVAILABLE: 1 }
const MEDconfig = {
  runServerAutomatically: true,
  defaultPort: 54288,
  portFindingMethod: PORT_FINDING_METHOD.FIX
}
import { getPythonEnvironment, getBundledPythonEnvironment } from "./pythonEnv.js"
import { exec, execFile } from "child_process"
import os from "os"
import path from "path"
import fs from "fs"

export function findAvailablePort(startPort, endPort = 8000) {
  let killProcess = MEDconfig.portFindingMethod === PORT_FINDING_METHOD.FIX || !MEDconfig.runServerAutomatically
  let platform = process.platform
  return new Promise((resolve, reject) => {
    let port = startPort
    function tryPort() {
      if (platform == "darwin") {
        exec(`lsof -i:${port}`, (err, stdout, stderr) => {
          if (err) {
            console.log(`Port ${port} is available !`)
            resolve(port)
          } else {
            if (killProcess) {
              exec("kill -9 $(lsof -t -i:" + port + ")", (err, stdout, stderr) => {
                if (!err) {
                  console.log("Previous server instance was killed successfully")
                  console.log(`Port ${port} is now available !`)
                  resolve(port)
                }
                stdout && console.log(stdout) && console.log(stderr)
              })
            } else {
              port++
              if (port > endPort) {
                reject("No available port")
              }
              tryPort()
            }
          }
        })
      } else {
        exec(`netstat ${platform == "win32" ? "-ano | find" : "-ltnup | grep"} ":${port}"`, (err, stdout, stderr) => {
          if (err) {
            console.log(`Port ${port} is available !`)
            resolve(port)
          } else {
            if (killProcess) {
              // Split the stdout into individual lines and use the first line to get the PID
              let line = stdout.trim().split("\n")[0]
              let PID = line.trim().split(/\s+/)[line.trim().split(/\s+/).length - 1].split("/")[0]
              exec(`${platform == "win32" ? "taskkill /f /t /pid" : "kill"} ${PID}`, (err, stdout, stderr) => {
                if (!err) {
                  console.log("Previous server instance was killed successfully")
                  console.log(`Port ${port} is now available !`)
                  resolve(port)
                }
                stdout && console.log(stdout) && console.log(stderr)
              })
            } else {
              port++
              if (port > endPort) {
                reject("No available port")
              }
              tryPort()
            }
          }
        })
      }
    }
    tryPort()
  })
}

export function killProcessOnPort(port) {
  let platform = process.platform
  return new Promise((resolve, reject) => {
    if (platform == "darwin") {
      exec(`lsof -i:${port}`, (err, stdout, stderr) => {
        if (err) {
          console.log(`Port ${port} is available !`)
          resolve(port)
        } else {
          exec("kill -9 $(lsof -t -i:" + port + ")", (err, stdout, stderr) => {
            if (!err) {
              console.log("Previous server instance was killed successfully")
              console.log(`Port ${port} is now available !`)
              resolve(port)
            }
            stdout && console.log(stdout) && console.log(stderr)
          })
        }
      })
    } else {
      exec(`netstat ${platform == "win32" ? "-ano | find" : "-ltnup | grep"} ":${port}"`, (err, stdout, stderr) => {
        if (err) {
          console.log(`Port ${port} is available !`)
          resolve(port)
        } else {
          let PID = stdout.trim().split(/\s+/)[stdout.trim().split(/\s+/).length - 1].split("/")[0]
          exec(`${platform == "win32" ? "taskkill /f /t /pid" : "kill"} ${PID}`, (err, stdout, stderr) => {
            if (!err) {
              console.log("Previous server instance was killed successfully")
              console.log(`Port ${port} is now available !`)
              resolve(port)
            }
            stdout && console.log(stdout) && console.log(stderr)
          })
        }
      })
    }
  })
}

export async function runServer(isProd, serverPort, serverProcess, serverState, condaPath = null) {
  // Runs the server
  let pythonEnvironment = getPythonEnvironment()
  if (process.platform !== "win32" && condaPath === null) {
    condaPath = pythonEnvironment
    if (pythonEnvironment !== undefined) {
      condaPath = pythonEnvironment
    }
  }

  let env = process.env
  let bundledPythonPath = getBundledPythonEnvironment()

  // The Go server expects MED_ENV to be the Python executable to run.
  // Prefer bundled Python (if present), else configured pythonEnvironment, else provided condaPath.
  // Fall back to plain `python` so PATH resolution can work.
  const pythonForGo = (bundledPythonPath || pythonEnvironment || condaPath || "python")
  env.MED_ENV = pythonForGo

  if (bundledPythonPath !== null) {
    bundledPythonPath = bundledPythonPath.replace("python.exe", "")

    let scriptPath = path.join(bundledPythonPath, "Scripts")
    let libPath = path.join(bundledPythonPath, "Lib")
    let pythonPath = path.join(bundledPythonPath, "python.exe")

    env.PATH = `${bundledPythonPath};${scriptPath};${libPath};${env.PATH}`
    console.log("env.PATH: " + env.PATH)
  }

  let chosenPort = null

  if (!isProd) {
    //**** DEVELOPMENT ****//
    let args = [serverPort, "dev", process.cwd()]
    // Get the temporary directory path
    args.push(os.tmpdir())
    // Always pass the effective python executable path as last arg so Go can use it.
    // This avoids stale conda paths overriding bundled Python.
    args.push(pythonForGo)

    await findAvailablePort(MEDconfig.defaultPort)
      .then((port) => {
        serverPort = port
        chosenPort = port
        // ensure the spawned process receives the actual chosen port as first argument
        if (Array.isArray(args) && args.length > 0) args[0] = serverPort
        serverState.serverIsRunning = true
        serverProcess = execFile(`${process.platform == "win32" ? "main.exe" : "./main"}`, args, {
          windowsHide: false,
          cwd: path.join(process.cwd(), "go_server"),
          env: env
        })
        if (serverProcess) {
          serverProcess.stdout.on("data", function (data) {
            console.log(`data: ${data.toString("utf8")}`)
          })
          serverProcess.stderr.on("data", (data) => {
            console.log(`stderr: ${data.toString("utf8")}`)
          })
          serverProcess.on("error", (err) => {
            console.log(`error: ${err}`)
          })
          serverProcess.on("disconnect", () => {
            console.log(`disconnected`)
          })
          serverProcess.on("close", (code) => {
            serverState.serverIsRunning = false
            console.log(`server child process close all stdio with code ${code}`)
          })
        }
      })
      .catch((err) => {
        console.error(err)
      })
  } else {
    //**** PRODUCTION ****//
    // In production we must pass a base directory where pythonCode/ exists.
    // In standalone server bundles, this is the directory containing medomics-server.exe.
    // `process.resourcesPath` is Electron-specific and may be undefined under nexe.
    const exeDir = path.dirname(process.execPath)
    const baseRootCandidates = [
      (typeof process.resourcesPath === 'string' && process.resourcesPath) ? process.resourcesPath : null,
      exeDir,
      path.dirname(exeDir),
    ].filter(Boolean)

    const baseRoot = baseRootCandidates.find((candidate) => {
      try {
        // Prefer a directory that looks like the server bundle root.
        return fs.existsSync(path.join(candidate, 'pythonCode')) || fs.existsSync(path.join(candidate, 'go_executables')) || fs.existsSync(path.join(candidate, 'backend'))
      } catch {
        return false
      }
    }) || exeDir
    let args = [serverPort, "prod", baseRoot]
    // Get the temporary directory path
    args.push(os.tmpdir())
    // Always pass python executable path as last argument so Go can run python scripts.
    // (If not present, it will be the string "python" and rely on PATH.)
    args.push(pythonForGo)

    await findAvailablePort(MEDconfig.defaultPort)
      .then((port) => {
        serverPort = port
        chosenPort = port
        console.log("process.resourcesPath: ", process.resourcesPath)
        console.log("process.execPath: ", process.execPath)
        console.log("[go] baseRoot:", baseRoot)
        console.log("[go] MED_ENV (python):", env.MED_ENV)
        // ensure the spawned process receives the actual chosen port as first argument
        if (Array.isArray(args) && args.length > 0) args[0] = serverPort

        // In production, the GO executable is located relative to the
        // server bundle root (same folder that contains pythonCode/ and go_executables/).

        if (process.platform == "win32") {
          const goPathWin = path.join(baseRoot, "go_executables", "server_go_win32.exe")
          console.log("Resolved GO executable path (win32):", goPathWin)

          if (!fs.existsSync(goPathWin)) {
            console.error("GO executable not found at:", goPathWin)
          } else {
            serverProcess = execFile(goPathWin, args, {
              windowsHide: false,
              env: env
            })
            serverState.serverIsRunning = true
          }
        } else if (process.platform == "linux") {
          const goPathLinux = path.join(baseRoot, "go_executables", "server_go")
          console.log("Resolved GO executable path (linux):", goPathLinux)

          if (!fs.existsSync(goPathLinux)) {
            console.error("GO executable not found at:", goPathLinux)
          } else {
            serverProcess = execFile(goPathLinux, args, {
              windowsHide: false
            })
            serverState.serverIsRunning = true
          }
        } else if (process.platform == "darwin") {
          const goPathDarwin = path.join(baseRoot, "go_executables", "server_go")
          console.log("Resolved GO executable path (darwin):", goPathDarwin)

          if (!fs.existsSync(goPathDarwin)) {
            console.error("GO executable not found at:", goPathDarwin)
          } else {
            serverProcess = execFile(goPathDarwin, args, {
              windowsHide: false
            })
            serverState.serverIsRunning = true
          }
        }
        if (serverProcess) {
          serverProcess.stdout.on("data", function (data) {
            console.log("data: ", data.toString("utf8"))
          })
          serverProcess.stderr.on("data", (data) => {
            console.log(`stderr: ${data}`)
            serverState.serverIsRunning = true
          })
          serverProcess.on("close", (code) => {
            serverState.serverIsRunning = false
            console.log(`my server child process close all stdio with code ${code}`)
          })
        }
      })
      .catch((err) => {
        console.error(err)
      })
  }
  // Return both the spawned process handle and the actual bound port
  return { process: serverProcess, port: chosenPort }
}
