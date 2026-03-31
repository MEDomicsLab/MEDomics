# Testing Patterns

**Analysis Date:** 2026-03-31

## Test Framework

**Runner:**

- `pytest` (detected from test naming and plain `assert` usage in `pythonCode/submodules/MEDimage/tests/test_extraction.py` and `pythonCode/submodules/MEDimage/tests/test_filtering.py`; `pytest==7.2.0` listed in `pythonEnv/requirements.txt`).
- Config: Not detected (`pytest.ini`, `setup.cfg`, and `pyproject.toml` pytest sections are not present at repository root; only `pythonCode/submodules/MEDimage/pyproject.toml` exists and does not define pytest config).

**Assertion Library:**

- Native Python `assert` statements (examples in `pythonCode/submodules/MEDimage/tests/test_extraction.py` and `pythonCode/submodules/MEDimage/tests/test_filtering.py`).

**Run Commands:**

```bash
pytest pythonCode/submodules/MEDimage/tests                       # Run MEDimage automated tests
pytest pythonCode/submodules/MEDimage/tests -k extraction -q      # Run extraction-focused subset
python pythonCode/tests/extraction_text/test_biobert_extraction.py <biobert_path> <input_csv> <output_csv>  # Run BioBERT validation script
```

## Test File Organization

**Location:**

- Python tests are in dedicated test directories under backend code:
  - `pythonCode/submodules/MEDimage/tests/`
  - `pythonCode/tests/extraction_text/`
- No JS/TS test suite detected for renderer/main (`jest.config.*` and `vitest.config.*` not detected).
- User-requested `./test/` directory is not present in this repository root; use `pythonCode/tests/` and `pythonCode/submodules/MEDimage/tests/` as the active test roots.

**Naming:**

- Pytest-compatible `test_*.py` naming for automated tests (examples: `pythonCode/submodules/MEDimage/tests/test_extraction.py`, `pythonCode/submodules/MEDimage/tests/test_filtering.py`).
- Script-style validation file can also use `test_` prefix while remaining executable as a CLI tool (example: `pythonCode/tests/extraction_text/test_biobert_extraction.py`).

**Structure:**

```
pythonCode/
├── tests/
│   └── extraction_text/
│       └── test_biobert_extraction.py
└── submodules/
    └── MEDimage/
        └── tests/
            ├── __init__.py
            ├── test_extraction.py
            └── test_filtering.py
```

## Test Structure

**Suite Organization:**

```python
class TestExtraction:
    def __get_phantom(self):
        ...

    def __get_random_roi(self):
        ...

    def test_morph_features(self):
        morph = MEDimage.biomarkers.morph.extract_all(...)
        assert abs(morph["Fmorph_vol"] - 556) < 1

    def test_stats_features(self):
        stats = MEDimage.biomarkers.stats.extract_all(...)
        assert abs(stats["Fstat_skew"] - 1.08) < 0.01
```

Pattern source: `pythonCode/submodules/MEDimage/tests/test_extraction.py`.

**Patterns:**

- Setup pattern: Build deterministic in-memory phantoms/ROIs in helper methods and local arrays (`__get_phantom`, `__get_random_roi` in `pythonCode/submodules/MEDimage/tests/test_extraction.py`).
- Teardown pattern: No explicit teardown; tests are pure compute and rely on process isolation.
- Assertion pattern: Mix equality checks against function aliases and tolerance-based numeric assertions (examples in `pythonCode/submodules/MEDimage/tests/test_extraction.py` and `pythonCode/submodules/MEDimage/tests/test_filtering.py`).

## Mocking

**Framework:**

- Not detected (`unittest.mock`, `pytest-mock`, and monkeypatch fixture usage are not present in identified tests).

**Patterns:**

```python
# Current pattern is real-function invocation with synthetic input, no mocks.
result = apply_gabor(input_images=phantom, voxel_length=2, sigma=5, _lambda=2, gamma=0.5, theta=np.pi/4, padding='constant')
assert round(np.max(result), 3) == 255.0
```

Pattern source: `pythonCode/submodules/MEDimage/tests/test_filtering.py`.

**What to Mock:**

- For new backend tests under `pythonCode/tests/`, mock heavy external dependencies (Hugging Face model loading, MongoDB I/O, filesystem writes) when validating control flow in:
  - `pythonCode/modules/extraction_text/BioBERT_extraction.py`
  - `pythonCode/modules/extraction_text/text_feature_extraction.py`
  - `pythonCode/modules/learning/predict.py`

**What NOT to Mock:**

- Keep numeric feature-kernel behavior unmocked for algorithm validation in MEDimage tests (`pythonCode/submodules/MEDimage/tests/test_extraction.py`, `pythonCode/submodules/MEDimage/tests/test_filtering.py`).

## Fixtures and Factories

**Test Data:**

```python
phantom = np.zeros((64,64,64))
phantom[32,32,32] = 255

roi = np.array([...], dtype=np.int16)
```

Sources: `pythonCode/submodules/MEDimage/tests/test_filtering.py`, `pythonCode/submodules/MEDimage/tests/test_extraction.py`.

**Location:**

- Data fixtures are inline in each test file (no shared `conftest.py` or fixtures module detected).
- Model catalog for extraction scenarios is maintained in `pythonCode/modules/extraction_text/selected_models.txt` and in the `PREDEFINED_MODELS` mapping in `pythonCode/modules/extraction_text/text_feature_extraction.py`.

## Coverage

**Requirements:** None enforced (no coverage tooling config detected in root, no CI coverage thresholds detected).

**View Coverage:**

```bash
pytest --cov=pythonCode/submodules/MEDimage pythonCode/submodules/MEDimage/tests
```

Command is operational guidance; coverage configuration file is not currently present.

## Test Types

**Unit Tests:**

- Numerical/algorithmic unit tests using deterministic synthetic arrays and direct library calls (examples in `pythonCode/submodules/MEDimage/tests/test_extraction.py` and `pythonCode/submodules/MEDimage/tests/test_filtering.py`).

**Integration Tests:**

- Script-driven integration validation for text extraction path/model loading and CSV processing in `pythonCode/tests/extraction_text/test_biobert_extraction.py`.
- This script exercises tokenizer/model loading (`transformers`), CSV IO (`pandas`), and embedding generation end-to-end.

**E2E Tests:**

- Not used for renderer/electron UI in the current repository (no Playwright/Cypress/Spectron test suite detected).

## Common Patterns

**Async Testing:**

```python
# Not a primary pattern in detected tests.
# Extraction validation script is synchronous and CLI-driven.
output_df = process_csv_with_biobert(...)
```

Source: `pythonCode/tests/extraction_text/test_biobert_extraction.py`.

**Error Testing:**

```python
if not os.path.exists(biobert_path):
    raise FileNotFoundError(...)

if patient_id_col not in df.columns:
    raise ValueError(...)
```

Source pattern currently appears in executable validation script and backend modules (`pythonCode/tests/extraction_text/test_biobert_extraction.py`, `pythonCode/modules/extraction_text/BioBERT_extraction.py`, `pythonCode/modules/extraction_text/text_feature_extraction.py`).

Use this explicit exception-validation style when adding tests around extraction pipeline guardrails.

---

_Testing analysis: 2026-03-31_
