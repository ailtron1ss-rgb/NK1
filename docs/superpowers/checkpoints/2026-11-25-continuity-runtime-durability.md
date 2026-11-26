# NK1 — Continuity Runtime Durability

**Date:** 2026-11-25  
**Repository:** `ailtron1ss-rgb/NK1`  
**Base:** `workpass70-source@87c9ed9034e09ca9fb83fd676ac52bb46434c4fe`  
**Working branch:** `aspect/continuity-runtime-durability-20261125`  
**Scope:** `ContinuityLedger` append/retention durability and `RecoveryWatchdog` checkpoint truthfulness.

## Why this was ported selectively

The 2026-11-24 local checkpoint was built against the older archive commit `615ffda7958273fed97aa809d374d8812eabed0a`. It was not safe to apply wholesale to the current source. The ContinuityLedger and RecoveryWatchdog source blobs were confirmed unchanged on the current base, while the Core integration was re-read from the exact current source and ported only around the full-projection commit boundary.

## Implemented

### ContinuityLedger

- Detaches each flush batch before awaiting I/O; events arriving during an active flush are drained separately rather than accidentally cleared.
- Repairs an unterminated JSONL tail before reopening and reports recovered tail bytes.
- Rejects a single frame larger than the journal cap before enqueueing.
- Uses complete JSONL frames for bounded retention; compaction keeps recent complete records and replaces the file through temp-write, file fsync, rename and best-effort directory fsync.
- Handles partial writes and fsyncs append batches. Before writing, it atomically persists a strict sidecar rollback marker (`.rollback`) containing the pre-append byte boundary, fsyncs the marker and parent directory, then appends and fsyncs the journal. The marker is removed only after the append commit. If rollback fails or the process dies, startup validates the durable marker, truncates to the exact pre-append boundary (including a complete-looking newline-terminated tail), fsyncs the journal, then removes and directory-syncs the marker. Malformed markers and lost boundaries fail closed.
- Diagnostics expose pending data, recovered bytes, retention drops, the last I/O error and weaker directory-durability warnings.
- Byte metrics count the actual append or replacement payload written.

### RecoveryWatchdog and Core

- A fresh watchdog starts with `lastCheckpointAt = 0`; construction, heartbeat and recovery classification do not claim durable storage.
- Restore normalizes missing, malformed, negative, unsafe and implausibly future checkpoint timestamps.
- Explicit checkpointing advances the marker only at the persistence boundary and rolls back the in-memory watchdog state if that commit fails.
- Core full-projection checkpoints include the watchdog marker in the same canonical `store.save(this.persisted)` operation. A failed Core save cannot leave a newer in-memory success marker.
- Extended Core regression verifies that the persisted marker advances only on a successful full flush and is present in the actual saved Core file.

## Tests and acceptance gate

Added:
- `tests/continuity-ledger-durability-20261124.mjs` — concurrent flush, torn-tail repair, bounded retention and oversized-frame rejection.
- `tests/recovery-watchdog-checkpoint-semantics-20261124.mjs` — initial marker, malformed restore, heartbeat/recovery separation, explicit checkpoint, failed-commit rollback and Core save fault injection.
- Extended `tests/big-pass-324-core-watchdog.mjs`.

Registered:
- `test:continuity-ledger-durability`
- `test:recovery-watchdog-checkpoint-semantics`
- `audit:continuity-durability`

Added workflow `.github/workflows/nk1-continuity-runtime-durability.yml` to run the formal gate plus process restart, FileStateStore crash recovery, kill/resume, longitudinal continuity and persistent continuity integration.

## Boundaries

- This is a bounded diagnostic continuity journal, not a replacement for canonical organism state, MemoryOS2 or append-only action receipts.
- Exact-head GitHub Actions verification is recorded below.
- The dedicated continuity workflow itself reports Node strip-syntax-only validation when its runner lacks TypeScript. On this exact head, however, `NK1 Module Dependency Audit` ran `npm --prefix runtime/neuro-kurisu run typecheck` with `TYPECHECK=PASS mode=tsc compiler=PATH`; the integrated software baseline also ran semantic runtime typecheck with `compiler=app-lock`.
- Independent power-loss testing and Android/Termux storage/latency soak remain outstanding.
- No Release ZIP, release tag, `main` or `workpass70-source` content was changed.


## 2026-11-26 — Durable rollback marker hardening

### Regression-driven change

The original in-memory-only `pendingRollbackSize` was insufficient after process death: a newline-terminated uncommitted append could be accepted by a fresh process because torn-tail repair only removes incomplete JSONL fragments.

Added two regressions to `tests/continuity-ledger-durability-20261124.mjs`:

- A fresh process must discard an uncertain, complete-looking frame using the persisted rollback marker, preserve earlier committed frames, report the exact removed byte count, and clear the marker after repair.
- A malformed rollback marker must block new writes without truncating or accepting data.

TDD evidence:
- Corrected RED commit: `9d82730b211055222bee4221fd27c8cffd2e3667`.
- Exact-head RED workflow: [45787202089](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45787202089). The four prior tests passed; both new tests failed for the intended reasons: the uncommitted tick 22 survived restart, and the malformed marker was ignored.
- GREEN implementation commit: `68ab1dc154d0ad085f38a157de951f55e791fca6`.
- Latest implementation blob: `738abd7a3629791d0b6ba9ddf4e077d56f3b7de1`.

### Exact-head acceptance — 2026-11-26

**Head:** `68ab1dc154d0ad085f38a157de951f55e791fca6`  
**GitHub Actions:** 70/70 workflows SUCCESS; 70/70 check runs SUCCESS; 0 failures; 0 pending.

Focused workflow results:
- [Continuity runtime durability](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45787392976) — SUCCESS. Its 11 functional steps passed, including the formal durability gate, durable restart, FileStateStore crash recovery, kill/resume, longitudinal behavioral continuity, persistent continuity kernel, and organism integration.
- [Cognitive Core Consolidation](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45787393015) — SUCCESS, including metacognitive episode runtime, active-information closed-loop regression, and runtime typecheck.
- [Module Dependency Audit](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45787393091) — SUCCESS. Dependency graph: 2,705 source files scanned, 5,735 dependency edges, 0 cycles, 0 legacy leakage, 0 boundary violations; semantic TypeScript check reported `TYPECHECK=PASS mode=tsc compiler=PATH`.
- [Integrated software baseline](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45787392971) — SUCCESS; runtime typecheck reported `compiler=app-lock`.
- [Unified organism runtime](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45787392883) — SUCCESS, including continuity and organism integration.
- [NeuroCore core regression validation](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45787393104) — SUCCESS.

The dedicated continuity job's own `typecheck-runtime` step fell back to strip-syntax-only mode (747 files) because that runner did not have the TypeScript compiler. This limitation is explicit; separate same-head semantic TSC runs above succeeded.

### Current integration and proof boundary

- PR #1174 remains OPEN and DRAFT; no merge was performed.
- Its base snapshot remains `9008a8982a5173304456bee2c604bd0bc8665964`; current `workpass70-source` is `7e601680c765d6dc94e51e4c8f5e729b48a6f56e`. Their histories have diverged since the PR's base and must be reconciled deliberately.
- `OrganismCore.ts` and `runtime/neuro-kurisu/package.json` overlap with other current-source work (including PR #1170); do not merge blindly.
- No Android/Termux storage, power-loss, latency, heap, or long-lived device soak was available in this CI run.
- Independent review and current-source integration remain open. No claim of `PROVEN`, `DEVICE_VERIFIED`, or `RELEASED` is made.



## 2026-11-26 follow-up — approval-ledger diagnostics and merged-head revalidation

### One transient governance failure, then non-reproduction

- On docs-only PR head `8b407d330dd16760a5b0375e4a557dd6e350ed75`, the `OmeStro 20 — Constitution Evolution` merge-ref workflow failed once: HTTP 409 instead of the expected 403 approval challenge.
- The response body was initially hidden by the test assertion. Added diagnostic output in `tests/constitution-evolution-server.mjs`; the observed message was `ActionGateway did not create a ratification ticket`.
- Inspection showed `ActionGateway.requestToolApproval` intentionally rolls back the in-memory request when durable permission-ledger persistence fails, but returned only generic `approval-storage-failed`. The Constitution Evolution Engine collapsed that to a generic missing-ticket error.
- Added path-free, bounded persistence failure reasons (stable symbolic message or error code; otherwise `checkpoint-save-failed`) and propagated that reason through the Engine. The failure remains fail-closed: no ticket is fabricated, and the pending request is removed on failed persistence.
- Added a unit regression with an injected failing ledger persister. It checks that the cause survives the ActionGateway → Constitution Engine boundary and that no pending request remains.

TDD evidence:
- RED test commit: `16f6c1be1429db08bc4e31a4b12d012fb36abfad`; workflow [45789564926](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45789564926) failed at the new assertion because the engine still emitted only the generic message.
- GREEN implementation commits: `f5563b4167d136bbcdc531144456be0bdb368298` (ActionGateway) and `d032eb211b7d3d560e3687f3be3456b6ed96e355` (Constitution Evolution Engine).
- Latest exact PR head: `d032eb211b7d3d560e3687f3be3456b6ed96e355`.
- Latest exact-head matrix: **72/72 workflow runs SUCCESS and 72/72 check runs SUCCESS; 0 failure, 0 pending**.
- `OmeStro 20 — Constitution Evolution` [45789787531](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45789787531) — SUCCESS, including runtime/app TSC, lifecycle/invariant tests, signed independent review, end-to-end server API / ActionGateway ratification / rollback, governance restore and P69-P73 persistence regression.
- Continuity acceptance [45789787375](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45789787375) — SUCCESS; Continuity Ledger suite 6/6, RecoveryWatchdog checkpoint suite 6/6, persistence window, kill/resume, longitudinal continuity and organism integration passed.
- Module audit [45789791058](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45789791058) — SUCCESS; 2,705 source files, 5,735 dependency edges, 0 missing dependencies, 0 cycles, 0 legacy leakage, 0 boundary violations, semantic TSC passed.
- Integrated baseline [45789787638](https://github.com/ailtron1ss-rgb/NK1/actions/runs/45789787638) — SUCCESS; semantic runtime TSC `TYPECHECK=PASS mode=tsc compiler=app-lock`; full software baseline reported `SOFTWARE_BASELINE=PASS_WITH_EXTERNAL_GATES_PENDING`.
- The dedicated continuity runner still uses strip-syntax-only validation because that runner has no TypeScript compiler; semantic TSC is separately verified at the same exact head by Module Audit and Integrated Baseline.

The HTTP 409 was not reproduced on the latest complete 72/72 matrix. The root cause of that one earlier failed invocation is not established; it is recorded as a transient/non-reproduced integration failure, not as a proven fixed defect. The new safe diagnostic path remains useful for the next recurrence.

### Current status boundary

- Latest head remains PR-only and DRAFT; no integration to `workpass70-source`, no merge, no release, and no Android/Termux device verification.
- PR branch divergence and Core/package overlap with current source remain integration blockers. Owner-aware checkpoint reconciliation with PR #1170 remains mandatory.
