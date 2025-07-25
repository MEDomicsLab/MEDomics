// Global tunnel state for remote connection management
export let activeTunnel = null
export let activeTunnelServer = null

let mongoDBLocalPort = null
let mongoDBRemotePort = null

export function setActiveTunnel(tunnel) {
  activeTunnel = tunnel
}
export function setActiveTunnelServer(server) {
  activeTunnelServer = server
}
export function getActiveTunnel() {
  return activeTunnel
}
export function getActiveTunnelServer() {
  return activeTunnelServer
}
import { getTunnelState, getTunnelObject, setTunnelObject } from "../../renderer/utilities/tunnelState.js"
import { Client } from 'ssh2'
const net = require('net')

/**
 * Starts an SSH tunnel and creates the backend port forwarding server only.
 * MongoDB tunnel can be created later by calling startMongoTunnel.
 * @param {Object} params - SSH and port config.
 * @param {string} params.host
 * @param {string} params.username
 * @param {string} [params.privateKey]
 * @param {string} [params.password]
 * @param {number|string} params.remotePort
 * @param {number|string} params.localBackendPort
 * @param {number|string} params.remoteBackendPort
 * @param {number|string} params.localDBPort
 * @param {number|string} params.remoteDBPort
 * @returns {Promise<{success: boolean}>}
 */
export async function startSSHTunnel({
  host,
  username,
  privateKey,
  password,
  remotePort,
  localBackendPort,
  remoteBackendPort,
  localDBPort,
  remoteDBPort
}) {
  return new Promise((resolve, reject) => {
    mongoDBLocalPort = localDBPort
    mongoDBRemotePort = remoteDBPort

    if (activeTunnelServer) {
      try { activeTunnelServer.backendServer.close() } catch {}
      try { activeTunnelServer.mongoServer && activeTunnelServer.mongoServer.close() } catch {}
      setActiveTunnelServer(null)
    }
    if (activeTunnel) {
      try { activeTunnel.end() } catch {}
      setActiveTunnel(null)
    }
    const connConfig = {
      host,
      port: parseInt(remotePort),
      username
    }
    if (privateKey) connConfig.privateKey = privateKey
    if (password) connConfig.password = password
    const conn = new Client()
    conn.on('ready', () => {
      // Backend port forwarding only
      const backendServer = net.createServer((socket) => {
        conn.forwardOut(
          socket.localAddress || '127.0.0.1',
          socket.localPort || 0,
          '127.0.0.1',
          parseInt(remoteBackendPort),
          (err, stream) => {
            if (err) {
              console.error(err)
              socket.destroy()
              return
            }
            socket.pipe(stream).pipe(socket)
          }
        )
      })
      backendServer.listen(localBackendPort, '127.0.0.1')

      backendServer.on('error', (e) => {
        conn.end()
        reject(new Error('Backend local server error: ' + e.message))
      })

      setActiveTunnel(conn)
      setTunnelObject(conn)
      setActiveTunnelServer({ backendServer: backendServer })
      console.log(backendServer)
      resolve({ success: true })
    }).on('error', (err) => {
      reject(new Error('SSH connection error: ' + err.message))
    }).connect(connConfig)
  })
}


/**
 * Checks if a port is open on the remote host via SSH.
 * @param {Client} conn - The active SSH2 Client connection.
 * @param {number|string} port - The port to check.
 * @returns {Promise<boolean>}
 */
async function checkRemotePortOpen(conn, port) {
  // Use detectRemoteOS to determine the remote OS and select the right command
  const remoteOS = await detectRemoteOS();
  let checkCmd;
  if (remoteOS === 'win32') {
    // Windows: use netstat and findstr
    checkCmd = `netstat -an | findstr :${port}`;
  } else {
    // Linux/macOS: use ss or netstat/grep
    checkCmd = `bash -c "command -v ss >/dev/null 2>&1 && ss -ltn | grep :${port} || netstat -an | grep LISTEN | grep :${port}" || netstat -an | grep :${port}`;
  }
  return new Promise((resolve, reject) => {
    conn.exec(checkCmd, (err, stream) => {
      if (err) {
        console.log("SSH exec error:", err);
        return reject(err);
      }
      let found = false;
      let stdout = '';
      let stderr = '';
      stream.on('data', (data) => {
        console.log("STDOUT:", data.toString());
        stdout += data.toString();
        if (data.toString().includes(port)) found = true;
      });
      stream.stderr.on('data', (data) => {
        console.log("STDERR:", data.toString());
        stderr += data.toString();
      });
      stream.on('close', (code, signal) => {
        console.log("Stream closed. Code:", code, ", Signal:", signal);
        console.log("Full STDOUT:", stdout);
        console.log("Full STDERR:", stderr);
        resolve(found);
      });
    });
  });
}

/**
 * Starts the MongoDB port forwarding tunnel using an existing SSH connection.
 * Checks if the remote port is open before creating the tunnel, with retries.
 * @returns {Promise<{success: boolean}>}
 */
export async function startMongoTunnel() {
  const conn = getActiveTunnel();
  if (!conn) {
    throw new Error('No active SSH connection for MongoDB tunnel.');
  }

  // Retry logic: up to 3 times, 5s delay
  let portOpen = false;
  let attempts = 0;
  const maxAttempts = 3;
  const delayMs = 5000;
  while (attempts < maxAttempts && !portOpen) {
    try {
      console.log(`Checking if remote MongoDB port ${mongoDBRemotePort} is open...`);
      portOpen = await checkRemotePortOpen(conn, mongoDBRemotePort);
    } catch (e) {
      // If SSH command fails, treat as not open
      portOpen = false;
    }
    if (!portOpen) {
      attempts++;
      if (attempts < maxAttempts) {
        await new Promise(res => setTimeout(res, delayMs));
      }
    }
  }
  if (!portOpen) {
    throw new Error(`MongoDB server is not listening on remote port ${mongoDBRemotePort} after ${maxAttempts} attempts.`);
  }

  // If mongoServer already exists, close it first
  if (activeTunnelServer && activeTunnelServer.mongoServer) {
    try { activeTunnelServer.mongoServer.close() } catch {}
  }
  const mongoServer = net.createServer((socket) => {
    conn.forwardOut(
      socket.localAddress || '127.0.0.1',
      socket.localPort || 0,
      '127.0.0.1',
      parseInt(mongoDBRemotePort),
      (err, stream) => {
        if (err) {
          console.error(err)
          socket.destroy()
          return
        }
        socket.pipe(stream).pipe(socket)
      }
    )
  })
  mongoServer.listen(mongoDBLocalPort, '127.0.0.1')

  mongoServer.on('error', (e) => {
    conn.end()
    throw new Error('Mongo local server error: ' + e.message)
  })

  // Update activeTunnelServer to include mongoServer
  setActiveTunnelServer({
    ...(activeTunnelServer || {}),
    mongoServer: mongoServer
  })
  console.log(mongoServer)
  return { success: true }
}

/**
 * Stops the SSH tunnel and closes all forwarded servers.
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function stopSSHTunnel() {
  let success = false
  let error = null
  if (activeTunnelServer) {
    try {
      await new Promise((resolve, reject) => {
        activeTunnelServer.backendServer.close((err) => {
          if (err) reject(err)
          else resolve()
        })
      })
      await new Promise((resolve, reject) => {
        activeTunnelServer.mongoServer.close((err) => {
          if (err) reject(err)
          else resolve()
        })
      })
      setActiveTunnelServer(null)
      success = true
    } catch (e) {
      error = e.message || String(e)
    }
  }
  if (activeTunnel) {
    try { activeTunnel.end() } catch {}
    setActiveTunnel(null)
    success = true
  }
  if (success) return { success: true }
  return { success: false, error: error || 'No active tunnel' }
}

export function checkRemoteFolderExists(folderPath) {
  // Ensure tunnel is active and SSH client is available
  const tunnel = getTunnelState()
  if (!tunnel || !tunnel.tunnelActive || !tunnel.tunnelObject || !tunnel.tunnelObject.sshClient) {
    const errMsg = 'No active SSH tunnel for remote folder creation.'
    console.error(errMsg)
    return "tunnel inactive"
  }
  tunnel.tunnelObject.sshClient.sftp((err, sftp) => {
    if (err) {
      console.error('SFTP error:', err)
      return "sftp error"
    }

    // Check if folder exists
    sftp.stat(folderPath, (statErr, stats) => {
      if (!statErr && stats && stats.isDirectory && stats.isDirectory()) {
        // Folder exists
        sftp.end && sftp.end()
        return "exists"
      }
    })
  })
  return "does not exist"
}

export function checkRemoteFileExists(filePath) {
  // Ensure tunnel is active and SSH client is available
  const tunnel = getTunnelState()
  if (!tunnel || !tunnel.tunnelActive || !tunnel.tunnelObject || !tunnel.tunnelObject.sshClient) {
    const errMsg = 'No active SSH tunnel for remote file check.'
    console.error(errMsg)
    return "tunnel inactive"
  }
  tunnel.tunnelObject.sshClient.sftp((err, sftp) => {
    if (err) {
      console.error('SFTP error:', err)
      return "sftp error"
    }

    // Check if file exists
    sftp.stat(filePath, (statErr, stats) => {
      if (!statErr && stats && stats.isFile && stats.isFile()) {
        // File exists
        sftp.end && sftp.end()
        return "exists"
      }
    })
  })
  return "does not exist"
}

export function getRemoteLStat(Path) {
  // Ensure tunnel is active and SSH client is available
  const tunnel = getTunnelState()
  if (!tunnel || !tunnel.tunnelActive || !tunnel.tunnelObject || !tunnel.tunnelObject.sshClient) {
    const errMsg = 'No active SSH tunnel for remote file check.'
    console.error(errMsg)
    return null
  }
  tunnel.tunnelObject.sshClient.sftp((err, sftp) => {
    if (err) {
      console.error('SFTP error:', err)
      return null
    }

    // Check if file exists
    sftp.lstat(Path, (statErr, stats) => {
      if (statErr) {
        return null
      } else {
        return stats
      }
    })
  })
  return null
}

export async function detectRemoteOS() {
  return new Promise((resolve, reject) => {
    activeTunnel.exec('uname -s', (err, stream) => {
      if (err) {
        // Assume Windows if uname fails
        resolve('win32')
        return
      }
      let output = ''
      stream.on('data', (outputData) => { output += outputData.toString() })
      stream.on('close', () => {
        const out = output.trim().toLowerCase()
        if (out.includes('linux')) {
          resolve('linux')
        } else if (out.includes('darwin')) {
          resolve('darwin')
        } else if (out.includes('bsd')) {
          resolve('unix')
        } else {
          resolve('win32')
        }
      })
      stream.stderr.on('data', () => resolve('win32'))
    })
  })
}

// Unused
export function getRemoteMongoDBPath() {
  const remotePlatform = detectRemoteOS()

  if (remotePlatform === "win32") {
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
