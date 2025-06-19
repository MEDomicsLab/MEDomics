import React, { createContext, useState, useContext } from "react";

// TunnelContext will store info about the active SSH tunnel
export const TunnelContext = createContext({
  host: null,
  tunnelActive: false,
  localAddress: "localhost",
  localPort: null,
  remotePort: null,
  backendPort: null,
  username: null,
  setTunnelInfo: () => {},
  clearTunnelInfo: () => {},
})

export const TunnelProvider = ({ children }) => {
  const [tunnelInfo, setTunnelInfo] = useState({
    host: null,
    tunnelActive: false,
    localAddress: "localhost",
    localPort: null,
    remotePort: null,
    backendPort: null,
    username: null,
  })

  const setTunnel = (info) => {
    setTunnelInfo({ ...tunnelInfo, ...info, tunnelActive: true })
  }

  const clearTunnel = () => {
    setTunnelInfo({
      host: null,
      tunnelActive: false,
      localAddress: "localhost",
      localPort: null,
      remotePort: null,
      backendPort: null,
      username: null,
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
