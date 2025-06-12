// Simple tunnel state for use outside React (e.g., in requests.js)
let tunnelInfo = {
  tunnelActive: false,
  localAddress: "localhost",
  localPort: null,
  remoteHost: null,
  remotePort: null,
  backendPort: null,
  username: null,
};

export function setTunnelState(info) {
  tunnelInfo = { ...tunnelInfo, ...info, tunnelActive: !!info.tunnelActive };
}

export function clearTunnelState() {
  tunnelInfo = {
    tunnelActive: false,
    localAddress: "localhost",
    localPort: null,
    remoteHost: null,
    remotePort: null,
    backendPort: null,
    username: null,
  };
}

export function getTunnelState() {
  return tunnelInfo;
}
