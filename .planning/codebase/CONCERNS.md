# Codebase Concerns

**Analysis Date:** 2026-03-31

## Tech Debt

**Transformer text extraction architecture scales poorly across models and cohorts:**

- Issue: `GoExecScriptTransformerExtraction._custom_process` loads tokenizer/model on every request chunk (`AutoTokenizer.from_pretrained` + `AutoModel.from_pretrained`) instead of reusing a loaded model for the whole extraction session.
- Files: `pythonCode/modules/extraction_text/text_feature_extraction.py`, `renderer/components/extractionTabular/extractionTabularData.jsx`
- Impact: Adding new large models increases startup time per chunk and multiplies GPU/CPU initialization overhead; extraction latency grows superlinearly as cohort size and model size increase.
- Fix approach: Cache model/tokenizer by `model_name_or_path` for process lifetime (or move to a persistent model worker); send all identifiers in one job and keep batching inside Python.

**Legacy and new text extraction paths duplicate logic and diverge:**

- Issue: `BioBERT_extraction.py` and `text_feature_extraction.py` both implement similar token-splitting, embedding aggregation, and Mongo persistence with inconsistent safeguards.
- Files: `pythonCode/modules/extraction_text/BioBERT_extraction.py`, `pythonCode/modules/extraction_text/text_feature_extraction.py`
- Impact: Bug fixes and model support changes must be duplicated; behavior drifts between BioBERT and generic transformer extraction.
- Fix approach: Extract shared embedding pipeline helpers into `pythonCode/modules/extraction_text/` utilities and keep model-specific code limited to model loading options.

**Progress and response handling is file-based and globally keyed by mutable IDs:**

- Issue: Python writes responses via `MED_TMP/temp_requests.txt`, while Go tracks in-memory script state in a shared `Scripts` map.
- Files: `pythonCode/med_libs/GoExecutionScript.py`, `go_server/src/utils.go`, `go_server/blueprints/extraction_text/extraction_text.go`
- Impact: Concurrent extraction jobs can become fragile when IDs collide or temp file path assumptions differ across environments.
- Fix approach: Use per-request temp files (include request UUID), explicit response channels, and robust cleanup/failure handling.

## Known Bugs

**Transformer extraction unit test imports a non-existent class:**

- Symptoms: Test module cannot import expected class or silently uses wrong fallback path.
- Files: `test/extractionTransformerText/test_transformer_text_extraction.py`, `pythonCode/modules/extraction_text/text_feature_extraction.py`
- Trigger: Running `test/extractionTransformerText/test_transformer_text_extraction.py` (it imports `GoExecScriptTextFeatureExtraction`, but implementation defines `GoExecScriptTransformerExtraction`).
- Workaround: Update test import/class name to `GoExecScriptTransformerExtraction` and align expected response contract.

**Transformer extraction test contract mismatches implementation contract:**

- Symptoms: Tests expect `{"status": "success"|"error"}` and CSV output flow, while production script returns enriched config JSON without `status` field and writes to MongoDB.
- Files: `test/extractionTransformerText/test_transformer_text_extraction.py`, `pythonCode/modules/extraction_text/text_feature_extraction.py`
- Trigger: Running tests in `test/extractionTransformerText/` against current extraction module.
- Workaround: Split tests into (1) API/Go+Mongo integration tests and (2) pure embedding unit tests; update assertions to current response schema.

**Chunking logic drops trailing text chunk for long notes:**

- Symptoms: Long clinical notes can lose final segment embeddings when split by newline/token budget.
- Files: `pythonCode/modules/extraction_text/text_feature_extraction.py`, `pythonCode/modules/extraction_text/BioBERT_extraction.py`, `pythonCode/tests/extraction_text/test_biobert_extraction.py`
- Trigger: Note length > 510 tokens with leftover text after last split boundary.
- Workaround: Append residual chunk after loop when `len_sub > 0`; add regression tests with >510-token synthetic notes.

## Security Considerations

**Unauthenticated local MongoDB connection assumptions:**

- Risk: Extraction code directly connects to `mongodb://localhost:54017/` with no auth/TLS parameters.
- Files: `pythonCode/modules/extraction_text/text_feature_extraction.py`, `pythonCode/modules/extraction_text/BioBERT_extraction.py`
- Current mitigation: Process appears constrained to local environment.
- Recommendations: Move Mongo URI to secure env-configured variable, require auth in non-dev environments, and support TLS options.

**Go server reads arbitrary response file path emitted by Python process:**

- Risk: `copyOutput` trusts `response-ready*_*<path>` and `ReadFile` reads that path directly.
- Files: `go_server/src/utils.go`, `pythonCode/med_libs/GoExecutionScript.py`
- Current mitigation: Intended internal protocol between trusted components.
- Recommendations: Restrict readable paths to a dedicated temp directory, validate resolved path prefix, and reject path traversal.

## Performance Bottlenecks

**Per-row insertion and repeated DataFrame materialization during extraction:**

- Problem: For `Note` frequency, loop inserts one document at a time and builds DataFrames from full Mongo cursor materialization repeatedly.
- Files: `pythonCode/modules/extraction_text/text_feature_extraction.py`, `pythonCode/modules/extraction_text/BioBERT_extraction.py`
- Cause: `pd.DataFrame(list(collection.find(...)))` and frequent `insert_many(records)` with tiny payloads.
- Improvement path: Stream cursor batches, accumulate larger insert batches, and avoid DataFrame conversion when only few fields are needed.

**Collection size retrieval performs full scan:**

- Problem: `len(list(result_collection.find()))` loads entire result set into memory.
- Files: `pythonCode/modules/extraction_text/text_feature_extraction.py`, `pythonCode/modules/extraction_text/BioBERT_extraction.py`
- Cause: Full materialization for counting.
- Improvement path: Replace with `result_collection.count_documents({})`.

**Repository carries heavy test/model assets that inflate clone and CI time:**

- Problem: Large committed assets include model weights and wide CSV fixtures.
- Files: `python/pretrained_bert_tf/biobert_pretrain_output_all_notes_150000/pytorch_model.bin`, `python/pretrained_bert_tf/biobert_pretrain_output_all_notes_150000/model.ckpt-150000.data-00000-of-00001`, `test/data/testingPhaseCSV/chart_events.csv`, `test/data/testingPhaseCSV/lab_events.csv`, `test/data/testingPhaseCSV/discharge_notes.csv`
- Cause: Binary/large-data fixtures stored directly in repo.
- Improvement path: Move heavy assets to artifact storage/LFS, keep minimal deterministic fixtures in `test/`, and document pull-on-demand scripts.

## Fragile Areas

**Model list synchronization across UI, backend, and tests is manual:**

- Files: `renderer/components/extractionTabular/extractionTypes/extractionTransformerText.jsx`, `pythonCode/modules/extraction_text/text_feature_extraction.py`, `test/extractionTransformerText/test_transformer_text_extraction_models.py`
- Why fragile: Three separate `PREDEFINED_MODELS` definitions can drift, causing UI options that backend cannot resolve or tests that validate obsolete models.
- Safe modification: Centralize model registry in one source (JSON or Python module) and generate/consume it in UI and tests.
- Test coverage: No contract test enforces registry parity across layers.

**Go process lifecycle handling can leave stale script state:**

- Files: `go_server/src/utils.go`
- Why fragile: `KillScript` only attempts kill when `ProcessState.Exited()` is true, which is opposite of intended kill condition for running processes.
- Safe modification: Kill when process exists and is not exited; add nil/state checks and unit tests around script lifecycle.
- Test coverage: No automated test detected for `KillScript` semantics.

## Scaling Limits

**Extraction throughput tied to frontend chunk size and repeated backend initialization:**

- Current capacity: Frontend slices identifiers by fixed size 25 before calling extraction (`extractDataFromFileList`).
- Limit: As patient count or model count grows, total jobs and model reloads increase sharply; this is amplified for larger HF models.
- Scaling path: Use long-running extraction jobs with backend-managed batching, job queueing, and model instance reuse.

**Single-process embedding pipeline limits multi-model expansion:**

- Current capacity: One Python process/job handles one selected model and writes directly to MongoDB.
- Limit: Running multiple models (as exercised in `test/extractionTransformerText/test_transformer_text_extraction_models.py`) requires repeated full dataset passes and repeated inference setup.
- Scaling path: Introduce multi-model orchestration (shared tokenization where possible, per-model worker pool, and parallelized batched inference).

## Dependencies at Risk

**Hugging Face model IDs as runtime dependencies:**

- Risk: Model availability, tokenizer format changes, or upstream removals can break extraction at runtime.
- Impact: `TransformerText_extraction` fails during `from_pretrained`, blocking feature generation.
- Migration plan: Pin tested revisions, keep a local model cache strategy, and add health-check validation for configured models.

## Missing Critical Features

**No explicit benchmark/acceptance gate for adding new text models:**

- Problem: New models can be added to UI/backend lists without mandatory quality/performance checks.
- Blocks: Safe rollout of additional extraction models with predictable latency and embedding shape guarantees.

**No canonical integration test for end-to-end Transformer extraction API path:**

- Problem: Existing tests in `test/extractionTransformerText/` are script-oriented and currently misaligned with production contracts.
- Blocks: Confident refactoring of `go_server` + Python + renderer extraction path.

## Test Coverage Gaps

**Production Transformer extraction class/path not validated by current tests:**

- What's not tested: End-to-end success/failure behavior of `GoExecScriptTransformerExtraction` through `/extraction_text/TransformerText_extraction/`.
- Files: `pythonCode/modules/extraction_text/text_feature_extraction.py`, `go_server/blueprints/extraction_text/extraction_text.go`, `test/extractionTransformerText/test_transformer_text_extraction.py`
- Risk: API regressions can ship while tests still pass/are skipped due to import/contract drift.
- Priority: High

**Edge cases for long-note chunking and empty-note handling are unverified:**

- What's not tested: Residual chunk preservation, mixed empty/non-empty note lists, and variable hidden sizes across models.
- Files: `pythonCode/modules/extraction_text/text_feature_extraction.py`, `pythonCode/modules/extraction_text/BioBERT_extraction.py`, `test/extractionTransformerText/test_transformer_text_extraction_models.py`
- Risk: Silent embedding quality degradation and inconsistent output schema across model families.
- Priority: High

**Operational concerns (timeouts/memory) are not covered in tests despite heavy fixtures:**

- What's not tested: Runtime and memory boundaries when running extraction over `test/data/testingPhaseCSV/*.csv` and local model assets.
- Files: `test/data/testingPhaseCSV/discharge_notes.csv`, `test/data/testingPhaseCSV/radiology_notes.csv`, `python/pretrained_bert_tf/biobert_pretrain_output_all_notes_150000/*`
- Risk: CI/local runs may be flaky or too slow, masking correctness issues behind infrastructure failures.
- Priority: Medium

---

_Concerns audit: 2026-03-31_
