# Architecture

**Analysis Date:** 2026-03-31

## Pattern Overview

**Overall:** Electron desktop host + Next.js/React renderer + local Go HTTP orchestrator that delegates execution to Python scripts.

**Key Characteristics:**

- UI logic and workflow editing live in the renderer layer under `renderer/components/**`.
- Execution orchestration is split: renderer issues HTTP calls, Go registers module routes, Python performs data/model/extraction jobs.
- Workspace/runtime lifecycle (server boot, Python env detection, MongoDB lifecycle, IPC) is centralized in `main/background.js`.

## Layers

**Desktop Shell / Process Control (Electron Main):**

- Purpose: Own app lifecycle, spawn/monitor backend services, expose IPC APIs to renderer.
- Location: `main/background.js`, `main/utils/server.js`, `main/utils/pythonEnv.js`, `main/utils/workspace.js`, `main/helpers/terminalManager.js`.
- Contains: BrowserWindow bootstrap, updater integration, workspace selection, server launch, MongoDB boot/stop, terminal PTY management.
- Depends on: Electron IPC, local Go binary in `go_server/main` (dev) or packaged `go_executables/*` (prod), local Python runtime.
- Used by: Renderer via `ipcRenderer.invoke(...)` and `ipcRenderer.send(...)` in `renderer/pages/_app.js` and components.

**Renderer UI / Workflow Authoring:**

- Purpose: Render module pages, maintain workflow state, trigger backend execution requests, display progress/results.
- Location: `renderer/pages/_app.js`, `renderer/components/layout/layoutManager.jsx`, `renderer/components/flow/flowPageBase.jsx`, `renderer/components/learning/workflow.jsx`, `renderer/components/extractionTabular/extractionTabularData.jsx`, `renderer/components/extractionMEDimage/flowCanvas.jsx`.
- Contains: Route-independent app shell, module containers, React Flow graph editing, request wrappers, progress polling.
- Depends on: `renderer/utilities/requests.js`, context providers, Electron IPC, Go HTTP routes.
- Used by: End-user interactions from module pages under `renderer/components/mainPages/*.jsx`.

**HTTP Orchestration Gateway (Go Server):**

- Purpose: Provide module-scoped HTTP endpoints, launch and track Python tasks, return JSON/progress to renderer.
- Location: `go_server/main.go`, `go_server/src/utils.go`, `go_server/blueprints/**`.
- Contains: Route registration (`AddHandleFunc`), request decode/encode wrapper (`CreateHandleFunc`), process map (`Scripts`) keyed by request id, progress extraction from stdout markers.
- Depends on: Python script entrypoints in `pythonCode/modules/**`, environment vars `MED_ENV` and `MED_TMP`.
- Used by: Renderer HTTP calls through `requestBackend` / `requestJson` in `renderer/utilities/requests.js`.

**Execution Modules (Python):**

- Purpose: Implement actual extraction, learning, evaluation, input processing, and related data/model operations.
- Location: `pythonCode/modules/**` with shared base libs in `pythonCode/med_libs/**`.
- Contains: Script classes inheriting `GoExecutionScript` for argument parsing, progress signaling, response serialization.
- Depends on: MongoDB collections (`mongodb://localhost:54017` in scripts such as `pythonCode/modules/learning/run_experiment.py`), ML/data libs, Hugging Face models in extraction scripts.
- Used by: Go blueprint handlers via `Utils.StartPythonScripts(...)` (for example in `go_server/blueprints/learning/learning.go` and `go_server/blueprints/extraction_text/extraction_text.go`).

**Test Assets / Offline Validation:**

- Purpose: Provide reproducible local datasets and standalone scripts for extraction/model behavior validation outside the renderer-go pipeline.
- Location: `test/extractionTransformerText/*.py`, `test/data/testingPhaseCSV/*.csv`, `test/extractionTransformerText/outputs/*.csv`.
- Contains: subset generation (`create_small_subset.py`), model sweep script (`test_transformer_text_extraction_models.py`), and legacy unittest-style extraction script (`test_transformer_text_extraction.py`).
- Depends on: Transformer models from Hugging Face and CSV fixtures.
- Used by: Manual/local developer testing rather than automated app-integrated test harness.

## Data Flow

**Learning orchestration flow (`/learning/run_experiment/{pageId}`):**

1. `renderer/components/learning/workflow.jsx` serializes the active React Flow graph, writes backend metadata into workspace collections, then sends request via `requestBackend(...)` to `/learning/run_experiment/{pageId}`.
2. `renderer/utilities/requests.js` posts `{ message: JSON.stringify(payload) }` to `http://localhost:{port}/learning/run_experiment/{pageId}`.
3. `go_server/blueprints/learning/learning.go` resolves to `handleRunExperiment`, which calls `Utils.StartPythonScripts(..., "../pythonCode/modules/learning/run_experiment.py", id)`.
4. `pythonCode/modules/learning/run_experiment.py` loads flow config from MongoDB, executes `MEDexperimentLearning`, emits progress markers (`progress*_*...`) and final response marker (`response-ready*_*...`) via `GoExecutionScript`.
5. `go_server/src/utils.go` reads progress/response markers from stdout, updates in-memory `Scripts[id]`, and returns response to renderer.
6. `renderer/components/generalPurpose/progressBarRequests.jsx` polls `/learning/progress/{pageId}` while running and `workflow.jsx` updates UI/results pane on completion.

**Transformer text extraction flow (`/extraction_text/TransformerText_extraction/{pageId}`):**

1. `renderer/components/mainPages/extractionTransformerTextPage.jsx` hosts `ExtractionTabularData` configured with `serverUrl="/extraction_text/"` and extraction type `TransformerText`.
2. `renderer/components/extractionTabular/extractionTabularData.jsx` batches patient identifiers and calls `/extraction_text/TransformerText_extraction/{pageId}`.
3. `go_server/blueprints/extraction_text/extraction_text.go` dispatches to `pythonCode/modules/extraction_text/text_feature_extraction.py`.
4. `text_feature_extraction.py` loads model/tokenizer (predefined map or custom path), reads source collection, writes embedding rows into result collection, returns collection metadata.
5. Renderer updates workspace metadata and displays extracted dataset via `DataTableFromDB`.

**State Management:**

- App/session state is React-context-based in renderer (`WorkspaceContext`, `LayoutModelContext`, `Flow*Context`) and persisted partly in Electron userData JSON files (`settings.json`, `workspaces.json`) managed by `main/utils/workspace.js` and `main/background.js`.

## Key Abstractions

**Workflow Scene Abstraction (graph + metadata):**

- Purpose: Represent executable ML/extraction pipelines authored in UI.
- Examples: `renderer/components/learning/workflow.jsx`, `renderer/components/extractionMEDimage/flowCanvas.jsx`, static node definitions in `renderer/public/setupVariables/*.jsx`.
- Pattern: React Flow state transformed into backend-friendly JSON, persisted as `metadata.json` / `backend_metadata.json` through workspace DB objects.

**Go Request Wrapper + Script Registry:**

- Purpose: Standardize route behavior and track long-running script processes.
- Examples: `go_server/src/utils.go` (`CreateHandleFunc`, `StartPythonScripts`, global `Scripts` map), route registrations in `go_server/main.go`.
- Pattern: Uniform POST endpoint contract with a `message` JSON string payload and optional `{id}` path suffix.

**Python Execution Base Class:**

- Purpose: Unify argument parsing, progress reporting, and response handoff to Go.
- Examples: `pythonCode/med_libs/GoExecutionScript.py`, subclass usage in `pythonCode/modules/learning/run_experiment.py` and `pythonCode/modules/extraction_text/text_feature_extraction.py`.
- Pattern: Template method (`start()` + `_custom_process()`) with stdout signaling protocol (`progress*_*`, `response-ready*_*`).

## Entry Points

**Electron app entry:**

- Location: `main/background.js` (compiled target referenced as `app/background.js` in `package.json`).
- Triggers: App startup.
- Responsibilities: Window creation, app menu, workspace init, Go server start, MongoDB management, IPC handlers.

**Go server entry:**

- Location: `go_server/main.go`.
- Triggers: Spawned by `main/utils/server.js` via local executable.
- Responsibilities: Register all module routes, set runtime env (`MED_ENV`, `MED_TMP`), start HTTP listener.

**Renderer root entry:**

- Location: `renderer/pages/_app.js`.
- Triggers: Next/Nextron renderer bootstrap.
- Responsibilities: Register IPC listeners, initialize providers, mount `LayoutManager` and module pages.

**Module execution entry points:**

- Location: `renderer/components/mainPages/*.jsx` (for example `learning.jsx`, `extractionTransformerTextPage.jsx`, `extractionMEDimage.jsx`).
- Triggers: User selecting a sidebar module in `renderer/components/layout/layoutManager.jsx`.
- Responsibilities: Bind module UI to a page id and wire execution components.

## Error Handling

**Strategy:** Multi-layer catch-and-propagate with structured error payloads and UI toast/dialog surfacing.

**Patterns:**

- Renderer request wrappers in `renderer/utilities/requests.js` call per-request error callbacks and fallback logging/toasts.
- Python errors are converted to structured dict payloads by `pythonCode/med_libs/GoExecutionScript.py` (`get_response_from_error`) and returned via response file signaling.
- Go wrapper in `go_server/src/utils.go` maps handler errors to JSON-like `{"error": ...}` payload strings when processing fails.

## Cross-Cutting Concerns

**Logging:** Console/electron-log forwarding in `main/background.js`; Go logs in `go_server/main.go` and `go_server/src/utils.go`; Python stdout signaling/logging in `pythonCode/med_libs/server_utils.py`.

**Validation:** UI-level gating for required extraction fields in `renderer/components/extractionTabular/extractionTypes/extractionTransformerText.jsx`; workflow validation/default checks before run in `renderer/components/learning/workflow.jsx`; route method checks in `go_server/src/utils.go`.

**Authentication:** Not applicable for local desktop orchestration (localhost-only flow observed across `renderer/utilities/requests.js` and `go_server/main.go`).

---

_Architecture analysis: 2026-03-31_
