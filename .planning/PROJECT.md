# MEDomics Extraction Model Expansion (Brownfield)

## Project Context

- Platform: Electron desktop app with Next.js renderer, Go HTTP orchestration server, and Python execution modules.
- Module focus: extraction pipeline, starting with text extraction.
- Current text models in production flow: BioBERT-specific path and generic TransformerText path.

## Objective

- Expand supported extraction models with a text-first onboarding framework that preserves existing behavior and remains compatible with current Electron + Go + Python integration.

## Scope

- In scope now: text extraction model onboarding framework, configuration strategy, inference routing design, rollout safeguards, and validation strategy based on existing `test/` assets.
- Deferred scope: replicate the same onboarding pattern for image and time-series extraction in later phases.

## Success Definition

- New text models can be added through a defined onboarding checklist and config contract without breaking BioBERT/TransformerText behavior.
- Go route and Python execution contracts remain backward compatible for existing renderer flows.
- Regression-safe validation path exists using current extraction scripts/tests in `test/` and Python test roots.

## Constraints

- Preserve current extraction behavior and existing route contracts.
- Minimize UI disruption in renderer extraction pages.
- Avoid breaking changes to Go request/response shape expected by the Electron app.

## Stakeholders

- Product/clinical users: need stable extraction outputs.
- App developers: need predictable model onboarding workflow.
- ML contributors: need fast, low-risk path to register and validate new text models.
