#!/usr/bin/env python3

import argparse
import json
import sys
from pathlib import Path


def build_parser():
    parser = argparse.ArgumentParser(
        description="Run TransformerText model onboarding sweep"
    )
    parser.add_argument(
        "--registry-path",
        default="pythonCode/modules/extraction_text/text_model_registry.json",
        help="Path to text model registry JSON",
    )
    parser.add_argument(
        "--attempt-load",
        action="store_true",
        help="Attempt actual transformer loads (otherwise dry-run validation only)",
    )
    return parser


def load_registry(path):
    with open(path, "r", encoding="utf-8") as registry_file:
        return json.load(registry_file)


def main():
    args = build_parser().parse_args()
    registry = load_registry(args.registry_path)
    models = [
        model for model in registry.get("models", []) if model.get("enabled", True)
    ]

    if not models:
        print("No enabled models found in registry")
        return 2

    model_ids = [model["model_id"] for model in models]
    if "scibert_scivocab_uncased" not in model_ids:
        print("Required onboarded model scibert_scivocab_uncased is missing")
        return 2

    successes = 0
    failures = 0

    if args.attempt_load:
        try:
            from transformers import AutoModel, AutoTokenizer
        except Exception as exc:
            print(f"Unable to import transformers for model load sweep: {exc}")
            return 2

        for model in models:
            model_id = model["model_id"]
            model_path = model["hf_model_name_or_path"]
            try:
                AutoTokenizer.from_pretrained(model_path)
                AutoModel.from_pretrained(model_path)
                print(f"PASS {model_id}: {model_path}")
                successes += 1
            except Exception as exc:
                print(f"FAIL {model_id}: {model_path} -> {exc}")
                failures += 1
    else:
        for model in models:
            print(
                f"PASS(dry-run) {model['model_id']}: {model['hf_model_name_or_path']}"
            )
            successes += 1

    print(
        f"Model sweep results: success={successes}, fail={failures}, total={len(models)}"
    )
    if successes == 0:
        return 1
    return 0


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[2]
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))
    sys.exit(main())
