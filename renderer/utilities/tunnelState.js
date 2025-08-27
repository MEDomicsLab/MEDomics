// Simple tunnel state for use outside React (e.g., in .js files)

let tunnelInfo = {
  host: null,
  tunnelActive: false,
  localAddress: "localhost",
  localBackendPort: null,
  remoteBackendPort: null,
  localDBPort: null,
  remoteDBPort: null,
  remotePort: null,
  username: null,
};

export function setTunnelState(info) {
  // Exclude password
  const { password, privateKey, ...safeInfo } = info
  tunnelInfo = { ...tunnelInfo, ...safeInfo, tunnelActive: safeInfo.tunnelActive }
}

export function clearTunnelState() {
  tunnelInfo = {
    host: null,
    tunnelActive: false,
    localAddress: "localhost",
    localBackendPort: null,
    remoteBackendPort: null,
    localDBPort: null,
    remoteDBPort: null,
    remotePort: null,
    username: null,
  };
}

export function getTunnelState() {
  return tunnelInfo
}

