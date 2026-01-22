import { memo, useState } from "react"
import { NodeResizer } from "reactflow"
import "@reactflow/node-resizer/dist/style.css"

const BoxNode = ({ data, selected }) => {
  const [height, setHeight] = useState(data.size?.height || "100%")
  return (
    <>
      <NodeResizer 
        nodeId={data.id} 
        minHeight={data.size?.height || 1000} 
        minWidth={data.size?.width || 700} 
        isVisible={selected}
        onResizeStart={() => {
          // set data height and width to 100% when resizing starts
          setHeight("100%")
        }}
      />
      <div
        tabIndex={0}
        id={data?.id}
        style={{
          width: data.size?.width || "100%",
          height: height,
          display: "flex",
          backgroundColor: "transparent",
          border: selected ? `4px solid ${data.internal.selectedBorderColor}` : `1px solid ${data.internal.borderColor}`,
          borderRadius: "8px",
          boxShadow: "0 4px 8px rgba(0, 0, 0, 0.05)",
          overflow: "hidden",
        }}
      >
        {/* Left sidebar - Container label */}
        <div
          style={{
            width: "60px",
            backgroundColor: data.internal.borderColor || "rgba(173, 230, 150, 0.8)",
            borderRight: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: "600",
            color: "#4a5568",
            fontSize: "25px",
            writingMode: "vertical-rl",
            transform: "rotate(180deg)",
          }}
        >
          {data.internal.name}
        </div>

        {/* Main content area */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            padding: "12px",
            gap: "8px",
          }}
        >
          {/* Content would go here */}
        </div>
      </div>
    </>
  )
}

export default memo(BoxNode)