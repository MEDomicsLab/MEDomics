import { createContext, useState, useContext } from "react";

// TunnelContext will store info about the active SSH tunnel
export const TunnelContext = createContext({
  host: null,
  tunnelActive: false,
  localAddress: "localhost",
  localExpressPort: null,
  remoteExpressPort: null,
  localGoPort: null,
  remoteGoPort: null,
  localDBPort: null,
  remoteDBPort: null,
  localJupyterPort: null,
  remoteJupyterPort: null,
  remotePort: null,
  username: null,
  serverStartedRemotely: false,
  expressStatus: "unknown",
  expressLogPath: null,
  remoteWorkspacePath: null,
  remoteBackendExecutablePath: null,
  requirementsMetRemote: false,
  requirementsDetailsRemote: null,
  requirementsCheckedAt: null,
  tunnels: [],
  setTunnelInfo: () => {},
  clearTunnelInfo: () => {},
})

export const TunnelProvider = ({ children }) => {
  const [tunnelInfo, setTunnelInfo] = useState({
    host: null,
    tunnelActive: false,
    localAddress: "localhost",
    localExpressPort: null,
    remoteExpressPort: null,
    localGoPort: null,
    remoteGoPort: null,
    localDBPort: null,
    remoteDBPort: null,
    localJupyterPort: null,
    remoteJupyterPort: null,
    remotePort: null,
    username: null,
    serverStartedRemotely: false,
    expressStatus: "unknown",
    expressLogPath: null,
    remoteWorkspacePath: null,
    remoteBackendExecutablePath: null,
    requirementsMetRemote: false,
    requirementsDetailsRemote: null,
    requirementsCheckedAt: null,
    tunnels: [],
  })

  const setTunnel = (info) => {
    if (!info || typeof info !== 'object') return
    const safeInfo = { ...info }
    delete safeInfo.password
    delete safeInfo.privateKey
    const hasFlag = Object.prototype.hasOwnProperty.call(safeInfo, 'tunnelActive')
    setTunnelInfo((prev) => {
      const nextTunnelActive = hasFlag ? !!safeInfo.tunnelActive : !!prev.tunnelActive
      return { ...prev, ...safeInfo, tunnelActive: nextTunnelActive }
    })
  }

  const clearTunnel = () => {
    setTunnelInfo({
      host: null,
      tunnelActive: false,
      localAddress: "localhost",
      localExpressPort: null,
      remoteExpressPort: null,
      localGoPort: null,
      remoteGoPort: null,
      localDBPort: null,
      remoteDBPort: null,
      localJupyterPort: null,
      remoteJupyterPort: null,
      remotePort: null,
      username: null,
      serverStartedRemotely: false,
      expressStatus: "unknown",
      expressLogPath: null,
      remoteWorkspacePath: null,
      remoteBackendExecutablePath: null,
      requirementsMetRemote: false,
      requirementsDetailsRemote: null,
      requirementsCheckedAt: null,
      tunnels: [],
    })
  }

  return (
    <TunnelContext.Provider value={{ ...tunnelInfo, setTunnelInfo: setTunnel, clearTunnelInfo: clearTunnel }}>
      {children}
    </TunnelContext.Provider>
  )
}

// Custom hook for easy access
export const useTunnel = () => useContext(TunnelContext)
