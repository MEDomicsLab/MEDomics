# Plan 02-01 Summary

Status: Complete

## Implemented

- Added canonical backend registry at `pythonCode/modules/extraction_text/text_model_registry.json` with legacy models and onboarded `scibert_scivocab_uncased`.
- Added renderer registry projection at `renderer/components/extractionTabular/extractionTypes/textModelRegistry.js` exporting `TEXT_MODEL_REGISTRY` and `TEXT_MODEL_DETAILS`.
- Updated `renderer/components/extractionTabular/extractionTypes/extractionTransformerText.jsx` to import and use registry constants instead of inline model lists.
- Added schema + parity tests at `pythonCode/tests/extraction_text/test_text_model_registry.py`.

## Verification

- `pytest pythonCode/tests/extraction_text/test_text_model_registry.py -q` -> `5 passed`

## Notes

- TransformerText request payload keys remain unchanged (`model_source_type`, `model_name_or_path`, `frequency`).
