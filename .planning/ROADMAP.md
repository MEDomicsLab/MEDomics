# Roadmap

## Phase 1 - Text Model Onboarding Foundation

Status: Planned

### Goals

- Establish a single text model onboarding pattern that supports expanding beyond BioBERT/TransformerText.
- Preserve existing extraction behavior while introducing additive model registration and validation paths.

### Workstreams

- WS1: Model registry consolidation strategy (single source of truth for available text models).
- WS2: Config contract evolution (additive fields + defaults preserving current behavior).
- WS3: Inference routing refactor blueprint (route-stable in Go, handler-extensible in Python).
- WS4: Validation matrix definition using existing `test/extractionTransformerText/` scripts and aligned Python tests.
- WS5: Rollout safety plan (gating, fallback, regression checks).

### Deliverables

- Text model onboarding checklist and acceptance template.
- Proposed registry/config schema (backward compatible).
- Routing decision table (legacy vs new model handlers).
- Regression checklist and command set.

### Exit Criteria

- Approved implementation plan for text onboarding with no breaking changes required in renderer request contract.
- Clear pass/fail gates for adding a new text model.

## Phase 2 - Text Onboarding Implementation + Hardening

Status: Planned

### Goals

- Implement phase 1 blueprint in code with incremental commits and regression checks.

### Workstreams

- Introduce registry source and wire renderer/backend parity checks.
- Implement routing abstraction in Python extraction module(s) while retaining existing Go endpoints.
- Add/update tests to cover model registration, handler dispatch, and output contract consistency.
- Add rollout controls and fallback behavior.

### Exit Criteria

- Existing BioBERT + TransformerText flows pass regression suite.
- At least one newly onboarded text model passes onboarding acceptance checklist.

## Phase 3 - Pattern Replication for Image and Time-Series

Status: Planned (deferred)

### Goals

- Reuse text onboarding pattern for `extraction_image` and `extraction_ts` modules.

### Workstreams

- Map text onboarding artifacts to modality-specific model registries.
- Apply route-stable, handler-extensible pattern in image/TS Python modules and Go blueprints.
- Add modality-appropriate regression checks with existing test infrastructure.

### Exit Criteria

- Shared onboarding governance across text/image/TS with modality-specific validators.

## Risks and Mitigations

- Registry drift across UI/backend/tests -> mitigate with single source + parity test.
- Performance regressions from larger models -> mitigate with benchmark gate in onboarding.
- Contract mismatch in legacy tests -> mitigate by updating/segmenting tests to production schema and route behavior.
