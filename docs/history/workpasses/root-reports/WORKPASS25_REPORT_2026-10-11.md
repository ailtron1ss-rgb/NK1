# Neuro-Kurisu WorkPass 25 — implementation report

Date: 2026-10-11. Base: WorkPass24 / runtime 35.47.0. New runtime: **35.48.0**, schema **224**.

## Implemented

1. Added `tools/fit_research_nli_calibration.py`: deterministic bounded temperature fitting for the local NLI service, >=50 reviewed examples/class, explicit dataset source and labeling protocol, dataset SHA-256, before/after NLL/Brier/ECE/accuracy/F1, no raw sample text in report, mode-0600 atomic exclusive output, no overwrite without explicit force and `promoted=false` by default.
2. Hardened `tools/research_nli_server.py` to apply optional calibration only when an explicitly configured artifact matches exact model ID/revision, class order, dataset provenance/hash, class counts, valid temperature, and fit eligibility. Readiness and raw inference remain available without the opt-in artifact.
3. Added calibration provenance to canonical research claim assessments and preserved it through atom/quote/aggregate storage. Model-version identity includes calibration method/hash/temperature; restore rejects mixed, inconsistent, or tampered calibration metadata.
4. Added docs in `docs/RESEARCH_NLI_CALIBRATION.md`, runbook/readme notes, package scripts, calibration-specific contract tests, and synchronized status/backlog/checklist.

## Progress count

- **2 new normalized deliverables DONE** (G76/G77).
- Current inventory: **77 total — 56 DONE, 11 PARTIAL, 10 TODO**.
- Compared with WorkPass24 by actual archive-entry SHA-256: **24 affected paths excluding the self-referential manifest** — 9 added, 15 modified, 0 removed. The detailed file hashes are in `Neuro_Kurisu_WORKPASS25_CHANGED_FILES_2026-10-11.json`.
- Runtime NLI tests: semantic 23, service 12/12, evaluator 4/4, calibration fitter 5/5; TypeScript `tsc` PASS.

## Verification and limits

- Runtime `audit:workpass25`: PASS after the final split and artifact-validation changes (runtime tsc, claim evidence 20, lineage 8, semantic NLI 23, service 12/12, evaluator 4/4, calibration 5/5, idempotency/research/Core/recovery).
- Release metadata contract **34/34**, unique status IDs **77/77**, weighted arithmetic **72.00%** consistent. The full root aggregate invocation exceeded the execution time limit after the nested runtime gate; its remaining components were run separately and passed, including app-script/browser verdict/report, memory benchmark, server imports, UI/API linkage and asset audit.
- Calibration fitter requires >=50 examples/class and uses a deterministic group-disjoint train/validation split; fitting happens only on train groups, review metrics on validation groups. Candidate eligibility requires validation NLL improvement of at least 1e-4, Brier delta <=0.01 and ECE delta <=0.03. Artifact loader independently validates split counts, metric consistency and eligibility.
- Real pretrained DeBERTa weights and inference were not run because package/model registry DNS is unavailable in the execution environment. Calibration fitter tests use a loopback mock and do not prove calibration quality.
- UI production build/browser E2E remain blocked because Vite dependencies are not installed. The memory retrieval candidate remains `not-promoted` pending independent temporal holdout and non-inferiority evidence.

**Release status:** implementation workpass, not release-ready.
