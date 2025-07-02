import { useState, useEffect, useContext } from "react"
import { Dialog } from "primereact/dialog"
import { toast } from "react-toastify"
import { ipcRenderer } from "electron"
import { requestBackend } from "../../utilities/requests"
import { ServerConnectionContext } from "../serverConnection/connectionContext"
import { useTunnel } from "../tunnel/TunnelContext"
import { getTunnelState, setTunnelState, clearTunnelState } from "../../utilities/tunnelState"
import { Button } from "@blueprintjs/core"
/**
 *
 * @returns {JSX.Element} The connection modal used for establishing a connection to a remote server
 */
const ConnectionModal = ({ visible, closable, onClose, onConnect }) =>{
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

  

  // Validation state
  const [inputErrors, setInputErrors] = useState({})
  const [inputValid, setInputValid] = useState(false)
  const [localPortWarning, setLocalPortWarning] = useState("")

  const { port } = useContext(ServerConnectionContext) // we get the port for server connexion
  const tunnelContext = useTunnel()


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
      const result = await ipcRenderer.invoke('generate-ssh-key', { comment: keyComment, username })
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
        handleConnect(connectionInfo, true)
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
  const handleConnect = async (info, isReconnect = false) => {
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
      const result = await ipcRenderer.invoke('start-ssh-tunnel', connInfo)
      if (result && result.success) {
        setTunnelActive(true)
        setTunnelStatus("SSH tunnel established.")
        setTunnelState({ ...connInfo, tunnelActive: true })
        tunnelContext.setTunnelInfo(getTunnelState()) // Sync React context
        setReconnectAttempts(0)
        if (onConnect) onConnect()
        toast.success("SSH tunnel established.")
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

  const handleDisconnect = async () => {
    setTunnelStatus("Disconnecting...")
    toast.info("Disconnecting SSH tunnel...")
    try {
      const result = await ipcRenderer.invoke('stop-ssh-tunnel')
      if (result && result.success) {
        setTunnelActive(false)
        setTunnelStatus("SSH tunnel disconnected.")
        tunnelContext.clearTunnelInfo()
        clearTunnelState()
        toast.success("SSH tunnel disconnected.")
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
          const result = await ipcRenderer.invoke('get-ssh-key', { username })
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
        <label>
          Remote SSH Port:
          <input type="number" value={remotePort} onChange={e => setRemotePort(e.target.value)} placeholder="22" />
          {inputErrors.remotePort && <div style={{ color: 'red', fontSize: 13 }}>{inputErrors.remotePort}</div>}
        </label>
        <label>
          Local Backend Port:
          <input type="number" value={localBackendPort} onChange={e => setLocalBackendPort(e.target.value)} placeholder="8888" />
          {inputErrors.localBackendPort && <div style={{ color: 'red', fontSize: 13 }}>{inputErrors.localBackendPort}</div>}
          {localPortWarning && <div style={{ color: 'orange', fontSize: 13, marginTop: 2 }}>{localPortWarning}</div>}
        </label>
        <label>
          Remote Backend Port:
          <input type="number" value={remoteBackendPort} onChange={e => setRemoteBackendPort(e.target.value)} placeholder="8888" />
          {inputErrors.remoteBackendPort && <div style={{ color: 'red', fontSize: 13 }}>{inputErrors.remoteBackendPort}</div>}
        </label>
        <label>
          Local MongoDB Port:
          <input type="number" value={localDBPort} onChange={e => setLocalDBPort(e.target.value)} placeholder="54020" />
        </label>
        <label>
          Remote MongoDB Port:
          <input type="number" value={remoteDBPort} onChange={e => setRemoteDBPort(e.target.value)} placeholder="54017" />
        </label>
        <label>
          SSH Key Comment:
          <input type="text" value={keyComment} onChange={e => setKeyComment(e.target.value)} placeholder="medomicslab-app" />
        </label>
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
          <Button className="connect-btn" onClick={() => handleConnect()} style={{ background: "#007ad9", color: "white" }} disabled={!inputValid || tunnelActive}>Connect</Button>
          
          <button onClick={handleDisconnect} style={{ background: "#d9534f", color: "white" }}>Disconnect</button>
        </div>
        {tunnelStatus && (
          <div style={{ marginTop: '0.5em', color: tunnelStatus.includes('established') ? 'green' : tunnelStatus.includes('Reconnecting') ? 'orange' : 'red' }}>{tunnelStatus}</div>
        )}
        <Button onClick={sendTestRequest} style={{ background: "#d9534f", color: "white" }}>Send test request</Button>
      </div>
      <style>
          {`
            .connect-btn:disabled {
              opacity: 0.5
              color: #666
              cursor: default
            }
          `}
        </style>
    </Dialog>
  )
}

export default ConnectionModal
