import { useState, useEffect, useContext } from "react"
import { Dialog } from "primereact/dialog"
import { toast } from "react-toastify"
import { ipcRenderer } from "electron"
import { requestBackend } from "../../utilities/requests"
import { ServerConnectionContext } from "../serverConnection/connectionContext"
import { useTunnel } from "../tunnel/TunnelContext"
import { getTunnelState, setTunnelState, clearTunnelState } from "../../utilities/tunnelState"
import { Button } from "@blueprintjs/core"
import { GoFile, GoFileDirectoryFill, GoChevronDown, GoChevronUp } from "react-icons/go"
import { FaFolderPlus } from "react-icons/fa"
import { WorkspaceContext } from "../workspace/workspaceContext"
import axios from "axios"

/**
 *
 * @returns {JSX.Element} The connection modal used for establishing a connection to a remote server
 */
const ConnectionModal = ({ visible, closable, onClose, onConnect }) =>{
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [host, setHost] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [remotePort, setRemotePort] = useState("22")
  const [localBackendPort, setLocalBackendPort] = useState("54280")
  const [remoteBackendPort, setRemoteBackendPort] = useState("54288")
  const [localDBPort, setLocalDBPort] = useState("54020")
  const [remoteDBPort, setRemoteDBPort] = useState("54017")
  const [privateKey, setPrivateKey] = useState("")
  const [publicKey, setPublicKey] = useState("")
  const [keyComment, setKeyComment] = useState("medomicslab-app")
  const [keyGenerated, setKeyGenerated] = useState(false)
  const [registerStatus, setRegisterStatus] = useState("")
  const [tunnelStatus, setTunnelStatus] = useState("")
  const [tunnelActive, setTunnelActive] = useState(false)
  const [reconnectAttempts, setReconnectAttempts] = useState(0)
  const maxReconnectAttempts = 3
  const reconnectDelay = 3000 // ms
  const [connectionInfo, setConnectionInfo] = useState(null)
  const { workspace, setWorkspace } = useContext(WorkspaceContext)

  // Validation state
  const [inputErrors, setInputErrors] = useState({})
  const [inputValid, setInputValid] = useState(false)
  const [localPortWarning, setLocalPortWarning] = useState("")

  const { port } = useContext(ServerConnectionContext) // we get the port for server connexion
  const tunnelContext = useTunnel()

  // Directory browser state
  const [directoryContents, setDirectoryContents] = useState([])
  const [remoteDirPath, setRemoteDirPath] = useState("")

  const registerPublicKey = async (publicKeyToRegister, usernameToRegister) => {
    setRegisterStatus("Registering...")
    toast.info("Registering your SSH public key with the backend...")
    await requestBackend(
      port,
      "/connection/register_ssh_key",
      {
        username: usernameToRegister,
        publicKey: publicKeyToRegister
      },
      async (jsonResponse) => {
        console.log("received results:", jsonResponse)
        if (!jsonResponse.error) {
          setRegisterStatus("Public key registered successfully!")
          toast.success("Your SSH public key was registered successfully.")
        } else {
          setRegisterStatus("Failed to register public key: " + jsonResponse.error)
          toast.error(jsonResponse.error)
        }
      },
      (err) => {
        setRegisterStatus("Failed to register public key: " + err)
        toast.error(err)
      }
    )
  }

  const handleGenerateKey = async () => {
    try {
      const result = await ipcRenderer.invoke('generateSSHKey', { comment: keyComment, username })
      if (result && result.publicKey && result.privateKey) {
        setPublicKey(result.publicKey)
        setPrivateKey(result.privateKey)
        setKeyGenerated(true)
        toast.success("A new SSH key pair was generated.")
      } else if (result && result.error) {
        alert('Key generation failed: ' + result.error)
        toast.error("Key Generation Failed: " + result.error)
      } else {
        alert('Key generation failed: Unknown error.')
        toast.error("Key Generation Failed: Unknown error.")
      }
    } catch (err) {
      alert('Key generation failed: ' + err.message)
      toast.error("Key Generation Failed: " + err.message)
    }
  }

  // Tunnel error handler and auto-reconnect
  useEffect(() => {
    if (!tunnelActive && reconnectAttempts > 0 && reconnectAttempts <= maxReconnectAttempts && connectionInfo) {
      setTunnelStatus(`Reconnecting... (attempt ${reconnectAttempts} of ${maxReconnectAttempts})`)
      toast.warn(`Attempt ${reconnectAttempts} of ${maxReconnectAttempts} to reconnect SSH tunnel.`)
      const timer = setTimeout(() => {
        handleConnectBackend(connectionInfo, true)
      }, reconnectDelay)
      return () => clearTimeout(timer)
    }
    if (reconnectAttempts > maxReconnectAttempts) {
      setTunnelStatus("Failed to reconnect SSH tunnel after multiple attempts.")
      toast.error("Failed to reconnect SSH tunnel after multiple attempts.")
    }
  }, [tunnelActive, reconnectAttempts, connectionInfo])

  // On modal open, check for existing tunnel and sync state
  useEffect(() => {
    if (visible) {
      const tunnel = getTunnelState()
      if (tunnel.tunnelActive) {
        setTunnelActive(true)
        setHost(tunnel.host || "")
        setUsername(tunnel.username || "")
        setRemotePort(tunnel.remotePort || "22")
        setLocalBackendPort(tunnel.localBackendPort || "54280")
        setRemoteBackendPort(tunnel.remoteBackendPort || "54288")
        setLocalDBPort(tunnel.localDBPort || "54020")
        setRemoteDBPort(tunnel.remoteDBPort || "54017")
        setTunnelStatus("SSH tunnel is already established.")
        tunnelContext.setTunnelInfo(tunnel) // Sync React context
      } else {
        setTunnelActive(false)
        setTunnelStatus("")
      }
    }
  }, [visible])

  // Updated connect handler with error handling and auto-reconnect
  const handleConnectBackend = async (info, isReconnect = false) => {
    setTunnelStatus(isReconnect ? "Reconnecting..." : "Connecting...")
    toast.info(isReconnect ? "Reconnecting SSH tunnel..." : "Establishing SSH tunnel...")
    const connInfo = info || { host, username, privateKey, password, remotePort, localBackendPort, remoteBackendPort, localDBPort, remoteDBPort }
    setConnectionInfo(connInfo)
    // --- Host validation ---
    const hostPattern = /^(?!-)[A-Za-z0-9-]{1,63}(?<!-)\.?([A-Za-z0-9-]{1,63}\.?)*[A-Za-z]{2,6}$|^(\d{1,3}\.){3}\d{1,3}$/
    if (!connInfo.host || connInfo.host.trim() === "") {
      setTunnelStatus("Error: Remote host is required.")
      toast.error("Remote host is required.")
      return
    }
    if (!hostPattern.test(connInfo.host.trim())) {
      setTunnelStatus("Error: Invalid remote host. Please enter a valid hostname or IP address.")
      toast.error("Invalid remote host. Please enter a valid hostname or IP address.")
      return
    }
    try {
      if (!connInfo.host) {
        setTunnelStatus("Error: Remote host is required.")
        toast.error("Remote host is required.")
        return
      }
      if (!connInfo.username) {
        setTunnelStatus("Error: Username is required.")
        toast.error("Username is required.")
        return
      }
      if (!connInfo.privateKey) {
        setTunnelStatus("Error: SSH private key is missing. Please generate a key first.")
       toast.error("SSH private key is missing. Please generate a key first.")
        return
      }
      if (!connInfo.remotePort || isNaN(Number(connInfo.remotePort))) {
        setTunnelStatus("Error: Remote SSH port is invalid.")
        toast.error("Remote SSH port is invalid.")
        return
      }
      if (!connInfo.localBackendPort || isNaN(Number(connInfo.localBackendPort))) {
        setTunnelStatus("Error: Local port is invalid.")
        toast.error("Local port is invalid.")
        return
      }
      if (!connInfo.remoteBackendPort || isNaN(Number(connInfo.remoteBackendPort))) {
        setTunnelStatus("Error: Remote backend port is invalid.")
        toast.error("Remote backend port is invalid.")
        return
      }
      if (!connInfo.localDBPort || isNaN(Number(connInfo.localDBPort))) {
        setTunnelStatus("Error: Local MongoDB port is invalid.")
        toast.error("Local MongoDB port is invalid.")
        return
      }
      if (!connInfo.remoteDBPort || isNaN(Number(connInfo.remoteDBPort))) {
        setTunnelStatus("Error: Remote MongoDB port is invalid.")
        toast.error("Remote MongoDB port is invalid.")
        return
      }
      const result = await ipcRenderer.invoke('startSSHTunnel', connInfo)
      if (result && result.success) {
        setTunnelActive(true)
        setTunnelStatus("SSH tunnel established.")
        setTunnelState({ ...connInfo, tunnelActive: true })
        tunnelContext.setTunnelInfo(getTunnelState()) // Sync React context
        setReconnectAttempts(0)
        if (onConnect) onConnect()
        toast.success("SSH tunnel established.")

        // Fetch home directory contents via IPC and update directoryContents and remoteDirPath
        try {
          const res = await ipcRenderer.invoke('listRemoteDirectory', { path: '~' })
          // res: { path, contents }
          if (res && typeof res === 'object') {
            if (typeof res.path === 'string') setRemoteDirPath(res.path)
            if (Array.isArray(res.contents)) {
              setDirectoryContents(res.contents.map(item => ({
                name: item.name,
                type: item.type === 'directory' || item.type === 'dir' ? 'dir' : 'file'
              })))
            } else {
              setDirectoryContents([])
            }
          } else {
            setDirectoryContents([])
          }
        } catch (err) {
          setDirectoryContents([])
        }
      } else if (result && result.error) {
        setTunnelStatus("Failed to establish SSH tunnel: " + result.error)
        setTunnelActive(false)
        setReconnectAttempts((prev) => prev + 1)
        toast.error("Tunnel failed: " + result.error)
      } else {
        setTunnelStatus("Failed to establish SSH tunnel: Unknown error.")
        setTunnelActive(false)
        setReconnectAttempts((prev) => prev + 1)
        toast.error("Tunnel Failed, Unknown error.")
      }
    } catch (err) {
      let errorMsg = err && err.message ? err.message : String(err)
      if (err && err.stack) {
        errorMsg += "\nStack: " + err.stack
      }
      setTunnelStatus("Failed to establish SSH tunnel: " + errorMsg)
      setTunnelActive(false)
      setReconnectAttempts((prev) => prev + 1)
      toast.error("Tunnel Failed: " + errorMsg)
    }
  }

  const handleConnectMongoDB = async () => {
    try {
      const result = await ipcRenderer.invoke('startMongoTunnel')
      if (result && result.success) {
        toast.success("MongoDB tunnel established.")
      } else if (result && result.error) {
        toast.error("MongoDB Tunnel failed: " + result.error)
      } else {
        toast.error("MongoDB Tunnel Failed, Unknown error.")
      }
    } catch (err) {
      let errorMsg = err && err.message ? err.message : String(err)
      if (err && err.stack) {
        errorMsg += "\nStack: " + err.stack
      }
      toast.error("MongoDB Tunnel Failed: " + errorMsg)
    }
  }

  const handleDisconnect = async () => {
    setTunnelStatus("Disconnecting...")
    toast.info("Disconnecting SSH tunnel...")
    try {
      const result = await ipcRenderer.invoke('stopSSHTunnel')
      if (result && result.success) {
        setTunnelActive(false)
        setTunnelStatus("SSH tunnel disconnected.")
        tunnelContext.clearTunnelInfo()
        ipcRenderer.invoke("setRemoteWorkspacePath", null)
        clearTunnelState()
        toast.success("SSH tunnel disconnected.")
        setDirectoryContents([])
        setRemoteDirPath("")
        setWorkspace(null)
      } else {
        setTunnelStatus("Failed to disconnect tunnel: " + (result?.error || 'Unknown error'))
        toast.error("Disconnect Failed: " + result?.error || 'Unknown error')
      }
    } catch (err) {
      setTunnelStatus("Failed to disconnect tunnel: " + (err.message || err))
      toast.error("Disconnect Failed: ", err.message || String(err))
    }
  }

  useEffect(() => {
    // When modal opens and username is set, check for existing SSH key (do NOT generate)
    if (visible && username) {
      (async () => {
        try {
          const result = await ipcRenderer.invoke('getSSHKey', { username })
          if (result && result.publicKey && result.privateKey) {
            setPublicKey(result.publicKey)
            setPrivateKey(result.privateKey)
            setKeyGenerated(!!result.publicKey)
          } else {
            setPublicKey("")
            setPrivateKey("")
            setKeyGenerated(false)
          }
        } catch {
          setPublicKey("")
          setPrivateKey("")
          setKeyGenerated(false)
        }
      })()
    }
  }, [visible, username, keyComment])

  const sendTestRequest = async () => {
    console.log("Port: ", port)
    console.log("Tunnel state: ", getTunnelState())
    console.log("Tunnel context: ", tunnelContext.tunnelActive)
    // if (!tunnelActive) {
    //   toast.error("SSH tunnel is not active. Please connect first.")
    //   return
    // }
    await requestBackend(
      port,
      "/connection/connection_test_request",
      { data: "" },
      async (jsonResponse) => {
        console.log("received results:", jsonResponse)
        if (!jsonResponse.error) {
          setRegisterStatus("Test request successful!")
        } else {
          setRegisterStatus("Test request failed: " + jsonResponse.error)
          toast.error(jsonResponse.error)
        }
      },
      (err) => {
        setRegisterStatus("Test request failed: " + err)
        toast.error(err)
      }
    )
  }

  // DirectoryBrowser component
const DirectoryBrowser = ({ directoryContents, onDirClick }) => {
  if (!directoryContents || directoryContents.length === 0) {
    return <div style={{ color: '#888', fontSize: 14 }}>No files or folders to display.</div>
  }
  return (
    <ul className="dir-browser-list">
      {directoryContents.map((item, idx) => (
        <li
          className="dir-browser-item"
          key={item.name + idx}
          style={item.type === 'dir' ? { cursor: 'pointer', fontWeight: 500 } : {}}
          onClick={item.type === 'dir' ? () => onDirClick && onDirClick(item.name) : undefined}
        >
          <span className="dir-browser-icon">
            {item.type === 'dir' ? (
              <GoFileDirectoryFill size={20} style={{ color: '#2222ff' }} />
            ) : (
              <GoFile size={20} style={{ color: '#6b7a90' }} />
            )}
          </span>
          <span>{item.name}</span>
        </li>
      ))}
    </ul>
  )
}

  // Input validation logic
  useEffect(() => {
    const errors = {}
    let warning = ""
    // Strict IPv4 regex
    const ipv4Pattern = /^(?:(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)$/
    // Hostname regex (RFC 1123, simple)
    const hostnamePattern = /^(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.[A-Za-z0-9-]{1,63})*$/
    const hostTrimmed = host.trim()
    if (!hostTrimmed) {
      errors.host = "Remote host is required."
    } else if (!(ipv4Pattern.test(hostTrimmed) || hostnamePattern.test(hostTrimmed))) {
      errors.host = "Enter a valid IPv4 address or hostname."
    }
    if (!username.trim()) {
      errors.username = "Username is required."
    }
    if (!remotePort || isNaN(Number(remotePort)) || Number(remotePort) < 1 || Number(remotePort) > 65535) {
      errors.remotePort = "Remote SSH port must be 1-65535."
    }
    if (!localBackendPort || isNaN(Number(localBackendPort)) || Number(localBackendPort) < 1 || Number(localBackendPort) > 65535) {
      errors.localBackendPort = "Local backend port must be 1-65535."
    }
    if (!remoteBackendPort || isNaN(Number(remoteBackendPort)) || Number(remoteBackendPort) < 1 || Number(remoteBackendPort) > 65535) {
      errors.remoteBackendPort = "Remote backend port must be 1-65535."
    }
    if (!localDBPort || isNaN(Number(localDBPort)) || Number(localDBPort) < 1 || Number(localDBPort) > 65535) {
      errors.localDBPort = "Local MongoDB port must be 1-65535."
    }
    if (!remoteDBPort || isNaN(Number(remoteDBPort)) || Number(remoteDBPort) < 1 || Number(remoteDBPort) > 65535) {
      errors.remoteDBPort = "Remote MongoDB port must be 1-65535."
    }
    if (!keyGenerated || !publicKey || !privateKey) {
      errors.key = "SSH key must be generated."
    }
    // Warn if localBackendPort matches the main server port
    if (String(localBackendPort) === String(port)) {
      warning = `Warning: Local backend port (${localBackendPort}) is the same as the main server port (${port}). This may cause conflicts if the local backend is running.`
    }
    setInputErrors(errors)
    setInputValid(Object.keys(errors).length === 0)
    setLocalPortWarning(warning)
  }, [host, username, remotePort, localBackendPort, remoteBackendPort, localDBPort, remoteDBPort, keyGenerated, publicKey, privateKey, port])

  // New folder modal state
  const [showNewFolderModal, setShowNewFolderModal] = useState(false)
  const [newFolderName, setNewFolderName] = useState("")
  const [creatingFolder, setCreatingFolder] = useState(false)

  const handleCreateFolder = async () => {
    setCreatingFolder(true)
    try {
      const result = await ipcRenderer.invoke('createRemoteFolder', {
        path: remoteDirPath,
        folderName: newFolderName.trim()
      })
      if (result && result.success) {
        const navResult = await ipcRenderer.invoke('navigateRemoteDirectory', {
          action: 'list',
          path: remoteDirPath
        })
        if (navResult && navResult.path) setRemoteDirPath(navResult.path)
        if (Array.isArray(navResult?.contents)) {
          setDirectoryContents(navResult.contents.map(item => ({
            name: item.name,
            type: item.type === 'dir' ? 'dir' : 'file'
          })))
        } else {
          setDirectoryContents([])
        }
        setShowNewFolderModal(false)
        setNewFolderName("")
      } else {
        toast.error('Failed to create folder: ' + (result && result.error ? result.error : 'Unknown error'))
      }
    } catch (err) {
      toast.error('Failed to create folder: ' + (err && err.message ? err.message : String(err)))
    } finally {
      setCreatingFolder(false)
    }
  }

  return (
    <Dialog className="modal" visible={visible} style={{ width: "50vw" }} closable={closable} onHide={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <h2>SSH Tunnel Connection</h2>
        <label>
          Remote Host:
          <input type="text" value={host} onChange={e => setHost(e.target.value)} placeholder="e.g. example.com" />
          {inputErrors.host && <div style={{ color: 'red', fontSize: 13 }}>{inputErrors.host}</div>}
        </label>
        <label>
          Username:
          <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="SSH username" />
          {inputErrors.username && <div style={{ color: 'red', fontSize: 13 }}>{inputErrors.username}</div>}
        </label>
        <label>
          Password:
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="SSH password" />
        </label>
        <div style={{ marginBottom: 8 }}>
          <button
            type="button"
            onClick={() => setShowAdvanced(v => !v)}
            style={{
              color: '#0000FF',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: 14,
              textDecoration: 'underline',
              marginBottom: 4
            }}
            aria-expanded={showAdvanced}
          >
            {showAdvanced ? 'Hide Advanced Settings' : 'Show Advanced Settings'}
            {showAdvanced ? <GoChevronUp style={{ fontSize: 20, marginLeft: '5px' }}></GoChevronUp> : <GoChevronDown style={{ fontSize: 20, marginLeft: '5px' }}></GoChevronDown>}
          </button>
          <div
            style={{
              display: 'flex',
              maxHeight: showAdvanced ? 1000 : 0,
              overflow: 'hidden',
              transition: 'max-height 0.35s cubic-bezier(0.4,0,0.2,1)',
              opacity: showAdvanced ? 1 : 0,
              transitionProperty: 'max-height, opacity',
              border: showAdvanced ? '1px solid #eee' : '1px solid transparent',
              borderRadius: 4,
              padding: showAdvanced ? 12 : 0,
              marginTop: showAdvanced ? 6 : 0,
              background: showAdvanced ? '#fafbfc' : 'transparent',
            }}
            aria-hidden={!showAdvanced}
          >
            {showAdvanced && <>
            <div>
              <label>
                Remote SSH Port:
                <input type="number" style={{ marginLeft: '5px' }} value={remotePort} onChange={e => setRemotePort(e.target.value)} placeholder="22" />
                {inputErrors.remotePort && <div style={{ color: 'red', fontSize: 13 }}>{inputErrors.remotePort}</div>}
              </label>
              <label>
                Local Backend Port:
                <input type="number" style={{ marginLeft: '5px' }} value={localBackendPort} onChange={e => setLocalBackendPort(e.target.value)} placeholder="8888" />
                {inputErrors.localBackendPort && <div style={{ color: 'red', fontSize: 13 }}>{inputErrors.localBackendPort}</div>}
                {localPortWarning && <div style={{ color: 'orange', fontSize: 13, marginTop: 2 }}>{localPortWarning}</div>}
              </label>
              <label>
                Remote Backend Port:
                <input type="number" style={{ marginLeft: '5px' }} value={remoteBackendPort} onChange={e => setRemoteBackendPort(e.target.value)} placeholder="8888" />
                {inputErrors.remoteBackendPort && <div style={{ color: 'red', fontSize: 13 }}>{inputErrors.remoteBackendPort}</div>}
              </label>
            </div>
            <div>
              <label>
                Local MongoDB Port:
                <input type="number" style={{ marginLeft: '5px' }} value={localDBPort} onChange={e => setLocalDBPort(e.target.value)} placeholder="54020" />
              </label>
              <label>
                Remote MongoDB Port:
                <input type="number" style={{ marginLeft: '5px' }} value={remoteDBPort} onChange={e => setRemoteDBPort(e.target.value)} placeholder="54017" />
              </label>
              <label>
                SSH Key Comment:
                <input type="text" style={{ marginLeft: '5px' }} value={keyComment} onChange={e => setKeyComment(e.target.value)} placeholder="medomicslab-app" />
              </label>
            </div>
            </>}
          </div>
        </div>
        <button onClick={handleGenerateKey} disabled={keyGenerated} style={{ background: keyGenerated ? '#ccc' : '#007ad9', color: 'white' }}>
          {keyGenerated ? 'Key Generated' : 'Generate SSH Key'}
        </button>
        {inputErrors.key && <div style={{ color: 'red', fontSize: 13, marginTop: 4 }}>{inputErrors.key}</div>}
        {keyGenerated && (
          <div>
            <strong>Public Key:</strong>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', background: '#f4f4f4', padding: '0.5em' }}>{publicKey}</pre>
            {registerStatus && <div style={{ marginTop: '0.5em', color: registerStatus.includes('success') ? 'green' : 'red' }}>{registerStatus}</div>}
          </div>
        )}
        <div style={{ display: "flex", gap: "1rem", justifyContent: "flex-end" }}>
          <Button onClick={onClose}>Close</Button>
          <Button className="connect-btn" onClick={() => handleConnectBackend()} style={{ background: "#007ad9", color: "white" }} disabled={!inputValid || tunnelActive}>Connect</Button>
          <Button onClick={handleDisconnect} style={{ background: "#d9534f", color: "white" }}>Disconnect</Button>
        </div>
        {tunnelStatus && (
          <div style={{ marginTop: '0.5em', color: tunnelStatus.includes('established') ? 'green' : tunnelStatus.includes('Reconnecting') ? 'orange' : 'red' }}>{tunnelStatus}</div>
        )}
        <Button onClick={sendTestRequest} style={{ background: "#d9534f", color: "white" }}>Send test request</Button>
        {/* Directory Browser Section */}
        <div style={{ marginTop: '2rem', borderTop: '1px solid #eee', paddingTop: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Remote Directory Browser</h3>
            <Button
              className="refresh-btn"
              icon="refresh"
              onClick={async () => {
                try {
                  // Use new backend navigation handler
                  const navResult = await ipcRenderer.invoke('navigateRemoteDirectory', {
                    action: 'list',
                    path: remoteDirPath
                  })
                  if (navResult && navResult.path) setRemoteDirPath(navResult.path)
                  if (Array.isArray(navResult?.contents)) {
                    setDirectoryContents(navResult.contents.map(item => ({
                      name: item.name,
                      type: item.type === 'dir' ? 'dir' : 'file'
                    })))
                  } else {
                    setDirectoryContents([])
                  }
                } catch {
                  setDirectoryContents([])
                }
              }}
              title="Refresh directory contents"
            ></Button>
            <Button
              className="new-folder-btn"
              onClick={() => {
                setNewFolderName("")
                setShowNewFolderModal(true)
              }}
              title="Create new folder"
              disabled={!tunnelActive}
            >
              <FaFolderPlus style={{ height: '21px', width: '18px', color: '#5f6b7c' }} />
            </Button>
            <Button
              id="set-workspace-btn"
              className="set-workspace-btn"
              icon="folder-open"
              onClick={async () => {
                const tunnelState = getTunnelState()
                axios.post(`http://${tunnelState.host}:3000/set-working-directory`, { workspacePath: remoteDirPath })
                  .then(response => {
                    if (response.data.success) {
                      toast.success("Workspace set successfully on remote app.")
                      if (response.data.workspace !== workspace) {
                        let workspaceToSet = { ...response.data.workspace }
                        workspaceToSet.newPort = tunnelState.localBackendPort
                        setWorkspace(workspaceToSet)
                        ipcRenderer.invoke("setRemoteWorkspacePath", remoteDirPath)
                        handleConnectMongoDB()
                      }
                    } else {
                      toast.error("Failed to set workspace: " + response.data.error)
                    }
                  })
                  .catch(err => {
                    toast.error("Failed to set workspace: " + (err && err.message ? err.message : String(err)))
                  })
              }}
              title="Set this directory as workspace on remote app"
              disabled={!tunnelActive}
            >
              Set as Workspace
            </Button>
          </div>
          <div style={{ color: '#666', fontSize: 13, marginBottom: 8, marginLeft: 2 }}>
            Path: <span style={{ fontFamily: 'monospace' }}>{remoteDirPath}</span>
          </div>
          <DirectoryBrowser
            directoryContents={
              // Add parent dir '..' if not at root
              remoteDirPath !== '' && remoteDirPath !== '/'
                ? [{ name: '..', type: 'dir' }, ...directoryContents]
                : directoryContents
            }
            onDirClick={async (dirName) => {
              try {
                let navResult
                if (dirName === '..') {
                  navResult = await ipcRenderer.invoke('navigateRemoteDirectory', {
                    action: 'up',
                    path: remoteDirPath
                  })
                } else {
                  navResult = await ipcRenderer.invoke('navigateRemoteDirectory', {
                    action: 'into',
                    path: remoteDirPath,
                    dirName
                  })
                }
                if (navResult && navResult.path) setRemoteDirPath(navResult.path)
                if (Array.isArray(navResult?.contents)) {
                  setDirectoryContents(navResult.contents.map(item => ({
                    name: item.name,
                    type: item.type === 'dir' ? 'dir' : 'file'
                  })))
                } else {
                  setDirectoryContents([])
                }
              } catch {
                setDirectoryContents([])
              }
            }}
          />
        </div>
      </div>
      {/* New Folder Modal */}
      {showNewFolderModal && (
        <Dialog
          visible={showNewFolderModal}
          style={{ width: 400 }}
          header="Create New Folder"
          onHide={() => setShowNewFolderModal(false)}
          closable
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button onClick={() => setShowNewFolderModal(false)} disabled={creatingFolder}>Cancel</Button>
              <Button
                intent="primary"
                onClick={async () => {
                  if (!newFolderName.trim()) return
                  setCreatingFolder(true)
                  try {
                    const result = await ipcRenderer.invoke('createRemoteFolder', {
                      path: remoteDirPath,
                      folderName: newFolderName.trim()
                    })
                    if (result && result.success) {
                      // Refresh directory after creation
                      const navResult = await ipcRenderer.invoke('navigateRemoteDirectory', {
                        action: 'list',
                        path: remoteDirPath
                      })
                      if (navResult && navResult.path) setRemoteDirPath(navResult.path)
                      if (Array.isArray(navResult?.contents)) {
                        setDirectoryContents(navResult.contents.map(item => ({
                          name: item.name,
                          type: item.type === 'dir' ? 'dir' : 'file'
                        })))
                      } else {
                        setDirectoryContents([])
                      }
                      setShowNewFolderModal(false)
                      setNewFolderName("")
                    } else {
                      toast.error('Failed to create folder: ' + (result && result.error ? result.error : 'Unknown error'))
                    }
                  } catch (err) {
                    toast.error('Failed to create folder: ' + (err && err.message ? err.message : String(err)))
                  } finally {
                    setCreatingFolder(false)
                  }
                }}
                disabled={!newFolderName.trim() || creatingFolder}
              >
                Create
              </Button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label htmlFor="new-folder-name">Folder Name:</label>
            <input
              id="new-folder-name"
              type="text"
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              autoFocus
              disabled={creatingFolder}
              onKeyDown={e => {
                if (e.key === 'Enter' && newFolderName.trim() && !creatingFolder) {
                  e.preventDefault()
                  handleCreateFolder()
                }
              }}
              placeholder="e.g. my_new_folder"
            />
          </div>
        </Dialog>
      )}
      <style>
          {`
            .refresh-btn {
              marginLeft: 8px;
              fontSize: 16px;
              padding: 2px 8px;
              color: gray
            }

            .new-folder-btn {
              marginLeft: 8px;
              fontSize: 16px;
              padding: 2px 2px;
              color: gray
            }

            .new-folder-btn:disabled {
              opacity: 0.5;
              color: white;
              cursor: default
            }

            #set-workspace-btn {
              marginLeft: 8px;
              fontSize: 16px;
              padding: 2px 8px;
              background: #007ad9;
              color: white
            }

            #set-workspace-btn > span {
              color: white
            }

            .set-workspace-btn:disabled {
              opacity: 0.5;
              color: white;
              cursor: default
            }

            .connect-btn:disabled {
              opacity: 0.5;
              color: #666;
              cursor: default
            }

            .dir-browser-list {
              list-style: none;
              padding-left: 0;
              margin: 0;
              min-height: 30em;
              max-height: 30em;
              overflow-y: scroll
            }

            .dir-browser-item {
              display: flex;
              align-items: center;
              gap: 0.5em;
              font-size: 1rem;
              margin-bottom: 0.25em
            }

            .dir-browser-icon {
              display: inline-block
            }
          `}
        </style>
    </Dialog>
  )
}

export default ConnectionModal
