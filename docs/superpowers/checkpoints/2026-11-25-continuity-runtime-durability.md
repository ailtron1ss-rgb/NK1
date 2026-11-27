# NK1 — Continuity Journal Durability and Approval Failure Provenance

**Updated:** 2026-11-27  
**Repository:** `ailtron1ss-rgb/NK1`  
**Canonical base:** `workpass70-source@8994a103f6b735f6347d77d926ee9c024a4d4f4d`  
**Working aspect branch:** `aspect/continuity-runtime-durability-20261125`  
**Scope:** bounded diagnostic ContinuityLedger; durable rollback intent for JSONL append; truthful ActionGateway approval-ledger failure cause.

## What is being integrated

### ContinuityLedger
- Flush detaches a batch before I/O; events arriving during an active flush remain queued for a later batch.
- Torn final JSONL fragments are repaired before append.
- Oversized frames are rejected before entering pending state.
- Bounded retention keeps complete recent frames and replaces the journal using a temporary file, file fsync and atomic rename.
- Append durability uses a strict sidecar `.rollback` write-ahead marker containing the exact pre-append byte boundary. The marker file is written to a unique temporary file, fsynced, renamed, and its parent directory synced before journal bytes are appended.
- Appended bytes are written completely and fsynced before the rollback marker is removed and the directory synced.
- On restart, a surviving valid marker causes truncation to the exact pre-append boundary, including a fully newline-terminated but uncommitted JSONL frame. Malformed markers and lost rollback boundaries fail closed.
- Diagnostics report pending bytes/frames, recovered bytes, retained-frame drops, last I/O error and weaker directory-durability warnings.

### Approval-ledger failure provenance
- If ActionGateway cannot persist a permission/approval request, the speculative pending request is removed; no ticket is fabricated.
- The gateway returns a bounded, path-free failure reason derived from a safe symbolic error code/message, otherwise `checkpoint-save-failed`.
- Constitution Evolution preserves this reason in the error crossing the ActionGateway → Engine boundary.
- The server API regression still requires the exact owner-approval challenge (HTTP 403); the test now prints the bounded response body on mismatch. No authorization status is relaxed.

## Current-source reconciliation

The source branch had diverged significantly from this aspect branch. The update is a normal two-parent commit with current `workpass70-source` as first parent and the previous aspect head as second parent. It preserves the feature work without force-pushing.

The following newer canonical owners are deliberately retained without replacement:
- `OrganismCore.ts` — current candidate/commit checkpoint boundary.
- `RecoveryWatchdog.ts` — current `checkpointCandidate()` / `commitCheckpoint()` API, including the separate no-store regression.
- `runtime/neuro-kurisu/package.json` — current package scripts, with only continuity-specific commands added.

The older standalone `RecoveryWatchdog.checkpoint(input, commitCallback)` test and old RecoveryWatchdog/Core implementations are not imported: they describe a superseded API and would overwrite the current canonical persistence owner. Current Watchdog and Core tests are run from the canonical source.

## Regression and verification

The dedicated workflow runs:
1. Runtime semantic typecheck.
2. ContinuityLedger concurrency, torn-tail, bounded-retention, oversized-frame, rollback-after-restart and malformed-marker regressions.
3. Current RecoveryWatchdog durable-commit regression, including no-store behavior.
4. Current Core checkpoint/restart regression and persistence durability-window test.
5. Existing watchdog, process restart, FileStateStore crash recovery, kill/resume, longitudinal continuity, persistent-kernel and organism-integration suites.
6. ActionGateway approval-ledger failure-provenance unit regression and Constitution Evolution server ratification/rollback E2E.

Earlier branch evidence (before current-source sync) recorded 72/72 checks passing on implementation head `d032eb211b7d3d560e3687f3be3456b6ed96e355`. That historical result does not count as verification for the current synchronized head. The workflow above must pass on the exact new head before this PR is promoted.

## Proof boundaries

- This is a bounded diagnostic journal, not a replacement for canonical organism state, MemoryOS2 or append-only action receipts.
- Successful CI does not establish physical power-loss semantics on every filesystem.
- Android/Termux acceptance remains outstanding: directory-fsync support, storage/power-loss behavior, write latency, heap/payload cost and prolonged process soak.
- No independent holdout, physical device, license/redistribution, release-archive parity or release-readiness gate is claimed by this PR.
- No `PROVEN`, `DEVICE_VERIFIED` or `RELEASED` status is asserted.
