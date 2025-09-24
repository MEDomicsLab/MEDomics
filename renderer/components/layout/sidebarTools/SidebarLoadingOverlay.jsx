import { ProgressSpinner } from "primereact/progressspinner"
import { useSidebarLoading } from "./SidebarLoadingContext"

const SidebarLoadingOverlay = () => {
  const { sidebarProcessing, sidebarProcessingMessage } = useSidebarLoading()
  if (!sidebarProcessing) return null
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        background: "rgba(53,53,53,0.7)",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center"
      }}
    >
      <div style={{ marginBottom: "1rem" }}>
        <ProgressSpinner style={{ width: "50px", height: "50px" }} strokeWidth="8" />
      </div>
      <div style={{ fontSize: "1.1rem", color: "white", textAlign: "center", maxWidth: "80%" }}>
        {sidebarProcessingMessage || "Loading workspace..."}
      </div>
    </div>
  )
}

export default SidebarLoadingOverlay