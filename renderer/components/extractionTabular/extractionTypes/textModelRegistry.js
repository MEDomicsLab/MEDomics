export const TEXT_MODEL_REGISTRY = [
  { label: "BioBERT v1.1", value: "biobert_v1_1" },
  { label: "BiomedNLP-BiomedBERT", value: "biomedbert_pubmed" },
  { label: "SapBERT PubMed", value: "sapbert_pubmed" },
  { label: "ModernPubMedBERT", value: "modern_pubmedbert" },
  { label: "BioClinical-ModernBERT", value: "bioclinical_modernbert" },
  { label: "Bio_ClinicalBERT", value: "bio_clinical_bert" },
  { label: "ClinicalBERT", value: "clinicalbert" },
  { label: "BlueBERT PubMed MIMIC", value: "bluebert_pubmed_mimic" },
  { label: "Clinical_ModernBERT", value: "clinical_modernbert" },
  { label: "SciBERT SciVocab Uncased", value: "scibert_scivocab_uncased" }
]

export const TEXT_MODEL_DETAILS = {
  biobert_v1_1: {
    description: "BioBERT: Pre-trained on PubMed abstracts and PMC full-text articles. Good baseline for biomedical tasks.",
    link: "https://huggingface.co/dmis-lab/biobert-v1.1",
    size: "~420MB",
    config: "BERT base (12L, 768H, 12A)"
  },
  biomedbert_pubmed: {
    description: "BiomedNLP-BiomedBERT: The standard PubMedBERT model, pre-trained from scratch on PubMed.",
    link: "https://huggingface.co/microsoft/BiomedNLP-BiomedBERT-base-uncased-abstract-fulltext",
    size: "~420MB",
    config: "BERT base (12L, 768H, 12A)"
  },
  sapbert_pubmed: {
    description: "SapBERT: Self-alignment pre-training for biomedical entity representation.",
    link: "https://huggingface.co/cambridgeltl/SapBERT-from-PubMedBERT-fulltext",
    size: "~420MB",
    config: "BERT base (12L, 768H, 12A)"
  },
  modern_pubmedbert: {
    description: "ModernPubMedBERT: A generic PubMedBERT model.",
    link: "https://huggingface.co/lokeshch19/ModernPubMedBERT",
    size: "~420MB",
    config: "BERT base (12L, 768H, 12A)"
  },
  bioclinical_modernbert: {
    description: "BioClinical-ModernBERT: Adapted for both biological and clinical contexts.",
    link: "https://huggingface.co/thomas-sounack/BioClinical-ModernBERT-base",
    size: "~420MB",
    config: "BERT base (12L, 768H, 12A)"
  },
  bio_clinical_bert: {
    description: "Bio_ClinicalBERT: Initialized from BioBERT and further trained on MIMIC-III.",
    link: "https://huggingface.co/emilyalsentzer/Bio_ClinicalBERT",
    size: "~420MB",
    config: "BERT base (12L, 768H, 12A)"
  },
  clinicalbert: {
    description: "ClinicalBERT: Pre-trained on MIMIC-III clinical notes.",
    link: "https://huggingface.co/medicalai/ClinicalBERT",
    size: "~420MB",
    config: "BERT base (12L, 768H, 12A)"
  },
  bluebert_pubmed_mimic: {
    description: "BlueBERT: Pre-trained on PubMed and MIMIC-III.",
    link: "https://huggingface.co/bionlp/bluebert_pubmed_mimic_uncased_L-12_H-768_A-12",
    size: "~420MB",
    config: "BERT base (12L, 768H, 12A)"
  },
  clinical_modernbert: {
    description: "Clinical_ModernBERT: Modern text embeddings for clinical domain.",
    link: "https://huggingface.co/Simonlee711/Clinical_ModernBERT",
    size: "~420MB",
    config: "BERT base (12L, 768H, 12A)"
  },
  scibert_scivocab_uncased: {
    description: "SciBERT trained on scientific text with SciVocab tokenizer.",
    link: "https://huggingface.co/allenai/scibert_scivocab_uncased",
    size: "~440MB",
    config: "BERT base (12L, 768H, 12A)"
  }
}
