import { useState, useEffect, useContext } from "react"
import { Dialog } from "primereact/dialog"
import { toast } from "react-toastify"
import { InputText } from "primereact/inputtext"
import { Password } from 'primereact/password'
import { InputNumber } from 'primereact/inputnumber'
import { ProgressSpinner } from 'primereact/progressspinner'
import { Tag } from 'primereact/tag'
import { ipcRenderer } from "electron"
import { requestBackend } from "../../utilities/requests"
import { ServerConnectionContext } from "../serverConnection/connectionContext"
import { useTunnel } from "../tunnel/TunnelContext"
import { getTunnelState } from "../../utilities/tunnelState"
import { Button } from "@blueprintjs/core"
import { GoFile, GoFileDirectoryFill, GoChevronDown, GoChevronUp } from "react-icons/go"
import { FaFolderPlus } from "react-icons/fa"
import { WorkspaceContext } from "../workspace/workspaceContext"
import { IoMdClose, IoIosRefresh } from "react-icons/io"

/**
 *
 * @returns {JSX.Element} The connection modal used for establishing a connection to a remote server
 */
const ConnectionModal = ({ visible, closable, onClose, onConnect }) =>{
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Connection info form fields
  const [host, setHost] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [remotePort, setRemotePort] = useState("22")
  // Express ports (local forwarded port and remote Express port)
  const [localExpressPort, setlocalExpressPort] = useState("55080")
  const [remoteExpressPort, setRemoteExpressPort] = useState("55088")
  // GO ports (optional direct forwarding)
  const [localGoPort, setLocalGoPort] = useState("54280")
  const [remoteGoPort, setRemoteGoPort] = useState("54288")
  const [localDBPort, setLocalDBPort] = useState("54020")
  const [remoteDBPort, setRemoteDBPort] = useState("54017")
  const [localJupyterPort, setLocalJupyterPort] = useState("8890")
  const [remoteJupyterPort, setRemoteJupyterPort] = useState("8900")
  const [privateKey, setPrivateKey] = useState("")
  const [publicKey, setPublicKey] = useState("")
  const [keyComment, setKeyComment] = useState("medomicslab-app")

  // Connection state
  const [keyGenerated, setKeyGenerated] = useState(false)
  const [registerStatus, setRegisterStatus] = useState("")
  const [tunnelStatus, setTunnelStatus] = useState("")
  const [remoteBackendStatus, setRemoteBackendStatus] = useState("")
  const [remoteBackendPath, setRemoteBackendPath] = useState("")
  const [tunnelActive, setTunnelActive] = useState(false)
  const [reconnectAttempts, setReconnectAttempts] = useState(0)
  const maxReconnectAttempts = 3
  const reconnectDelay = 3000 // ms
  const [connectionInfo, setConnectionInfo] = useState(null)
  const { workspace, setWorkspace } = useContext(WorkspaceContext)

  // Process/loading states
  const [connectionProcessing, setConnectionProcessing] = useState(false)
  const [navigationProcessing, setNavigationProcessing] = useState(false)
  // GO tunnel verification state
  const [goVerifyStatus, setGoVerifyStatus] = useState('idle') // idle | checking | ok | fail
  const [goVerifyLoading, setGoVerifyLoading] = useState(false)

  // Validation state
  const [inputErrors, setInputErrors] = useState({})
  const [inputValid, setInputValid] = useState(false)
  const [localPortWarning, setLocalPortWarning] = useState("")

  const { port } = useContext(ServerConnectionContext) // we get the port for server connexion
  const tunnelContext = useTunnel()

  // Directory browser state
  const [directoryContents, setDirectoryContents] = useState([])
  const [remoteDirPath, setRemoteDirPath] = useState("")

  // const registerPublicKey = async (publicKeyToRegister, usernameToRegister) => {
  //   setRegisterStatus("Registering...")
  //   toast.info("Registering your SSH public key with the backend...")
  //   await requestBackend(
  //     port,
  //     "/connection/register_ssh_key",
  //     {
  //       username: usernameToRegister,
  //       publicKey: publicKeyToRegister
  //     },
  //     async (jsonResponse) => {
  //       console.log("received results:", jsonResponse)
  //       if (!jsonResponse.error) {
  //         setRegisterStatus("Public key registered successfully!")
  //         toast.success("Your SSH public key was registered successfully.")
  //       } else {
  //         setRegisterStatus("Failed to register public key: " + jsonResponse.error)
  //         toast.error(jsonResponse.error)
  //       }
  //     },
  //     (err) => {
  //       setRegisterStatus("Failed to register public key: " + err)
  //       toast.error(err)
  //     }
  //   )
  // }

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
      setConnectionProcessing(false)
      setTunnelStatus("Failed to reconnect SSH tunnel after multiple attempts.")
      toast.error("Failed to reconnect SSH tunnel after multiple attempts.")
      setReconnectAttempts(0)
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
  setlocalExpressPort(tunnel.localExpressPort || "55080")
  setRemoteExpressPort(tunnel.remoteExpressPort || "55088")
  setLocalGoPort(tunnel.localGoPort || "54280")
  setRemoteGoPort(tunnel.remoteGoPort || "54288")
        setLocalDBPort(tunnel.localDBPort || "54020")
        setRemoteDBPort(tunnel.remoteDBPort || "54017")
        setLocalJupyterPort(tunnel.localJupyterPort || "8890")
        setRemoteJupyterPort(tunnel.remoteJupyterPort || "8900")
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
    setConnectionProcessing(true)
    setTunnelStatus(isReconnect ? "Reconnecting..." : "Connecting...")
    toast.info(isReconnect ? "Reconnecting SSH tunnel..." : "Establishing SSH tunnel...")
  const connInfo = info || { host, username, privateKey, password, remotePort, localExpressPort, remoteExpressPort, localGoPort, remoteGoPort, localDBPort, remoteDBPort, localJupyterPort, remoteJupyterPort }
    setConnectionInfo(connInfo)
    // --- Host validation ---
    const hostPattern = /^(?!-)[A-Za-z0-9-]{1,63}(?<!-)\.?([A-Za-z0-9-]{1,63}\.?)*[A-Za-z]{2,6}$|^(\d{1,3}\.){3}\d{1,3}$/
    if (!connInfo.host || connInfo.host.trim() === "") {
      setTunnelStatus("Error: Remote host is required.")
      toast.error("Remote host is required.")
      setConnectionProcessing(false)
      return
    }
    if (!hostPattern.test(connInfo.host.trim())) {
      setTunnelStatus("Error: Invalid remote host. Please enter a valid hostname or IP address.")
      toast.error("Invalid remote host. Please enter a valid hostname or IP address.")
      setConnectionProcessing(false)
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
      if (!connInfo.localExpressPort || isNaN(Number(connInfo.localExpressPort))) {
        setTunnelStatus("Error: Local port is invalid.")
        toast.error("Local port is invalid.")
        return
      }
      if (!connInfo.remoteExpressPort || isNaN(Number(connInfo.remoteExpressPort))) {
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
      if (!connInfo.localJupyterPort || isNaN(Number(connInfo.localJupyterPort))) {
        setTunnelStatus("Error: Local Jupyter port is invalid.")
        toast.error("Local Jupyter port is invalid.")
        return
      }
      if (!connInfo.remoteJupyterPort || isNaN(Number(connInfo.remoteJupyterPort))) {
        setTunnelStatus("Error: Remote Jupyter port is invalid.")
        toast.error("Remote Jupyter port is invalid.")
        return
      }
      const result = await ipcRenderer.invoke('startSSHTunnel', connInfo)
      if (result && result.success) {
        setTunnelActive(true)
        setTunnelStatus("SSH tunnel established.")
        await ipcRenderer.invoke("setTunnelState", { ...connInfo, tunnelActive: true })
        tunnelContext.setTunnelInfo(await ipcRenderer.invoke("getTunnelState")) // Sync React context
        setReconnectAttempts(0)
        if (onConnect) onConnect()
        toast.success("SSH tunnel established.")
        setConnectionProcessing(false)

        // Ensure remote backend server is present and running
        try {
          setRemoteBackendStatus('Checking remote server...')
          const ensure = await ipcRenderer.invoke('ensureRemoteBackend', { port: Number(connInfo.remoteExpressPort) })
          if (ensure && ensure.success && ensure.status === 'running') {
            setRemoteBackendStatus(`Remote server running on port ${connInfo.remoteExpressPort}`)
            ensure.path && setRemoteBackendPath(ensure.path)
          } else if (ensure && ensure.status === 'not-found') {
            setRemoteBackendStatus('Remote server not found. Install or locate it.')
          } else {
            setRemoteBackendStatus(`Remote server not running (${ensure?.status || 'unknown'}). You can install or locate it.`)
          }
        } catch (e) {
          setRemoteBackendStatus('Failed to check/start remote server: ' + (e?.message || String(e)))
        }

        // Fetch home directory contents via IPC and update directoryContents and remoteDirPath
        try {
          setNavigationProcessing(true)
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
        } finally {
          setNavigationProcessing(false)
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

  // Removed unused MongoDB tunnel handler (no UI entry point)

  const handleDisconnect = async () => {
    setConnectionProcessing(true)
    setTunnelStatus("Disconnecting...")
    toast.info("Disconnecting SSH tunnel...")
    try {
      const result = await ipcRenderer.invoke('stopSSHTunnel')
      if (result && result.success) {
        setTunnelActive(false)
        setTunnelStatus("SSH tunnel disconnected.")
        tunnelContext.clearTunnelInfo()
        ipcRenderer.invoke("setRemoteWorkspacePath", null)
        ipcRenderer.invoke("clearTunnelState")
        toast.success("SSH tunnel disconnected.")
        setDirectoryContents([])
        setRemoteDirPath("")
        setWorkspace({
          hasBeenSet: false,
          workingDirectory: "",
          isRemote: false
        })
      } else {
        setTunnelStatus("Failed to disconnect tunnel: " + (result?.error || 'Unknown error'))
        toast.error("Disconnect Failed: " + result?.error || 'Unknown error')
      }
    } catch (err) {
      setTunnelStatus("Failed to disconnect tunnel: " + (err.message || err))
      toast.error("Disconnect Failed: ", err.message || String(err))
    } finally {
      setConnectionProcessing(false)
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

  const verifyGoTunnel = async () => {
    if (!tunnelActive) {
      toast.error('SSH tunnel is not active. Please connect first.')
      return
    }
  setGoVerifyLoading(true)
  setGoVerifyStatus('checking')
    try {
      await requestBackend(
        port,
        "/connection/connection_test_request",
        { data: "" },
        async (jsonResponse) => {
          console.log("GO Verify Response: ", jsonResponse)
          if (!jsonResponse.error) {
            setRegisterStatus("GO tunnel verified!")
            setGoVerifyStatus('ok')
            // Optionally store more detail if needed
            toast.success("GO tunnel is reachable.")
          } else {
            const msg = jsonResponse.error || 'Unknown error'
            setRegisterStatus("GO tunnel check failed: " + msg)
            setGoVerifyStatus('fail')
            // Optionally store more detail if needed
            toast.error(msg)
          }
          setGoVerifyLoading(false)
        },
        (err) => {
          const msg = err && err.message ? err.message : String(err)
          setRegisterStatus("GO tunnel check failed: " + msg)
          setGoVerifyStatus('fail')
          // Optionally store more detail if needed
          toast.error(msg)
          setGoVerifyLoading(false)
        }
      )
    } catch (e) {
      const msg = e && e.message ? e.message : String(e)
      setRegisterStatus("GO tunnel check failed: " + msg)
      setGoVerifyStatus('fail')
  // Optionally store more detail if needed
      toast.error(msg)
      setGoVerifyLoading(false)
    }
  }

  // DirectoryBrowser component
  const DirectoryBrowser = ({ directoryContents, onDirClick, navigationProcessing }) => {
    if (!directoryContents || directoryContents.length === 0) {
      return <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>No files or folders to display.</div>
    }
    return (
      <div style={{ position: 'relative', opacity: navigationProcessing ? 0.3 : 1 }}>
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
        {navigationProcessing && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2
          }}>
            <ProgressSpinner style={{ width: '40px', height: '40px' }} strokeWidth="4" />
          </div>
        )}
      </div>
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
    if (!localExpressPort || isNaN(Number(localExpressPort)) || Number(localExpressPort) < 1 || Number(localExpressPort) > 65535) {
      errors.localExpressPort = "Local Express port must be 1-65535."
    }
    if (!remoteExpressPort || isNaN(Number(remoteExpressPort)) || Number(remoteExpressPort) < 1 || Number(remoteExpressPort) > 65535) {
      errors.remoteExpressPort = "Remote Express port must be 1-65535."
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
  // Warn if localExpressPort matches the main server port
    if (String(localExpressPort) === String(port)) {
      warning = `Warning: Local Express port (${localExpressPort}) is the same as the main server port (${port}). This may cause conflicts if a local backend is running.`
    }
    setInputErrors(errors)
    setInputValid(Object.keys(errors).length === 0)
    setLocalPortWarning(warning)
  }, [host, username, remotePort, localExpressPort, remoteExpressPort, localDBPort, remoteDBPort, keyGenerated, publicKey, privateKey, port])

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
        <div className="title-header" > 
          <h2>SSH Tunnel Connection</h2>
          <Button style={{ padding: "0px", background: 'transparent' }} onClick={onClose}><IoMdClose style={{ fontSize: "18pt", color: 'var(--text-secondary)' }} /></Button>
        </div>
        <label>
          Remote Host:
          <InputText disabled={tunnelActive || connectionProcessing} value={host} onChange={e => setHost(e.target.value)} placeholder="e.g. example.com" style={{ marginLeft: "5px" }} />
          {inputErrors.host && <div style={{ color: 'var(--danger)', fontSize: 13 }}>{inputErrors.host}</div>}
        </label>
        <label>
          Username: 
          <InputText disabled={tunnelActive || connectionProcessing} value={username} onChange={e => setUsername(e.target.value)} placeholder="SSH username" style={{ marginLeft: "5px" }} />
          {inputErrors.username && <div style={{ color: 'var(--danger)', fontSize: 13 }}>{inputErrors.username}</div>}
        </label>
        <label>
          Password: 
          <Password disabled={tunnelActive || connectionProcessing} value={password} onChange={e => setPassword(e.target.value)} placeholder="SSH password" style={{ marginLeft: "5px" }} feedback={false} toggleMask />
        </label>
        <div style={{ marginBottom: 8 }}>
          <button
            type="button"
            onClick={() => setShowAdvanced(v => !v)}
            style={{
              color: 'var(--button-bg)',
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
              border: showAdvanced ? '1px solid var(--border-color)' : '1px solid transparent',
              borderRadius: 4,
              padding: showAdvanced ? 12 : 0,
              marginTop: showAdvanced ? 6 : 0,
              background: showAdvanced ? 'var(--bg-secondary)' : 'transparent',
            }}
            aria-hidden={!showAdvanced}
          >
            {showAdvanced && <>
            <div style={{ width: '100%'}}>
              <label>
                Remote SSH Port:
                <InputNumber disabled={tunnelActive || connectionProcessing} value={remotePort} onChange={e => setRemotePort(e.value)} placeholder="22" useGrouping={false} min={1} max={65535} />
                {inputErrors.remotePort && <div style={{ color: 'var(--danger)', fontSize: 13 }}>{inputErrors.remotePort}</div>}
              </label>
              <label>
                Local Express Port:
                <InputNumber disabled={tunnelActive || connectionProcessing} value={localExpressPort} onChange={e => setlocalExpressPort(e.value)} placeholder="54280" useGrouping={false} min={1} max={65535} />
                {inputErrors.localExpressPort && <div style={{ color: 'red', fontSize: 13 }}>{inputErrors.localExpressPort}</div>}
                {localPortWarning && <div style={{ color: 'var(--warning)', fontSize: 13, marginTop: 2 }}>{localPortWarning}</div>}
              </label>
              <label>
                Remote Express Port:
                <InputNumber disabled={tunnelActive || connectionProcessing} value={remoteExpressPort} onChange={e => setRemoteExpressPort(e.value)} placeholder="54288" useGrouping={false} min={1} max={65535} />
                {inputErrors.remoteExpressPort && <div style={{ color: 'var(--danger)', fontSize: 13 }}>{inputErrors.remoteExpressPort}</div>}
              </label>
            </div>
            <div style={{ width: '100%'}}>
              <label>
                Local MongoDB Port:
                <InputNumber disabled={tunnelActive || connectionProcessing} value={localDBPort} onChange={e => setLocalDBPort(e.value)} placeholder="54020" useGrouping={false} min={1} max={65535} />
              </label>
              <label>
                Remote MongoDB Port:
                <InputNumber disabled={tunnelActive || connectionProcessing} value={remoteDBPort} onChange={e => setRemoteDBPort(e.value)} placeholder="54017" useGrouping={false} min={1} max={65535} />
              </label>
              <label>
                SSH Key Comment:
                <InputText disabled={tunnelActive || connectionProcessing} className="ssh-key-command" value={keyComment} onChange={e => setKeyComment(e.target.value)} placeholder="medomicslab-app" />
              </label>
              <div style={{ marginTop: 8, fontWeight: 600 }}>GO Server (optional direct tunnel)</div>
              <label>
                Local GO Port:
                <InputNumber disabled={tunnelActive || connectionProcessing} value={localGoPort} onChange={e => setLocalGoPort(e.value)} placeholder="54380" useGrouping={false} min={1} max={65535} />
              </label>
              <label>
                Remote GO Port:
                <InputNumber disabled={tunnelActive || connectionProcessing} value={remoteGoPort} onChange={e => setRemoteGoPort(e.value)} placeholder="54388" useGrouping={false} min={1} max={65535} />
              </label>
            </div>
            </>}
          </div>
        </div>
        <Button onClick={handleGenerateKey} disabled={keyGenerated || tunnelActive || connectionProcessing} style={{ background: 'var(--button-bg)', color: 'var(--button-text)', opacity: keyGenerated ? 0.4 : 1 }}>
          {keyGenerated ? 'Key Generated' : 'Generate SSH Key'}
        </Button>
        {inputErrors.key && <div style={{ color: 'red', fontSize: 13, marginTop: 4 }}>{inputErrors.key}</div>}
        {keyGenerated && (
          <div>
            <strong>Public Key:</strong>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', background: 'var(--bg-tertiary)', marginTop: '10px', padding: '0.5em' }}>{publicKey}</pre>
            {registerStatus && <div style={{ marginTop: '0.5em', color: registerStatus.includes('success') ? 'var(--success)' : 'var(--danger)' }}>{registerStatus}</div>}
          </div>
        )}
        <div style={{ display: "flex", gap: "1rem", justifyContent: "flex-end" }}>
          <Button className="connect-btn" onClick={() => handleConnectBackend()} style={{ background: 'var(--button-bg)', color: 'var(--button-text)' }} disabled={!inputValid || tunnelActive || connectionProcessing}>Connect</Button>
          <Button className="disconnect-btn" onClick={handleDisconnect} disabled={!tunnelActive || connectionProcessing} style={{ background: "var(--danger)", color: "var(--button-text)" }}>Disconnect</Button>
        </div>
        {tunnelStatus && (
          <div>
            <div style={{ marginTop: '0.5em', color: tunnelStatus.includes('established') ? 'var(--success)' : tunnelStatus.includes('onnecting') ? 'var(--warning)' : 'var(--danger)' }}>
              { connectionProcessing && (<ProgressSpinner style={{width: '14px', height: '14px'}} strokeWidth="4" />)} {tunnelStatus}
            </div>
          </div>
        )}
        {/* Remote server (GO backend) status and actions */}
        <div style={{ border: '1px solid var(--border-color)', borderRadius: 4, padding: 12, background: 'var(--bg-secondary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0, fontSize: '1rem' }}>Remote Server</h3>
            <div style={{ fontSize: 13, color: remoteBackendStatus.includes('running') ? 'var(--success)' : remoteBackendStatus ? 'var(--warning)' : 'var(--text-muted)' }}>
              {remoteBackendStatus || 'Unknown'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
            <Button
              onClick={async () => {
                if (!tunnelActive) {
                  toast.error('SSH tunnel is not active. Connect first.')
                  return
                }
                try {
                  setRemoteBackendStatus('Checking remote server...')
                  const ensure = await ipcRenderer.invoke('ensureRemoteBackend', { port: Number(remoteExpressPort) })
                  if (ensure && ensure.success && ensure.status === 'running') {
                    setRemoteBackendStatus(`Remote server running on port ${remoteExpressPort}`)
                    ensure.path && setRemoteBackendPath(ensure.path)
                  } else if (ensure && ensure.status === 'not-found') {
                    setRemoteBackendStatus('Remote server not found. Install or locate it.')
                  } else {
                    setRemoteBackendStatus(`Remote server not running (${ensure?.status || 'unknown'}). You can install or locate it.`)
                  }
                } catch (e) {
                  setRemoteBackendStatus('Failed to check/start remote server: ' + (e?.message || String(e)))
                }
              }}
              disabled={!tunnelActive || connectionProcessing}
              style={{ background: 'var(--button-bg)', color: 'var(--button-text)' }}
              title="Detect and start remote server if present"
            >
              Ensure Remote Server
            </Button>
            <Button
              onClick={async () => {
                if (!tunnelActive) {
                  toast.error('SSH tunnel is not active. Connect first.')
                  return
                }
                try {
                  setRemoteBackendStatus('Installing remote server...')
                  const res = await ipcRenderer.invoke('installRemoteBackend')
                  if (res && res.success) {
                    setRemoteBackendPath(res.path)
                    toast.success('Remote server installed.')
                    const ensure = await ipcRenderer.invoke('ensureRemoteBackend', { port: Number(remoteExpressPort) })
                    if (ensure && ensure.success && ensure.status === 'running') {
                      setRemoteBackendStatus(`Remote server running on port ${remoteExpressPort}`)
                    } else {
                      setRemoteBackendStatus('Installed, but failed to start automatically. Try Ensure again.')
                    }
                  } else {
                    setRemoteBackendStatus('Install failed: ' + (res?.error || 'unknown error'))
                    toast.error('Failed to install remote server: ' + (res?.error || 'unknown error'))
                  }
                } catch (e) {
                  setRemoteBackendStatus('Install failed: ' + (e?.message || String(e)))
                }
              }}
              disabled={!tunnelActive || connectionProcessing}
              style={{ background: 'var(--button-bg)', color: 'var(--button-text)' }}
              title="Upload and install the server binary on the remote host"
            >
              Install on Remote
            </Button>
            <Button
              onClick={async () => {
                if (!tunnelActive) {
                  toast.error('SSH tunnel is not active. Connect first.')
                  return
                }
                const p = window.prompt('Enter full path to remote server executable:')
                if (!p) return
                setRemoteBackendPath(p)
                await ipcRenderer.invoke('setRemoteBackendPath', p)
                const res = await ipcRenderer.invoke('startRemoteBackendUsingPath', { path: p, port: Number(remoteExpressPort) })
                if (res && res.success) {
                  setRemoteBackendStatus('Attempted to start. Verifying...')
                  const ensure = await ipcRenderer.invoke('ensureRemoteBackend', { port: Number(remoteExpressPort) })
                  if (ensure && ensure.success && ensure.status === 'running') {
                    setRemoteBackendStatus(`Remote server running on port ${remoteExpressPort}`)
                  } else {
                    setRemoteBackendStatus('Failed to start with the provided path.')
                    toast.error('Failed to start remote server with provided path.')
                  }
                } else {
                  setRemoteBackendStatus('Failed to start: ' + (res?.error || 'unknown error'))
                }
              }}
              disabled={!tunnelActive || connectionProcessing}
              style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
              title="Manually provide the path on the remote host"
            >
              Locate manually...
            </Button>
          </div>
          {remoteBackendPath && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>Path: <span style={{ fontFamily: 'monospace' }}>{remoteBackendPath}</span></div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button onClick={verifyGoTunnel} disabled={!tunnelActive || goVerifyLoading} style={{ background: 'var(--button-bg)', color: 'var(--button-text)' }}>
            {goVerifyLoading ? 'Checking…' : 'Verify GO tunnel'}
          </Button>
          {goVerifyLoading && (
            <ProgressSpinner style={{ width: '18px', height: '18px' }} strokeWidth="6" />
          )}
          {goVerifyStatus !== 'idle' && !goVerifyLoading && (
            <Tag
              value={goVerifyStatus === 'ok' ? 'Verified' : 'Failed'}
              severity={goVerifyStatus === 'ok' ? 'success' : 'danger'}
              icon={goVerifyStatus === 'ok' ? 'pi pi-check' : 'pi pi-times'}
              rounded
            />
          )}
        </div>
        {/* Directory Browser Section */}
        <div style={{ marginTop: '2rem', borderTop: '1px solid #eee', paddingTop: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Remote Directory Browser</h3>
            <Button
              className="refresh-btn"
              disabled={!tunnelActive || navigationProcessing}
              onClick={async () => {
                try {
                  setNavigationProcessing(true)
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
                } finally {
                  setNavigationProcessing(false)
                }
              }}
              title="Refresh directory contents"
            >
              <IoIosRefresh style={{ height: '21px', width: '18px' }} />
            </Button>
            <Button
              className="new-folder-btn"
              onClick={() => {
                setNewFolderName("")
                setShowNewFolderModal(true)
              }}
              title="Create new folder"
              disabled={!tunnelActive || navigationProcessing}
            >
              <FaFolderPlus style={{ height: '21px', width: '18px' }} />
            </Button>
            <Button
              id="set-workspace-btn"
              className="set-workspace-btn"
              icon="folder-open"
              onClick={async () => {
                const tunnelState = getTunnelState()
                setConnectionProcessing(true)
                setNavigationProcessing(true)
                window.backend.requestExpress({ method: 'post', path: '/set-working-directory', host: tunnelState.host, port: tunnelState.localExpressPort, body: { workspacePath: remoteDirPath } })
                  .then((response) => {
                    if (response.data.success) {
                      toast.success("Workspace set successfully on remote app.")
                      if (response.data.workspace !== workspace) {
                        setWorkspace(response.data.workspace)
                      }
                      setConnectionProcessing(false)
                      setNavigationProcessing(false)
                    } else {
                      toast.error("Failed to set workspace on remote app: " + (response.data.error || "Unknown error"))
                      setConnectionProcessing(false)
                      setNavigationProcessing(false)
                    }
                  })
                  .catch((error) => {
                    toast.error("Error setting workspace on remote app: " + error)
                    setConnectionProcessing(false)
                    setNavigationProcessing(false)
                  })
              }}
              title="Set this directory as workspace on remote app"
              disabled={!tunnelActive || navigationProcessing || !remoteDirPath}
            >
              Set as Workspace
            </Button>
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 8, marginLeft: 2 }}>
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
              if (!tunnelActive || navigationProcessing) return
              setNavigationProcessing(true)
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
              } finally {
                setNavigationProcessing(false)
              }
            }
          }
          navigationProcessing={navigationProcessing}
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
                  setNavigationProcessing(true)
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
                    setNavigationProcessing(false)
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
            <InputText
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
              padding: 2px 4px;
              background: var(--bg-secondary) !important;
              color: var(--text-secondary) !important 
            }

            .refresh-btn:disabled {
              opacity: 0.5;
              cursor: default
            }

            .new-folder-btn {
              marginLeft: 8px;
              fontSize: 16px;
              padding: 2px 4px;
              background: var(--bg-secondary) !important;
              color: var(--text-secondary) !important 
            }

            .new-folder-btn:disabled {
              opacity: 0.5;
              cursor: default
            }

            #set-workspace-btn {
              marginLeft: 8px;
              fontSize: 16px;
              padding: 2px 8px;
              background: var(--button-bg) !important;
              color: var(--button-text) !important;
            }

            .set-workspace-btn:disabled {
              opacity: 0.5;
              color: var(--button-text) !important;
              cursor: default
            }

            .connect-btn:disabled {
              opacity: 0.5;
              cursor: default
            }

            .disconnect-btn:disabled {
              opacity: 0.5;
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

            .p-inputnumber input {
              width: 100px;
              margin-left: 8px;
              padding: 4px
            }

            .ssh-key-command {
              width: 50%;
              margin-left: 8px;
              padding: 4px
            }

            .title-header {
              display: flex;
              align-items: center;
              justify-content: space-between;
            }

            .p-progress-spinner-circle {
              stroke: var(--warning) !important;
            }
          `}
        </style>
    </Dialog>
  )
}

export default ConnectionModal
