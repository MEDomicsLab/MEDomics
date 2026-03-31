
import React, { useState, useEffect } from 'react';
import { Dropdown } from 'primereact/dropdown';
import { RadioButton } from 'primereact/radiobutton';
import { InputText } from 'primereact/inputtext';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { shell } from 'electron';
const PREDEFINED_MODELS = [
    { label: "BioBERT v1.1", value: "biobert_v1_1" },
    { label: "BiomedNLP-BiomedBERT", value: "biomedbert_pubmed" },
    { label: "SapBERT PubMed", value: "sapbert_pubmed" },
    { label: "ModernPubMedBERT", value: "modern_pubmedbert" },
    { label: "BioClinical-ModernBERT", value: "bioclinical_modernbert" },
    { label: "Bio_ClinicalBERT", value: "bio_clinical_bert" },
    { label: "ClinicalBERT", value: "clinicalbert" },
    { label: "BlueBERT PubMed MIMIC", value: "bluebert_pubmed_mimic" },
    { label: "Clinical_ModernBERT", value: "clinical_modernbert" }
];

const MODEL_DETAILS = {
    "biobert_v1_1": {
        description: "BioBERT: Pre-trained on PubMed abstracts and PMC full-text articles. Good baseline for biomedical tasks.",
        link: "https://huggingface.co/dmis-lab/biobert-v1.1",
        size: "~420MB",
        config: "BERT base (12L, 768H, 12A)"
    },
    "biomedbert_pubmed": {
        description: "BiomedNLP-BiomedBERT: The standard PubMedBERT model, pre-trained from scratch on PubMed.",
        link: "https://huggingface.co/microsoft/BiomedNLP-BiomedBERT-base-uncased-abstract-fulltext",
        size: "~420MB",
        config: "BERT base (12L, 768H, 12A)"
    },
    "sapbert_pubmed": {
        description: "SapBERT: Self-alignment pre-training for biomedical entity representation.",
        link: "https://huggingface.co/cambridgeltl/SapBERT-from-PubMedBERT-fulltext",
        size: "~420MB",
        config: "BERT base (12L, 768H, 12A)"
    },
    "modern_pubmedbert": {
        description: "ModernPubMedBERT: A generic PubMedBERT model.",
        link: "https://huggingface.co/lokeshch19/ModernPubMedBERT",
        size: "~420MB",
        config: "BERT base (12L, 768H, 12A)"
    },
    "bioclinical_modernbert": {
        description: "BioClinical-ModernBERT: Adapted for both biological and clinical contexts.",
        link: "https://huggingface.co/thomas-sounack/BioClinical-ModernBERT-base",
        size: "~420MB",
        config: "BERT base (12L, 768H, 12A)"
    },
    "bio_clinical_bert": {
        description: "Bio_ClinicalBERT: Initialized from BioBERT and further trained on MIMIC-III.",
        link: "https://huggingface.co/emilyalsentzer/Bio_ClinicalBERT",
        size: "~420MB",
        config: "BERT base (12L, 768H, 12A)"
    },
    "clinicalbert": {
        description: "ClinicalBERT: Pre-trained on MIMIC-III clinical notes.",
        link: "https://huggingface.co/medicalai/ClinicalBERT",
        size: "~420MB",
        config: "BERT base (12L, 768H, 12A)"
    },
    "bluebert_pubmed_mimic": {
        description: "BlueBERT: Pre-trained on PubMed and MIMIC-III.",
        link: "https://huggingface.co/bionlp/bluebert_pubmed_mimic_uncased_L-12_H-768_A-12",
        size: "~420MB",
        config: "BERT base (12L, 768H, 12A)"
    },
    "clinical_modernbert": {
        description: "Clinical_ModernBERT: Modern text embeddings for clinical domain.",
        link: "https://huggingface.co/Simonlee711/Clinical_ModernBERT",
        size: "~420MB",
        config: "BERT base (12L, 768H, 12A)"
    }
};

const AGGREGATION_MODES = [
    { label: 'Per Note (One row per note)', value: 'note' },
    { label: 'Per Patient (Average embeddings)', value: 'patient' }
];

const ExtractionTransformerText = ({ columnsTypes, setExtractionJsonData, setMayProceed }) => {
    // Form State
    const [modelSourceType, setModelSourceType] = useState("predefined"); // predefined, local
    const [selectedModel, setSelectedModel] = useState("biobert_v1_1");
    const [localModelPath, setLocalModelPath] = useState("");
    const [columnPrefix, setColumnPrefix] = useState("text_embed");
    const [aggregationMode, setAggregationMode] = useState("note");
    
    // Column Mappings (similar to BioBERT)
    const [selectedColumns, setSelectedColumns] = useState({
        patientIdentifier: "",
        admissionIdentifier: "",
        admissionTime: "",
        notes: "",
        time: ""
    });

    /**
     * Handle column selection from dropdowns
     */
    const handleColumnSelect = (key, event) => {
        const val = event.value;
        setSelectedColumns(prev => ({ ...prev, [key]: val }));
    };

    /**
     * Update parent state when configuration changes
     */
    useEffect(() => {
        // Validation: Need at least patient ID and Text column
        // And model selection
        const isValid = 
            selectedColumns.patientIdentifier && 
            selectedColumns.notes && 
            (modelSourceType === 'predefined' ? selectedModel : localModelPath);

        setMayProceed(!!isValid);

        const config = {
            selectedColumns,
            columnPrefix,
            model_source_type: modelSourceType,
            model_name_or_path: modelSourceType === 'predefined' ? selectedModel : localModelPath,
            aggregation_mode: aggregationMode,
            // Add legacy fields if backend expects them for consistency, though we might not use all
            frequency: aggregationMode === 'note' ? 'Note' : 'Patient' 
        };
        
        setExtractionJsonData(config);

    }, [selectedColumns, columnPrefix, modelSourceType, selectedModel, localModelPath, aggregationMode]);


    const selectedInfo = modelSourceType === 'predefined' ? MODEL_DETAILS[selectedModel] : null;

    // Card 1: Column Selection
    const columnSelectionContent = (
        <Card title="1. Column Mapping" className="mb-4 w-full">
            <div className="flex flex-column gap-4">
                <div className="field">
                    <label className="block font-bold mb-2">Patient Identifier &nbsp;</label>
                    <Dropdown 
                        value={selectedColumns.patientIdentifier} 
                        options={Object.keys(columnsTypes)} 
                        onChange={(e) => handleColumnSelect('patientIdentifier', e)} 
                        placeholder="Select Patient ID Column"
                        className="w-full mt-1"
                    />
                </div>
                <div className="field">
                    <label className="block font-bold mb-2">Text / Notes Column &nbsp;</label>
                    <Dropdown 
                        value={selectedColumns.notes} 
                        options={Object.keys(columnsTypes)} 
                        onChange={(e) => handleColumnSelect('notes', e)} 
                        placeholder="Select Text Column"
                        className="w-full mt-1"
                    />
                </div>
                <div className="field">
                    <label className="block mb-2">Date / Time (Optional) &nbsp;</label>
                     <Dropdown 
                        value={selectedColumns.time} 
                        options={Object.keys(columnsTypes)} 
                        onChange={(e) => handleColumnSelect('time', e)} 
                        placeholder="Select Time Column"
                        className="w-full mt-1"
                    />
                </div>
            </div>
        </Card>
    );

    // Card 2: Model Configuration
    const modelConfigContent = (
         <Card title="2. Model Configuration" className="mb-4 w-full">
            <div className="flex flex-column gap-4">
                 <div className="flex gap-4 mb-2">
                    <div className="field-radiobutton">
                        <RadioButton inputId="srcPre" name="source" value="predefined" onChange={(e) => setModelSourceType(e.value)} checked={modelSourceType === 'predefined'} />
                        <label htmlFor="srcPre" className="ml-2">&nbsp; Predefined HF Model</label>
                    </div>
                    <div className="field-radiobutton">
                        <RadioButton inputId="srcLocal" name="source" value="local" onChange={(e) => setModelSourceType(e.value)} checked={modelSourceType === 'local'} />
                        <label htmlFor="srcLocal" className="ml-2">&nbsp; Custom (Path/ID)</label>
                    </div>
                 </div>

                 {modelSourceType === 'predefined' ? (
                     <Dropdown 
                        value={selectedModel} 
                        options={PREDEFINED_MODELS} 
                        onChange={(e) => setSelectedModel(e.value)} 
                        className="w-full mt-1"
                        placeholder="Select a model"
                    />
                 ) : (
                     <div className="flex flex-column">
                        <InputText 
                            value={localModelPath} 
                            onChange={(e) => setLocalModelPath(e.target.value)} 
                            placeholder="e.g. bert-base-uncased OR /path/to/model"
                            className="w-full mt-1"
                        />
                        <small className="mt-2">Enter Hugging Face Model ID or absolute path.</small>
                     </div>
                 )}

                 {/* Information Card */}
                 {selectedInfo && (
                    <div className="mt-3 surface-ground border-round p-3 border-1 border-300">
                        <div className="flex align-items-center mb-3">
                            <i className="pi pi-info-circle text-blue-500 mr-2" style={{ fontSize: '1.2rem' }}></i>
                            <span className="font-bold text-lg">&nbsp; {PREDEFINED_MODELS.find(m => m.value === selectedModel)?.label}</span>
                        </div>
                        <p className="m-0 mb-3 line-height-3 text-700">{selectedInfo.description}</p>
                        <div className="grid mb-3">
                            <div className="col-12 md:col-6">
                                <div className="text-600 mb-1">Model size:</div>
                                <div className="font-medium">{selectedInfo.size || 'Unknown'}</div>
                            </div>
                            <div className="col-12 md:col-6">
                                <div className="text-600 text-xs mb-1">Configuration:</div>
                                <div className="font-medium">{selectedInfo.config || 'Unknown'}</div>
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
                                <i className="pi pi-cloud-download mr-1"></i>
                                Auto-downloaded if missing
                            </span>
                        </div>
                    </div>
                 )}

                 <div className="field mt-3">
                     <label className="block font-bold mb-2">Aggregation Mode</label>
                     <Dropdown 
                        value={aggregationMode}
                        options={AGGREGATION_MODES}
                        onChange={(e) => setAggregationMode(e.value)}
                        className="w-full mt-1"
                    />
                 </div>
            </div>
        </Card>
    );

    // Card 3: Output Settings
    const outputSettingsContent = (
        <Card title="3. Output Settings" className="mb-4 w-full">
            <div className="flex flex-column gap-3">
                <div className="field">
                    <label className="block font-bold mb-2">Column Prefix</label>
                    <InputText 
                        value={columnPrefix} 
                        onChange={(e) => setColumnPrefix(e.target.value)} 
                        className="w-full mt-1"
                    />
                    <small className="mt-2">Prefix for generated feature columns (e.g. {columnPrefix}_0, {columnPrefix}_1...)</small>
                </div>
            </div>
        </Card>
    );

    return (
        <div className="p-2" style={{ maxWidth: '800px', margin: '0 auto' }}>
             {columnSelectionContent}
             {modelConfigContent}
             {outputSettingsContent}
        </div>
    );
};

export default ExtractionTransformerText;
