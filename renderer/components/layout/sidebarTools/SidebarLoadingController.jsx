import { useEffect } from "react"
import { ipcRenderer } from "electron"
import { useSidebarLoading } from "./SidebarLoadingContext"

export default function SidebarLoadingController() {
  const { setSidebarProcessing, setSidebarProcessingMessage } = useSidebarLoading()

  useEffect(() => {
    // Listen for custom event dispatched on window
    function handleSidebarLoadingEvent(e) {
      const { processing, message } = e.detail || {}
      setSidebarProcessing(processing)
      setSidebarProcessingMessage(message)
      console.log("[CustomEvent] sidebarProcessing:", processing, "sidebarProcessingMessage:", message)
    }
    window.addEventListener("sidebarLoading", handleSidebarLoadingEvent)

    // Still listen for IPC from main process if needed
    ipcRenderer.on("setSidebarLoading", (event, { processing, message }) => {
      setSidebarProcessing(processing)
      setSidebarProcessingMessage(message)
      console.log("[IPC] sidebarProcessing:", processing, "sidebarProcessingMessage:", message)
    })

    return () => {
      window.removeEventListener("sidebarLoading", handleSidebarLoadingEvent)
      ipcRenderer.removeAllListeners("setSidebarLoading")
    }
  }, [])
  return null
}