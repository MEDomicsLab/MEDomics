# Requirements

## Functional Requirements

### R1. Text-First Model Onboarding Contract

- Define a canonical onboarding contract for text extraction models including:
  - model identifier/source type;
  - expected embedding behavior and output shape metadata;
  - required tokenizer/model loading options;
  - validation commands and acceptance criteria.

### R2. Backward-Compatible Configuration

- Preserve existing config usage for:
  - BioBERT extraction flow;
  - TransformerText extraction flow.
- Introduce additive configuration only (no mandatory breaking fields for current users).

### R3. Inference Routing Strategy

- Provide phased routing strategy for selecting model handlers in Python while keeping Go route surface stable.
- Ensure route compatibility with existing renderer calls to `/extraction_text/BioBERT_extraction/` and `/extraction_text/TransformerText_extraction/`.

### R4. Regression-Safe Rollout Controls

- Define feature-flag or gated rollout mechanism for new text models.
- Include fallback behavior to existing stable model path if onboarding model fails validation.

### R5. Validation Using Existing Assets

- Use current tests/scripts under `test/` as primary validation assets.
- Include aligned secondary validation for Python test roots where relevant:
  - `pythonCode/tests/extraction_text/`;
  - `pythonCode/submodules/MEDimage/tests/` (non-text baseline sanity checks).

## Non-Functional Requirements

### N1. Compatibility

- Must remain compatible with current Electron renderer state management and request helpers.
- Must remain compatible with current Go request wrapper/progress conventions.

### N2. Reliability

- New model onboarding must not degrade extraction success rate for existing models.
- Errors must remain structured and actionable across Python -> Go -> renderer path.

### N3. Performance Awareness

- Onboarding process must include a benchmark checkpoint for runtime/memory impact on representative text extraction workloads.

### N4. Maintainability

- Model registry and onboarding docs must reduce duplication between UI options, backend mapping, and tests.

## Acceptance Criteria

- A phased roadmap exists for text-first implementation and later replication to image/time-series.
- Each phase has explicit entry/exit criteria and regression gates.
- Planning artifacts identify impacted files/components across renderer, Go blueprints, Python modules, and tests.
