# Neuro-Kurisu SUPER — Canonical Integration WorkPass 4

**Date:** 2026-10-09  
**Canonical archive:** `Neuro_Kurisu_SUPER_WILL_LUMINA_HEXIS_LETTA_CONSCIO_HOTFIX_CHAT_v20_2026-10-09.zip`  
**Canonical runtime:** Neuro-Kurisu 35.40.0 / schema 223  
**Scope:** selective integration from compatibility, adaptive-memory and subject-fidelity/context-budget passes; no bulk replacement of the latest archive.

## Implemented

1. **Adaptive memory strategy → action selection.** Added the bounded `AdaptiveMemoryStrategyReadout` and integrated it into the canonical core's existing MemoryOS2 retrieval and PolicyAuthorityLedger. Only tagged, grounded strategy evidence participates; explicit outcome records are guarded by verification/independence gates; action contribution is capped at ±0.03. State defaults, snapshotting and migration are connected to canonical persistence. No second memory or policy owner is introduced.
2. **Portable-subject fidelity.** Added read-only diagnostics over the existing portable-subject bundle/projection contract. Reports fingerprint validity, round-trip projection, host-owned boundaries and section coverage. The API explicitly returns `behavioralEquivalenceClaim: false`; a structurally valid transfer is not advertised as behaviorally identical.
3. **Loss-accounted language context.** Added `ContextBudgetLedger` to both normal and cognitive-proposal prompt construction. User text now enters the budgeted prompt slot instead of being appended outside the accounting path. Receipts classify included/truncated/omitted context, record hashes and only permit later recall through canonical source references. Token counts are estimates from character counts, not tokenizer measurements.
4. **Closed diagnostic wiring.** Added read-only `GET /api/organism/memory-strategy`, `/api/organism/subject-fidelity`, and `/api/organism/context-budget`; added shared API client methods and Runtime Atlas entries. Corrected the sensorium client/Atlas route to `/api/organism/sensorium/status`. Static linkage now checks the required new seams.
5. **Portable NeuroCore V143 launch.** Removed hard-coded `/mnt/data/work_v143` benchmark output assumptions. A shared path helper uses `NK_NEUROCORE_V143_OUTPUT_DIR` or project-local `evidence/` by default; added tests for default and override. Research remains research-only.
6. **Safer backup/restore.** Unified the root CLI wrappers around a shared state-backup helper with file allowlist, SHA-256 manifest validation, staging, pre-restore backup, atomic replacement, explicit restore confirmation and refusal while the runtime lock is active. Regression tests cover raw bytes, corruption, lock/confirmation and empty backups.
7. **Integration and release bookkeeping.** Added server-relative-import audit, API/UI linkage audit and scripts at runtime/root level. Expanded HTTP smoke to validate actual chat output and all new endpoints. Updated changelog, version provenance, integration manifest and task list; refreshed source inventory. A separate changed-file manifest is provided alongside this report.

## Verification actually run

| Gate | Result |
|---|---|
| `npm run audit:quick` | PASS; assets, architecture (cycles=0, legacyLeakage=0), hygiene (0 errors/warnings), release contract, integrity and executable syntax audits all pass |
| `npm run audit:integration-workpass` | PASS |
| Server-relative-import audit | PASS; 10 imports checked, 0 missing |
| API/UI linkage audit | PASS; 122 client routes, 47 Runtime Atlas surfaces, no missing static handlers |
| Adaptive memory strategy regression | PASS |
| Portable-subject boundary/fidelity | PASS; valid round-trip and tamper rejection |
| Language context budget | PASS; normal/proposal prompt integration exercised |
| Shared backup/restore helper | PASS; 4 tests |
| Root backup/restore CLI round-trip | PASS; raw bytes restored; restore without `--confirm-overwrite` rejected |
| NeuroCore V143 output path | PASS; 2 tests |
| Real HTTP server smoke | PASS; includes actual chat completion and new diagnostics routes |
| Organism smoke | PASS |
| WILL integration/surfaces | PASS; 9/9 and 3/3 |
| Lumina adaptation | PASS; 3/3 |
| Hexis adaptation + server smoke | PASS |
| Letta governance | PASS |
| Conscio adaptation + UI wiring + server smoke | PASS; UI wiring reports 18 methods, 0 missing, 0 unused |

## Limits and next gates

- Root `npm run typecheck` was attempted but is **blocked in this environment** by absent `@types/node` and `vite/client` definitions/dependencies; this is not reported as a passing typecheck.
- Full React/Vite production build and real browser E2E were not executed. Static linkage and HTTP smoke do not replace these gates.
- No clean-room upgrade/rollback drill, multi-hour soak, or full target-device Live2D interaction test was performed.
- No Memory 2.0 uplift is claimed: retrieval/strategy efficacy still needs baseline-versus-candidate benchmark, holdout data and source-grounded independent outcomes.
- NeuroCore V143 path portability was tested; full scientific model benchmarks were not run.

**Release status:** implementation workpass only. The canonical runtime remains 35.40.0/schema 223. This report does not certify 100% release readiness.
