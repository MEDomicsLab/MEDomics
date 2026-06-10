import { useState } from "react";

const BASE_MODELS = [
  "MIMIC-IV Base Logistics Ensemble",
  "Hippo-EHR Transformers v4",
  "Custom Local XGBoost Checkpoint",
];

const TARGET_LABELS = [
  "In-Hospital Mortality Risk Factor",
  "30-Day Readmission Diagnostic Index",
  "Septic Shock Onset Threshold",
];

const MPC_STRATEGIES = [
  { value: "average", label: "Average — mean(IPC, APC)" },
  { value: "minimum", label: "Minimum — min(IPC, APC)" },
  { value: "custom",  label: "Custom function" },
];

function Collapsible({ title, subtitle, accentColor, children }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="collapsible">
      <div className="collapsible-header" onClick={() => setOpen((o) => !o)}>
        <span style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)", display: "inline-block", transition: "transform 0.2s", fontSize: 11, color: "#6C757D" }}>
          ▶
        </span>
        <div>
          <div style={{ fontSize: 12, fontWeight: 500, color: accentColor }}>{title}</div>
          <div style={{ fontSize: 11, color: "#6C757D" }}>{subtitle}</div>
        </div>
      </div>
      {open && <div className="collapsible-body">{children}</div>}
    </div>
  );
}

export default function Med3paConfigForm() {
  const [med3pa_params, setMed3paParams] = useState({
    base_model: null,
    target_classification_label: null,
    ipc: {
      n_estimators: 0,
      max_depth: 0,
      min_samples_split: 0,
      confidence_metric: null,
    },
    apc: {
      tree_max_depth: 3,
      min_leading_samples: 0,
      ccp_alpha: 0,
    },
    mpc_strategy: null,
  });

  const [ipcCustomExpr, setIpcCustomExpr] = useState(false);
  const [mpcCustomExpr, setMpcCustomExpr] = useState(false);

  const setTop = (key, val) =>
    setMed3paParams((p) => ({ ...p, [key]: val }));

  const setIpc = (key, val) =>
    setMed3paParams((p) => ({ ...p, ipc: { ...p.ipc, [key]: val } }));

  const setApc = (key, val) =>
    setMed3paParams((p) => ({ ...p, apc: { ...p.apc, [key]: val } }));

  const STEPS_CURRENT = [
    { n: "1", name: "Configure model", active: true },
    { n: "2", name: "Set threshold",   active: false },
    { n: "3", name: "Deploy",          active: false },
  ];

  return (
    <div style={{ fontFamily: "sans-serif", padding: "1rem" }}>

      {/* Top bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 2 }}>Analysis workspace</div>
          <div style={{ fontSize: 12, color: "#6C757D" }}>ICU in-hospital mortality · Configure inputs</div>
        </div>
        <button style={{ padding: "8px 18px", background: "#185FA5", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 500 }}>
          Next step →
        </button>
      </div>

      {/* Step bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 20, flexWrap: "wrap" }}>
        {STEPS_CURRENT.map((step, i) => (
          <span key={step.n} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{
              width: 24, height: 24, borderRadius: "50%",
              background: step.active ? "#185FA5" : "#E9ECEF",
              color: step.active ? "#fff" : "#6C757D",
              fontSize: 11, fontWeight: 500,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {step.n}
            </span>
            <span style={{ fontSize: 12, fontWeight: step.active ? 500 : 400, color: step.active ? "#212529" : "#6C757D" }}>
              {step.name}
            </span>
            {i < STEPS_CURRENT.length - 1 && (
              <span style={{ display: "inline-block", width: 32, height: 1, background: "#E9ECEF", marginLeft: 4 }} />
            )}
          </span>
        ))}
      </div>

      {/* Two-column layout */}
      <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 16 }}>

        {/* LEFT — Base model card */}
        <div style={{ border: "1px solid #E9ECEF", borderRadius: 8, padding: "12px 16px", background: "#fff" }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: "#185FA5", marginBottom: 10 }}>
            Select baseline prediction model
          </div>

          <label style={{ fontSize: 12, color: "#6C757D", display: "block", marginBottom: 4 }}>
            Base model source architecture
          </label>
          <select
            style={{ width: "100%", marginBottom: 12, height: 32 }}
            value={med3pa_params.base_model ?? ""}
            onChange={(e) => setTop("base_model", e.target.value || null)}
          >
            <option value="">— select —</option>
            {BASE_MODELS.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>

          <label style={{ fontSize: 12, color: "#6C757D", display: "block", marginBottom: 4 }}>
            Target classification label
          </label>
          <input type="text" placeholder="e.g One Year Mortality" style={{ width: "100%", boxSizing: "border-box", height: 28 }} value={med3pa_params.target_classification_label ?? ""} onChange={(e) => setTop("target_classification_label", e.target.value || null)} />
          {/* <select
            style={{ width: "100%", marginBottom: 12, height: 32 }}
            value={med3pa_params.target_classification_label ?? ""}
            onChange={(e) => setTop("target_classification_label", e.target.value || null)}
          >
            <option value="">— select —</option>
            {TARGET_LABELS.map((v) => <option key={v} value={v}>{v}</option>)}
          </select> */}
        </div>

        {/* RIGHT — Confidence method configuration */}
        <div style={{ border: "1px solid #E9ECEF", borderRadius: 8, padding: "12px 16px", background: "#fff" }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: "#185FA5", marginBottom: 10 }}>
            Confidence method configuration
          </div>

          {/* IPC */}
          <Collapsible
            title="IPC — Individualized Predictive Confidence"
            subtitle="Per-sample confidence via algorithm hyperparameters"
            accentColor="#185FA5"
          >
            <p style={{ fontSize: 12, fontWeight: 500, color: "#495057", margin: "4px 0 6px" }}>
              Algorithm-specific hyperparameters
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 8 }}>
              <div>
                <label style={{ fontSize: 11, color: "#6C757D", display: "block", marginBottom: 2 }}>n_estimators</label>
                <input
                  type="number"
                  placeholder="e.g. 100"
                  style={{ width: "100%", boxSizing: "border-box", height: 28 }}
                  value={med3pa_params.ipc.n_estimators || ""}
                  onChange={(e) => setIpc("n_estimators", parseInt(e.target.value) || 0)}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "#6C757D", display: "block", marginBottom: 2 }}>max_depth</label>
                <input
                  type="number"
                  placeholder="e.g. 5"
                  style={{ width: "100%", boxSizing: "border-box", height: 28 }}
                  value={med3pa_params.ipc.max_depth || ""}
                  onChange={(e) => setIpc("max_depth", parseInt(e.target.value) || 0)}
                />
              </div>
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, color: "#6C757D", display: "block", marginBottom: 2 }}>min_samples_split</label>
              <input
                type="number"
                placeholder="e.g. 2"
                style={{ width: "100%", boxSizing: "border-box", height: 28 }}
                value={med3pa_params.ipc.min_samples_split || ""}
                onChange={(e) => setIpc("min_samples_split", parseInt(e.target.value) || 0)}
              />
            </div>

            <hr style={{ border: "none", borderTop: "1px solid #E9ECEF", margin: "10px 0" }} />

            <p style={{ fontSize: 12, fontWeight: 500, color: "#495057", margin: "6px 0 4px" }}>
              Confidence metric formulation (cᵢ)
            </p>
            <p style={{ fontSize: 11, color: "#6C757D", margin: "0 0 8px" }}>
              Choose how the per-sample target variable is defined.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                <input
                  type="radio"
                  name="ipc_metric"
                  value="continuous"
                  checked={med3pa_params.ipc.confidence_metric === "continuous"}
                  onChange={() => {setIpc("confidence_metric", "continuous")
                    setIpcCustomExpr(false)
                  }}
                />
                (1 − |ŷᵢ − yᵢ|)
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                <input
                  type="radio"
                  name="ipc_metric"
                  value="custom"
                  checked={ipcCustomExpr}
                  onChange={() => {setIpcCustomExpr(true)
                    setIpc("confidence_metric", null)
                  }}
                />
                Custom function
              </label>
            </div>
            {ipcCustomExpr && (
              <div style={{ background: "#F8F9FA", border: "1px solid #E9ECEF", borderRadius: 6, padding: "8px 10px" }}>
                <label style={{ fontSize: 11, color: "#6C757D", display: "block", marginBottom: 4 }}>f(p, y) =</label>
                <input
                  style={{ width: "100%", boxSizing: "border-box", height: 30 }}
                  placeholder="e.g. (1 − |p − y|)"
                  value={med3pa_params.ipc.confidence_metric??""}
                  onChange={(e) => setIpc("confidence_metric", e.target.value)}
                />
              </div>
            )}
          </Collapsible>

          {/* APC */}
          <Collapsible
            title="APC — Aggregate Predictive Confidence"
            subtitle="Group-level confidence via decision tree complexity"
            accentColor="#0F6E56"
          >
            <p style={{ fontSize: 12, fontWeight: 500, color: "#495057", margin: "4px 0 2px" }}>
              Tree depth (max_depth) — {med3pa_params.apc.tree_max_depth}
            </p>
            <input
              type="range"
              min={1} max={10} step={1}
              style={{ width: "100%", marginBottom: 4 }}
              value={med3pa_params.apc.tree_max_depth}
              onChange={(e) => setApc("tree_max_depth", parseInt(e.target.value))}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#6C757D", marginBottom: 10 }}>
              <span>1</span><span>10</span>
            </div>

            <hr style={{ border: "none", borderTop: "1px solid #E9ECEF", margin: "10px 0" }} />

            <p style={{ fontSize: 12, fontWeight: 500, color: "#495057", margin: "4px 0 6px" }}>Complexity control</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, color: "#6C757D", display: "block", marginBottom: 2 }}>min_samples_leaf</label>
                <input
                  type="number"
                  placeholder="e.g. 5"
                  style={{ width: "100%", boxSizing: "border-box", height: 28 }}
                  value={med3pa_params.apc.min_leading_samples || ""}
                  onChange={(e) => setApc("min_leading_samples", parseInt(e.target.value) || 0)}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "#6C757D", display: "block", marginBottom: 2 }}>ccp_alpha</label>
                <input
                  type="number"
                  step={0.001}
                  placeholder="e.g. 0.01"
                  style={{ width: "100%", boxSizing: "border-box", height: 28 }}
                  value={med3pa_params.apc.ccp_alpha || ""}
                  onChange={(e) => setApc("ccp_alpha", parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
          </Collapsible>

          {/* MPC */}
          <Collapsible
            title="MPC — Mixed Predictive Confidence"
            subtitle="Combine IPC and APC into a single confidence signal"
            accentColor="#6A3FA0"
          >
            <p style={{ fontSize: 12, fontWeight: 500, color: "#495057", margin: "4px 0 6px" }}>Combination strategy</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
              {MPC_STRATEGIES.map((opt) => (
                <label key={opt.value} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="mpc_strategy"
                    value={opt.value}
                    checked={mpcCustomExpr === opt.value}
                    onChange={() => {setMpcCustomExpr(opt.value)
                        setTop("mpc_strategy", opt.value === "custom" ? null : opt.value)
                    }}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
            {mpcCustomExpr === "custom" && (
              <div style={{ background: "#F8F9FA", border: "1px solid #E9ECEF", borderRadius: 6, padding: "8px 10px" }}>
                <label style={{ fontSize: 11, color: "#6C757D", display: "block", marginBottom: 4 }}>f(IPC, APC) =</label>
                <input
                  style={{ width: "100%", boxSizing: "border-box", height: 30 }}
                  placeholder="e.g. 0.6 * IPC + 0.4 * APC"
                  value={med3pa_params.mpc_strategy??""}
                  onChange={(e) => setTop("mpc_strategy", e.target.value)}
                />
              </div>
            )}
          </Collapsible>

          <button
            style={{ width: "100%", padding: 10, marginTop: 8, background: "#0F6E56", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 14, fontWeight: 500 }}
            onClick={() => console.log(med3pa_params)}
          >
            ⚡ Run pipeline execution
          </button>
        </div>
      </div>
    </div>
  );
}