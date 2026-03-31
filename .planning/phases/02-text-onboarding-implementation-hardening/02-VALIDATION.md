---
phase: 2
slug: text-onboarding-implementation-hardening
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-31
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                                                                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Framework**          | pytest 7.x + script-based Python checks                                                                                                                                                     |
| **Config file**        | none (repository currently runs explicit test commands)                                                                                                                                     |
| **Quick run command**  | `pytest pythonCode/tests/extraction_text/test_text_model_registry.py -q`                                                                                                                    |
| **Full suite command** | `pytest pythonCode/tests/extraction_text/test_text_model_registry.py pythonCode/tests/extraction_text/test_text_dispatch_fallback.py pythonCode/submodules/MEDimage/tests -k extraction -q` |
| **Estimated runtime**  | ~45 seconds                                                                                                                                                                                 |

---

## Sampling Rate

- **After every task commit:** Run `pytest pythonCode/tests/extraction_text/test_text_model_registry.py -q`
- **After every plan wave:** Run `pytest pythonCode/tests/extraction_text/test_text_model_registry.py pythonCode/tests/extraction_text/test_text_dispatch_fallback.py pythonCode/submodules/MEDimage/tests -k extraction -q`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement | Test Type   | Automated Command                                                                         | File Exists | Status     |
| -------- | ---- | ---- | ----------- | ----------- | ----------------------------------------------------------------------------------------- | ----------- | ---------- |
| 02-01-01 | 01   | 1    | R1,R2,N4    | unit        | `pytest pythonCode/tests/extraction_text/test_text_model_registry.py -q`                  | ✅          | ⬜ pending |
| 02-01-02 | 01   | 1    | R1,R2       | unit        | `pytest pythonCode/tests/extraction_text/test_text_model_registry.py -q`                  | ✅          | ⬜ pending |
| 02-02-01 | 02   | 2    | R3,R4,N1,N2 | unit        | `pytest pythonCode/tests/extraction_text/test_text_dispatch_fallback.py -q`               | ❌ W0       | ⬜ pending |
| 02-03-01 | 03   | 2    | R5,N3       | integration | `python test/extractionTransformerText/test_transformer_text_extraction_models.py --help` | ❌ W0       | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [x] Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior                                                                        | Requirement | Why Manual                                                        | Test Instructions                                                                                              |
| ------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| TransformerText extraction form still guides valid config selection in renderer | N1          | Primereact/Electron interactive UX not covered by automated suite | Launch app, open TransformerText extraction page, verify model picker/path input + run button enablement logic |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-03-31
