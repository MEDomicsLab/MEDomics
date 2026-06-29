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
    parser.add_argument("--rows", type=int, default=100, help="Number of rows to keep")
    parser.add_argument(
        "--id-col", default="subject_id", help="Patient identifier column"
    )
    parser.add_argument("--text-col", default="text", help="Text/notes column")
    return parser


def deterministic_subset(df, rows):
    frame = df.copy()
    frame["_stable_key"] = frame.apply(
        lambda row: hashlib.sha1(str(tuple(row.values)).encode("utf-8")).hexdigest(),
        axis=1,
    )
    frame = frame.sort_values("_stable_key").drop(columns=["_stable_key"])
    return frame.head(rows)


def main():
    args = build_parser().parse_args()

    df = pd.read_csv(args.input_csv)
    missing_cols = [
        col for col in [args.id_col, args.text_col] if col not in df.columns
    ]
    if missing_cols:
        print(f"Missing required columns: {missing_cols}")
        return 2

    subset = deterministic_subset(df, max(args.rows, 0))
    subset.to_csv(args.output_csv, index=False)
    print(f"Wrote {len(subset)} rows to {args.output_csv}")
    print(f"Columns preserved: {args.id_col}, {args.text_col}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
