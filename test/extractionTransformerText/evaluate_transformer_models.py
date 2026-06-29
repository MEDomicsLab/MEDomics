#!/usr/bin/env python3

import argparse
import json
import os
import sys
from pathlib import Path
from collections import defaultdict
from itertools import combinations

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.decomposition import PCA
from sklearn.metrics.pairwise import cosine_similarity
import scipy.stats

import torch
from transformers import AutoTokenizer, AutoModel

# Make sure we can load the registry
MODULE_DIR = Path(__file__).resolve().parents[2] / "pythonCode" / "modules" / "extraction_text"

def build_parser():
    parser = argparse.ArgumentParser(
        description="Evaluate transformer models on a real CSV file of discharge notes"
    )
    parser.add_argument(
        "--input-csv",
        required=True,
        help="Input CSV path (e.g. discharge_notes_subset.csv)"
    )
    parser.add_argument(
        "--registry-path",
        default=str(MODULE_DIR / "text_model_registry.json"),
        help="Path to text model registry JSON"
    )
    parser.add_argument(
        "--output-dir",
        default=str(Path(__file__).resolve().parent / "eval_results"),
        help="Output directory for plots and reports"
    )
    parser.add_argument(
        "--column-prefix", default="text_embed", help="Embedding column prefix"
    )
    parser.add_argument(
        "--id-col", default="subject_id", help="Patient identifier column"
    )
    parser.add_argument("--text-col", default="text", help="Text column")
    parser.add_argument("--time-col", default="charttime", help="Optional time column")
    parser.add_argument(
        "--frequency",
        default="Note",
        choices=["Note", "Patient", "Admission"],
        help="Aggregation frequency",
    )
    return parser

def load_registry(path):
    with open(path, "r", encoding="utf-8") as registry_file:
        return json.load(registry_file)

class TransformerFeatureExtractor:
    def __init__(self, model_path):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.tokenizer = AutoTokenizer.from_pretrained(model_path)
        self.model = AutoModel.from_pretrained(model_path).to(self.device)
        self.model.eval()

    def split_note_document(self, text, min_length=15):
        tokens_list_0 = self.tokenizer.tokenize(text)

        if len(tokens_list_0) <= 510:
            return [text], [1]

        chunk_parse = []
        chunk_length = []
        chunk = text

        tokens_list = self.tokenizer.tokenize(chunk)
        if len(tokens_list) >= 510:
            temp = chunk.split("\n")
            ind_start = 0
            len_sub = 0
            for i in range(len(temp)):
                temp_tk = self.tokenizer.tokenize(temp[i])
                if len_sub + len(temp_tk) > 510:
                    chunk_parse.append(" ".join(temp[ind_start:i]))
                    chunk_length.append(len_sub)
                    ind_start = i
                    len_sub = len(temp_tk)
                else:
                    len_sub += len(temp_tk)
            # add remaining
            if len_sub > 0:
                chunk_parse.append(" ".join(temp[ind_start:]))
                chunk_length.append(len_sub)
        elif len(tokens_list) >= min_length:
            chunk_parse.append(chunk)
            chunk_length.append(len(tokens_list))

        return chunk_parse, chunk_length

    def get_embeddings(self, text):
        tokens_pt = self.tokenizer(text, return_tensors="pt", truncation=True, max_length=512).to(self.device)
        with torch.no_grad():
            outputs = self.model(**tokens_pt)
            last_hidden_state = outputs.last_hidden_state
            pooler_output = getattr(outputs, "pooler_output", None)

            if pooler_output is not None:
                embeddings = pooler_output.detach().cpu().numpy()
            else:
                embeddings = last_hidden_state[:, 0, :].detach().cpu().numpy()

        return embeddings

    def get_aggregated_embedding(self, text):
        if pd.isna(text) or text.strip() == "":
            return np.zeros(self.model.config.hidden_size)

        full_embedding = None
        string_list, _ = self.split_note_document(str(text))
        
        for event_string_sub in string_list:
            if not event_string_sub.strip():
                continue
            embedding = self.get_embeddings(event_string_sub)
            if full_embedding is None:
                full_embedding = embedding
            else:
                full_embedding = np.concatenate((full_embedding, embedding), axis=0)

        if full_embedding is not None and len(full_embedding) > 0:
            return np.average(full_embedding, axis=0)
        else:
            return np.zeros(self.model.config.hidden_size)


def extract_all_models(args, registry, df):
    models_to_test = [m for m in registry.get("models", []) if m.get("enabled", True)]
    
    embeddings_by_model = {}
    
    print(f"Loaded {len(df)} rows from {args.input_csv}")
    
    for model_info in models_to_test:
        model_id = model_info["model_id"]
        model_path = model_info["hf_model_name_or_path"]
        print(f"\n--- Loading {model_id} ({model_path}) ---")
        try:
            extractor = TransformerFeatureExtractor(model_path)
            
            model_embeddings = []
            for idx, row in df.iterrows():
                text = row[args.text_col]
                emb = extractor.get_aggregated_embedding(text)
                model_embeddings.append(emb)
            
            # shape: [num_samples, hidden_size]
            embeddings_by_model[model_id] = np.vstack(model_embeddings)
            print(f"Successfully extracted embeddings for {model_id}. Shape: {embeddings_by_model[model_id].shape}")
            
        except Exception as e:
            print(f"Failed to load/extract for {model_id}: {e}")

    return embeddings_by_model

def compare_embeddings(embeddings_by_model, output_dir, df, text_col):
    os.makedirs(output_dir, exist_ok=True)
    
    model_ids = list(embeddings_by_model.keys())
    num_models = len(model_ids)
    num_samples = embeddings_by_model[model_ids[0]].shape[0]
    
    report_path = os.path.join(output_dir, "embedding_comparison_report.txt")
    
    with open(report_path, "w") as f:
        f.write(f"Transformer Text Extraction Model Comparison\n")
        f.write(f"============================================\n\n")
        f.write(f"Number of samples evaluated: {num_samples}\n")
        f.write(f"Models evaluated: {', '.join(model_ids)}\n\n")
        
        # 1. Pairwise Cosine Similarity
        f.write("1. Average Pairwise Cosine Similarity\n")
        f.write("-------------------------------------\n")
        f.write("Shows how closely two models align their representation of the exact same input texts.\n\n")
        
        sim_matrix = np.zeros((num_models, num_models))
        for i, m1 in enumerate(model_ids):
            for j, m2 in enumerate(model_ids):
                if i == j:
                    sim_matrix[i, j] = 1.0
                else:
                    # Compute cosine similarity per sample, then average
                    # emb1: (N, H), emb2: (N, H') 
                    emb1 = embeddings_by_model[m1]
                    emb2 = embeddings_by_model[m2]
                    
                    # Normalize
                    emb1_norm = emb1 / np.linalg.norm(emb1, axis=1, keepdims=True)
                    emb2_norm = emb2 / np.linalg.norm(emb2, axis=1, keepdims=True)
                    
                    # Element-wise dot product for matching samples, then mean
                    sims = np.sum(emb1_norm * emb2_norm, axis=1)
                    sim_matrix[i, j] = np.mean(sims)
        
        # Plot Heatmap
        plt.figure(figsize=(10, 8))
        sns.heatmap(sim_matrix, annot=True, xticklabels=model_ids, yticklabels=model_ids, cmap="viridis")
        plt.title("Average Cosine Similarity Between Model Embeddings")
        plt.tight_layout()
        plt.savefig(os.path.join(output_dir, "heatmap_cosine_sim.png"))
        plt.close()
        
        f.write("Cosine similarity matrix saved to heatmap_cosine_sim.png\n\n")
        
        # 2. Neighborhood Preservation (Rank Correlation)
        f.write("2. Neighborhood Preservation (Nearest Neighbors)\n")
        f.write("------------------------------------------------\n")
        f.write("Spearman rank correlation of the pairwise distances between all samples.\n")
        f.write("High correlation means two models cluster samples similarly.\n\n")
        
        # Compute pairwise distance matrix for each model (flattened for correlation)
        dist_matrices = {}
        for m in model_ids:
            # 1 - cosine similarity matrix between all samples (N x N)
            sim_m = cosine_similarity(embeddings_by_model[m])
            dist_m = 1.0 - sim_m
            # extract upper triangle (exclude diagonal) to get unique pairs
            dist_matrices[m] = dist_m[np.triu_indices(num_samples, k=1)]
            
        corr_matrix = np.zeros((num_models, num_models))
        for i, m1 in enumerate(model_ids):
            for j, m2 in enumerate(model_ids):
                if i == j:
                    corr_matrix[i, j] = 1.0
                else:
                    corr, _ = scipy.stats.spearmanr(dist_matrices[m1], dist_matrices[m2])
                    corr_matrix[i, j] = corr
                    
        # Plot Heatmap for Rank Correlation
        plt.figure(figsize=(10, 8))
        sns.heatmap(corr_matrix, annot=True, xticklabels=model_ids, yticklabels=model_ids, cmap="plasma")
        plt.title("Nearest-Neighbor Rank Correlation")
        plt.tight_layout()
        plt.savefig(os.path.join(output_dir, "heatmap_rank_corr.png"))
        plt.close()
        
        f.write("Rank correlation matrix saved to heatmap_rank_corr.png\n\n")
        
        # 3. PCA Visualization
        f.write("3. 2D PCA Visualization\n")
        f.write("-----------------------\n")
        f.write("Projecting embeddings from all models down to 2D.\n")
        f.write("Each point represents a text sample from a specific model.\n")
        
        pca = PCA(n_components=2)
        # Stack all embeddings together to fit a shared PCA space
        all_embeddings = np.vstack(list(embeddings_by_model.values()))
        pca.fit(all_embeddings)
        
        plt.figure(figsize=(12, 10))
        for m in model_ids:
            emb_2d = pca.transform(embeddings_by_model[m])
            plt.scatter(emb_2d[:, 0], emb_2d[:, 1], label=m, alpha=0.7)
            
        plt.title("2D PCA Projection of Model Embeddings")
        plt.legend()
        plt.tight_layout()
        plt.savefig(os.path.join(output_dir, "pca_projection.png"))
        plt.close()
        
        f.write("PCA projection saved to pca_projection.png\n\n")
        f.write("Done evaluating models.\n")
        
    print(f"\nEvaluation complete! Results saved in {output_dir}")

def main():
    args = build_parser().parse_args()
    
    if not os.path.exists(args.input_csv):
        print(f"Error: Input CSV {args.input_csv} not found.")
        return 1
        
    df = pd.read_csv(args.input_csv)
    if args.text_col not in df.columns:
        print(f"Error: Text column '{args.text_col}' not found in CSV. Columns: {df.columns}")
        return 1
        
    # We may want to only test the first N rows if it's too big, 
    # but the subset is supposedly small enough.
    # df = df.head(50) 
        
    registry = load_registry(args.registry_path)
    
    embeddings_by_model = extract_all_models(args, registry, df)
    
    # Save embeddings to CSV
    os.makedirs(args.output_dir, exist_ok=True)
    for model_id, embeddings in embeddings_by_model.items():
        # Create a dataframe with embedding columns
        emb_df = pd.DataFrame(embeddings)
        emb_df.columns = [f"{args.column_prefix}_{i}" for i in range(embeddings.shape[1])]
        
        # Add the ID column from the original dataframe
        emb_df.insert(0, args.id_col, df[args.id_col].values)
        if args.time_col in df.columns:
            emb_df.insert(1, args.time_col, df[args.time_col].values)
            
        out_csv = os.path.join(args.output_dir, f"{model_id}_embeddings.csv")
        emb_df.to_csv(out_csv, index=False)
        print(f"Saved {model_id} embeddings to {out_csv}")
    
    if len(embeddings_by_model) < 2:
        print("Not enough models successfully processed to compare.")
        return 2
        
    compare_embeddings(embeddings_by_model, args.output_dir, df, args.text_col)
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
