# External Integrations

**Analysis Date:** 2026-03-31

## APIs & External Services

**Model Providers (NLP extraction):**

- Hugging Face Hub - Transformer model download/resolve for extraction modules.
  - SDK/Client: `transformers` + `huggingface-hub` (Python requirements in `pythonEnv/requirements.txt`).
  - Auth: Not required in current code paths; model IDs are public strings in `pythonCode/modules/extraction_text/text_feature_extraction.py` and links listed in `pythonCode/modules/extraction_text/selected_models.txt`.

**BI/Analytics:**

- Apache Superset - launched and configured locally for embedded dashboard use.
  - SDK/Client: `@superset-ui/embedded-sdk` (`package.json`) and `apache-superset==4.1.1` managed by `pythonCode/modules/superset/SupersetEnvManager.py`.
  - Auth: Superset admin user created by script in `pythonCode/modules/superset/launch.py`; additional users created via `pythonCode/modules/superset/create_user.py` route.

**Platform Update Service:**

- GitHub Releases - desktop auto-update channel.
  - SDK/Client: `electron-updater` in `main/background.js`, publish config in `electron-builder.yml`.
  - Auth: CI uses `GITHUB_TOKEN` in `.github/workflows/automaticBuilding*.yml`.

**Package/Artifact download endpoints:**

- External binary/package downloads for runtime bootstrap:
  - Python standalone tarballs from `github.com/indygreg/python-build-standalone` in `main/utils/pythonEnv.js`.
  - MongoDB installers from `fastdl.mongodb.org` and package manager repos in `main/utils/installation.js`.

## Data Storage

**Databases:**

- MongoDB (local single-node instance expected).
  - Connection: hardcoded `mongodb://localhost:54017/` in `pythonCode/med_libs/mongodb_utils.py`, `pythonCode/modules/extraction_text/BioBERT_extraction.py`, `pythonCode/modules/extraction_text/text_feature_extraction.py`, and `renderer/components/mongoDB/mongoDBUtils.js`.
  - Client: `pymongo` in Python modules; `mongodb` Node driver in renderer/main JS.

**File Storage:**

- Local filesystem only for working data, temporary request payloads, and extracted artifacts (`pythonCode/med_libs/GoExecutionScript.py`, `main/utils/pythonEnv.js`, `renderer/components/mongoDB/mongoDBUtils.js`).

**Caching:**

- Model/resource caching delegated to Hugging Face/transformers default local cache behavior (no separate Redis/memcached service detected).

## Authentication & Identity

**Auth Provider:**

- Superset internal auth (local app-managed users).
  - Implementation: scripted admin creation and user provisioning through Superset CLI in `pythonCode/modules/superset/launch.py` and `pythonCode/modules/superset/create_user.py`.

## Monitoring & Observability

**Error Tracking:**

- None detected for external SaaS error tracking (no Sentry/NewRelic client found in scanned app code).

**Logs:**

- Local logging via `electron-log` in `main/background.js`.
- Go server logging through standard `log` package in `go_server/main.go` and `go_server/src/utils.go`.
- Python scripts return progress/status through stdout markers handled by Go bridge (`pythonCode/med_libs/GoExecutionScript.py` ↔ `go_server/src/utils.go`).

## CI/CD & Deployment

**Hosting:**

- Desktop distribution (not web hosting) via Electron build artifacts in `electron-builder.yml`.

**CI Pipeline:**

- GitHub Actions in `.github/workflows/automaticBuilding.yml`, `.github/workflows/automaticBuildingMac.yml`, `.github/workflows/automaticBuildingLinux.yml`, `.github/workflows/automaticBuildingWin.yml`.

## Environment Configuration

**Required env vars:**

- `MED_ENV` (Python executable path used by Go launcher) in `go_server/main.go` and `go_server/src/utils.go`.
- `MED_TMP` (temporary directory for response handoff files) in `go_server/main.go` and `pythonCode/med_libs/GoExecutionScript.py`.
- `RUN_MODE` / `ELECTRON_RUN_MODE` (dev/prod script path behavior) in `go_server/src/utils.go`.
- `NODE_ENV` (dev/prod branching in Electron runtime management) in `main/background.js` and `main/utils/pythonEnv.js`.

**Secrets location:**

- `.env` file present at repository root (`.env`), plus GitHub Actions secrets referenced in `.github/workflows/automaticBuilding*.yml`.

## Webhooks & Callbacks

**Incoming:**

- Internal HTTP endpoints only (renderer to local Go server), e.g., `/extraction_text/BioBERT_extraction/`, `/extraction_text/TransformerText_extraction/`, `/superset/launch/` via `go_server/blueprints/extraction_text/extraction_text.go` and `go_server/blueprints/superset/superset.go`.
- No third-party webhook receiver endpoints detected.

**Outgoing:**

- Renderer HTTP calls to local Go backend through Axios in `renderer/utilities/requests.js`.
- Superset launched as local background process and framed at `http://localhost:<port>` in `renderer/components/mainPages/superset/SupersetFrame.jsx`.
- Hugging Face model fetches triggered by `AutoTokenizer.from_pretrained(...)` / `AutoModel.from_pretrained(...)` in `pythonCode/modules/extraction_text/text_feature_extraction.py`.

## Model/Provider Integration Points (Extraction-focused)

- **Frontend model selection:** `renderer/components/extractionTabular/extractionTypes/extractionTransformerText.jsx` sends `model_source_type` and `model_name_or_path` with extraction request payload.
- **Backend model dispatch:** `go_server/blueprints/extraction_text/extraction_text.go` maps routes to:
  - `../pythonCode/modules/extraction_text/BioBERT_extraction.py`
  - `../pythonCode/modules/extraction_text/text_feature_extraction.py`
- **Predefined Hugging Face registry:** `PREDEFINED_MODELS` map in `pythonCode/modules/extraction_text/text_feature_extraction.py`.
- **Reference list for extension:** `pythonCode/modules/extraction_text/selected_models.txt`.
- **Validation/testing path for new models:** standalone script `pythonCode/tests/extraction_text/test_biobert_extraction.py` and operator guide `.vscode/instructions/QUICK_START_BIOBERT_TEST.md`.
- **Data path for model enhancement experiments:** CSV-driven extraction test flow in `pythonCode/tests/extraction_text/test_biobert_extraction.py` (input CSV and output embedding CSV), suitable for quick A/B checks before wiring a new model into `PREDEFINED_MODELS`.

---

_Integration audit: 2026-03-31_
