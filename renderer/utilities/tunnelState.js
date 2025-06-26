// Simple tunnel state for use outside React (e.g., in requests.js)
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
  tunnelInfo = { ...tunnelInfo, ...info, tunnelActive: !!info.tunnelActive }
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
