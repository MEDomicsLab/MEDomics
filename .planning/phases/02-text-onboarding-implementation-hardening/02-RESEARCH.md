# Phase 2 — Research: Text Onboarding Implementation + Hardening

**Date:** 2026-03-31  
**Status:** Complete

## Scope Answered

How to implement Phase 2 with no breaking changes while onboarding at least one additional text model.

## Current-State Findings

1. **Go route contracts are already stable and explicit** in `go_server/blueprints/extraction_text/extraction_text.go`:
   - `/extraction_text/BioBERT_extraction/`
   - `/extraction_text/TransformerText_extraction/`
   - `/extraction_text/progress/`
2. **Python transformer extraction already has partial registry behavior** via `PREDEFINED_MODELS` in `pythonCode/modules/extraction_text/text_feature_extraction.py`, but the registry is duplicated in UI and not contract-validated.
3. **Renderer model list duplicates backend model list** in `renderer/components/extractionTabular/extractionTypes/extractionTransformerText.jsx` (`PREDEFINED_MODELS` + `MODEL_DETAILS`).
4. **Existing baseline tests are fragmented**:
   - Present: `pythonCode/tests/extraction_text/test_biobert_extraction.py`
   - Present: `pythonCode/submodules/MEDimage/tests/test_extraction.py`
   - Missing in repo but required by project guidance: `test/extractionTransformerText/*`

## Implementation Strategy (Recommended)

### 1) Single model registry as source of truth

- Add a shared text model registry artifact in Python (JSON file consumed by Python + renderer parity test).
- Keep existing BioBERT route/handler untouched.
- Use registry only for TransformerText model resolution and onboarding metadata.

### 2) Route-stable, handler-extensible backend

- Keep Go endpoint paths unchanged.
- Introduce a Python-level dispatch helper that resolves:
  - `legacy_biobert` handler path (unchanged)
  - `registry_transformer` handler path (extensible)
- Add fallback behavior: when requested model fails load/validation and feature flag disallows hard-fail, fallback to a stable default (`biobert_v1_1` for TransformerText path).

### 3) Regression-first hardening

- Add focused tests for:
  - registry schema validity,
  - UI/backend parity,
  - fallback dispatch behavior,
  - output contract shape continuity (`collection_length`, prefixed embedding columns).
- Recreate required baseline scripts under `test/extractionTransformerText/` (currently absent) and keep existing python tests active.

## Recommended File Targets

- `pythonCode/modules/extraction_text/text_model_registry.json` (new)
- `pythonCode/modules/extraction_text/text_feature_extraction.py` (modify)
- `pythonCode/modules/extraction_text/BioBERT_extraction.py` (minimal contract-safe hardening only)
- `renderer/components/extractionTabular/extractionTypes/extractionTransformerText.jsx` (consume registry-derived model IDs or generated mirror file)
- `go_server/blueprints/extraction_text/extraction_text.go` (no endpoint change; optional additive logging only)
- `pythonCode/tests/extraction_text/test_text_model_registry.py` (new)
- `pythonCode/tests/extraction_text/test_text_dispatch_fallback.py` (new)
- `test/extractionTransformerText/create_small_subset.py` (new if absent)
- `test/extractionTransformerText/test_transformer_text_extraction.py` (new if absent)
- `test/extractionTransformerText/test_transformer_text_extraction_models.py` (new if absent)

## Pitfalls to Avoid

1. Do **not** rename or remove Go routes.
2. Do **not** change renderer request envelope (`relativeToExtractionType`, `identifiersList`, etc.).
3. Do **not** force new required config fields for existing BioBERT/TransformerText runs.
4. Do **not** rely on UI-only model metadata without backend validation.

## Validation Architecture

### Required checks per implementation wave

1. **Registry + parity checks**
   - `pytest pythonCode/tests/extraction_text/test_text_model_registry.py -q`
2. **Fallback/dispatch behavior checks**
   - `pytest pythonCode/tests/extraction_text/test_text_dispatch_fallback.py -q`
3. **Legacy sanity checks**
   - `python pythonCode/tests/extraction_text/test_biobert_extraction.py --help`
4. **Non-text extraction baseline sanity**
   - `pytest pythonCode/submodules/MEDimage/tests -k extraction -q`

### Nyquist strategy

- Run quick checks after each task touching extraction routing/registry.
- Run full phase checks before phase verification.
- Block phase completion on any regression in legacy BioBERT behavior or route availability.
