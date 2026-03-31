# Coding Conventions

**Analysis Date:** 2026-03-31

## Naming Patterns

**Files:**

- Use `camelCase` for most JavaScript/JSX utility and page files (examples: `renderer/utilities/requests.js`, `renderer/components/mainPages/extractionText.jsx`, `main/helpers/terminalManager.js`).
- Use `PascalCase` for React component files that represent a primary component/class (examples: `renderer/components/flow/results/PipelinesResults.jsx` does not follow this strictly, while `renderer/components/mainPages/extractionTransformerTextPage.jsx` and `renderer/components/layout/flexlayout/mainContainerClass.tsx` are mixed-style variants).
- Use `snake_case` for Python modules (examples: `pythonCode/modules/extraction_text/BioBERT_extraction.py`, `pythonCode/modules/learning/run_experiment.py`, `pythonCode/modules/evaluation/predict_test.py`).
- Use `test_*.py` for pytest-style files (examples: `pythonCode/submodules/MEDimage/tests/test_extraction.py`, `pythonCode/submodules/MEDimage/tests/test_filtering.py`) and script-style naming for manual test runners (example: `pythonCode/tests/extraction_text/test_biobert_extraction.py`).

**Functions:**

- Use `camelCase` in JS/TS(X) (examples: `datasetSelected`, `runExtraction` in `renderer/components/extractionTabular/extractionTabularData.jsx`; `startJupyterServer` in `renderer/components/layout/flexlayout/mainContainerClass.tsx`).
- Use `snake_case` in Python (examples: `parse_arguments`, `get_response_from_error` in `pythonCode/med_libs/GoExecutionScript.py`; `get_embeddings_from_event_list` in `pythonCode/modules/extraction_text/text_feature_extraction.py`).
- Keep React component functions as `PascalCase` constants (examples: `ExtractionTextPage` in `renderer/components/mainPages/extractionText.jsx`, `ExtractionTransformerText` in `renderer/components/extractionTabular/extractionTypes/extractionTransformerText.jsx`).

**Variables:**

- Use `camelCase` for JS local/state variables (examples: `selectedDataset`, `extractionJsonData`, `mayProceed` in `renderer/components/extractionTabular/extractionTabularData.jsx`).
- Use `UPPER_SNAKE_CASE` for constants (examples: `TERMINAL_CLONE_READY_DELAY` in `main/helpers/terminalManager.js`, `PREDEFINED_MODELS` in `pythonCode/modules/extraction_text/text_feature_extraction.py`).
- Python class members generally use `snake_case`, with legacy uppercase members for model handles in extraction scripts (`BIOBERT_PATH`, `BIOBERT_MODEL` in `pythonCode/modules/extraction_text/BioBERT_extraction.py`).

**Types:**

- TypeScript uses explicit interfaces for context and props/state where present (examples: `LayoutContextType`, `DataContextType` in `renderer/components/layout/flexlayout/mainContainerClass.tsx`).
- JavaScript and Python codebases are primarily dynamic-typed; use docstrings/JSDoc blocks for intent instead of strict type annotations in most files (examples: `renderer/components/extractionTabular/extractionTypes/extractionBioBERT.jsx`, `pythonCode/modules/learning/predict.py`).

## Code Style

**Formatting:**

- Tool used: Prettier via `.prettierrc.js`.
- Key settings from `.prettierrc.js`:
  - `semi: false`
  - `singleQuote: false`
  - `tabWidth: 2`
  - `printWidth: 200`
  - `trailingComma: "none"`
- Apply 2-space indentation and semicolon-less JS style across renderer/main files (examples: `renderer/pages/_app.js`, `main/background.js`).

**Linting:**

- Tool used: ESLint via `.eslintrc.js` with `eslint:recommended`, `plugin:react/recommended`, and `next`.
- Key enforced rules:
  - `camelcase: ["error"]`
  - `quote-props: ["error", "consistent"]`
  - `no-mixed-spaces-and-tabs: ["error", "smart-tabs"]`
- Key disabled rules used by current code:
  - `react/prop-types`, `react-hooks/exhaustive-deps`, `@next/next/no-img-element`.
- TypeScript files may disable lint rules file-wide when needed for framework compatibility (example: `renderer/components/layout/flexlayout/mainContainerClass.tsx` starts with `/* eslint-disable ... */`).

## Import Organization

**Order:**

1. External packages/framework imports.
2. Project-relative imports.
3. Local `require`/interop imports when needed.

Use this mixed ordering pattern consistently in JS/TS files (examples: `main/background.js`, `renderer/components/layout/flexlayout/mainContainerClass.tsx`, `renderer/components/flow/results/pipelinesResults.jsx`).

**Path Aliases:**

- Not detected. Use relative paths (`../`, `../../`) for imports (examples: `renderer/components/mainPages/extractionText.jsx`, `renderer/components/extractionTabular/extractionTabularData.jsx`).

## Error Handling

**Patterns:**

- Wrap backend script entrypoints with framework-level exception handling through `GoExecutionScript.start()` in `pythonCode/med_libs/GoExecutionScript.py`; convert exceptions into structured error payloads.
- Raise explicit exceptions for invalid runtime prerequisites (examples: missing model path in `pythonCode/modules/extraction_text/BioBERT_extraction.py`, missing pickle model in `pythonCode/modules/learning/predict.py`).
- Use UI toasts for recoverable renderer-side failures and progress feedback (examples: `toast.error(...)` in `renderer/components/extractionTabular/extractionTabularData.jsx`, `renderer/utilities/requests.js`).
- Keep request wrappers defensive with `try/catch` around IPC and HTTP calls (example: `renderer/utilities/requests.js`).

## Logging

**Framework:** console + `electron-log` + `go_print`

**Patterns:**

- Use `console.log`/`console.error` heavily in renderer/main Electron code for runtime tracing (examples: `main/background.js`, `renderer/pages/_app.js`).
- Mirror logs to file and renderer through overridden `console.log` in `main/background.js`.
- Use Python-side `go_print` to emit protocol messages to the Go bridge (examples: `pythonCode/med_libs/server_utils.py`, `pythonCode/modules/learning/run_experiment.py`).

## Comments

**When to Comment:**

- Use block comments/JSDoc-style comments for component purpose and function contracts, especially in UI workflow files (examples: `renderer/components/extractionTabular/extractionTabularData.jsx`, `renderer/components/learning/workflow.jsx`).
- Use inline operational comments for platform-specific behavior and process-management code (examples: `main/helpers/terminalManager.js`, `main/background.js`).

**JSDoc/TSDoc:**

- Frequently used in JS/TS renderer and main files to document params and side effects (examples: `renderer/pages/_app.js`, `renderer/components/layout/flexlayout/mainContainerClass.tsx`).
- Python modules rely on docstrings for classes/functions (examples: `pythonCode/med_libs/GoExecutionScript.py`, `pythonCode/modules/extraction_text/text_feature_extraction.py`).

## Function Design

**Size:**

- Prefer medium-to-large orchestrator functions/components in workflow and app shell files (examples: `renderer/components/learning/workflow.jsx`, `main/background.js`), with helper methods defined in the same module.

**Parameters:**

- Use config-object parameters for backend processing entrypoints (examples: `_custom_process(self, json_config)` in `pythonCode/modules/learning/predict.py` and `pythonCode/modules/extraction_text/text_feature_extraction.py`).
- Use prop objects in React components and pass callbacks/state setters down (examples: `ExtractionBioBERT` in `renderer/components/extractionTabular/extractionTypes/extractionBioBERT.jsx`).

**Return Values:**

- Backend scripts return serializable dictionaries intended for IPC/Go transport (examples: `self.results` in `pythonCode/modules/learning/predict.py`, `pythonCode/modules/evaluation/predict_test.py`).
- Frontend helper/request functions return promise-based results and invoke callbacks (example: `axiosPostJsonGo` in `renderer/utilities/requests.js`).

## Module Design

**Exports:**

- Use `export default` for React components and major JS modules (examples: `renderer/components/mainPages/extractionText.jsx`, `renderer/components/extractionTabular/extractionTabularData.jsx`, `main/helpers/terminalManager.js`).
- Use named exports for utility functions where multiple APIs are exposed (example: `requestBackend`, `requestJson`, `axiosPostJsonGo` in `renderer/utilities/requests.js`).
- Python execution modules instantiate and run scripts at module bottom rather than exporting callable APIs (examples: `pythonCode/modules/learning/run_experiment.py`, `pythonCode/modules/extraction_text/BioBERT_extraction.py`).

**Barrel Files:**

- Limited usage. Direct file imports are preferred across renderer/main (examples: `renderer/pages/_app.js` direct imports, `main/background.js` direct imports).

---

_Convention analysis: 2026-03-31_
