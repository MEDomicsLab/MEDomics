#!/usr/bin/env python3

import argparse
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

import pandas as pd


def build_parser():
    parser = argparse.ArgumentParser(
        description="Validate transformer text extraction output contract"
    )
    parser.add_argument("--input-csv", required=True, help="Input CSV path")
    parser.add_argument("--output-csv", required=True, help="Output CSV path")
    parser.add_argument("--db-name", default="data", help="Mongo DB name")
    parser.add_argument(
        "--source-collection",
        default="notes_source_test",
        help="Source collection name",
    )
    parser.add_argument(
        "--result-collection",
        default="notes_result_test",
        help="Result collection name",
    )
    parser.add_argument(
        "--model-source-type", default="predefined", help="Model source type"
    )
    parser.add_argument(
        "--model-name-or-path", default="biobert_v1_1", help="Model id or path"
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


def run_transformer_extraction(args):
    root = Path(__file__).resolve().parents[2]
    script_path = root / "pythonCode/modules/extraction_text/text_feature_extraction.py"

    input_df = pd.read_csv(args.input_csv)
    identifiers = sorted(input_df[args.id_col].dropna().unique().tolist())

    extraction_payload = {
        "selectedColumns": {
            "patientIdentifier": args.id_col,
            "notes": args.text_col,
            "time": args.time_col,
        },
        "columnPrefix": args.column_prefix,
        "model_source_type": args.model_source_type,
        "model_name_or_path": args.model_name_or_path,
        "frequency": args.frequency,
        "allow_model_fallback": True,
    }

    config = {
        "identifiersList": identifiers,
        "relativeToExtractionType": extraction_payload,
        "DBName": args.db_name,
        "collectionName": args.source_collection,
        "resultCollectionName": args.result_collection,
    }

    tmp_dir = tempfile.mkdtemp(prefix="transformer-text-test-")
    temp_requests_path = os.path.join(tmp_dir, "temp_requests.txt")
    env = os.environ.copy()
    env["MED_TMP"] = tmp_dir

    command = [
        sys.executable,
        str(script_path),
        "--json-param",
        json.dumps(config),
        "--id",
        "transformer-contract-test",
    ]
    completed = subprocess.run(command, capture_output=True, text=True, env=env)
    if completed.returncode != 0:
        raise RuntimeError(
            f"Transformer extraction script failed: {completed.stderr or completed.stdout}"
        )

    if not os.path.exists(temp_requests_path):
        raise RuntimeError("Extraction response file not found")

    with open(temp_requests_path, "r", encoding="utf-8") as response_file:
        payload = json.load(response_file)

    if payload.get("error"):
        raise RuntimeError(f"Transformer extraction reported error: {payload['error']}")

    return payload


def validate_output_contract(output_csv, column_prefix):
    df = pd.read_csv(output_csv)
    embedding_columns = [
        col
        for col in df.columns
        if col.startswith(f"{column_prefix}_attr") or "embedding" in col.lower()
    ]

    if not embedding_columns:
        raise AssertionError("No embedding-prefixed columns found in output")

    print(f"Embedding columns detected: {len(embedding_columns)}")
    print(f"Output row count: {len(df)}")


def main():
    args = build_parser().parse_args()
    response = run_transformer_extraction(args)

    if "collection_length" not in response:
        raise AssertionError("collection_length missing from extraction response")

    print(f"collection_length: {response['collection_length']}")
    validate_output_contract(args.output_csv, args.column_prefix)
    return 0


if __name__ == "__main__":
    sys.exit(main())
