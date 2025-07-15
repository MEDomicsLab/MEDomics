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
  tunnelObject: null, // Optional: to store the tunnel object if needed
};

export function setTunnelState(info) {
  tunnelInfo = { ...tunnelInfo, ...info, tunnelActive: !!info.tunnelActive }
}

export function setTunnelObject(tunnelObject) {
  tunnelInfo.tunnelObject = tunnelObject;
}

export function getTunnelObject() {
  return tunnelInfo.tunnelObject;
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
    tunnelObject: null,
  };
}

export function getTunnelState() {
  return tunnelInfo
}
