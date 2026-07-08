#!/usr/bin/env python3

import argparse
import hashlib
import sys

import pandas as pd


def build_parser():
    parser = argparse.ArgumentParser(
        description="Create a deterministic text extraction CSV subset"
    )
    parser.add_argument("input_csv", help="Input CSV path")
    parser.add_argument("output_csv", help="Output CSV path")
    parser.add_argument(
        "--rows",
        type=int,
        default=100,
        help="Number of rows to keep when no patient list is provided",
    )
    parser.add_argument(
        "--number_of_patients",
        type=int,
        help="Number of unique patients to keep; all rows for those patients are included",
    )
    parser.add_argument(
        "--id-col", default="subject_id", help="Patient identifier column"
    )
    parser.add_argument("--text-col", default="text", help="Text/notes column")
    parser.add_argument(
        "--selected-patients-csv",
        help="Optional CSV file containing patient IDs to keep",
    )
    return parser


def deterministic_subset(df, rows):
    frame = df.copy()
    frame["_stable_key"] = frame.apply(
        lambda row: hashlib.sha1(str(tuple(row.values)).encode("utf-8")).hexdigest(),
        axis=1,
    )
    frame = frame.sort_values("_stable_key").drop(columns=["_stable_key"])
    return frame.head(rows)


def subset_by_patient_list(df, selected_patients_csv, id_col):
    selected_patients = pd.read_csv(selected_patients_csv)
    if id_col not in selected_patients.columns:
        raise ValueError(
            f"Selected patients file is missing required column: {id_col}"
        )

    selected_ids = (
        selected_patients[id_col].dropna().astype(str).drop_duplicates().tolist()
    )
    return df[df[id_col].astype(str).isin(selected_ids)]


def deterministic_patient_subset(df, patient_count, id_col):
    frame = df.copy()
    unique_ids = (
        frame[id_col]
        .dropna()
        .astype(str)
        .drop_duplicates()
        .to_frame(name=id_col)
    )
    unique_ids["_stable_key"] = unique_ids[id_col].map(
        lambda value: hashlib.sha1(value.encode("utf-8")).hexdigest()
    )
    selected_ids = (
        unique_ids.sort_values("_stable_key")[id_col]
        .head(max(patient_count, 0))
        .tolist()
    )
    return frame[frame[id_col].astype(str).isin(selected_ids)]


def main():
    args = build_parser().parse_args()

    df = pd.read_csv(args.input_csv)
    missing_cols = [
        col for col in [args.id_col, args.text_col] if col not in df.columns
    ]
    if missing_cols:
        print(f"Missing required columns: {missing_cols}")
        return 2

    if args.selected_patients_csv:
        subset = subset_by_patient_list(df, args.selected_patients_csv, args.id_col)
    elif args.number_of_patients is not None:
        subset = deterministic_patient_subset(df, args.number_of_patients, args.id_col)
    else:
        subset = deterministic_subset(df, max(args.rows, 0))

    subset.to_csv(args.output_csv, index=False)
    print(f"Wrote {len(subset)} rows to {args.output_csv}")
    print(f"Columns preserved: {args.id_col}, {args.text_col}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
