# Codebase Structure

**Analysis Date:** 2026-03-31

## Directory Layout

```text
MEDomics/
├── main/                    # Electron main-process source (IPC, server bootstrap, workspace/runtime management)
├── renderer/                # Next.js/React renderer source (UI, workflows, request clients)
├── go_server/               # Go HTTP orchestration server and blueprint route handlers
├── pythonCode/              # Python execution modules and shared libraries invoked by Go
├── test/                    # Manual/standalone extraction-model test scripts + CSV fixtures
├── app/                     # Built renderer/main artifacts bundled by Nextron/Electron
├── go_executables/          # Packaged Go binaries used in production packaging
├── pythonEnv/               # Python requirements bundles used for bundled runtime install
├── utilScripts/             # Build/packaging helper scripts per platform
├── resources/               # App assets used in packaging and UI
├── baseFiles/               # Base template files (for example empty scene/notebook)
└── .planning/codebase/      # Codebase mapping documents for planner/executor agents
```

## Directory Purposes

**`main/`:**

- Purpose: Electron main-process control plane.
- Contains: `background.js` app lifecycle, helpers, server/python/workspace utility modules.
- Key files: `main/background.js`, `main/utils/server.js`, `main/utils/pythonEnv.js`, `main/utils/workspace.js`, `main/helpers/terminalManager.js`.

**`renderer/`:**

- Purpose: End-user interface and workflow authoring/execution triggers.
- Contains: module pages, reusable components, flow contexts, request utilities, static public assets.
- Key files: `renderer/pages/_app.js`, `renderer/components/layout/layoutManager.jsx`, `renderer/components/learning/workflow.jsx`, `renderer/components/extractionTabular/extractionTabularData.jsx`, `renderer/utilities/requests.js`.

**`go_server/`:**

- Purpose: Local HTTP API layer that translates UI requests into Python script execution.
- Contains: `main.go` route registration and runtime setup, `blueprints/*` module routes, `src/utils.go` process + request utilities.
- Key files: `go_server/main.go`, `go_server/src/utils.go`, `go_server/blueprints/learning/learning.go`, `go_server/blueprints/extraction_text/extraction_text.go`, `go_server/blueprints/input/input.go`.

**`pythonCode/`:**

- Purpose: Implementation of extraction/model/data operations executed by backend orchestration.
- Contains: per-domain scripts in `modules/*` and shared base abstractions in `med_libs/*`.
- Key files: `pythonCode/modules/learning/run_experiment.py`, `pythonCode/modules/extraction_text/text_feature_extraction.py`, `pythonCode/med_libs/GoExecutionScript.py`, `pythonCode/med_libs/server_utils.py`.

**`test/`:**

- Purpose: Test datasets and standalone scripts supporting extraction/model orchestration validation.
- Contains: Transformer extraction scripts and CSV fixtures for reproducible local runs.
- Key files: `test/extractionTransformerText/create_small_subset.py`, `test/extractionTransformerText/test_transformer_text_extraction_models.py`, `test/extractionTransformerText/test_transformer_text_extraction.py`, `test/data/testingPhaseCSV/discharge_notes_subset.csv`.

**`app/`:**

- Purpose: Generated app output consumed in production mode (`serve({ directory: "app" })` in `main/background.js`).
- Contains: compiled Next chunks, static assets, copied setup/public resources, packaged executable payloads.
- Key files: `app/background.js`, `app/index.html`, `app/_next/static/**`.

## Key File Locations

**Entry Points:**

- `main/background.js`: Electron process entry and IPC/server lifecycle hub.
- `renderer/pages/_app.js`: Renderer app root with providers and IPC listeners.
- `go_server/main.go`: Go HTTP server bootstrap and blueprint registration.
- `pythonCode/modules/*/*.py`: Python script execution entrypoints invoked from Go blueprints.

**Configuration:**

- `medomics.dev.js`: Runtime config (`defaultPort`, `mongoPort`, server auto-start behavior).
- `package.json`: Nextron/Electron scripts and dependency graph.
- `go_server/go.mod`: Go module dependencies and version target.
- `pythonEnv/merged_requirements.txt`: Python package set required for bundled environment.

**Core Logic:**

- `renderer/components/learning/workflow.jsx`: Learning graph orchestration + backend run wiring.
- `renderer/components/extractionTabular/extractionTabularData.jsx`: Tabular extraction orchestration and batching.
- `go_server/src/utils.go`: Request wrapper, process registry, stdout protocol parsing.
- `pythonCode/med_libs/GoExecutionScript.py`: Cross-module execution protocol for Python scripts.

**Testing:**

- `test/extractionTransformerText/*.py`: Transformer text extraction validation scripts.
- `test/data/testingPhaseCSV/*.csv`: fixture datasets for extraction/testing phase scenarios.
- `pythonCode/tests/extraction_text/test_biobert_extraction.py`: standalone BioBERT extraction test utility.

## Naming Conventions

**Files:**

- React components: camelCase `.jsx`/`.tsx` (example: `renderer/components/layout/layoutManager.jsx`, `renderer/components/learning/HyperParameterInput.jsx`).
- Go blueprints: lower_snake_case directory + `.go` file repeating directory name (example: `go_server/blueprints/extraction_text/extraction_text.go`).
- Python modules/scripts: snake_case `.py` (example: `pythonCode/modules/learning/run_experiment.py`).

**Directories:**

- Renderer components are grouped by feature/module (`renderer/components/learning/`, `renderer/components/extractionMEDimage/`, `renderer/components/mainPages/`).
- Python execution modules are grouped by backend route domain (`pythonCode/modules/learning/`, `pythonCode/modules/input/`, `pythonCode/modules/extraction_text/`).

## Where to Add New Code

**New Feature:**

- Primary code: add UI wiring in `renderer/components/mainPages/` and feature logic under the corresponding subtree in `renderer/components/<module>/`.
- Backend route: add Go handler in `go_server/blueprints/<module>/<module>.go` and register via that module’s `AddHandleFunc()`.
- Python execution: add script in `pythonCode/modules/<module>/` and invoke via `Utils.StartPythonScripts(...)` in Go blueprint.
- Tests: add fixture/script support in `test/<feature>/` and use datasets under `test/data/testingPhaseCSV/` when relevant.

**New Component/Module:**

- Implementation: place module page wrapper in `renderer/components/mainPages/` and mount it from `renderer/components/layout/layoutManager.jsx` sidebar/content switch.

**Utilities:**

- Shared request helpers: `renderer/utilities/`.
- Main-process runtime helpers: `main/utils/` or `main/helpers/`.
- Python shared execution helpers: `pythonCode/med_libs/`.
- Go shared server utilities: `go_server/src/`.

## Special Directories

**`test/data/testingPhaseCSV/`:**

- Purpose: Fixed CSV fixtures used by extraction/testing scripts.
- Generated: No.
- Committed: Yes.

**`test/extractionTransformerText/outputs/`:**

- Purpose: Output target for model-sweep extraction script artifacts.
- Generated: Yes (script output).
- Committed: Yes (currently includes generated CSVs).

**`app/`:**

- Purpose: Built/distributed app assets used in production runs.
- Generated: Yes.
- Committed: Yes.

**`backend/node_modules/`:**

- Purpose: Legacy/auxiliary dependency directory without active source files in `backend/`.
- Generated: Yes.
- Committed: Yes (as currently present in repository state).

---

_Structure analysis: 2026-03-31_
