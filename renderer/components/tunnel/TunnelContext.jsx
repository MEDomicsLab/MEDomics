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
  goStatus: "unknown",
  mongoStatus: "unknown",
  expressLogPath: null,
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
    goStatus: "unknown",
    mongoStatus: "unknown",
    expressLogPath: null,
  })

  const setTunnel = (info) => {
    // Commented out to fix linting problems: unused password and privateKey destructuring
    // const { password, privateKey, ...safeInfo } = info
    const safeInfo = info
    setTunnelInfo(prev => ({ ...prev, ...safeInfo, tunnelActive: true }))
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
      goStatus: "unknown",
      mongoStatus: "unknown",
      expressLogPath: null,
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
