
import Input from "../learning/input";
import { json } from "d3";
import { useContext, useState } from "react";
import { requestBackend } from "../../utilities/requests";
import { PageInfosContext } from "../mainPages/moduleBasics/pageInfosContext";
import { WorkspaceContext } from "../workspace/workspaceContext";
import { ErrorRequestContext } from "../generalPurpose/errorRequestContext";
import ProgressBarRequests from "../generalPurpose/progressBarRequests";
import { toast } from "react-toastify";

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

export default function Med3paConfigForm({ onAnalysisComplete = null, onNextStep = null }) {
  const [med3pa_params, setMed3paParams] = useState({
    base_model: null,
    chosen_dataset: null,
    session_name: null,
    target_column: null,
    ipc: {
      n_estimators: 0,
      max_depth: 0,
      min_samples_split: 0,
      confidence_metric: null,
      ipc_type: "EnsembleRandomForestRegressor",
      // uncertainty_metric: "sigmoidal_error",
      grid: {
        n_estimators: null,
        max_depth: null,
        min_samples_leaf: null,
      },
    },
    apc: {
      tree_max_depth: 3,
      min_leading_samples: 0,
      ccp_alpha: 0,
      grid: {
        max_depth: null,
        min_samples_leaf: null,
      },
    },
    mpc_strategy: null,
    samples_ratio: { min: 0, max: 10, step: 5 },
    evaluate_models: true,
  });

  const [ipcCustomExpr, setIpcCustomExpr] = useState(false);
  const [mpcCustomExpr, setMpcCustomExpr] = useState(false);
  const [modelHasWarning, setModelHasWarning] = useState({ state: false, tooltip: "" })
  const [datasetHasWarning, setDatasetHasWarning] = useState({ state: false, tooltip: "" })
  const setTop = (key, val) =>
    setMed3paParams((p) => ({ ...p, [key]: val }));

  const setIpc = (key, val) =>
    setMed3paParams((p) => ({ ...p, ipc: { ...p.ipc, [key]: val } }));

  const setApc = (key, val) =>
    setMed3paParams((p) => ({ ...p, apc: { ...p.apc, [key]: val } }));

  const setIpcGrid = (key, val) =>
    setMed3paParams((p) => ({ ...p, ipc: { ...p.ipc, grid: { ...p.ipc.grid, [key]: val } } }));

  const setApcGrid = (key, val) =>
    setMed3paParams((p) => ({ ...p, apc: { ...p.apc, grid: { ...p.apc.grid, [key]: val } } }));

  const setSamplesRatio = (key, val) =>
    setMed3paParams((p) => ({ ...p, samples_ratio: { ...p.samples_ratio, [key]: val } }));

  const STEPS_CURRENT = [
    { n: "1", name: "Configure model", active: true },
    { n: "2", name: "Analysis", active: false },
    { n: "3", name: "Deploy", active: false },
  ];
  const { pageId } = useContext(PageInfosContext);
  const { port } = useContext(WorkspaceContext);
  const { setError } = useContext(ErrorRequestContext);
  const [isUpdating, setIsUpdating] = useState(false);
  const [progressValue, setProgressValue] = useState({ now: 0, currentLabel: "" });

  const runAnalysis = () => {
    setIsUpdating(true);
    requestBackend(
      port,
      "med3pa/run_analysis/" + pageId,           
      { pageId: pageId, med3pa_params: med3pa_params },
      (jsonResponse) => {
        if (jsonResponse.error) {
          if (typeof jsonResponse.error == "string") jsonResponse.error = JSON.parse(jsonResponse.error);
          setError(jsonResponse.error);
          setIsUpdating(false);
        } else {
          setIsUpdating(false);
          console.log("med3pa result:", jsonResponse);
          toast.success("MED3pa analysis complete");
          if (onAnalysisComplete) onAnalysisComplete(med3pa_params.session_name || "med3pa_session");
        }
      },
      (error) => {
        setIsUpdating(false);
        toast.error("Analysis failed", error);
      }
    );
  };
  return (
    <div style={{ fontFamily: "sans-serif", padding: "1rem" }}>

      {/* Top bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 2 }}>Configuration Page</div>
          <div style={{ fontSize: 12, color: "#6C757D" }}>ICU in-hospital mortality · Configure inputs</div>
        </div>
        {onNextStep && (
          <button
            style={{ padding: "8px 18px", background: "#185FA5", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 500 }}
            onClick={onNextStep}
          >
            Next step →
          </button>
        )}
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


          <Input
              name="Base Model Source Architecture"
              settingInfos={{ type: "models-input", tooltip: "" }}
              currentValue={med3pa_params.base_model?.id}
              onInputChange={(data) => setTop("base_model",data.value)}
              setHasWarning={setModelHasWarning}
            />
          
          <label style={{ fontSize: 12, color: "#6C757D", display: "block", marginBottom: 4 }}>
            Training Data (.csv)
          </label>
          <Input
                name="Choose dataset"
                settingInfos={{ type: "data-input", tooltip: "" }}
                currentValue={med3pa_params.chosen_dataset?.id}
                onInputChange={(data) => setTop("chosen_dataset",data.value)}
                setHasWarning={setDatasetHasWarning}
              />
          <label style={{ fontSize: 12, color: "#6C757D", display: "block", marginBottom: 4 }}>
            Target column
          </label>
          <input
            type="text"
            placeholder="e.g. deceased"
            style={{ width: "100%", boxSizing: "border-box", height: 28, marginBottom: 8 }}
            value={med3pa_params.target_column ?? ""}
            onChange={(e) => setTop("target_column", e.target.value || null)}
          />
          <label style={{ fontSize: 12, color: "#6C757D", display: "block", marginBottom: 4 }}>
          Session Name
        </label>
        <input type="text" placeholder="" style={{ width: "100%", boxSizing: "border-box", height: 28 }} value={med3pa_params.session_name ?? ""} onChange={(e) => setTop("session_name", e.target.value || null)} />
       
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

            <hr style={{ border: "none", borderTop: "1px solid #E9ECEF", margin: "10px 0" }} />

            <p style={{ fontSize: 12, fontWeight: 500, color: "#495057", margin: "6px 0 4px" }}>
              IPC regressor
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 8 }}>
              <div>
                <label style={{ fontSize: 11, color: "#6C757D", display: "block", marginBottom: 2 }}>ipc_type</label>
                <input
                  type="text"
                  style={{ width: "100%", boxSizing: "border-box", height: 28 }}
                  value={med3pa_params.ipc.ipc_type ?? ""}
                  onChange={(e) => setIpc("ipc_type", e.target.value || null)}
                />
              </div>
              {/* <div>
                <label style={{ fontSize: 11, color: "#6C757D", display: "block", marginBottom: 2 }}>uncertainty_metric</label>
                <input
                  type="text"
                  style={{ width: "100%", boxSizing: "border-box", height: 28 }}
                  value={med3pa_params.ipc.uncertainty_metric ?? ""}
                  onChange={(e) => setIpc("uncertainty_metric", e.target.value || null)}
                />
              </div> */}
            </div>

            <p style={{ fontSize: 12, fontWeight: 500, color: "#495057", margin: "6px 0 4px" }}>
              Grid-search ranges (comma-separated)
            </p>
            <div style={{ marginBottom: 6 }}>
              <label style={{ fontSize: 11, color: "#6C757D", display: "block", marginBottom: 2 }}>n_estimators</label>
              <input
                type="text"
                placeholder="e.g. 50, 100, 200"
                style={{ width: "100%", boxSizing: "border-box", height: 28 }}
                value={med3pa_params.ipc.grid.n_estimators ?? ""}
                onChange={(e) => setIpcGrid("n_estimators", e.target.value || null)}
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, color: "#6C757D", display: "block", marginBottom: 2 }}>max_depth</label>
                <input
                  type="text"
                  placeholder="e.g. 2, 3, 4, 5"
                  style={{ width: "100%", boxSizing: "border-box", height: 28 }}
                  value={med3pa_params.ipc.grid.max_depth ?? ""}
                  onChange={(e) => setIpcGrid("max_depth", e.target.value || null)}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "#6C757D", display: "block", marginBottom: 2 }}>min_samples_leaf</label>
                <input
                  type="text"
                  placeholder="e.g. 1, 2, 4"
                  style={{ width: "100%", boxSizing: "border-box", height: 28 }}
                  value={med3pa_params.ipc.grid.min_samples_leaf ?? ""}
                  onChange={(e) => setIpcGrid("min_samples_leaf", e.target.value || null)}
                />
              </div>
            </div>
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

            <hr style={{ border: "none", borderTop: "1px solid #E9ECEF", margin: "10px 0" }} />

            <p style={{ fontSize: 12, fontWeight: 500, color: "#495057", margin: "6px 0 4px" }}>
              Grid-search ranges (comma-separated)
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, color: "#6C757D", display: "block", marginBottom: 2 }}>max_depth</label>
                <input
                  type="text"
                  placeholder="e.g. 2, 3, 4, 5"
                  style={{ width: "100%", boxSizing: "border-box", height: 28 }}
                  value={med3pa_params.apc.grid.max_depth ?? ""}
                  onChange={(e) => setApcGrid("max_depth", e.target.value || null)}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "#6C757D", display: "block", marginBottom: 2 }}>min_samples_leaf</label>
                <input
                  type="text"
                  placeholder="e.g. 1, 2, 4"
                  style={{ width: "100%", boxSizing: "border-box", height: 28 }}
                  value={med3pa_params.apc.grid.min_samples_leaf ?? ""}
                  onChange={(e) => setApcGrid("min_samples_leaf", e.target.value || null)}
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

          {/* Experiment settings */}
          <Collapsible
            title="Experiment settings"
            subtitle="Declaration-rate sweep and model evaluation"
            accentColor="#B5651D"
          >
            <p style={{ fontSize: 12, fontWeight: 500, color: "#495057", margin: "4px 0 6px" }}>
              Samples ratio sweep
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 8 }}>
              <div>
                <label style={{ fontSize: 11, color: "#6C757D", display: "block", marginBottom: 2 }}>min</label>
                <input
                  type="number"
                  style={{ width: "100%", boxSizing: "border-box", height: 28 }}
                  value={med3pa_params.samples_ratio.min}
                  onChange={(e) => setSamplesRatio("min", parseInt(e.target.value) || 0)}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "#6C757D", display: "block", marginBottom: 2 }}>max</label>
                <input
                  type="number"
                  style={{ width: "100%", boxSizing: "border-box", height: 28 }}
                  value={med3pa_params.samples_ratio.max}
                  onChange={(e) => setSamplesRatio("max", parseInt(e.target.value) || 0)}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "#6C757D", display: "block", marginBottom: 2 }}>step</label>
                <input
                  type="number"
                  style={{ width: "100%", boxSizing: "border-box", height: 28 }}
                  value={med3pa_params.samples_ratio.step}
                  onChange={(e) => setSamplesRatio("step", parseInt(e.target.value) || 0)}
                />
              </div>
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer", marginTop: 4 }}>
              <input
                type="checkbox"
                checked={med3pa_params.evaluate_models}
                onChange={(e) => setTop("evaluate_models", e.target.checked)}
              />
              Evaluate models
            </label>
          </Collapsible>

          <button
            style={{ width: "100%", padding: 10, marginTop: 8, background: "#0F6E56", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 14, fontWeight: 500 }}
            onClick={runAnalysis}
          >
            ⚡ Run Analysis
          </button>
          {isUpdating && (
  <ProgressBarRequests
    isUpdating={isUpdating}
    setIsUpdating={setIsUpdating}
    progress={progressValue}
    setProgress={setProgressValue}
    requestTopic={"med3pa/progress/" + pageId}
  />)}
        </div>
      </div>
    </div>
  );
}