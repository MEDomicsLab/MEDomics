#!/usr/bin/env python3
"""
Standalone test script for BioBERT extraction.

Usage:
    python test_biobert_extraction.py <biobert_path> <input_csv_path> <output_csv_path>

Example:
    python test_biobert_extraction.py ./python/pretrained_bert_tf/biobert_pretrain_output_all_notes_150000 ./python/discharge_notes.csv ./output_embeddings.csv
"""

import argparse
import datetime
import os
import sys
from pathlib import Path

try:
    import numpy as np
except ModuleNotFoundError:
    np = None

try:
    import pandas as pd
except ModuleNotFoundError:
    pd = None

try:
    import torch
except ModuleNotFoundError:
    torch = None

try:
    from transformers import AutoTokenizer, AutoModel
except ModuleNotFoundError:
    AutoTokenizer = None
    AutoModel = None


def split_note_document(tokenizer, text, min_length=15):
    """
    Split a text if too long for embeddings generation.
    BioBERT can only process a string with ≤ 512 tokens.
    If the input text exceeds this token count, we split it based on line breaks.

    :param tokenizer: The BioBERT tokenizer
    :param text: String of text to be processed into an embedding
    :param min_length: When parsing the text into its subsections, remove text strings below a minimum length

    :return: chunk_parse: A list of "chunks", i.e. text strings, that breaks up the original text into strings with 512 tokens.
             chunk_length: A list of the token counts for each "chunk".
    """
    tokens_list_0 = tokenizer.tokenize(text)

    if len(tokens_list_0) <= 510:
        return [text], [1]

    chunk_parse = []
    chunk_length = []
    chunk = text

    # Go through text and aggregate in groups up to 510 tokens (+ padding)
    tokens_list = tokenizer.tokenize(chunk)
    if len(tokens_list) >= 510:
        temp = chunk.split("\n")
        ind_start = 0
        len_sub = 0
        for i in range(len(temp)):
            temp_tk = tokenizer.tokenize(temp[i])
            if len_sub + len(temp_tk) > 510:
                chunk_parse.append(" ".join(temp[ind_start:i]))
                chunk_length.append(len_sub)
                # reset for next chunk
                ind_start = i
                len_sub = len(temp_tk)
            else:
                len_sub += len(temp_tk)
    elif len(tokens_list) >= min_length:
        chunk_parse.append(chunk)
        chunk_length.append(len(tokens_list))

    return chunk_parse, chunk_length


def get_biobert_embeddings(model, tokenizer, text):
    """
    Obtain BioBERT embeddings of text string.

    :param model: The BioBERT model
    :param tokenizer: The BioBERT tokenizer
    :param text: Input text (str).

    :return: embeddings: Final Biobert embeddings with vector dimensionality = (1,768).
             hidden_embeddings: Last hidden layer in Biobert model with vector dimensionality = (token_size,768).
    """
    tokens_pt = tokenizer(
        text, return_tensors="pt", truncation=True, max_length=512, padding=True
    )
    outputs = model(**tokens_pt)
    last_hidden_state = outputs.last_hidden_state
    pooler_output = outputs.pooler_output
    hidden_embeddings = last_hidden_state.detach().numpy()
    embeddings = pooler_output.detach().numpy()

    return embeddings, hidden_embeddings


def get_biobert_embeddings_from_event_list(model, tokenizer, event_list):
    """
    For notes obtain fixed-size BioBERT embeddings.

    :param model: The BioBERT model
    :param tokenizer: The BioBERT tokenizer
    :param event_list: List of text strings to process

    :return: aggregated_embeddings: BioBERT event features for all events.
    """
    full_embedding = None

    for idx, event_string in enumerate(event_list):
        if pd.isna(event_string) or event_string == "":
            continue

        string_list, lengths = split_note_document(tokenizer, str(event_string))
        for idx_sub, event_string_sub in enumerate(string_list):
            # Extract biobert embedding
            embedding, hidden_embedding = get_biobert_embeddings(
                model, tokenizer, event_string_sub
            )
            # Concatenate
            if full_embedding is None:
                full_embedding = embedding
            else:
                full_embedding = np.concatenate((full_embedding, embedding), axis=0)

    # Return the weighted average of embedding vector across temporal dimension
    if full_embedding is not None and len(full_embedding) > 0:
        aggregated_embedding = np.average(full_embedding, axis=0)
    else:
        aggregated_embedding = np.zeros(768)

    return aggregated_embedding


def process_csv_with_biobert(
    biobert_path,
    input_csv_path,
    output_csv_path,
    patient_id_col="subject_id",
    notes_col="text",
    time_col="charttime",
    column_prefix="notes_attr",
):
    """
    Process a CSV file and generate BioBERT embeddings.

    :param biobert_path: Path to the BioBERT model directory
    :param input_csv_path: Path to the input CSV file
    :param output_csv_path: Path to save the output CSV with embeddings
    :param patient_id_col: Column name for patient identifier
    :param notes_col: Column name for text notes
    :param time_col: Column name for time (optional)
    :param column_prefix: Prefix for embedding columns
    """
    if any(dep is None for dep in [np, pd, torch, AutoTokenizer, AutoModel]):
        raise ModuleNotFoundError(
            "numpy, pandas, torch, and transformers are required to run BioBERT extraction"
        )

    print(f"Loading BioBERT model from: {biobert_path}")

    # Check if path exists
    if not os.path.exists(biobert_path):
        raise FileNotFoundError(f"BioBERT model path does not exist: {biobert_path}")

    # Check for required files
    required_files = ["config.json", "vocab.txt"]
    for file in required_files:
        file_path = os.path.join(biobert_path, file)
        if not os.path.exists(file_path):
            print(f"Warning: {file} not found in {biobert_path}")
            print(f"Contents of {biobert_path}:")
            if os.path.isdir(biobert_path):
                print(f"  {os.listdir(biobert_path)}")

    # Try to load the model
    try:
        print("Loading tokenizer...")
        tokenizer = AutoTokenizer.from_pretrained(biobert_path)
        print("Loading model...")
        model = AutoModel.from_pretrained(biobert_path)
        print("Model loaded successfully!")
    except Exception as e:
        print(f"Error loading model: {e}")
        print("\nTroubleshooting tips:")
        print(
            "1. Make sure the path points to the folder containing config.json, vocab.txt, and pytorch_model.bin"
        )
        print(
            "2. For your case, the path should be: ./python/pretrained_bert_tf/biobert_pretrain_output_all_notes_150000"
        )
        print(
            "3. If the model is in TensorFlow format, you may need to convert it to PyTorch format"
        )
        raise

    print(f"\nLoading CSV from: {input_csv_path}")
    try:
        # Read CSV in chunks if it's very large
        df = pd.read_csv(input_csv_path, nrows=None)  # Read all rows
        print(f"Loaded {len(df)} rows")
        print(f"Columns: {df.columns.tolist()}")
    except Exception as e:
        print(f"Error loading CSV: {e}")
        raise

    # Check required columns
    if patient_id_col not in df.columns:
        raise ValueError(
            f"Column '{patient_id_col}' not found in CSV. Available columns: {df.columns.tolist()}"
        )
    if notes_col not in df.columns:
        raise ValueError(
            f"Column '{notes_col}' not found in CSV. Available columns: {df.columns.tolist()}"
        )

    missing_notes_count = df[notes_col].isna().sum()
    empty_notes_count = 0
    for val in df[notes_col]:
        if isinstance(val, str) and val.strip() == "":
            empty_notes_count += 1

    # Process each row
    print("\nProcessing notes and generating embeddings...")
    results = []

    for idx, row in df.iterrows():
        if (idx + 1) % 100 == 0:
            print(f"Processing row {idx + 1}/{len(df)}...")

        patient_id = row[patient_id_col]
        notes_text = row[notes_col]

        # Get embeddings
        embeddings = get_biobert_embeddings_from_event_list(
            model, tokenizer, [notes_text]
        )

        # Create result row
        result_row = {patient_id_col: patient_id}

        # Add time column if available
        if time_col in df.columns:
            result_row[time_col] = row[time_col]

        # Add embedding columns
        for i, emb_val in enumerate(embeddings):
            result_row[f"{column_prefix}_{i}"] = emb_val

        results.append(result_row)

    # Create output dataframe
    output_df = pd.DataFrame(results)

    print(f"\nSaving results to: {output_csv_path}")
    output_df.to_csv(output_csv_path, index=False)
    print(f"Saved {len(output_df)} rows with {len(output_df.columns)} columns")
    print(f"Column prefix: {column_prefix}")
    print(f"Embedding dimension: {len(embeddings)}")
    print(f"Processed row count: {len(output_df)}")
    print(f"Missing note count: {missing_notes_count}")
    print(f"Empty note count: {empty_notes_count}")

    return output_df


def main():
    parser = argparse.ArgumentParser(
        description="Test BioBERT extraction on a CSV file",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Basic usage
  python test_biobert_extraction.py \\
    ./python/pretrained_bert_tf/biobert_pretrain_output_all_notes_150000 \\
    ./python/discharge_notes.csv \\
    ./output_embeddings.csv
  
  # With custom column names
  python test_biobert_extraction.py \\
    ./python/pretrained_bert_tf/biobert_pretrain_output_all_notes_150000 \\
    ./python/discharge_notes.csv \\
    ./output_embeddings.csv \\
    --patient-id-col subject_id \\
    --notes-col text \\
    --time-col charttime
        """,
    )

    parser.add_argument(
        "biobert_path", type=str, help="Path to BioBERT model directory"
    )
    parser.add_argument("input_csv", type=str, help="Path to input CSV file")
    parser.add_argument("output_csv", type=str, help="Path to output CSV file")
    parser.add_argument(
        "--patient-id-col",
        type=str,
        default="subject_id",
        help="Column name for patient identifier (default: subject_id)",
    )
    parser.add_argument(
        "--notes-col",
        type=str,
        default="text",
        help="Column name for text notes (default: text)",
    )
    parser.add_argument(
        "--time-col",
        type=str,
        default="charttime",
        help="Column name for time column (default: charttime)",
    )
    parser.add_argument(
        "--column-prefix",
        type=str,
        default="notes_attr",
        help="Prefix for embedding columns (default: notes_attr)",
    )

    args = parser.parse_args()

    # Convert to absolute paths
    biobert_path = os.path.abspath(args.biobert_path)
    input_csv = os.path.abspath(args.input_csv)
    output_csv = os.path.abspath(args.output_csv)

    print("=" * 60)
    print("BioBERT Extraction Test Script")
    print("=" * 60)
    print(f"BioBERT Path: {biobert_path}")
    print(f"Input CSV: {input_csv}")
    print(f"Output CSV: {output_csv}")
    print("=" * 60)
    print()

    try:
        process_csv_with_biobert(
            biobert_path=biobert_path,
            input_csv_path=input_csv,
            output_csv_path=output_csv,
            patient_id_col=args.patient_id_col,
            notes_col=args.notes_col,
            time_col=args.time_col,
            column_prefix=args.column_prefix,
        )
        print("\n" + "=" * 60)
        print("SUCCESS: BioBERT extraction completed!")
        print("=" * 60)
    except Exception as e:
        print("\n" + "=" * 60)
        print(f"ERROR: {type(e).__name__}: {e}")
        print("=" * 60)
        import traceback

        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
