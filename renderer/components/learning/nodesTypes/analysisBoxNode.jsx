import { shell } from "electron"
import { InputNumber } from "primereact/inputnumber"
import { InputText } from "primereact/inputtext"
import { Panel } from "primereact/panel"
import { memo, useContext, useEffect } from "react"
import { AiOutlineInfoCircle } from "react-icons/ai"
import { Handle, Position } from "reactflow"
import { FlowFunctionsContext } from "../../flow/context/flowFunctionsContext"

const AnalysisBoxNode = ({ data, selected }) => {
  const { updateNode } = useContext(FlowFunctionsContext)

  const header = (
    <div className="d-flex align-items-center justify-content-between">
      <label className="mb-0" style={{ marginRight: "0.3rem" }}>Analysis Box</label>
      <AiOutlineInfoCircle
        className="btn-info-node mr-2"
        onClick={() => {
          shell.openExternal("https://pycaret.readthedocs.io/en/stable/api/classification.html#pycaret.classification.plot_model")
        }}
      />
    </div>
  )

  useEffect(() => {
    if (data) {
        if (!data.internal.settings) {
            data.internal.settings = {}
        }
        if (!data.internal.settings.plot) {
            data.internal.settings.plot = 'auc'
        }
        if (!data.internal.settings.scale) {
            data.internal.settings.scale = 1
        }
    }
  }, [data])

  return (
    <>
      {/* Left handle for connecting */}
      <Handle
        type="target"
        position={Position.Left}
        style={{ left: -6, width: 12, height: 12 }}
      />

      {/* Outer container */}
      <div
        tabIndex={0}
        id={data?.id}
        style={{
          width: data.size?.width || 320,
          height: data.size?.height || "auto",
          display: "flex",
          border: selected
            ? `4px solid ${data.internal.selectedBorderColor}`
            : `1px solid ${data.internal.borderColor}`,
          borderRadius: 8,
          overflow: "hidden",
          backgroundColor: "#fff",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        }}
      >
        {/* Sidebar */}
        <div
          style={{
            width: 60,
            backgroundColor: data.internal.borderColor || "rgba(173, 230, 150, 0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            writingMode: "vertical-rl",
            transform: "rotate(180deg)",
            fontWeight: 600,
            fontSize: 18,
            color: "#333",
          }}
        >
          {data.internal.name}
        </div>

        {/* Content panel */}
        <div
          style={{
            flex: 1,
            padding: "0.75rem",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <Panel header={header}>
            <div className="p-fluid">
              {/* Plot Metric Input */}
              <div className="field" style={{ marginBottom: "1rem" }}>
                <label htmlFor="plot-metric">Plot Metric</label>
                <InputText
                  id="plot-metric"
                  value={data.internal.settings.plot}
                  onChange={(e) => {
                    data.internal.settings.plot = e.target.value
                    updateNode({
                      id: data.id,
                      updatedData: data.internal,
                    })
                  }}
                  placeholder="e.g., AUC"
                  style={{ width: "140px", marginLeft: "0.5rem" }}
                />
              </div>

              {/* Scale Input */}
              <div className="field">
                <label htmlFor="scale">Scale</label>
                <InputNumber
                  id="scale"
                  value={data.internal.settings.scale}
                  onValueChange={(e) => {
                    data.internal.settings.scale = e.value
                    updateNode({
                      id: data.id,
                      updatedData: data.internal,
                    })
                  }}
                  mode="decimal"
                  min={1}
                  max={10}
                  step={1}
                  showButtons
                  buttonLayout="horizontal"
                  inputClassName="text-center"
                  style={{ width: "140px", marginLeft: "0.5rem" }}
                />
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </>
  )
}

export default memo(AnalysisBoxNode)
