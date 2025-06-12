import React, { createContext, useState, useContext } from "react";

// TunnelContext will store info about the active SSH tunnel
export const TunnelContext = createContext({
  tunnelActive: false,
  localAddress: "localhost",
  localPort: null,
  remoteHost: null,
  remotePort: null,
  backendPort: null,
  username: null,
  setTunnelInfo: () => {},
  clearTunnelInfo: () => {},
});

export const TunnelProvider = ({ children }) => {
  const [tunnelInfo, setTunnelInfo] = useState({
    tunnelActive: false,
    localAddress: "localhost",
    localPort: null,
    remoteHost: null,
    remotePort: null,
    backendPort: null,
    username: null,
  });

  const setTunnel = (info) => {
    setTunnelInfo({ ...tunnelInfo, ...info, tunnelActive: true });
  };

  const clearTunnel = () => {
    setTunnelInfo({
      tunnelActive: false,
      localAddress: "localhost",
      localPort: null,
      remoteHost: null,
      remotePort: null,
      backendPort: null,
      username: null,
    });
  };

  return (
    <TunnelContext.Provider value={{ ...tunnelInfo, setTunnelInfo: setTunnel, clearTunnelInfo: clearTunnel }}>
      {children}
    </TunnelContext.Provider>
  );
};

// Custom hook for easy access
export const useTunnel = () => useContext(TunnelContext);
