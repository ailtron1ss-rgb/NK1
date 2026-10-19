# WorkPass 13 — Release Metadata Contract and Project Status Reconciliation

**Date:** 2026-10-10  
**Base archive:** `Neuro_Kurisu_SUPER_WILL_LUMINA_HEXIS_LETTA_CONSCIO_INTEGRATED_WORKPASS12_2026-10-10.zip`  
**Base SHA-256:** `4f1fd4e6f3c04887c653c3ba44c8f262af57a1cd280b33801b840fe5dca24712`  
**Canonical runtime:** Neuro-Kurisu 35.40.0 / schema 223  
**Status:** implementation workpass; not release sign-off.

## Implementation

1. Aligned root `package.json` version with `SUPER_VERSION.json` at `20.0.0-super-final3`; canonical runtime remains `35.40.0` / schema `223`.
2. Added a root `audit:workpass12` alias and repeatable `audit:workpass13` command.
3. Added `tools/verify-release-metadata.mjs`. It verifies package/version metadata, app/runtime nested lockfile dependency alignment, workpass lineage, script aliases, current status inventory counts, weighted score arithmetic and installation instructions.
4. Added node:test regressions for valid metadata, package-version drift, lockfile drift, normalized-task-count drift and score arithmetic drift (5 cases, all PASS).
5. Corrected README and runbook installation commands. `npm --prefix app ci` was an invalid instruction in this environment; `npm run install:all` runs `npm ci` with `cwd=app` via `tools/super-install.mjs`. The contract validator now also verifies current task counts and weighted score arithmetic to prevent status drift.
6. Reviewed WorkPass 7 scorecard and WorkPass 8–12 reports/tasklists. Added a normalized non-duplicated inventory of 40 deliverables (23 DONE, 9 PARTIAL, 8 TODO) and a re-baselined fixed-weight roadmap scorecard.

## Project progress — evidence-aware recalculation

- Historical WorkPass 7 score: 63.55% (from 2026-10-09).
- WorkPass 13 reconciled score: **67.80%**, +4.25 percentage points, using the same fixed weights.
- Only workstreams changed: Memory 2.0 evidence/tooling, 45% → 60%; transport/idempotency/replay, 20% → 40%.
- Other workstream values remain unchanged where later evidence did not justify a new estimate.
- 40 normalized deliverables: 23 DONE (57.5%), 9 PARTIAL (22.5%), 8 TODO (20%). With hypothetical half-credit for every PARTIAL, equal-weight completion equivalent would be 68.75%; this is only a comparison aid, not the official weighted score.

The score is implementation-roadmap progress, not release readiness. It does not measure the percentage of tests passed, nor the probability of release success.

## Verification actually run

- `npm run audit:release-metadata` — PASS.
- `npm run test:release-metadata-contract` — PASS (5 test cases after status/score arithmetic checks were added).
- `npm --prefix runtime/neuro-kurisu run audit:workpass12` — PASS: retrieval benchmark regression and experiment fixtures remain `not-promoted`; runtime TypeScript `TYPECHECK=PASS mode=tsc`; 10 server imports, 0 missing; UI/API linkage 124 routes / 48 Runtime Atlas surfaces / 5 required seams / 0 missing; server smoke PASS.
- `npm run audit:assets` — completed through WorkPass 13 aggregate audit.
- `npm run audit:workpass13` — PASS after the final metadata/status extensions, including 31 metadata checks and five regression cases.

## Installation/build limitation

`app/package-lock.json` exists and its root dependencies match `app/package.json`. A clean `npm ci` attempt from the app directory could not complete because registry DNS returned `EAI_AGAIN`. No `node_modules` were added to the distribution, and no complete React/Vite production build or browser E2E is claimed.

## Still open

- Real independently labelled temporal MemoryOS2 holdout and baseline-vs-candidate production uplift.
- Full app typecheck/React-Vite build and desktop/mobile/Live2D browser E2E.
- Clean-room install, backup/restore, migration, upgrade and rollback drill.
- Multi-hour soak and resource-growth measurements.
- External provider receipts/reconnect/fault injection/postcondition verification.
- Final SBOM/license/NOTICE/provenance sign-off.

## Files of record

- `docs/PROJECT_CURRENT_STATUS_2026-10-10_WORKPASS13.md` — human-readable current status and staged plan.
- `docs/PROJECT_CURRENT_STATUS_2026-10-10_WORKPASS13.json` — 40-row normalized task inventory.
- `docs/PROJECT_PROGRESS_SCORECARD_2026-10-10_WORKPASS13.json` — fixed-weight scorecard.
- `WORKPASS13_CHANGED_FILES_2026-10-10.json` — exact changed-file provenance.
