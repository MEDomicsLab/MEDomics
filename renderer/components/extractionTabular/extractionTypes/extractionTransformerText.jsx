
import React, { useState, useEffect } from 'react';
import { Dropdown } from 'primereact/dropdown';
import { RadioButton } from 'primereact/radiobutton';
import { InputText } from 'primereact/inputtext';
import { Carousel } from 'primereact/carousel';
import { Card } from 'primereact/card';

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

    const responsiveOptions = [
        { breakpoint: '1024px', numVisible: 1, numScroll: 1 },
        { breakpoint: '768px', numVisible: 1, numScroll: 1 },
        { breakpoint: '560px', numVisible: 1, numScroll: 1 }
    ];

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


    const cardTemplate = (item) => {
        return (
            <div className="center">
                <Card className="extraction-card">
                    {item}
                </Card>
            </div>
        );
    };

    // Card 1: Column Selection
    const columnSelectionContent = (
        <div className="flex flex-column gap-3">
            <h4>1. Column Mapping</h4>
            <div className="field">
                <label className="block font-bold">Patient Identifier *</label>
                <Dropdown 
                    value={selectedColumns.patientIdentifier} 
                    options={Object.keys(columnsTypes)} 
                    onChange={(e) => handleColumnSelect('patientIdentifier', e)} 
                    placeholder="Select Patient ID Column"
                    className="w-full"
                />
            </div>
            <div className="field">
                <label className="block font-bold">Text / Notes Column *</label>
                <Dropdown 
                    value={selectedColumns.notes} 
                    options={Object.keys(columnsTypes)} 
                    onChange={(e) => handleColumnSelect('notes', e)} 
                    placeholder="Select Text Column"
                    className="w-full"
                />
            </div>
            <div className="field">
                <label className="block">Date / Time (Optional)</label>
                 <Dropdown 
                    value={selectedColumns.time} 
                    options={Object.keys(columnsTypes)} 
                    onChange={(e) => handleColumnSelect('time', e)} 
                    placeholder="Select Time Column"
                    className="w-full"
                />
            </div>
        </div>
    );

    // Card 2: Model Configuration
    const modelConfigContent = (
        <div className="flex flex-column gap-3">
             <h4>2. Model Configuration</h4>
             <div className="flex gap-4">
                <div className="field-radiobutton">
                    <RadioButton inputId="srcPre" name="source" value="predefined" onChange={(e) => setModelSourceType(e.value)} checked={modelSourceType === 'predefined'} />
                    <label htmlFor="srcPre" className="ml-2">Predefined HF Model</label>
                </div>
                <div className="field-radiobutton">
                    <RadioButton inputId="srcLocal" name="source" value="local" onChange={(e) => setModelSourceType(e.value)} checked={modelSourceType === 'local'} />
                    <label htmlFor="srcLocal" className="ml-2">Custom (Path/ID)</label>
                </div>
             </div>

             {modelSourceType === 'predefined' ? (
                 <Dropdown 
                    value={selectedModel} 
                    options={PREDEFINED_MODELS} 
                    onChange={(e) => setSelectedModel(e.value)} 
                    className="w-full"
                    placeholder="Select a model"
                />
             ) : (
                 <div className="flex flex-column">
                    <InputText 
                        value={localModelPath} 
                        onChange={(e) => setLocalModelPath(e.target.value)} 
                        placeholder="e.g. bert-base-uncased OR /path/to/model"
                        className="w-full"
                    />
                    <small>Enter Hugging Face Model ID or absolute path.</small>
                 </div>
             )}

             <div className="field mt-3">
                 <label className="block font-bold">Aggregation Mode</label>
                 <Dropdown 
                    value={aggregationMode}
                    options={AGGREGATION_MODES}
                    onChange={(e) => setAggregationMode(e.value)}
                    className="w-full"
                />
             </div>
        </div>
    );

    // Card 3: Output Settings
    const outputSettingsContent = (
        <div className="flex flex-column gap-3">
            <h4>3. Output Settings</h4>
            <div className="field">
                <label className="block font-bold">Column Prefix</label>
                <InputText 
                    value={columnPrefix} 
                    onChange={(e) => setColumnPrefix(e.target.value)} 
                    className="w-full"
                />
                <small>Prefix for generated feature columns (e.g. {columnPrefix}_0, {columnPrefix}_1...)</small>
            </div>
        </div>
    );

    const items = [columnSelectionContent, modelConfigContent, outputSettingsContent];

    return (
        <div className="extraction-carousel">
             <Carousel 
                value={items} 
                numVisible={1} 
                numScroll={1} 
                responsiveOptions={responsiveOptions} 
                itemTemplate={cardTemplate} 
                circular={false}
            />
        </div>
    );
};

export default ExtractionTransformerText;
