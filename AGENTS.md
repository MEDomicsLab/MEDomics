# AGENTS

## Project Planning Scaffold

This repository includes a planning scaffold for extraction model expansion under `.planning/`.

### Active Initiative

- Brownfield enhancement: extraction model expansion.
- Scope focus: text extraction model onboarding first.
- Subsequent replication target: image and time-series extraction modules.

### Core Constraints

- Preserve current extraction behavior for BioBERT and TransformerText flows.
- Keep existing Electron renderer request behavior and UX intact.
- Keep Go HTTP endpoint contracts backward compatible.
- Use existing scripts/tests in `test/` as baseline regression assets.

### Source of Planning Truth

- `.planning/PROJECT.md`
- `.planning/REQUIREMENTS.md`
- `.planning/ROADMAP.md`
- `.planning/STATE.md`
- `.planning/config.json`

### Execution Guidance

- Implement in phases with regression checks per phase.
- Prefer additive changes over breaking schema/contract changes.
- Establish a single model registry pattern to avoid UI/backend/test drift.
