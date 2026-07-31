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

const ONNX_EXTENSIONS = ["onnx"]
const SKLEARN_EXTENSIONS = ["pkl", "pickle", "joblib"]

/**
 * @returns {JSX.Element} a page
 *
 * @description
 * Imports a model trained outside MEDomicsLab as a .medmodel, so it can be used
 * as a base model by MED3pa and by any other module that consumes .medmodel
 * objects. Accepts pickled sklearn-style estimators and ONNX graphs.
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

  const extension = filePath ? filePath.split(".").pop().toLowerCase() : null
  const isOnnx = ONNX_EXTENSIONS.includes(extension)
  const isKnownExtension = isOnnx || SKLEARN_EXTENSIONS.includes(extension)

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
          framework: isOnnx ? "onnx" : "sklearn",
          onnx_raw_logits: isOnnx ? rawLogits : false,
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
        <Message severity="error" className="mb-2 w-100" text={`.${extension} is not a supported model file. Use .pkl, .pickle, .joblib or .onnx.`} />
      )}
      <p style={{ fontSize: 11, color: "#6C757D", marginBottom: 12 }}>Pickled estimator (.pkl, .pickle, .joblib) or ONNX graph (.onnx).</p>

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

      {isOnnx && (
        <div style={{ background: "#F8F9FA", border: "1px solid #E9ECEF", borderRadius: 6, padding: "10px 12px", marginBottom: 12 }}>
          <p style={{ fontSize: 12, fontWeight: 500, margin: "0 0 8px" }}>ONNX options</p>

          <div className="d-flex align-items-start gap-2 mb-2">
            <Checkbox inputId="rawLogits" checked={rawLogits} onChange={(e) => setRawLogits(e.checked)} />
            <label htmlFor="rawLogits" style={{ fontSize: 13 }}>
              Outputs are raw logits
            </label>
          </div>
          <p style={{ fontSize: 11, color: "#6C757D", margin: "0 0 10px" }}>
            Tick this only if the graph was exported without its final sigmoid/softmax. It cannot be detected automatically, and getting it wrong
            produces confidence scores that look plausible but are wrong.
          </p>

          <label className="d-block mb-1" style={{ fontSize: 12 }}>
            Probability output name (optional)
          </label>
          <InputText className="w-100" value={onnxOutput} onChange={(e) => setOnnxOutput(e.target.value)} placeholder="probabilities" />
          <p style={{ fontSize: 11, color: "#6C757D", margin: "6px 0 0" }}>Only needed when the graph has several outputs and none is named for probabilities.</p>
        </div>
      )}

      <Button label={isImporting ? "Importing…" : "Import model"} className="w-100" disabled={!canImport} onClick={runImport} />
    </div>
  )
}

export default ExternalModelImport
