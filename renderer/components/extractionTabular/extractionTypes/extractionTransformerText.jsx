import React, { useState, useEffect, useContext } from "react"
import { Dropdown } from "primereact/dropdown"
import { RadioButton } from "primereact/radiobutton"
import { InputText } from "primereact/inputtext"
import { Card } from "primereact/card"
import { Button } from "primereact/button"
import { shell } from "electron"
import { TEXT_MODEL_REGISTRY, TEXT_MODEL_DETAILS } from "./textModelRegistry"
import { requestBackend } from "../../../utilities/requests"
import { ServerConnectionContext } from "../../serverConnection/connectionContext"
import { PageInfosContext } from "../../mainPages/moduleBasics/pageInfosContext"

const AGGREGATION_MODES = [
  { label: "Per Note (One row per note)", value: "note" },
  { label: "Per Patient (Average embeddings)", value: "patient" }
]

const ExtractionTransformerText = ({ columnsTypes, setExtractionJsonData, setMayProceed }) => {
  // Form State
  const [modelSourceType, setModelSourceType] = useState("predefined") // predefined, local
  const [selectedModel, setSelectedModel] = useState("biobert_v1_1")
  const [localModelPath, setLocalModelPath] = useState("")
  const [columnPrefix, setColumnPrefix] = useState("text_embed")
  const [aggregationMode, setAggregationMode] = useState("note")

  // Model download status: { [model_id]: boolean }. Empty/missing entries
  // mean "unknown" (still loading, or the check failed) - always falls back
  // to the static "Auto-downloaded if missing" label in that case.
  const [modelDownloadStatus, setModelDownloadStatus] = useState({})
  const [modelStatusLoading, setModelStatusLoading] = useState(true)

  const { port } = useContext(ServerConnectionContext)
  const { pageId } = useContext(PageInfosContext)

  // Column Mappings (similar to BioBERT)
  const [selectedColumns, setSelectedColumns] = useState({
    patientIdentifier: "",
    admissionIdentifier: "",
    admissionTime: "",
    notes: "",
    time: ""
  })

  /**
   * Handle column selection from dropdowns
   */
  const handleColumnSelect = (key, event) => {
    const val = event.value
    setSelectedColumns((prev) => ({ ...prev, [key]: val }))
  }

  /**
   * On mount, check which predefined models are already downloaded locally.
   * Never blocks the UI: any failure just leaves modelDownloadStatus empty,
   * so the static "Auto-downloaded if missing" label is shown instead.
   */
  useEffect(() => {
    requestBackend(
      port,
      "/extraction_text/check_models_downloaded/" + pageId,
      {},
      (response) => {
        setModelStatusLoading(false)
        if (response && !response.error) {
          setModelDownloadStatus(response)
        }
      },
      () => {
        setModelStatusLoading(false)
      }
    )
  }, [])

  /**
   * Update parent state when configuration changes
   */
  useEffect(() => {
    // Validation: Need at least patient ID and Text column
    // And model selection
    const isValid = selectedColumns.patientIdentifier && selectedColumns.notes && (modelSourceType === "predefined" ? selectedModel : localModelPath)

    setMayProceed(!!isValid)

    const config = {
      selectedColumns,
      columnPrefix,
      model_source_type: modelSourceType,
      model_name_or_path: modelSourceType === "predefined" ? selectedModel : localModelPath,
      aggregation_mode: aggregationMode,
      // Add legacy fields if backend expects them for consistency, though we might not use all
      frequency: aggregationMode === "note" ? "Note" : "Patient"
    }

    setExtractionJsonData(config)
  }, [selectedColumns, columnPrefix, modelSourceType, selectedModel, localModelPath, aggregationMode])

  const selectedInfo = modelSourceType === "predefined" ? TEXT_MODEL_DETAILS[selectedModel] : null

  /**
   * Renders a downloaded/not-downloaded icon next to each model option.
   * Shows no icon while the check is loading or for models whose status
   * is unknown (check failed).
   */
  const modelItemTemplate = (option) => {
    const isDownloaded = modelDownloadStatus[option.value]
    return (
      <div className="flex align-items-center justify-content-between w-full">
        <span>{option.label}</span>
        {!modelStatusLoading && isDownloaded !== undefined && (
          <i
            className={isDownloaded ? "pi pi-check-circle text-green-500 ml-2" : "pi pi-cloud-download text-500 ml-2"}
            title={isDownloaded ? "Already downloaded" : "Not downloaded yet"}
          ></i>
        )}
      </div>
    )
  }

  // Card 1: Column Selection
  const columnSelectionContent = (
    <Card title="1. Column Mapping" className="mb-4 w-full">
      <div className="flex flex-column gap-4">
        <div className="field">
          <label className="block font-bold mb-2">Patient Identifier &nbsp;</label>
          <Dropdown
            value={selectedColumns.patientIdentifier}
            options={Object.keys(columnsTypes)}
            onChange={(e) => handleColumnSelect("patientIdentifier", e)}
            placeholder="Select Patient ID Column"
            className="w-full mt-1"
          />
        </div>
        <div className="field">
          <label className="block font-bold mb-2">Text / Notes Column &nbsp;</label>
          <Dropdown value={selectedColumns.notes} options={Object.keys(columnsTypes)} onChange={(e) => handleColumnSelect("notes", e)} placeholder="Select Text Column" className="w-full mt-1" />
        </div>
        <div className="field">
          <label className="block mb-2">Date / Time (Optional) &nbsp;</label>
          <Dropdown value={selectedColumns.time} options={Object.keys(columnsTypes)} onChange={(e) => handleColumnSelect("time", e)} placeholder="Select Time Column" className="w-full mt-1" />
        </div>
      </div>
    </Card>
  )

  // Card 2: Model Configuration
  const modelConfigContent = (
    <Card title="2. Model Configuration" className="mb-4 w-full">
      <div className="flex flex-column gap-4">
        <div className="flex gap-4 mb-2">
          <div className="field-radiobutton">
            <RadioButton inputId="srcPre" name="source" value="predefined" onChange={(e) => setModelSourceType(e.value)} checked={modelSourceType === "predefined"} />
            <label htmlFor="srcPre" className="ml-2">
              &nbsp; Predefined HF Model
            </label>
          </div>
          <div className="field-radiobutton">
            <RadioButton inputId="srcLocal" name="source" value="local" onChange={(e) => setModelSourceType(e.value)} checked={modelSourceType === "local"} />
            <label htmlFor="srcLocal" className="ml-2">
              &nbsp; Custom (Path/ID)
            </label>
          </div>
        </div>

        {modelSourceType === "predefined" ? (
          <Dropdown
            value={selectedModel}
            options={TEXT_MODEL_REGISTRY}
            onChange={(e) => setSelectedModel(e.value)}
            className="w-full mt-1"
            placeholder="Select a model"
            itemTemplate={modelItemTemplate}
          />
        ) : (
          <div className="flex flex-column">
            <InputText value={localModelPath} onChange={(e) => setLocalModelPath(e.target.value)} placeholder="e.g. bert-base-uncased OR /path/to/model" className="w-full mt-1" />
            <small className="mt-2">Enter Hugging Face Model ID or absolute path.</small>
          </div>
        )}

        {/* Information Card */}
        {selectedInfo && (
          <div className="mt-3 surface-ground border-round p-3 border-1 border-300">
            <div className="flex align-items-center mb-3">
              <i className="pi pi-info-circle text-blue-500 mr-2" style={{ fontSize: "1.2rem" }}></i>
              <span className="font-bold text-lg">&nbsp; {TEXT_MODEL_REGISTRY.find((m) => m.value === selectedModel)?.label}</span>
            </div>
            <p className="m-0 mb-3 line-height-3 text-700">{selectedInfo.description}</p>
            <div className="grid mb-3">
              <div className="col-12 md:col-6">
                <div className="text-600 mb-1">Model size:</div>
                <div className="font-medium">{selectedInfo.size || "Unknown"}</div>
              </div>
              <div className="col-12 md:col-6">
                <div className="text-600 text-xs mb-1">Configuration:</div>
                <div className="font-medium">{selectedInfo.config || "Unknown"}</div>
              </div>
            </div>
            <div className="flex align-items-center justify-content-between mt-2">
              <Button
                link
                label="View on Hugging Face"
                icon="pi pi-external-link"
                // Use Electron shell to open external links
                onClick={() => shell.openExternal(selectedInfo.link)}
                // onClick={() => window.open(selectedInfo.link, '_blank')}
                className="p-0"
              />
              <span className="text-500 text-xs">
                <i className={`pi ${modelDownloadStatus[selectedModel] === true ? "pi-check-circle" : "pi-cloud-download"} mr-1`}></i>
                {modelDownloadStatus[selectedModel] === true
                  ? "Already downloaded"
                  : modelDownloadStatus[selectedModel] === false
                    ? "Not downloaded — will fetch on first run"
                    : "Auto-downloaded if missing"}
              </span>
            </div>
          </div>
        )}

        <div className="field mt-3">
          <label className="block font-bold mb-2">Aggregation Mode</label>
          <Dropdown value={aggregationMode} options={AGGREGATION_MODES} onChange={(e) => setAggregationMode(e.value)} className="w-full mt-1" />
        </div>
      </div>
    </Card>
  )

  // Card 3: Output Settings
  const outputSettingsContent = (
    <Card title="3. Output Settings" className="mb-4 w-full">
      <div className="flex flex-column gap-3">
        <div className="field">
          <label className="block font-bold mb-2">Column Prefix</label>
          <InputText value={columnPrefix} onChange={(e) => setColumnPrefix(e.target.value)} className="w-full mt-1" />
          <small className="mt-2">
            Prefix for generated feature columns (e.g. {columnPrefix}_0, {columnPrefix}_1...)
          </small>
        </div>
      </div>
    </Card>
  )

  return (
    <div className="p-2" style={{ maxWidth: "800px", margin: "0 auto" }}>
      {columnSelectionContent}
      {modelConfigContent}
      {outputSettingsContent}
    </div>
  )
}

export default ExtractionTransformerText
