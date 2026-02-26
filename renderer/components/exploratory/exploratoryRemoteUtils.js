import { getTunnelState } from "../../utilities/tunnelState"

export const resolveExploratoryExpressPort = async (isRemoteMode) => {
  const tunnel = getTunnelState()
  if (isRemoteMode && tunnel?.tunnelActive && tunnel.localExpressPort) {
    return Number(tunnel.localExpressPort)
  }
  const expressPort = await window.backend.getExpressPort()
  return Number(expressPort)
}

export const resolveExploratoryReportUrl = ({ reportPath, localExpressPort, isRemoteMode, reportType = "Exploratory" }) => {
  if (!reportPath) return ""
  const tunnel = getTunnelState()

  if (isRemoteMode) {
    const expressTunnel = (tunnel?.tunnels || []).find((entry) => entry.name === "express" && entry.status === "forwarding")
    const port = Number(expressTunnel?.localPort || tunnel?.localExpressPort || localExpressPort)
    if (!Number.isFinite(port)) {
      throw new Error(`No local Express tunnel port available for ${reportType} report`)
    }
    return `http://127.0.0.1:${port}${reportPath}`
  }

  return `http://127.0.0.1:${localExpressPort}${reportPath}`
}

export const openExploratoryReportInIframe = ({ dispatchLayout, url, name, idPrefix }) => {
  dispatchLayout({ type: "openInIFrame", payload: { path: url, name, id: `${idPrefix}-${Date.now()}` } })
}
