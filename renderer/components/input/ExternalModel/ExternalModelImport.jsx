/* eslint-disable camelcase */
import { randomUUID } from "crypto"
import { ipcRenderer } from "electron"
import { Button } from "primereact/button"
import { Checkbox } from "primereact/checkbox"
import { InputText } from "primereact/inputtext"
import { InputTextarea } from "primereact/inputtextarea"
import { Message } from "primereact/message"
import { useContext, useState } from "react"
import { toast } from "react-toastify"
import { requestBackend } from "../../../utilities/requests"
import { insertMEDDataObjectIfNotExists } from "../../mongoDB/mongoDBUtils"
import { DataContext } from "../../workspace/dataContext"
import { MEDDataObject } from "../../workspace/NewMedDataObject"
import { WorkspaceContext } from "../../workspace/workspaceContext"

/**
 * Which framework each file extension belongs to.
 *
 * Mirrors FRAMEWORK_EXTENSIONS in pythonCode/med_libs/model_loading.py, which
 * is authoritative -- the python side re-derives the framework and will reject
 * a file this map guesses wrong about. Kept here only so the form can show the
 * framework and the options that apply to it before anything is uploaded.
 */
const FRAMEWORK_BY_EXTENSION = {
  onnx: "onnx",
  pkl: "sklearn",
  pickle: "sklearn",
  joblib: "sklearn",
  json: "xgboost",
  ubj: "xgboost",
  xgb: "xgboost",
  txt: "lightgbm",
  lgb: "lightgbm",
  pt: "pytorch",
  pth: "pytorch",
  keras: "keras",
  h5: "keras"
}

const FRAMEWORK_LABELS = {
  onnx: "ONNX graph",
  sklearn: "scikit-learn (pickled estimator)",
  xgboost: "XGBoost (native Booster)",
  lightgbm: "LightGBM (native Booster)",
  pytorch: "PyTorch (saved module)",
  keras: "Keras / TensorFlow"
}

// Frameworks whose libraries are not pinned in requirements.txt, so the import
// can fail on a missing package rather than on the model itself.
const OPTIONAL_DEPENDENCY = {
  pytorch: "torch",
  keras: "tensorflow (or keras)"
}

/**
 * @returns {JSX.Element} a page
 *
 * @description
 * Imports a model trained outside MEDomicsLab as a .medmodel, so it can be used
 * as a base model by MED3pa and by any other module that consumes .medmodel
 * objects.
 *
 * Which frameworks are accepted is decided by the adapter registry in
 * med_libs/model_loading.py, not here: the only thing MED3pa asks of a base
 * model is predict_proba(X) -> (n, 2), and each adapter is what makes one
 * framework satisfy it.
 */
const ExternalModelImport = () => {
  const { globalData } = useContext(DataContext)
  const { port } = useContext(WorkspaceContext)

  const [filePath, setFilePath] = useState(null)
  const [modelName, setModelName] = useState("")
  const [featureText, setFeatureText] = useState("")
  const [target, setTarget] = useState("")
  const [threshold, setThreshold] = useState("")
  const [rawLogits, setRawLogits] = useState(false)
  const [onnxOutput, setOnnxOutput] = useState("")
  const [isImporting, setIsImporting] = useState(false)
  // Null means "use whatever the extension implies". Set only when the user
  // corrects the guess, which matters for .json and .txt.
  const [frameworkOverride, setFrameworkOverride] = useState(null)

  const extension = filePath ? filePath.split(".").pop().toLowerCase() : null
  const detectedFramework = FRAMEWORK_BY_EXTENSION[extension] ?? null
  const framework = frameworkOverride ?? detectedFramework
  const isOnnx = framework === "onnx"
  const isKnownExtension = detectedFramework !== null
  // sklearn estimators always return probabilities; every other framework can
  // have been exported without its final activation.
  const supportsRawLogits = framework !== null && framework !== "sklearn"

  /**
   * @description Parse the feature textarea into an ordered list of column names
   * @returns {Array} the feature names, in the order the user wrote them
   */
  const parseFeatures = () =>
    featureText
      .split(/[\n,]/)
      .map((f) => f.trim())
      .filter((f) => f !== "")

  /**
   * @description Open the native file picker and remember the chosen artifact
   */
  const chooseFile = async () => {
    const selected = await ipcRenderer.invoke("select-model-file")
    if (!selected) return
    setFilePath(selected)
    // A new file re-detects; a correction for the previous one must not stick.
    setFrameworkOverride(null)
    if (!modelName) {
      const base = selected.split(/[\\/]/).pop()
      setModelName(base.substring(0, base.lastIndexOf(".")) || base)
    }
  }

  /**
   * @description Get the MODELS folder at the workspace root, creating it on first use.
   * Imported models belong to no experiment, so parenting them under one would
   * imply a provenance that does not exist.
   * @returns {String} the MEDDataObject id of the MODELS folder
   */
  const ensureModelsFolder = async () => {
    if (globalData?.ROOT) {
      const existing = MEDDataObject.getChildIDWithName(globalData, "ROOT", "MODELS")
      if (existing) return existing
    }
    const folder = new MEDDataObject({
      id: randomUUID(),
      name: "MODELS",
      type: "directory",
      parentID: "ROOT",
      childrenIDs: [],
      inWorkspace: false
    })
    return await insertMEDDataObjectIfNotExists(folder)
  }

  const runImport = async () => {
    const features = parseFeatures()
    setIsImporting(true)
    let parentId
    try {
      parentId = await ensureModelsFolder()
    } catch (error) {
      setIsImporting(false)
      toast.error(`Could not create the MODELS folder: ${error.message}`)
      return
    }

    requestBackend(
      port,
      "learning/import_external_model/externalModelImport",
      {
        import_params: {
          file_path: filePath,
          model_name: modelName,
          parent_id: parentId,
          columns: features,
          target: target,
          ml_type: "classification",
          threshold: threshold === "" ? null : parseFloat(threshold),
          framework: framework,
          raw_logits: supportsRawLogits ? rawLogits : false,
          onnx_output: isOnnx ? onnxOutput : null
        }
      },
      (jsonResponse) => {
        setIsImporting(false)
        if (jsonResponse.error) {
          const message = typeof jsonResponse.error == "string" ? jsonResponse.error : jsonResponse.error.message
          toast.error(`Import failed: ${message}`)
          return
        }
        const warnings = jsonResponse.warnings || []
        warnings.forEach((w) => toast.warn(w))
        toast.success(`Imported ${jsonResponse.name} with ${jsonResponse.columns?.length ?? 0} features`)
        MEDDataObject.updateWorkspaceDataObject()
      },
      (error) => {
        setIsImporting(false)
        toast.error(`Import failed: ${error.message ?? error}`)
      }
    )
  }

  const canImport = filePath && isKnownExtension && modelName.trim() !== "" && target.trim() !== "" && !isImporting

  return (
    <div className="p-3" style={{ maxWidth: 720 }}>
      <Message
        severity="info"
        className="mb-3 w-100"
        content={
          <span>
            The model must expose a binary <code>predict_proba</code>, which is what MED3pa uses to compute confidence. It is tested on a sample row
            before anything is saved.
          </span>
        }
      />

      <label className="d-block mb-1">Model file</label>
      <div className="d-flex align-items-center gap-2 mb-1">
        <Button label="Choose file…" outlined onClick={chooseFile} />
        <span style={{ fontSize: 12, color: "#6C757D", wordBreak: "break-all" }}>{filePath ?? "No file selected"}</span>
      </div>
      {filePath && !isKnownExtension && (
        <Message
          severity="error"
          className="mb-2 w-100"
          text={`.${extension} is not a supported model file. Use ${Object.keys(FRAMEWORK_BY_EXTENSION)
            .map((e) => `.${e}`)
            .join(", ")}.`}
        />
      )}
      <p style={{ fontSize: 11, color: "#6C757D", marginBottom: 12 }}>
        Pickled estimator (.pkl, .pickle, .joblib), ONNX graph (.onnx), XGBoost Booster (.json, .ubj), LightGBM Booster (.txt), PyTorch module (.pt,
        .pth) or Keras model (.keras, .h5).
      </p>

      {framework && (
        <>
          <label className="d-block mb-1">Framework</label>
          <select
            className="form-select mb-1"
            value={framework}
            onChange={(e) => setFrameworkOverride(e.target.value)}
            style={{ fontSize: 13 }}
          >
            {Object.keys(FRAMEWORK_LABELS).map((key) => (
              <option key={key} value={key}>
                {FRAMEWORK_LABELS[key]}
              </option>
            ))}
          </select>
          <p style={{ fontSize: 11, color: "#6C757D", marginBottom: 12 }}>
            {frameworkOverride && frameworkOverride !== detectedFramework
              ? `Overriding the guess from .${extension}.`
              : `Detected from .${extension}. Change it if that is wrong — .json and .txt are ambiguous.`}
            {OPTIONAL_DEPENDENCY[framework] && ` Needs ${OPTIONAL_DEPENDENCY[framework]} in the app's python environment.`}
          </p>
        </>
      )}

      <label className="d-block mb-1">Model name</label>
      <InputText className="w-100 mb-3" value={modelName} onChange={(e) => setModelName(e.target.value)} placeholder="saved as <name>.medmodel" />

      <label className="d-block mb-1">Target column</label>
      <InputText className="w-100 mb-3" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="e.g. deceased" />

      <label className="d-block mb-1">Features, in the order the model expects them</label>
      <InputTextarea className="w-100" rows={5} value={featureText} onChange={(e) => setFeatureText(e.target.value)} placeholder="age, sex, lactate, …" />
      <p style={{ fontSize: 11, color: "#6C757D", marginBottom: 12 }}>
        One per line or comma-separated. Leave blank for a pickled model that records its own feature names — the import will read them and fail if it
        cannot.
      </p>

      <label className="d-block mb-1">Decision threshold (optional)</label>
      <InputText className="w-100 mb-1" value={threshold} onChange={(e) => setThreshold(e.target.value)} placeholder="0.5" />
      <p style={{ fontSize: 11, color: "#6C757D", marginBottom: 12 }}>Probability above which a prediction counts as positive. Defaults to 0.5.</p>

      {supportsRawLogits && (
        <div style={{ background: "#F8F9FA", border: "1px solid #E9ECEF", borderRadius: 6, padding: "10px 12px", marginBottom: 12 }}>
          <p style={{ fontSize: 12, fontWeight: 500, margin: "0 0 8px" }}>{FRAMEWORK_LABELS[framework]} options</p>

          <div className="d-flex align-items-start gap-2 mb-2">
            <Checkbox inputId="rawLogits" checked={rawLogits} onChange={(e) => setRawLogits(e.checked)} />
            <label htmlFor="rawLogits" style={{ fontSize: 13 }}>
              Outputs are raw logits
            </label>
          </div>
          <p style={{ fontSize: 11, color: "#6C757D", margin: "0 0 10px" }}>
            Tick this only if the model was exported without its final sigmoid/softmax — an XGBoost <code>binary:logitraw</code> objective, a PyTorch
            head with no sigmoid, an ONNX graph cut before its activation. It cannot be detected automatically, and getting it wrong produces
            confidence scores that look plausible but are wrong.
          </p>

          {isOnnx && (
            <>
              <label className="d-block mb-1" style={{ fontSize: 12 }}>
                Probability output name (optional)
              </label>
              <InputText className="w-100" value={onnxOutput} onChange={(e) => setOnnxOutput(e.target.value)} placeholder="probabilities" />
              <p style={{ fontSize: 11, color: "#6C757D", margin: "6px 0 0" }}>Only needed when the graph has several outputs and none is named for probabilities.</p>
            </>
          )}
        </div>
      )}

      <Button label={isImporting ? "Importing…" : "Import model"} className="w-100" disabled={!canImport} onClick={runImport} />
    </div>
  )
}

export default ExternalModelImport
