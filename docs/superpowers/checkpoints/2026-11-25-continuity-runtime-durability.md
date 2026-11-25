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
- Handles partial writes, fsyncs successful append batches, and attempts exact-boundary rollback on failure. If rollback itself fails, the next reopen truncates to the captured pre-append boundary before retrying, including when the uncertain tail happens to end with a newline.
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
- GitHub Actions must complete before this work is marked CI-verified.
- The current workflow typecheck may use Node strip-syntax mode if TypeScript compiler is unavailable; that is not semantic `tsc` verification.
- Independent power-loss testing and Android/Termux storage/latency soak remain outstanding.
- No Release ZIP, release tag, `main` or `workpass70-source` content was changed.
