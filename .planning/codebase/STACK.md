# Technology Stack

**Analysis Date:** 2026-03-31

## Languages

**Primary:**

- JavaScript (ES modules) - Electron main process and app orchestration in `main/background.js`, `main/utils/server.js`, `main/utils/pythonEnv.js`.
- JSX (React) - Renderer UI in `renderer/components/**` including extraction pages in `renderer/components/extractionTabular/extractionTypes/extractionTransformerText.jsx` and `renderer/components/extractionTabular/extractionTypes/extractionBioBERT.jsx`.
- Python 3.9 runtime target - Data processing, extraction, ML, and Superset bootstrap in `pythonCode/modules/**`.
- Go 1.21 - Internal HTTP bridge server and module routing in `go_server/main.go`, `go_server/src/utils.go`, and `go_server/blueprints/**`.

**Secondary:**

- TypeScript/TSX (limited) - Utility/layout components in `renderer/components/layout/flexlayout/*.tsx`.
- YAML - Build/release pipelines and packaging config in `.github/workflows/*.yml`, `electron-builder.yml`, and `pythonEnv/conda_env_osx64.yml`.

## Runtime

**Environment:**

- Node.js 18.13 in CI (`.github/workflows/automaticBuilding.yml`, `.github/workflows/automaticBuildingMac.yml`, `.github/workflows/automaticBuildingLinux.yml`, `.github/workflows/automaticBuildingWin.yml`).
- Electron runtime (`electron` dependency in `package.json`) with Nextron (`nextron` in `package.json`) for Next.js + Electron integration.
- Python interpreter discovery and bundled runtime management in `main/utils/pythonEnv.js`.
- Go runtime for request routing and Python subprocess execution in `go_server/main.go` and `go_server/src/utils.go`.

**Package Manager:**

- npm (root app): `package.json` + lockfile `package-lock.json`.
- npm (legacy/minimal backend folder): `backend/package-lock.json` only detected (no `backend/package.json` detected).
- pip/requirements for Python environment in `pythonEnv/requirements.txt`, `pythonEnv/requirements_mac.txt`, and `pythonEnv/conda_env_osx64.yml`.
- Go modules in `go_server/go.mod` and `go_server/go.sum`.
- Lockfile: present for Node (`package-lock.json`, `backend/package-lock.json`) and Go (`go_server/go.sum`); Python is pinned by requirements/conda files, not lockfile-based.

## Frameworks

**Core:**

- Electron + Next.js via Nextron - desktop UI and renderer/main split (`package.json`, `renderer/next.config.js`, `main/background.js`).
- React 18 - UI framework (`package.json`) used across `renderer/components/**`.
- Go net/http with CORS wrapper - backend routing layer in `go_server/main.go` and `go_server/src/utils.go`.
- Python script execution framework (`GoExecutionScript`) for structured progress/response handoff in `pythonCode/med_libs/GoExecutionScript.py`.

**Testing:**

- pytest in Python dependency set (`pythonEnv/requirements.txt`) with tests present at `pythonCode/tests/extraction_text/test_biobert_extraction.py` and `pythonCode/submodules/MEDimage/tests/test_extraction.py`.

**Build/Dev:**

- Electron Builder packaging in `electron-builder.yml`.
- GitHub Actions CI/CD pipelines in `.github/workflows/*.yml`.
- Go compile during builds (`go build main.go`) in workflow files.

## Key Dependencies

**Critical:**

- `transformers` + `torch` + `huggingface-hub` (Python requirements) for text embedding extraction in `pythonCode/modules/extraction_text/text_feature_extraction.py` and `pythonCode/modules/extraction_text/BioBERT_extraction.py`.
- `pymongo` / `mongodb` for persistent dataset and feature storage in `pythonCode/med_libs/mongodb_utils.py` and `renderer/components/mongoDB/mongoDBUtils.js`.
- `axios` for renderer-to-Go HTTP calls in `renderer/utilities/requests.js`.
- `@superset-ui/embedded-sdk` (frontend dependency) plus Superset setup scripts in `pythonCode/modules/superset/launch.py` and `pythonCode/modules/superset/SupersetEnvManager.py`.

**Infrastructure:**

- Go `github.com/rs/cors` for API CORS in `go_server/go.mod` and `go_server/main.go`.
- `node-pty` for embedded terminal support (`package.json`) used by terminal components in `renderer/components/terminal/*.jsx`.
- Electron auto-update (`electron-updater`) in `main/background.js`.
- Two Git submodules for domain libraries (`.gitmodules`): `pythonCode/submodules/MEDimage` and `pythonCode/submodules/MEDprofiles`.

## Configuration

**Environment:**

- `.env` file present at repository root (`.env` exists) and consumed via process env helpers in `go_server/src/utils.go` (`GetDotEnvVariable`) and Electron/main code (`main/background.js`, `main/utils/pythonEnv.js`).
- Required runtime variables include `MED_ENV` and `MED_TMP` set by Go server startup in `go_server/main.go`.
- `RUN_MODE` / `ELECTRON_RUN_MODE` determines Python script path resolution in `go_server/src/utils.go`.
- `NODE_ENV` controls production/development behavior in `main/background.js` and `main/utils/pythonEnv.js`.

**Build:**

- App packaging and artifacts in `electron-builder.yml`.
- Platform-specific workflow automation in `.github/workflows/automaticBuilding*.yml`.
- Renderer bundling target set to `electron-renderer` in `renderer/next.config.js`.
- Runtime defaults (ports/auto-start behavior) in `medomics.dev.js`.

## Platform Requirements

**Development:**

- Node + npm for desktop app build (`package.json`).
- Go 1.21+ for server binary (`go_server/go.mod`).
- Python 3.9 target and pip packages (`pythonEnv/requirements*.txt`, `pythonEnv/conda_env_osx64.yml`).
- Local MongoDB expected on `localhost:54017` by both JS and Python layers (`renderer/components/mongoDB/mongoDBUtils.js`, `pythonCode/med_libs/mongodb_utils.py`).

**Production:**

- Electron packaged app with embedded resources from `electron-builder.yml` (`go_executables`, `pythonCode`, `pythonEnv`).
- Targeted desktop distribution for macOS (`dmg/zip/pkg`), Windows (`nsis exe`), and Linux (`deb`) per `electron-builder.yml` and `.github/workflows/automaticBuilding*.yml`.

---

_Stack analysis: 2026-03-31_
