// Simple tunnel state for use outside React (e.g., in .js files)

let tunnelInfo = {
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
  // Service statuses and flags
  serverStartedRemotely: false,
  expressStatus: "unknown",
  expressLogPath: null,
  // Optional persisted remote context
  remoteWorkspacePath: null,
  remoteBackendExecutablePath: null,
  requirementsMetRemote: false,
  requirementsDetailsRemote: null,
  requirementsCheckedAt: null,
  tunnels: [],
};

export function setTunnelState(info) {
  // Exclude password
  const { password, privateKey, ...safeInfo } = info
  const hasFlag = Object.prototype.hasOwnProperty.call(safeInfo, 'tunnelActive')
  const nextTunnelActive = hasFlag
    ? !!safeInfo.tunnelActive
    : (typeof tunnelInfo.tunnelActive === 'boolean' ? tunnelInfo.tunnelActive : false)
  tunnelInfo = { ...tunnelInfo, ...safeInfo, tunnelActive: nextTunnelActive }
}

export function clearTunnelState() {
  tunnelInfo = {
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
  };
}

export function getTunnelState() {
  return tunnelInfo
}

