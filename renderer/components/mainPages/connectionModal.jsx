import { useState, useEffect, useContext, useRef } from "react"
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
import { GoFile, GoFileDirectoryFill, GoChevronDown, GoChevronUp, GoChevronLeft, GoChevronRight } from "react-icons/go"
import { FaFolderPlus } from "react-icons/fa"
import { WorkspaceContext } from "../workspace/workspaceContext"
import { IoMdClose, IoIosRefresh } from "react-icons/io"
import RemoteServerPage from "./remoteServer"

/**
 *
 * @returns {JSX.Element} The connection modal used for establishing a connection to a remote server
 */
import { Steps } from 'primereact/steps'
import { ProgressBar } from 'primereact/progressbar'

// Minimal, opt-in debug logging for tunnel events/heartbeat
const DEBUG_TUNNEL = false

const ConnectionModal = ({ visible, closable, onClose, onConnect }) =>{
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [activeStep, setActiveStep] = useState(0) // 0=SSH, 1=Server Setup, 2=Workspace

  // Step 1: Optional advanced disclosure for SSH key details
  const [showSSHKeyAdvanced, setShowSSHKeyAdvanced] = useState(false)

  // Connection info form fields
  const [host, setHost] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [remotePort, setRemotePort] = useState("22")
  // Express ports (local forwarded port and remote Express port)
  const [localExpressPort, setLocalExpressPort] = useState("5001")
  const [remoteExpressPort, setRemoteExpressPort] = useState("5010")
  // GO ports (optional direct forwarding)
  const [localGoPort, setLocalGoPort] = useState("54380")
  const [remoteGoPort, setRemoteGoPort] = useState("54288")
  const [localDBPort, setLocalDBPort] = useState("54020")
  const [remoteDBPort, setRemoteDBPort] = useState("54017")
  const [localJupyterPort, setLocalJupyterPort] = useState("8890")
  const [remoteJupyterPort, setRemoteJupyterPort] = useState("8900")
  const [, setPrivateKey] = useState("")
  const [publicKey, setPublicKey] = useState("")
  // Commented out to fix linting problems: unused setter setKeyComment
  // const [keyComment, setKeyComment] = useState("medomicslab-app")
  const [keyComment] = useState("medomicslab-app")

  // Connection state
  const [keyGenerated, setKeyGenerated] = useState(false)
  const [registerStatus, setRegisterStatus] = useState("")
  const [tunnelStatus, setTunnelStatus] = useState("")
  const [remoteBackendStatus, setRemoteBackendStatus] = useState("")
  const [remoteBackendPath, setRemoteBackendPath] = useState("")
  const [remoteBackendVersion, setRemoteBackendVersion] = useState("")
  const [latestRemoteVersionTag, setLatestRemoteVersionTag] = useState("")
  const [latestRemoteVersionAvailable, setLatestRemoteVersionAvailable] = useState(false)
  const [latestRemoteVersionChecked, setLatestRemoteVersionChecked] = useState(false)
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
    // GO probe info hint for Verify button
  const [goProbeInfo, setGoProbeInfo] = useState(null)

  // Step 2: Remote server setup state
  const [remoteInstalled, setRemoteInstalled] = useState(false)
  const [installingRemote, setInstallingRemote] = useState(false)
  const [remoteInstallText, setRemoteInstallText] = useState('')
  const [remoteStartPort, setRemoteStartPort] = useState('5010')
  const [remoteServerRunning, setRemoteServerRunning] = useState(false)
  const [lastStartAt, setLastStartAt] = useState(null)
  const heartbeatBusyRef = useRef(false)
  const [shouldRecheck, setShouldRecheck] = useState(false)
  // Step 2 action busy states (used to disable buttons until the async action fully exits)
  const [checkingRemoteServerBusy, setCheckingRemoteServerBusy] = useState(false)
  const [startingRemoteServerBusy, setStartingRemoteServerBusy] = useState(false)
  const [checkingRemotePortBusy, setCheckingRemotePortBusy] = useState(false)
  const [requirementsChecking, setRequirementsChecking] = useState(false)
  const [requirementsMetRemote, setRequirementsMetRemote] = useState(false)
  const [requirementsInstalling, setRequirementsInstalling] = useState(false)
  const [requirementsDetailsRemote, setRequirementsDetailsRemote] = useState({ pythonInstalled: false, mongoInstalled: false })
  // Debug: last start attempt details
  const [lastStartDetails, setLastStartDetails] = useState('')
  // Remote install progress
  const [remoteInstallPhase, setRemoteInstallPhase] = useState('')
  const [remoteDownloadPercent, setRemoteDownloadPercent] = useState(null)
  const [remoteDownloadSpeed, setRemoteDownloadSpeed] = useState(null)
  // Commented out state variable to fix linting problems: remoteInstallEvents not directly used
  // const [remoteInstallEvents, setRemoteInstallEvents] = useState([])
  const [, setRemoteInstallEvents] = useState([])

  // Validation state
  const [inputErrors, setInputErrors] = useState({})
  const [inputValid, setInputValid] = useState(false)
  const [localPortWarning, setLocalPortWarning] = useState("")

  const { port } = useContext(ServerConnectionContext) // we get the port for server connexion
  const tunnelContext = useTunnel()

  // Directory browser state
  const [directoryContents, setDirectoryContents] = useState([])
  const [remoteDirPath, setRemoteDirPath] = useState("")

  // Prevent overlapping local port rebind operations while the user is editing
  const localPortRebindBusyRef = useRef({ go: false, mongo: false })

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

  const ensureSSHKey = async (usernameToUse) => {
    const uname = String(usernameToUse || username || '').trim()
    if (!uname) throw new Error('Username is required to generate an SSH key.')

    // 1) Try to load an existing key from the main process (if supported)
    try {
      const existing = await ipcRenderer.invoke('getSSHKey', { username: uname })
      if (existing && existing.publicKey && existing.privateKey) {
        setPublicKey(existing.publicKey)
        setPrivateKey(existing.privateKey)
        setKeyGenerated(true)
        return existing
      }
    } catch (e) {
      // If handler isn't implemented or lookup fails, fall back to generation.
      console.warn('getSSHKey failed; will attempt to generate:', e && e.message ? e.message : e)
    }

    // 2) Generate a new key
    const created = await ipcRenderer.invoke('generateSSHKey', { comment: keyComment, username: uname })
    if (created && created.publicKey && created.privateKey) {
      setPublicKey(created.publicKey)
      setPrivateKey(created.privateKey)
      setKeyGenerated(true)
      return created
    }
    throw new Error(created?.error || 'SSH key generation failed.')
  }

  // Tunnel error handler and auto-reconnect
  useEffect(() => {
    if (!tunnelActive && reconnectAttempts > 0 && reconnectAttempts <= maxReconnectAttempts && connectionInfo) {
      setTunnelStatus(`Reconnecting... (attempt ${reconnectAttempts} of ${maxReconnectAttempts})`)
      toast.warn(`Attempt ${reconnectAttempts} of ${maxReconnectAttempts} to reconnect SSH tunnel.`)
      const timer = setTimeout(() => {
        handleConnectSSH(connectionInfo, true)
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

  // On modal open, check for existing tunnel and sync state, and reset wizard
  useEffect(() => {
    if (visible) {
      setActiveStep(0)
      setShowSSHKeyAdvanced(false)
      setRemoteInstalled(false)
      setInstallingRemote(false)
      setRemoteInstallText('')
      setRemoteServerRunning(false)
      setRequirementsMetRemote(false)
      setRequirementsChecking(false)
      setRequirementsInstalling(false)
      setRemoteInstallPhase('')
      setRemoteDownloadPercent(null)
      setRemoteDownloadSpeed(null)
      setRemoteInstallEvents([])
      setRemoteBackendVersion("")
      setLatestRemoteVersionTag("")
      setLatestRemoteVersionAvailable(false)
      setLatestRemoteVersionChecked(false)
      const tunnel = getTunnelState()
      if (tunnel.tunnelActive) {
        setTunnelActive(true)
        setHost(tunnel.host || "")
        setUsername(tunnel.username || "")
        setRemotePort(tunnel.remotePort || "22")
        setLocalExpressPort(tunnel.localExpressPort || "5001")
        setRemoteExpressPort(tunnel.remoteExpressPort || "5010")
        setLocalGoPort(tunnel.localGoPort || "54380")
        setRemoteGoPort(tunnel.remoteGoPort || "54288")
        setLocalDBPort(tunnel.localDBPort || "54020")
        setTunnelStatus("SSH tunnel is already established.")
        setActiveStep(1)
        tunnelContext.setTunnelInfo(tunnel) // Sync React context
      }
    }
  }, [visible])

  // Subscribe to remote install progress events
  useEffect(() => {
    const handler = (_event, payload) => {
      try {
        if (!payload || typeof payload !== 'object') return
        if (payload.phase) {
          setRemoteInstallPhase(payload.phase)
          // Provide user-friendly, contextual text for each phase
          switch (payload.phase) {
            case 'github-fetch-releases':
              setRemoteInstallText('Fetching releases from GitHub…')
              break
            case 'github-pick-release':
              setRemoteInstallText(`Picking release ${payload.tag || payload.name || ''}…`)
              break
            case 'github-select-asset':
              // Surface the selected asset name for clarity
              setRemoteInstallText(`Selected asset: ${payload.asset || 'unknown'} (preparing download)`) 
              break
            case 'prepare-dirs':
              setRemoteInstallText('Preparing directories on remote…')
              break
            case 'download-start':
              setRemoteInstallText('Downloading server asset…')
              break
            case 'download-progress':
              setRemoteInstallText('Downloading…')
              break
            case 'download-complete':
              setRemoteInstallText('Download complete. Verifying…')
              break
            case 'verify-start':
              setRemoteInstallText('Verifying checksum…')
              break
            case 'verify-complete':
              setRemoteInstallText('Verification complete. Extracting…')
              break
            case 'extract-start':
              setRemoteInstallText('Extracting files…')
              break
            case 'extract-complete':
              setRemoteInstallText('Extraction complete. Locating executable…')
              break
            case 'locate-exe':
              setRemoteInstallText('Locating backend executable…')
              break
            case 'done':
              setRemoteInstallText('Installation completed successfully.')
              break
            case 'error':
              setRemoteInstallText('Install failed')
              break
            default:
              // Generic fallback
              setRemoteInstallText(`Phase: ${payload.phase}`)
          }
        }
        if (typeof payload.percent === 'number') setRemoteDownloadPercent(payload.percent)
        if (typeof payload.speed === 'number') setRemoteDownloadSpeed(payload.speed)
        setRemoteInstallEvents(prev => [...prev.slice(-50), payload])
        if (payload.phase === 'done') {
          // Reset spinners once installation finishes
          setInstallingRemote(false)
          setRemoteInstallText('Installation completed successfully.')
          setRemoteInstallPhase('')
          setRemoteDownloadPercent(null)
          setRemoteDownloadSpeed(null)
        } else if (payload.phase === 'error') {
          // Clear progress state on any error
          setInstallingRemote(false)
          setRemoteInstallText('Install failed')
          setRemoteInstallPhase('')
          setRemoteDownloadPercent(null)
          setRemoteDownloadSpeed(null)
          toast.error(`Remote install error${payload.step ? ` at ${payload.step}` : ''}: ${payload.details || ''}`)
        }
      } catch (e) { /* ignore */ }
    }
    ipcRenderer.on('remoteBackendInstallProgress', handler)
    return () => {
      try { 
        ipcRenderer.removeListener('remoteBackendInstallProgress', handler)
        console.log('Removed remoteBackendInstallProgress listener')
       } catch (e) { /* ignore */ }
    }
  }, [])

  // Subscribe to tunnel state changes from main process and auto-sync UI/context
  useEffect(() => {
    const handler = async () => {
      try {
        // Always fetch the authoritative full tunnel state to avoid partial payload issues
        const state = await ipcRenderer.invoke('getTunnelState')
        if (!state) return
        // Basic tunnel status
        setTunnelActive(!!state.tunnelActive)
        // Sync commonly used ports if present
        if (state.localExpressPort !== undefined) setLocalExpressPort(String(state.localExpressPort))
        if (state.remoteExpressPort !== undefined) setRemoteExpressPort(String(state.remoteExpressPort))
        if (state.localGoPort !== undefined) setLocalGoPort(String(state.localGoPort))
        if (state.remoteGoPort !== undefined) setRemoteGoPort(String(state.remoteGoPort))
        if (state.localDBPort !== undefined) setLocalDBPort(String(state.localDBPort))
        if (state.remoteDBPort !== undefined) setRemoteDBPort(String(state.remoteDBPort))
        if (state.localJupyterPort !== undefined) setLocalJupyterPort(String(state.localJupyterPort))
        if (state.remoteJupyterPort !== undefined) setRemoteJupyterPort(String(state.remoteJupyterPort))
        // Reflect express server running state: treat 'running' or 'forwarding' as running
        if (state.expressStatus) {
          const s = String(state.expressStatus).toLowerCase()
          setRemoteServerRunning(s === 'running' || s === 'forwarding')
        }
        if (DEBUG_TUNNEL) {
          try {
            console.debug('[ConnectionModal] tunnel event', {
              expressStatus: state.expressStatus,
              tunnelActive: !!state.tunnelActive,
              localExpressPort: state.localExpressPort,
              remoteExpressPort: state.remoteExpressPort,
              runningNext: state.expressStatus === 'running'
            })
          } catch (_) { /* ignore logging errors */ }
        }
        // Keep React context in sync for other panels
        try { tunnelContext.setTunnelInfo(state) } catch (_) { /* ignore */ }
      } catch (_) { /* ignore */ }
    }
    try {
      ipcRenderer.on('tunnelStateChanged', handler)
      ipcRenderer.on('tunnelStateUpdate', handler)
    } catch (_) { /* ignore */ }
    return () => {
      try {
        ipcRenderer.removeListener('tunnelStateChanged', handler)
        ipcRenderer.removeListener('tunnelStateUpdate', handler)
      } catch (_) { /* ignore */ }
    }
  }, [])

  // Rebind local forwarded ports (GO/Mongo) while the tunnel is active.
  // This keeps the same remote port but moves the local listening port.
  useEffect(() => {
    if (!tunnelActive) return
    const desiredLocalPort = Number(localGoPort)
    if (!Number.isFinite(desiredLocalPort) || desiredLocalPort < 1 || desiredLocalPort > 65535) return

    const timer = setTimeout(async () => {
      if (localPortRebindBusyRef.current.go) return
      localPortRebindBusyRef.current.go = true
      try {
        const state = await ipcRenderer.invoke('getTunnelState')
        const tunnels = Array.isArray(state?.tunnels) ? state.tunnels : []
        const entry = tunnels.find(t => t && t.name === 'go')
        const currentLocal = Number(entry?.localPort ?? state?.localGoPort)
        const remotePort = Number(entry?.remotePort ?? state?.remoteGoPort ?? remoteGoPort)
        if (!remotePort || Number.isNaN(remotePort)) return
        if (currentLocal && currentLocal === desiredLocalPort) return

        const res = await ipcRenderer.invoke('rebindPortTunnel', { name: 'go', newLocalPort: desiredLocalPort, newRemotePort: remotePort })
        if (!res?.success) {
          console.warn('Failed to rebind GO forward local port:', res?.error || res)
        }
      } catch (e) {
        console.warn('Failed to rebind GO forward local port:', e && e.message ? e.message : String(e))
      } finally {
        localPortRebindBusyRef.current.go = false
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [localGoPort, remoteGoPort, tunnelActive])

  useEffect(() => {
    if (!tunnelActive) return
    const desiredLocalPort = Number(localDBPort)
    if (!Number.isFinite(desiredLocalPort) || desiredLocalPort < 1 || desiredLocalPort > 65535) return

    const timer = setTimeout(async () => {
      if (localPortRebindBusyRef.current.mongo) return
      localPortRebindBusyRef.current.mongo = true
      try {
        const state = await ipcRenderer.invoke('getTunnelState')
        const tunnels = Array.isArray(state?.tunnels) ? state.tunnels : []
        const entry = tunnels.find(t => t && t.name === 'mongo')
        const currentLocal = Number(entry?.localPort ?? state?.localDBPort)
        const remotePort = Number(entry?.remotePort ?? state?.remoteDBPort ?? remoteDBPort)
        if (!remotePort || Number.isNaN(remotePort)) return
        if (currentLocal && currentLocal === desiredLocalPort) return

        const res = await ipcRenderer.invoke('rebindPortTunnel', { name: 'mongo', newLocalPort: desiredLocalPort, newRemotePort: remotePort })
        if (!res?.success) {
          console.warn('Failed to rebind Mongo forward local port:', res?.error || res)
        }
      } catch (e) {
        console.warn('Failed to rebind Mongo forward local port:', e && e.message ? e.message : String(e))
      } finally {
        localPortRebindBusyRef.current.mongo = false
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [localDBPort, remoteDBPort, tunnelActive])

  // Step 1: Only establish SSH tunnel/auth to remote host
  const handleConnectSSH = async (info, isReconnect = false) => {
    setConnectionProcessing(true)
    setTunnelStatus(isReconnect ? "Reconnecting..." : "Connecting...")
    toast.info(isReconnect ? "Reconnecting SSH tunnel..." : "Establishing SSH tunnel...")
    const baseInfo = info || { host, username, password, remotePort, localExpressPort, remoteExpressPort, localGoPort, remoteGoPort, localDBPort, remoteDBPort, localJupyterPort, remoteJupyterPort }
    // --- Host validation ---
    const hostPattern = /^(?!-)[A-Za-z0-9-]{1,63}(?<!-)\.?([A-Za-z0-9-]{1,63}\.?)*[A-Za-z]{2,6}$|^(\d{1,3}\.){3}\d{1,3}$/
    if (!baseInfo.host || baseInfo.host.trim() === "") {
      setTunnelStatus("Error: Remote host is required.")
      toast.error("Remote host is required.")
      setConnectionProcessing(false)
      return
    }
    if (!hostPattern.test(baseInfo.host.trim())) {
      setTunnelStatus("Error: Invalid remote host. Please enter a valid hostname or IP address.")
      toast.error("Invalid remote host. Please enter a valid hostname or IP address.")
      setConnectionProcessing(false)
      return
    }

    // Ensure an SSH key exists (load if present, generate otherwise)
    let keyResult
    try {
      keyResult = await ensureSSHKey(baseInfo.username)
    } catch (e) {
      const msg = e?.message || String(e)
      setTunnelStatus('Failed to prepare SSH key: ' + msg)
      toast.error('Failed to prepare SSH key: ' + msg)
      setConnectionProcessing(false)
      return
    }

    const connInfo = { ...baseInfo, privateKey: keyResult?.privateKey || '' }
    setConnectionInfo(connInfo)
    try {
      if (!connInfo.host) {
        setTunnelStatus("Error: Remote host is required.")
        toast.error("Remote host is required.")
        setConnectionProcessing(false)
        return
      }
      if (!connInfo.username) {
        setTunnelStatus("Error: Username is required.")
        toast.error("Username is required.")
        setConnectionProcessing(false)
        return
      }
      if (!connInfo.privateKey) {
        setTunnelStatus("Error: SSH private key is missing and could not be generated.")
        toast.error("SSH private key is missing and could not be generated.")
        setConnectionProcessing(false)
        return
      }
      if (!connInfo.remotePort || isNaN(Number(connInfo.remotePort))) {
        setTunnelStatus("Error: Remote SSH port is invalid.")
        toast.error("Remote SSH port is invalid.")
        setConnectionProcessing(false)
        return
      }
      if (!connInfo.localExpressPort || isNaN(Number(connInfo.localExpressPort))) {
        setTunnelStatus("Error: Local port is invalid.")
        toast.error("Local port is invalid.")
        setConnectionProcessing(false)
        return
      }
      if (!connInfo.remoteExpressPort || isNaN(Number(connInfo.remoteExpressPort))) {
        setTunnelStatus("Error: Remote backend port is invalid.")
        toast.error("Remote backend port is invalid.")
        setConnectionProcessing(false)
        return
      }
      if (!connInfo.localDBPort || isNaN(Number(connInfo.localDBPort))) {
        setTunnelStatus("Error: Local MongoDB port is invalid.")
        toast.error("Local MongoDB port is invalid.")
        setConnectionProcessing(false)
        return
      }
      if (!connInfo.remoteDBPort || isNaN(Number(connInfo.remoteDBPort))) {
        setTunnelStatus("Error: Remote MongoDB port is invalid.")
        toast.error("Remote MongoDB port is invalid.")
        setConnectionProcessing(false)
        return
      }
      if (!connInfo.localJupyterPort || isNaN(Number(connInfo.localJupyterPort))) {
        setTunnelStatus("Error: Local Jupyter port is invalid.")
        toast.error("Local Jupyter port is invalid.")
        setConnectionProcessing(false)
        return
      }
      if (!connInfo.remoteJupyterPort || isNaN(Number(connInfo.remoteJupyterPort))) {
        setTunnelStatus("Error: Remote Jupyter port is invalid.")
        toast.error("Remote Jupyter port is invalid.")
        setConnectionProcessing(false)
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
        // Move to step 2 (Server Setup)
        setActiveStep(1)
      } else if (result && result.error) {
        setTunnelStatus("Failed to establish SSH tunnel: " + result.error)
        setTunnelActive(false)
        setReconnectAttempts((prev) => prev + 1)
        toast.error("Tunnel failed: " + result.error)
        setConnectionProcessing(false)
      } else {
        setTunnelStatus("Failed to establish SSH tunnel: Unknown error.")
        setTunnelActive(false)
        setReconnectAttempts((prev) => prev + 1)
        toast.error("Tunnel Failed, Unknown error.")
        setConnectionProcessing(false)
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
      setConnectionProcessing(false)
    }
  }


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
        setActiveStep(0)
        setRemoteInstalled(false)
        setRemoteServerRunning(false)
        setRequirementsMetRemote(false)
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

  // Step 2 helpers
  const checkRemoteServer = async () => {
    if (!tunnelActive) {
      toast.error('SSH tunnel is not active. Connect first.')
      return
    }
    try {
      setCheckingRemoteServerBusy(true)
      setRemoteBackendStatus('Checking remote server...')
      // First, check installation presence on remote
      const presence = await ipcRenderer.invoke('backendPresence', { target: 'remote' })
      let installed = !!(presence && presence.success && presence.installed)
      // Fallback: explicitly check default install directory via SFTP listing
      if (!installed) {
        try {
          // Use relative path to home; remoteFunctions normalizePath defaults '.' to HOME
          const listRes = await ipcRenderer.invoke('navigateRemoteDirectory', { action: 'list', path: '.medomics/medomics-server/versions' })
          if (listRes && Array.isArray(listRes.contents) && listRes.contents.length > 0) {
            installed = true
          }
        } catch(e) { console.log('Fallback remote presence check failed:', e) }
      }
      // Attempt to locate the executable to keep path in sync and as a last resort confirm presence
      try {
        const locate = await ipcRenderer.invoke('locateRemoteBackendExecutable')
        if (locate && locate.success && locate.path) {
          setRemoteBackendPath(locate.path)
          // If we couldn't confirm installation earlier but we found a path, consider it installed
          if (!installed) installed = true
        }
      } catch (e) {
        console.warn('Locate remote backend executable failed:', e)
      }
      setRemoteInstalled(installed)

      // Then, read snapshot/status (may include a last-known port from state file)
      const status = await ipcRenderer.invoke('backendStatus', { target: 'remote' })
      console.log('Remote backend status:', status)
      const expressPort = status && (status.expressPort || status.state?.expressPort)
      if (typeof expressPort === 'number') {
        setRemoteExpressPort(String(expressPort))
      }
      const goPort = status && (status.go?.port || status.state?.goPort)
      if (typeof goPort === 'number') {
        setRemoteGoPort(String(goPort))
        console.log('Starting GO forward on port', goPort, 'to local port', localGoPort)
        ipcRenderer.invoke('startPortTunnel', { name: 'go', localPort: Number(localGoPort), remotePort: Number(goPort) })
        // Auto-rebind if current tunnel targets a different remote port
        const currentGo = Number(remoteGoPort)
        if (currentGo && goPort !== currentGo) {
          await ipcRenderer.invoke('rebindPortTunnel', { name: 'go', newRemotePort: Number(goPort) })
        }
      }

      const mongoPort = status && (status.mongo?.port || status.state?.dbPort || status.state?.mongoPort)
      if (typeof mongoPort === 'number') {
        setRemoteDBPort(String(mongoPort))
        const currentMongo = Number(remoteDBPort)
        if (currentMongo && mongoPort !== currentMongo) {
          await ipcRenderer.invoke('rebindPortTunnel', { name: 'mongo', newRemotePort: Number(mongoPort) })
        }
      }

      const jupPort = status && (status.jupyter?.port || status.state?.jupyterPort)
      if (typeof jupPort === 'number') {
        setRemoteJupyterPort(String(jupPort))
        const currentJup = Number(remoteJupyterPort)
        if (currentJup && jupPort !== currentJup) {
          await ipcRenderer.invoke('rebindPortTunnel', { name: 'jupyter', newRemotePort: Number(jupPort) })
        }
      }

      // If a different remote port was discovered, automatically rebind the forward using generic API
      try {
        const discovered = typeof status?.discoveredRemotePort === 'number' ? status.discoveredRemotePort : (typeof expressPort === 'number' ? expressPort : null)
        const currentRemote = Number(remoteExpressPort)
        if (discovered && currentRemote && discovered !== currentRemote) {
          const reb = await ipcRenderer.invoke('rebindPortTunnel', { name: 'express', newRemotePort: Number(discovered) })
          if (reb && reb.success) {
            setRemoteExpressPort(String(discovered))
            try { tunnelContext.setTunnelInfo(await ipcRenderer.invoke('getTunnelState')) } catch(e) { console.warn('Post-rebind context sync failed:', e) }
            toast.success(`Rebound Express forward to remote port ${discovered}.`)
            // After rebind, try a quick status confirm
            try {
              const ts = await ipcRenderer.invoke('getTunnelState')
              const fwd = ts?.localExpressPort || Number(localExpressPort)
              if (fwd) {
                const resp = await window.backend.requestExpress({ method: 'get', path: '/status', host: '127.0.0.1', port: Number(fwd), timeout: 3000 })
                if (resp?.data?.success) {
                  setRemoteBackendStatus(`Express server confirmed via /status on port ${discovered}`)
                  setRemoteServerRunning(true)
                }
              }
            } catch(e) { console.warn('Post-rebind /status confirm failed:', e) }
          } else {
            toast.error(`Failed to rebind forward: ${reb?.error || 'Unknown error'}`)
          }
        }
      } catch { /* non-fatal */ }

      // If installation could not be confirmed, stop immediately without probing /status
      if (!installed) {
        setRemoteBackendStatus('Remote server not found. Install it to continue.')
        setRemoteServerRunning(false)
        setShouldRecheck(false)
        return
      }

      // If backendStatus already returned a valid snapshot, use it directly
      if (status && status.success) {
        const data = status
        const expressStatus = 'running'
        if (typeof data.expressPort === 'number') {
          setRemoteExpressPort(String(data.expressPort))
        }
        await ipcRenderer.invoke('setTunnelState', {
          expressStatus,
          serverStartedRemotely: false
        })
        try {
          tunnelContext.setTunnelInfo(await ipcRenderer.invoke("getTunnelState"))
        } catch(e) { /* non-fatal context sync */ }
        setRemoteBackendStatus(`Express server confirmed via /status${data.expressPort ? ' on port ' + data.expressPort : ''}`)
        setRemoteServerRunning(true)
        setShouldRecheck(true)
        return
      }

      // Confirm it's our Express server by hitting forwarded /status and update tunnel panel
      try {
        const ts = await ipcRenderer.invoke('getTunnelState')
        const fwd = ts?.localExpressPort || Number(localExpressPort)
        const resp = fwd ? await window.backend.requestExpress({ method: 'get', path: '/status', host: '127.0.0.1', port: Number(fwd), timeout: 4000 }) : null
        const data = resp?.data || {}
        if (data && data.success) {
          // Normalize statuses
          const expressStatus = 'running'
          // Sync express port from server snapshot if provided
          if (typeof data.expressPort === 'number') {
            setRemoteExpressPort(String(data.expressPort))
          }
          // Update the Remote Server tab state
          await ipcRenderer.invoke('setTunnelState', {
            expressStatus,
            // We didn’t start it here, just confirming
            serverStartedRemotely: false
          })
          try {
            tunnelContext.setTunnelInfo(await ipcRenderer.invoke("getTunnelState"))
          } catch(e) { /* non-fatal context sync */ }
          setRemoteBackendStatus(`Express server confirmed via /status${data.expressPort ? ' on port ' + data.expressPort : ''}`)
          setRemoteServerRunning(true)
          setShouldRecheck(true)
          return
        }
      } catch (confirmErr) {
        console.warn('Confirm /status failed:', confirmErr && confirmErr.message ? confirmErr.message : confirmErr)
      }

      // If confirmation failed, report based on installation/presence without claiming reachability
      if (installed) {
        // Grace period after a recent start: avoid flipping running=false on transient timeouts
        const withinGrace = lastStartAt && (Date.now() - lastStartAt < 20000)
        setRemoteBackendStatus(withinGrace ? 'Server starting up; will recheck shortly.' : 'Remote server installed but unreachable.')
        if (!withinGrace) setRemoteServerRunning(false)
        setShouldRecheck(true)
      } else {
        setRemoteBackendStatus('Remote server not found. Install or locate it.')
        setRemoteServerRunning(false)
        setShouldRecheck(false)
      }
    } catch (e) {
      setRemoteBackendStatus('Failed to check remote server: ' + (e?.message || String(e)))
    } finally {
      setCheckingRemoteServerBusy(false)
    }
  }

  // Derive a human-readable version string from the remote backend executable path
  useEffect(() => {
    if (!remoteBackendPath) {
      setRemoteBackendVersion("")
      return
    }
    try {
      const normalized = remoteBackendPath.replace(/\\/g, "/")
      const segments = normalized.split("/").filter(Boolean)
      if (!segments.length) {
        setRemoteBackendVersion("")
        return
      }

      let versionSegment = null

      // Prefer the directory immediately under a "versions" folder, if present
      const versionsIdx = segments.lastIndexOf("versions")
      if (versionsIdx >= 0 && versionsIdx < segments.length - 1) {
        versionSegment = segments[versionsIdx + 1]
      } else {
        // Fallbacks: directory before "bin", or parent directory
        const binIdx = segments.lastIndexOf("bin")
        if (binIdx > 0) {
          versionSegment = segments[binIdx - 1]
        } else if (segments.length >= 2) {
          versionSegment = segments[segments.length - 2]
        } else {
          versionSegment = segments[segments.length - 1]
        }
      }

      if (!versionSegment) {
        setRemoteBackendVersion("")
        return
      }

      // Clean up common prefix like "server-" or "server_" for display
      const cleaned = versionSegment.replace(/^server[-_]?/i, "")
      setRemoteBackendVersion(cleaned || versionSegment)
    } catch {
      setRemoteBackendVersion("")
    }
  }, [remoteBackendPath])

  // Check GitHub releases to see if a newer backend version is available on the remote
  const checkForNewRemoteBackendVersion = async () => {
    try {
      const latest = await ipcRenderer.invoke('getLatestBackendReleaseInfo')
      console.log('Latest backend release info:', latest)
      const rawTag = latest && (latest.tag || latest.tag_name || latest.name)
      const tag = rawTag ? String(rawTag).trim() : ''
      if (!tag) {
        setLatestRemoteVersionTag("")
        setLatestRemoteVersionAvailable(false)
        setLatestRemoteVersionChecked(true)
        return { tag: '', alreadyInstalled: false }
      }

      let alreadyInstalled = false
      try {
        const listRes = await ipcRenderer.invoke('navigateRemoteDirectory', { action: 'list', path: '.medomics/medomics-server/versions' })
        const names = Array.isArray(listRes?.contents) ? listRes.contents.map(c => c?.name).filter(Boolean) : []
        // common release folder naming patterns: vX.Y.Z or X.Y.Z
        const candidates = [tag, tag.startsWith('v') ? tag.slice(1) : `v${tag}`]
        alreadyInstalled = candidates.some(t => names.includes(t))
        console.log('Release candidates vs remote versions:', { tag, candidates, names, alreadyInstalled })
      } catch (e) {
        console.log('Remote versions directory listing failed for latest release check:', e)
      }

      setLatestRemoteVersionTag(tag)
      setLatestRemoteVersionAvailable(!alreadyInstalled)
      setLatestRemoteVersionChecked(true)
      return { tag, alreadyInstalled }
    } catch (e) {
      console.warn('Latest backend release check failed:', e && e.message ? e.message : e)
      setLatestRemoteVersionChecked(true)
      return { tag: '', alreadyInstalled: false, error: e }
    }
  }

  // TODO: Replace with the GitHub Releases manifest asset URL for MEDomics Server, e.g.
  // https://github.com/MEDomicsLab/MEDomics/releases/latest/download/manifest.json
  // or pin to a specific version: https://github.com/MEDomicsLab/MEDomics/releases/download/vX.Y.Z/manifest.json
  // Manifest is optional now; remote installer can use GitHub Releases when no manifest is provided.
  const DEFAULT_REMOTE_MANIFEST = ''
  const installRemoteServer = async () => {
    if (!tunnelActive) {
      toast.error('SSH tunnel is not active. Connect first.')
      return
    }
    try {
      setInstallingRemote(true)
      // Keep the UI disabled immediately on click (pre-check can take time)
      setRemoteInstallText('Preparing install...')
      // Pre-check: if latest release tag already exists on remote, skip install
      try {
        const { tag, alreadyInstalled } = await checkForNewRemoteBackendVersion()
        if (tag && alreadyInstalled) {
          toast.success(`Latest backend (${tag}) already installed. Skipping re-install.`)
          setRemoteInstalled(true)
          // Optionally locate executable to update path
          try {
            const locate = await ipcRenderer.invoke('locateRemoteBackendExecutable')
            if (locate && locate.success && locate.path) {
              setRemoteBackendPath(locate.path)
            }
          } catch { /* ignore */ }
          // Trigger a status recheck for UI freshness
          setShouldRecheck(true)
          await checkRemoteServer()
          return
        }
      } catch { /* non-fatal; proceed with normal install */ }

      setRemoteInstallText('Installing remote server...')
      const payload = {}
      if (DEFAULT_REMOTE_MANIFEST) payload.manifestUrl = DEFAULT_REMOTE_MANIFEST
      const res = await ipcRenderer.invoke('installRemoteBackendFromURL', payload)
      if (res && res.success) {
        setRemoteBackendPath(res.path)
        toast.success('Remote server installed.')
        setRemoteInstalled(true)
        // Refresh latest-release availability state so the UI can disable Update when up-to-date
        try { await checkForNewRemoteBackendVersion() } catch { /* non-fatal */ }
        // Hint the UI to recheck status right after a successful install
        setShouldRecheck(true)
        // After install, run a status check
        await checkRemoteServer()
      } else {
        toast.error('Failed to install remote server: ' + (res?.error || 'unknown error'))
        setRemoteInstalled(false)
      }
    } catch (e) {
      toast.error('Install failed: ' + (e?.message || String(e)))
      setRemoteInstalled(false)
      // Ensure progress visuals are cleared on thrown errors
      setRemoteInstallPhase('')
      setRemoteDownloadPercent(null)
      setRemoteDownloadSpeed(null)
    } finally {
      setInstallingRemote(false)
      setRemoteInstallText('')
    }
  }

  const startRemoteServer = async () => {
    if (!tunnelActive) {
      toast.error('SSH tunnel is not active. Connect first.')
      return
    }
    try {
      setStartingRemoteServerBusy(true)
      setRemoteBackendStatus('Starting remote server...')
      // Prefer explicit start if path is known, else ensure
      let started
      let pathToUse = remoteBackendPath
      // Sanity check: verify saved path exists remotely; if not, auto-locate once
      if (pathToUse) {
        const existsStatus = await ipcRenderer.invoke('checkRemoteFileExists', pathToUse)
        if (existsStatus !== 'exists') {
          const locate = await ipcRenderer.invoke('locateRemoteBackendExecutable')
          if (locate && locate.success && locate.path) {
            pathToUse = locate.path
            setRemoteBackendPath(pathToUse)
            setLastStartDetails(`Executable re-located: ${pathToUse}`)
          } else {
            setLastStartDetails('Saved path missing; auto-locate failed. Falling back to Ensure.')
            pathToUse = ''
          }
        }
      }
      console.log('Starting remote backend using path:', pathToUse || '(Ensure)')
      if (pathToUse) {
        started = await ipcRenderer.invoke('startRemoteBackendUsingPath', { path: pathToUse, port: Number(remoteStartPort)})
      } else {
        started = await ipcRenderer.invoke('ensureRemoteBackend', { port: Number(remoteStartPort) })
      }
      if (started && started.success) {
        setRemoteBackendStatus(`Remote server running on port ${remoteStartPort}`)
        setRemoteServerRunning(true)
        setLastStartAt(Date.now())
        setLastStartDetails('Start OK')
        // Sync selected express port with running one
        setRemoteExpressPort(String(remoteStartPort))
        // Optionally verify by hitting /status via forwarded localhost port
        try {
          const tunnelState = await ipcRenderer.invoke('getTunnelState')
          const forwardedPort = tunnelState?.localExpressPort || Number(localExpressPort)
          if (window && window.backend && typeof window.backend.requestExpress === 'function' && forwardedPort) {
            await window.backend.requestExpress({ method: 'get', path: '/status', host: '127.0.0.1', port: Number(forwardedPort) })
          }
        } catch (verifyErr) {
          // Non-fatal: log and continue; status UI will be updated by checkRemoteServer
          console.warn('Status verify failed:', verifyErr && verifyErr.message ? verifyErr.message : verifyErr)
        }
        // Reflect running state back into tunnel state so listeners update consistently
        try {
          await ipcRenderer.invoke('setTunnelState', { expressStatus: 'running' })
          try { tunnelContext.setTunnelInfo(await ipcRenderer.invoke('getTunnelState')) } catch (_) { /* ignore */ }
        } catch (_) { /* ignore */ }
        // After server starts, immediately check requirements to update UI
        await checkRequirementsRemote()
        setShouldRecheck(true)
        // Sync tunnel context so Remote Server panel sees updated ports/status/log path
        try {
          const tunnel = await ipcRenderer.invoke('getTunnelState')
          tunnelContext.setTunnelInfo(tunnel)
        } catch (e) {
          console.warn('Failed to sync tunnel context after starting server:', e && e.message ? e.message : e)
        }
      } else {
        const msg = started?.error || 'unknown error'
        setRemoteBackendStatus('Failed to start remote server: ' + msg)
        setLastStartDetails(`Status: ${started?.status || 'n/a'} · ${msg}`)
        setRemoteServerRunning(false)
      }
    } catch (e) {
      const msg = e?.message || String(e)
      setRemoteBackendStatus('Failed to start remote server: ' + msg)
      setLastStartDetails(`Exception: ${msg}`)
      setRemoteServerRunning(false)
    } finally {
      setStartingRemoteServerBusy(false)
    }
  }

  const stopRemoteServer = async () => {
    if (!tunnelActive || !remoteServerRunning) {
      toast.error('Server not running or tunnel inactive.')
      return
    }
    try {
      setRemoteBackendStatus('Stopping remote server...')
      // Request remote Express to stop via SSH-forwarded endpoint on localhost
      const tunnelState = await ipcRenderer.invoke('getTunnelState')
      const forwardedPort = tunnelState?.localExpressPort || Number(localExpressPort)
      const remoteExpressPortNum = Number(tunnelState?.remoteExpressPort || remoteStartPort)

      const markStopped = async (message = 'Remote server stopped') => {
        setRemoteBackendStatus(message)
        setRemoteServerRunning(false)
        setShouldRecheck(true)
        try {
          await ipcRenderer.invoke('setTunnelState', { tunnelActive: true, expressStatus: 'stopped', serverStartedRemotely: false })
          try {
            tunnelContext.setTunnelInfo(await ipcRenderer.invoke("getTunnelState"))
          } catch(e) { /* non-fatal context sync */ }
          await ipcRenderer.invoke('stopRemoteServerLogStream')
        } catch(e) { console.log('Failed to update tunnel state after remote stop: ', e) }
        // Immediately re-run status check to reflect latest state
        await checkRemoteServer()
      }

      let resp
      try {
        resp = await window.backend.requestExpress({ method: 'post', path: '/stop-express', host: '127.0.0.1', port: Number(forwardedPort) })
        console.log('Remote /stop-express response:', {
          status: resp?.status,
          data: resp?.data,
          forwardedPort,
          remoteExpressPortNum,
        })
      } catch (err) {
        // If stop endpoint failed, fall through to port check below
        console.warn('Remote /stop-express request failed:', {
          message: err && err.message ? err.message : String(err),
          forwardedPort,
          remoteExpressPortNum,
        })
      }

      if (resp?.data?.success) {
        toast.success('Remote server stopped successfully.')
        await markStopped('Remote server stopped')
      } else {
        // If the stop call did not succeed, check whether the remote Express port is still open.
        let portCheckResult = null
        try {
          if (remoteExpressPortNum && !Number.isNaN(remoteExpressPortNum)) {
            const check = await ipcRenderer.invoke('remoteCheckPort', { port: remoteExpressPortNum })
            portCheckResult = check
            console.log('remoteCheckPort after stop:', check)
            if (check?.success && !check.open) {
              // Port is no longer listening → treat as stopped even if /stop-express failed.
              toast.success('Remote server appears stopped (port closed).')
              await markStopped('Remote server stopped (port closed)')
              return
            }
          }
        } catch (checkErr) {
          console.warn('remoteCheckPort after stop failed:', checkErr && checkErr.message ? checkErr.message : checkErr)
        }
        const baseMsg = resp?.data?.error || resp?.data?.message || resp?.statusText || 'unknown error'
        const detail = portCheckResult
          ? ` (remoteCheckPort: success=${portCheckResult.success}, open=${portCheckResult.open}, error=${portCheckResult.error || 'none'})`
          : ''
        const msg = baseMsg + detail
        setRemoteBackendStatus('Failed to stop remote server: ' + msg)
      }
    } catch (e) {
      setRemoteBackendStatus('Failed to stop remote server: ' + (e?.message || String(e)))
    }
  }


  const checkRequirementsRemote = async () => {
    if (!tunnelActive) {
      console.warn('Cannot check remote requirements: tunnel inactive.')
      return
    }
    try {
      setRequirementsChecking(true)
      // Always call via the SSH-forwarded localhost port
      const tunnelState = await ipcRenderer.invoke('getTunnelState')
      const forwardedPort = tunnelState?.localExpressPort || Number(localExpressPort)
      const resp = await window.backend.requestExpress({ method: 'get', path: '/check-requirements', host: '127.0.0.1', port: Number(forwardedPort) })
      const result = resp?.data?.result || {}
      console.log('Remote requirements check result:', result)
      // Treat any non-empty path for Python/Mongo as "installed"
      const pythonInstalled = !!(result?.pythonInstalled)
      const mongoInstalled = !!(result?.mongoDBInstalled)

      const ok = pythonInstalled && mongoInstalled
      setRequirementsDetailsRemote({ pythonInstalled, mongoInstalled })
      setRequirementsMetRemote(ok)
      if (!ok) toast.warn('Some requirements are missing on remote.')
    } catch (e) {
      console.warn('Remote requirements check failed:', e && e.message ? e.message : e)
      setRequirementsMetRemote(false)
      setRequirementsDetailsRemote({ pythonInstalled: false, mongoInstalled: false })
    } finally {
      setRequirementsChecking(false)
    }
  }

  const waitForRequirementsRemote = async ({ forwardedPort, maxWaitMs = 10 * 60 * 1000, intervalMs = 5000 } = {}) => {
    const startedAt = Date.now()
    while (Date.now() - startedAt < maxWaitMs) {
      try {
        const resp = await window.backend.requestExpress({ method: 'get', path: '/check-requirements', host: '127.0.0.1', port: Number(forwardedPort) })
        const result = resp?.data?.result || {}
        const pythonInstalled = !!(result?.pythonInstalled)
        const mongoInstalled = !!(result?.mongoDBInstalled)
        const ok = pythonInstalled && mongoInstalled
        setRequirementsDetailsRemote({ pythonInstalled, mongoInstalled })
        setRequirementsMetRemote(ok)
        if (ok) return true
      } catch {
        // Ignore transient errors while the remote is restarting/installing
      }
      await new Promise((r) => setTimeout(r, intervalMs))
    }
    return false
  }


  const installRequirementsRemote = async () => {
    if (!tunnelActive || !remoteServerRunning) return
    try {
      setRequirementsInstalling(true)
      const tunnelState = await ipcRenderer.invoke('getTunnelState')
      const forwardedPort = tunnelState?.localExpressPort || Number(localExpressPort)
      // Install only the requirements that are currently missing
      const { pythonInstalled, mongoInstalled } = requirementsDetailsRemote || {}

      if (!pythonInstalled) {
        try {
          await window.backend.requestExpress({ method: 'post', path: '/install-bundled-python', host: '127.0.0.1', port: Number(forwardedPort) })
        } catch (e) {
          console.warn('Python remote install error:', e)
        }
      }

      if (!mongoInstalled) {
        try {
          await window.backend.requestExpress({ method: 'post', path: '/install-mongo', host: '127.0.0.1', port: Number(forwardedPort) })
        } catch (e) {
      console.warn('Mongo remote install error:', e)
      // Detect Windows Installer service failures (e.g., MSI exit code 1601)
      try {
      const msg = e && e.message ? e.message : null
      let installerCode = null
      let windowsInstallerError = false
      if (msg && typeof msg === 'object') {
        installerCode = msg.installerExitCode || msg.errorCode || null
        windowsInstallerError = !!msg.windowsInstallerError
      } else if (msg) {
        const str = String(msg)
        if (str.includes('1601')) installerCode = 1601
        if (str.toLowerCase().includes('windows installer service could not be accessed')) {
          windowsInstallerError = true
        }
      }
      if (installerCode === 1601 || windowsInstallerError) {
        toast.error('Automatic MongoDB installation failed on the remote machine because the Windows Installer service is not available. Please install MongoDB manually using the official documentation: https://www.mongodb.com/docs/manual/administration/install-community/#std-label-install-mdb-community-edition')
      }
      } catch (_) {
      // Best-effort diagnostics; ignore parsing issues
      }
        }
      }
      // Re-check
      const ok = await waitForRequirementsRemote({ forwardedPort: Number(forwardedPort) })
      if (!ok) {
        toast.warn('Remote requirements install is taking longer than expected. Please re-check in a moment.')
      }
    } finally {
      setRequirementsInstalling(false)
    }
  }

  // Refresh remote directory contents (used by refresh button and auto on entering Workspace page)
  const refreshRemoteDirectory = async () => {
    if (!tunnelActive || navigationProcessing) return
    try {
      setNavigationProcessing(true)
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
      // Status-first: try to read GO state and port
      const tunnelState = await ipcRenderer.invoke('getTunnelState')
      const forwardedPort = tunnelState?.localExpressPort || Number(localExpressPort)
      if (!forwardedPort) throw new Error('No forwarded Express port available')

      const readStatus = async (timeout = 6000) => {
        try {
          const resp = await window.backend.requestExpress({ method: 'get', path: '/status', host: '127.0.0.1', port: Number(forwardedPort), timeout })
          return resp?.data || {}
        } catch { return {} }
      }

      let data = await readStatus(6000)
      let discoveredGo = typeof data.go?.port === 'number' ? data.go.port : null
      const goRunning = !!data.go?.running

      // If not running, start idempotently then re-read status
      if (!goRunning || !discoveredGo) {
        try {
          await window.backend.requestExpress({ method: 'post', path: '/ensure-go', host: '127.0.0.1', port: Number(forwardedPort) })
          data = await readStatus(8000)
          discoveredGo = typeof data.go?.port === 'number' ? data.go.port : null
        } catch (e) {
          console.warn('ensure-go failed:', e)
        }
      }

      // Bind/rebind forward if we have a port
      if (discoveredGo) {
        const currentRemoteGo = Number(remoteGoPort)
        // Always ensure a GO forward exists by starting the generic tunnel;
        // startPortTunnel will close any existing 'go' server and recreate if needed.
        try {
          setRemoteGoPort(String(discoveredGo))
          const ts = await ipcRenderer.invoke('getTunnelState')
          const lp = Number(ts?.localGoPort || localGoPort)
          await ipcRenderer.invoke('startPortTunnel', { name: 'go', localPort: lp, remotePort: Number(discoveredGo), ensureRemoteOpen: true })
          try { tunnelContext.setTunnelInfo(await ipcRenderer.invoke('getTunnelState')) } catch { /* ignore */ }
        } catch (e) {
          console.warn('GO forward start failed:', e && e.message ? e.message : e)
          // Fallback: if remote port changed vs current, attempt a rebind
          if (!currentRemoteGo || discoveredGo !== currentRemoteGo) {
            try {
              await ipcRenderer.invoke('rebindPortTunnel', { name: 'go', newRemotePort: Number(discoveredGo) })
              try { tunnelContext.setTunnelInfo(await ipcRenderer.invoke('getTunnelState')) } catch { /* ignore */ }
            } catch (rebErr) {
              console.warn('GO rebind failed:', rebErr && rebErr.message ? rebErr.message : rebErr)
            }
          }
        }
      }

      // Clear any previous probe hint at start of verification
      setGoProbeInfo(null)

      // First try the base GO test request; if it succeeds, skip probe
      const test = await new Promise((resolve) => {
        try {
          requestBackend(
            localGoPort,
            "/connection/connection_test_request",
            { data: "" },
            (jsonResponse) => {
              console.log("GO Verify Response:", jsonResponse)
              if (!jsonResponse?.error) resolve({ ok: true, data: jsonResponse })
              else resolve({ ok: false, error: jsonResponse.error })
            },
            (err) => {
              const msg = err && err.message ? err.message : String(err)
              resolve({ ok: false, error: msg })
            }
          )
        } catch (err) {
          const msg = err && err.message ? err.message : String(err)
          resolve({ ok: false, error: msg })
        }
      })

      if (test && test.ok) {
        setRegisterStatus("GO tunnel verified!")
        setGoVerifyStatus('ok')
        toast.success("GO tunnel is reachable.")
        return
      }

      // Base request failed: run probe to see remote/local reachability
      const probe = await ipcRenderer.invoke('probeGo')
      setGoProbeInfo(probe || null)

      const parts = []
      if (probe && probe.success !== false) {
        parts.push(`probe: remoteOpen=${!!probe.remoteOpen}, localReachable=${!!probe.localReachable}`)
      } else if (probe && probe.error) {
        parts.push(`probe error: ${probe.error}`)
      }
      parts.push(`test error: ${test && test.error ? test.error : 'no-response'}`)
      const msg = parts.join(' · ')
      setRegisterStatus("GO tunnel check failed: " + msg)
      setGoVerifyStatus('fail')
      toast.error(msg)
    } catch (e) {
      const msg = e && e.message ? e.message : String(e)
      setRegisterStatus("GO tunnel check failed: " + msg)
      setGoVerifyStatus('fail')
      toast.error(msg)
    } finally {
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
  // Warn if localExpressPort matches the main server port
    if (String(localExpressPort) === String(port)) {
      warning = `Warning: Local Express port (${localExpressPort}) is the same as the main server port (${port}). This may cause conflicts if a local backend is running.`
    }
    setInputErrors(errors)
    setInputValid(Object.keys(errors).length === 0)
    setLocalPortWarning(warning)
  }, [host, username, remotePort, localExpressPort, remoteExpressPort, localDBPort, remoteDBPort, port])

  // New folder modal state
  const [showNewFolderModal, setShowNewFolderModal] = useState(false)
  const [newFolderName, setNewFolderName] = useState("")
  const [creatingFolder, setCreatingFolder] = useState(false)
  // Debug panel toggle
  const [showRemotePanel, setShowRemotePanel] = useState(true)

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

  const steps = [
    { label: 'SSH Connection' },
    { label: 'Server Setup' },
    { label: 'Workspace' }
  ]

  const serverSetupActionsBusy = checkingRemoteServerBusy || installingRemote || startingRemoteServerBusy || checkingRemotePortBusy

  const formatReleaseTagForDisplay = (tag) => {
    const cleaned = String(tag || '').trim().replace(/^server[-_]?/i, '')
    if (!cleaned) return ''
    return cleaned.startsWith('v') ? cleaned : `v${cleaned}`
  }

  const installButtonLabel = !remoteInstalled
    ? 'Install'
    : (latestRemoteVersionAvailable ? 'Update' : 'Install')
  const installButtonDisabled = (!tunnelActive || connectionProcessing || serverSetupActionsBusy) || (remoteInstalled && !latestRemoteVersionAvailable)
  const latestRemoteVersionDisplay = formatReleaseTagForDisplay(latestRemoteVersionTag)

  // Pager visibility/disabled states
  const prevDisabled = connectionProcessing || activeStep === 0
  const nextDisabled = connectionProcessing ||
    (activeStep === 0 && !tunnelActive) ||
    (activeStep === 1 && (!remoteServerRunning || !requirementsMetRemote))

  // Auto-run actions when switching pages
  useEffect(() => {
    if (!visible) return
    // Debounce page switch actions to avoid rapid repeated calls
    let timer
    if (activeStep === 1) {
      timer = setTimeout(() => {
        (async () => {
          // On first entry to Server Setup, also check if a newer release is available
          if (!latestRemoteVersionChecked) {
            try { await checkForNewRemoteBackendVersion() } catch { /* non-fatal */ }
          }
          try { await checkRemoteServer() } catch { /* non-fatal */ }
        })()
      }, 300)
    } else if (activeStep === 2) {
      timer = setTimeout(async () => {
        // On entering Workspace page: refresh directory, then ensure GO forward if status reports a port
        try { refreshRemoteDirectory() } catch (e) { console.warn('Workspace directory refresh failed on page enter', e) }
        try {
          const ts = await ipcRenderer.invoke('getTunnelState')
          const forwardedPort = ts?.localExpressPort || Number(localExpressPort)
          if (forwardedPort) {
            const resp = await window.backend.requestExpress({ method: 'get', path: '/status', host: '127.0.0.1', port: Number(forwardedPort), timeout: 5000 })
            const data = resp?.data || {}
            const goPort = typeof data?.go?.port === 'number' ? data.go.port : null
            const goRunning = !!data?.go?.running
            if (goRunning && goPort) {
              try {
                const desiredRemote = Number(goPort)
                const tunnels = Array.isArray(ts?.tunnels) ? ts.tunnels : []
                const goEntry = tunnels.find(t => t && t.name === 'go')
                const currentRemote = goEntry ? Number(goEntry.remotePort) : Number(ts?.remoteGoPort || remoteGoPort)
                const isForwarding = !!(goEntry && goEntry.status === 'forwarding')

                if (String(remoteGoPort) !== String(desiredRemote)) setRemoteGoPort(String(desiredRemote))

                if (isForwarding && currentRemote && currentRemote === desiredRemote) {
                  // already good
                } else if (isForwarding && desiredRemote && currentRemote && currentRemote !== desiredRemote) {
                  await ipcRenderer.invoke('rebindPortTunnel', { name: 'go', newRemotePort: Number(desiredRemote) })
                } else {
                  const lp = Number(ts?.localGoPort || localGoPort)
                  await ipcRenderer.invoke('startPortTunnel', { name: 'go', localPort: lp, remotePort: Number(desiredRemote), ensureRemoteOpen: true })
                }
                try { tunnelContext.setTunnelInfo(await ipcRenderer.invoke('getTunnelState')) } catch(e) { console.warn('GO forward ensure tunnel context sync failed:', e) }
              } catch (e) { /* non-fatal */ }
            }
          }
        } catch(e) { console.warn('GO forward ensure on Workspace enter failed:', e) }
      }, 300)
    }
    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [activeStep, visible, latestRemoteVersionChecked])

  // Heartbeat: periodically check /status and auto-rebind tunnels if remote ports change
  useEffect(() => {
    if (!tunnelActive || !visible || !remoteServerRunning) return
    let interval
    const beat = async () => {
      if (heartbeatBusyRef.current) return
      try {
        heartbeatBusyRef.current = true
        const tunnelState = await ipcRenderer.invoke('getTunnelState')
        const forwardedPort = tunnelState?.localExpressPort
        if (!forwardedPort) return
        const resp = await window.backend.requestExpress({ method: 'get', path: '/status', host: '127.0.0.1', port: Number(forwardedPort), timeout: 5000 })
        const data = resp?.data || {}
        if (!data || !data.success) return
        const discoveredExpress = typeof data.expressPort === 'number' ? data.expressPort : null
        const discoveredGo = typeof data.go?.port === 'number' ? data.go.port : null
        const discoveredMongo = typeof data.mongo?.port === 'number' ? data.mongo.port : null
        const discoveredJup = typeof data.jupyter?.port === 'number' ? data.jupyter.port : null
        const goRunning = !!data?.go?.running
        if (DEBUG_TUNNEL) {
          try {
            console.debug('[ConnectionModal] heartbeat status', {
              forwardedPort,
              discoveredExpress,
              discoveredGo,
              discoveredMongo,
              discoveredJup
            })
          } catch (_) { /* ignore logging errors */ }
        }
        // Express
        if (discoveredExpress && Number(remoteExpressPort) && discoveredExpress !== Number(remoteExpressPort)) {
          await ipcRenderer.invoke('rebindPortTunnel', { name: 'express', newRemotePort: Number(discoveredExpress) })
          setRemoteExpressPort(String(discoveredExpress))
        }
        // GO: if running and a port is reported, ensure a forward exists/start it; else rebind if remote changed
        if (goRunning && discoveredGo) {
          const tunnels = Array.isArray(tunnelState?.tunnels) ? tunnelState.tunnels : []
          const goEntry = tunnels.find(t => t && t.name === 'go')
          const desiredRemote = Number(discoveredGo)
          const currentRemote = goEntry ? Number(goEntry.remotePort) : Number(tunnelState?.remoteGoPort || remoteGoPort)
          const isForwarding = !!(goEntry && goEntry.status === 'forwarding')

          // Keep UI state synced but avoid re-setting if unchanged
          if (String(remoteGoPort) !== String(desiredRemote)) setRemoteGoPort(String(desiredRemote))

          // If we already have a live forward to the same remote port, do nothing.
          if (isForwarding && currentRemote && currentRemote === desiredRemote) {
            // no-op
          } else if (isForwarding && desiredRemote && currentRemote && currentRemote !== desiredRemote) {
            // Remote port changed: rebind existing forward
            await ipcRenderer.invoke('rebindPortTunnel', { name: 'go', newRemotePort: Number(desiredRemote) })
          } else {
            // No forward yet (or it's closed): start one
            const lp = Number(tunnelState?.localGoPort || localGoPort)
            await ipcRenderer.invoke('startPortTunnel', { name: 'go', localPort: lp, remotePort: Number(desiredRemote), ensureRemoteOpen: true })
          }
        } else if (discoveredGo && Number(remoteGoPort) && discoveredGo !== Number(remoteGoPort)) {
          await ipcRenderer.invoke('rebindPortTunnel', { name: 'go', newRemotePort: Number(discoveredGo) })
          setRemoteGoPort(String(discoveredGo))
        }
        // Mongo
        if (discoveredMongo && Number(remoteDBPort) && discoveredMongo !== Number(remoteDBPort)) {
          await ipcRenderer.invoke('rebindPortTunnel', { name: 'mongo', newRemotePort: Number(discoveredMongo) })
          setRemoteDBPort(String(discoveredMongo))
        }
        // Jupyter
        if (discoveredJup && Number(remoteJupyterPort) && discoveredJup !== Number(remoteJupyterPort)) {
          await ipcRenderer.invoke('rebindPortTunnel', { name: 'jupyter', newRemotePort: Number(discoveredJup) })
          setRemoteJupyterPort(String(discoveredJup))
        }
        try { tunnelContext.setTunnelInfo(await ipcRenderer.invoke('getTunnelState')) } catch (e) { /* quiet */ }
      } catch(e) { /* quiet */ }
      finally { heartbeatBusyRef.current = false }
    }
    interval = setInterval(beat, 20000)
    return () => { if (interval) clearInterval(interval) }
  }, [tunnelActive, visible, remoteServerRunning, remoteExpressPort, remoteGoPort, remoteDBPort, remoteJupyterPort])

  return (
    <Dialog className="modal" visible={visible} style={{ width: "60vw" }} closable={closable} onHide={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div className="title-header" > 
          <h2>Connect to a remote workspace</h2>
          <Button style={{ padding: "0px", background: 'transparent' }} onClick={onClose}><IoMdClose style={{ fontSize: "18pt", color: 'var(--text-secondary)' }} /></Button>
        </div>
        <Steps model={steps} activeIndex={activeStep} readOnly={true} />

        {/* STEP 1: SSH CONNECTION */}
        {activeStep === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
            {localPortWarning && (
              <div style={{ color: 'var(--warning)', fontSize: 12 }}>
                {localPortWarning}
              </div>
            )}
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              An SSH key will be used automatically (loaded if available, generated if missing) when you click Connect.
            </div>
            {keyGenerated && publicKey && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowSSHKeyAdvanced(v => !v)}
                  style={{
                    color: 'var(--button-bg)',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 14,
                    textDecoration: 'underline',
                    padding: 0
                  }}
                  aria-expanded={showSSHKeyAdvanced}
                >
                  {showSSHKeyAdvanced ? 'Hide SSH Key (Advanced)' : 'Show SSH Key (Advanced)'}
                </button>
                {showSSHKeyAdvanced && (
                  <div style={{ marginTop: 8 }}>
                    <strong>Public Key:</strong>
                    <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', background: 'var(--bg-tertiary)', marginTop: '10px', padding: '0.5em' }}>{publicKey}</pre>
                    {registerStatus && <div style={{ marginTop: '0.5em', color: registerStatus.includes('success') ? 'var(--success)' : 'var(--danger)' }}>{registerStatus}</div>}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* STEP 2: REMOTE SERVER SETUP */}
        {activeStep === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: '1rem' }}>Remote Express Server</h3>
              <div style={{ fontSize: 13, color: remoteBackendStatus.includes('running') || remoteBackendStatus.includes(' reachable') ? 'var(--success)' : remoteBackendStatus ? 'var(--warning)' : 'var(--text-muted)' }}>
                {remoteBackendStatus || 'Unknown'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <Button onClick={checkRemoteServer} disabled={!tunnelActive || connectionProcessing || serverSetupActionsBusy} style={{ background: 'var(--button-bg)', color: 'var(--button-text)' }}>{shouldRecheck ? 'Recheck status' : 'Check'}</Button>
              <Button onClick={installRemoteServer} disabled={installButtonDisabled} style={{ background: 'var(--button-bg)', color: 'var(--button-text)' }}>{installButtonLabel}</Button>
              {remoteInstalled && latestRemoteVersionAvailable && latestRemoteVersionDisplay && (
                <span style={{ fontSize: 12, color: 'var(--warning)' }}>
                  New version available to download: {latestRemoteVersionDisplay}
                </span>
              )}
              {(installingRemote || remoteInstallPhase) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  {typeof remoteDownloadPercent === 'number' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <ProgressBar value={Math.max(0, Math.min(100, remoteDownloadPercent))} style={{ width: 240 }} />
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)', minWidth: 60, textAlign: 'right' }}>
                        {remoteDownloadPercent.toFixed(0)}%
                      </span>
                    </div>
                  ) : (
                    <ProgressBar mode="indeterminate" style={{ width: 240 }} />
                  )}
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {remoteInstallText ||
                      (remoteInstallPhase
                        ? `Phase: ${remoteInstallPhase}`
                        : 'Installing...')}
                    {typeof remoteDownloadSpeed === 'number' && ` · ${(remoteDownloadSpeed / (1024*1024)).toFixed(2)} MB/s`}
                  </span>
                </div>
              )}
            </div>
            {lastStartDetails && (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                {lastStartDetails}
              </div>
            )}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8 }}>
              <span>Start on port:</span>
              <InputNumber disabled={!tunnelActive || connectionProcessing || serverSetupActionsBusy} value={remoteStartPort} onChange={e => setRemoteStartPort(e.value)} useGrouping={false} min={1} max={65535} />
              {!remoteServerRunning ? (
                <Button onClick={startRemoteServer} disabled={!tunnelActive || connectionProcessing || serverSetupActionsBusy} style={{ background: 'var(--button-bg)', color: 'var(--button-text)' }}>Start Server</Button>
              ) : (
                <Button onClick={stopRemoteServer} disabled={!tunnelActive || connectionProcessing || serverSetupActionsBusy} style={{ background: 'var(--danger)', color: 'var(--button-text)' }}>Stop Server</Button>
              )}
              {remoteBackendVersion && (
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Version: {remoteBackendVersion}
                </span>
              )}
              <Button onClick={async () => {
                if (!tunnelActive) return toast.error('SSH tunnel not active.')
                setCheckingRemotePortBusy(true)
                try {
                  const res = await ipcRenderer.invoke('remoteCheckPort', { port: Number(remoteStartPort) })
                  if (res && res.success) {
                    if (res.open) {
                      toast.success(`Port ${remoteStartPort} is listening remotely.`)
                    } else {
                      toast.warn(`Port ${remoteStartPort} is not listening on remote host.`)
                    }
                  } else {
                    toast.error(`Port check failed: ${res?.error || 'unknown error'}`)
                  }
                } catch (e) {
                  toast.error(`Port check error: ${e.message || e}`)
                } finally {
                  setCheckingRemotePortBusy(false)
                }
              }} disabled={!tunnelActive || connectionProcessing || serverSetupActionsBusy} style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>Check Port</Button>
            </div>
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h4 style={{ margin: 0 }}>Remote Requirements</h4>
                <Tag value={requirementsMetRemote ? 'OK' : 'Missing'} severity={requirementsMetRemote ? 'success' : 'warning'} rounded />
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                Python: <strong style={{ color: requirementsDetailsRemote.pythonInstalled ? 'var(--success)' : 'var(--danger)' }}>{requirementsDetailsRemote.pythonInstalled ? 'Installed' : 'Missing'}</strong> · MongoDB: <strong style={{ color: requirementsDetailsRemote.mongoInstalled ? 'var(--success)' : 'var(--danger)' }}>{requirementsDetailsRemote.mongoInstalled ? 'Installed' : 'Missing'}</strong>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Button onClick={checkRequirementsRemote} disabled={!remoteServerRunning || requirementsChecking || requirementsInstalling} style={{ background: 'var(--button-bg)', color: 'var(--button-text)' }}>Check</Button>
                  <Button onClick={installRequirementsRemote} disabled={!remoteServerRunning || requirementsInstalling || requirementsChecking || requirementsMetRemote} style={{ background: 'var(--button-bg)', color: 'var(--button-text)' }}>Install Missing</Button>
                  {(requirementsChecking || requirementsInstalling) && <ProgressBar mode="indeterminate" style={{ width: 200 }} />}
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', maxWidth: 420 }}>
                  Note: On some Windows systems MongoDB cannot be installed automatically because the Windows Installer service is unavailable. In that case you may need to install MongoDB manually using the official instructions.
                </span>
              </div>
            </div>
            {/* Page navigation moved to the global footer */}
          </div>
        )}
        {activeStep === 2 && (
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
                Local GO Port:
                <InputNumber disabled={connectionProcessing} value={localGoPort} onChange={e => setLocalGoPort(e.value == null ? '' : String(e.value))} placeholder="54380" useGrouping={false} min={1} max={65535} />
              </label>
              <label>
                Local MongoDB Port:
                <InputNumber disabled={connectionProcessing} value={localDBPort} onChange={e => setLocalDBPort(e.value == null ? '' : String(e.value))} placeholder="54020" useGrouping={false} min={1} max={65535} />
              </label>
            </div>
            </>}
          </div>
        </div>
        )}
        {activeStep === 0 && (
          <div style={{ display: "flex", gap: "1rem", justifyContent: "flex-end" }}>
            <Button className="connect-btn" onClick={() => handleConnectSSH()} style={{ background: 'var(--button-bg)', color: 'var(--button-text)' }} disabled={!inputValid || tunnelActive || connectionProcessing}>Connect</Button>
            <Button className="disconnect-btn" onClick={handleDisconnect} disabled={!tunnelActive || connectionProcessing} style={{ background: "var(--danger)", color: "var(--button-text)" }}>Disconnect</Button>
          </div>
        )}
        {/* Remote server (GO backend) status and actions (kept for reference, used in Step 2)
        {activeStep === 2 && (
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
        )} */}
        {activeStep === 2 && (
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
          {goProbeInfo && !goVerifyLoading && (
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Probe: remoteOpen={goProbeInfo.remoteOpen ? 'yes' : 'no'} · localReachable={goProbeInfo.localReachable ? 'yes' : 'no'}
            </span>
          )}
        </div>
        )}
        {/* Directory Browser Section - Step 3 */}
        {activeStep === 2 && (
        <div style={{ marginTop: '2rem', borderTop: '1px solid #eee', paddingTop: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Remote Directory Browser</h3>
            <Button
              className="refresh-btn"
              disabled={!tunnelActive || navigationProcessing}
              onClick={refreshRemoteDirectory}
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
                if (!remoteDirPath) {
                  toast.error('Select a workspace directory first.')
                  return
                }
                if (!tunnelActive) {
                  toast.error('SSH tunnel is not active. Connect first.')
                  return
                }
                if (!remoteServerRunning) {
                  toast.error('Remote server not ready. Start the server first.')
                  return
                }
                if (!requirementsMetRemote) {
                  toast.error('Remote requirements not met. Cannot set workspace.')
                  return
                }

                setConnectionProcessing(true)
                setNavigationProcessing(true)
                try {
                  let tunnelState = await ipcRenderer.invoke('getTunnelState')
                  const forwardedPort = tunnelState?.localExpressPort || Number(localExpressPort)
                  if (!forwardedPort) throw new Error('No forwarded Express port available')

                  const response = await window.backend.requestExpress({
                    method: 'post',
                    path: '/set-working-directory',
                    host: '127.0.0.1',
                    port: Number(forwardedPort),
                    body: { workspacePath: remoteDirPath }
                  })
                  console.log("Recieved workspace object from remote:", response.data.workspace)

                  if (response?.data?.success) {
                    toast.success('Workspace set successfully on remote app.')
                    
                    // Establish mongoDB tunnel
                    try {
                      const mongoPort = Number(response?.data?.workspace?.newPort || remoteDBPort)
                      await ipcRenderer.invoke('startPortTunnel', { name: 'mongo', localPort: Number(localDBPort), remotePort: mongoPort, ensureRemoteOpen: true })
                      setRemoteDBPort(String(mongoPort))
                    } catch (e) {
                      console.warn('Failed to start mongo tunnel:', e)
                    }

                    // Confirm tunnel established, otherwise cancel showing the workspace
                    tunnelState = await ipcRenderer.invoke('getTunnelState')
                    if (!(Array.isArray(tunnelState?.tunnels) || !tunnelState.tunnels.some(t => t?.name === 'mongo'))) {
                      throw new Error('MongoDB tunnel not active after workspace set, cannot show workspace.')
                    }

                    if (response.data.workspace !== workspace) {
                      setWorkspace(response.data.workspace)
                    }
                  } else {
                    toast.error('Failed to set workspace on remote app: ' + (response?.data?.error || 'Unknown error'))
                  }
                } catch (error) {
                  const msg = error && error.message ? error.message : String(error)
                  toast.error('Error setting workspace on remote app: ' + msg)
                } finally {
                  setConnectionProcessing(false)
                  setNavigationProcessing(false)
                }
              }}
              title="Set this directory as workspace (and connect when ready)"
              disabled={!tunnelActive || navigationProcessing || connectionProcessing || !remoteDirPath}
            >
              Set as Workspace
            </Button>
            <Button
              className="leave-workspace-btn"
              onClick={async () => {
                try {
                  setConnectionProcessing(true)
                  // Stop Mongo if possible
                  await window.backend.requestExpress({ method: 'post', path: '/stop-mongo', host, port: Number(localExpressPort) })
                  setWorkspace({
                    hasBeenSet: false,
                    workingDirectory: "",
                    isRemote: false
                  })
                  // Stop mongo tunnel but ignore errors (in case it was started outside of this workflow or already stopped)
                  try {
                    await ipcRenderer.invoke('stopPortTunnel', { name: 'mongo' })
                  } catch (e) {
                    console.warn('Failed to stop mongo tunnel:', e)
                  }
                } catch (e) {
                  console.warn('Error leaving workspace:', e)
                }
                finally {
                  setConnectionProcessing(false)
                }
              }}
              title="Disconnect from the current mongoDB workspace"
              disabled={!tunnelActive || connectionProcessing}
              style={{ background: 'var(--danger)', color: 'var(--button-text)' }}
            >
              Leave workspace
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
        )}
        {/* Remote Server Debug Panel - collapsible */}
        <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <h3 style={{ margin: 0, fontSize: '1rem' }}>Remote Server Panel</h3>
            <Button
              onClick={() => setShowRemotePanel(v => !v)}
              style={{ marginLeft: 'auto', background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
              title={showRemotePanel ? 'Hide panel' : 'Show panel'}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {showRemotePanel ? 'Hide' : 'Show'}
                {showRemotePanel ? <GoChevronUp size={18} /> : <GoChevronDown size={18} />}
              </span>
            </Button>
          </div>
          {showRemotePanel && (
            <RemoteServerPage />
          )}
        </div>
        {/* Global wizard footer navigation */}
        {tunnelStatus && (
          <div>
            <div style={{ marginTop: '0.5em', color: tunnelStatus.includes('established') ? 'var(--success)' : tunnelStatus.includes('onnecting') ? 'var(--warning)' : 'var(--danger)' }}>
              { connectionProcessing && (<ProgressSpinner style={{width: '14px', height: '14px'}} strokeWidth="4" />)} {tunnelStatus}
            </div>
          </div>
        )}
        <div className="wizard-footer">
          <Button
            className="pager-btn pager-prev"
            onClick={() => setActiveStep((s) => Math.max(0, s - 1))}
            disabled={prevDisabled}
            style={{ visibility: prevDisabled ? 'hidden' : 'visible' }}
            title="Previous step"
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <GoChevronLeft size={18} />
              Previous
            </span>
          </Button>
          <Button
            className="pager-btn pager-next"
            onClick={() => {
              if (activeStep === 0) return setActiveStep(1)
              if (activeStep === 1) return setActiveStep(2)
              if (activeStep === 2) return typeof onClose === 'function' ? onClose() : null
            }}
            disabled={nextDisabled}
            style={{ visibility: nextDisabled ? 'hidden' : 'visible' }}
            title={activeStep === 2 ? 'Finish' : 'Next step'}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {activeStep === 2 ? 'Finish' : 'Next'}
              <GoChevronRight size={18} />
            </span>
          </Button>
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
            /* Generic disabled state for PrimeReact buttons */
            .p-button:disabled, .p-button.p-disabled {
              opacity: 0.5 !important;
              filter: grayscale(0.3) brightness(0.95);
              cursor: not-allowed !important;
            }

            /* Ensure BlueprintJS buttons also show a clear disabled state */
            .bp5-button:disabled,
            .bp5-button.bp5-disabled,
            .bp5-button[aria-disabled="true"] {
              opacity: 0.5 !important;
              filter: grayscale(0.3) brightness(0.95);
              cursor: not-allowed !important;
            }

            /* Wizard footer navigation */
            .wizard-footer {
              display: flex;
              align-items: center;
              justify-content: space-between;
              margin-top: 16px;
              padding-top: 12px;
              border-top: 1px solid var(--border-color);
            }
            .pager-btn {
              background: var(--bg-secondary) !important;
              color: var(--text-secondary) !important;
              border: 1px solid var(--border-color) !important;
            }
            .pager-prev {
              /* left variant */
            }
            .pager-next {
              background: var(--button-bg) !important;
              color: var(--button-text) !important;
              border-color: var(--button-bg) !important;
            }

            .refresh-btn {
              margin-left: 8px;
              font-size: 16px;
              padding: 2px 4px;
              background: var(--bg-secondary) !important;
              color: var(--text-secondary) !important 
            }

            .refresh-btn:disabled {
              opacity: 0.5;
              cursor: default
            }

            .new-folder-btn {
              margin-left: 8px;
              font-size: 16px;
              padding: 2px 4px;
              background: var(--bg-secondary) !important;
              color: var(--text-secondary) !important 
            }

            .new-folder-btn:disabled {
              opacity: 0.5;
              cursor: default
            }

            #set-workspace-btn {
              margin-left: 8px;
              font-size: 16px;
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

            .connect-workspace-btn:disabled, .leave-workspace-btn:disabled {
              opacity: 0.5;
              cursor: default;
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
