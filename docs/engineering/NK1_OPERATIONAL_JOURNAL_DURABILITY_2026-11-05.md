# NK1 OperationalJournal durability workpass — 2026-11-05

## Why this is not a second EventLog

The N.E.K.O. archive separates its append-only EventLog (append, fsync, replay/reconciliation) from its Outbox (pending/done/attempt records). NK1 already has canonical state persistence in FileStateStore, operational evidence in RuntimeEvidenceBus, and memory/learning owners. OperationalJournal is currently used for runtime diagnostics and lifecycle breadcrumbs; it is not a replayable state source.

This pass therefore adopts only the durability mechanics appropriate to that diagnostic role. It does not add event replay, a second state owner, command application, or an Outbox.

## Runtime behavior

- Writes are serialized per journal instance in invocation order.
- flush() waits for writes queued before the call.
- Each append uses a file handle in append mode.
- warn/error records are fsynced by default.
- Selected critical info events are fsynced: runtime.stop.durable, runtime.emergency-checkpoint, compound-repair staged/completed and trusted-shadow completed.
- Ordinary runtime.step info records do not incur file fsync by default.
- Critical writes also attempt parent-directory fsync; strictDirectoryFsync=true makes directory-sync failures visible to the caller.
- Rotation considers current bytes plus the incoming line, retains 1..5 rotated files, and syncs the parent directory after rename.
- Metrics expose successful writes, bytes, file fsyncs, directory fsyncs and rotations.

## Complexity and latency model

For a record of serialized size B, the non-rotation append path is O(B) for serialization/write plus O(1) metadata. Per-instance ordering adds O(1) queue bookkeeping per record. A rotation performs O(R) rename/unlink operations where R is the configured rotation count (bounded to 5). Memory overhead is O(1) queue state plus the current serialized record.

Normal info writes avoid fsync; warning/error and selected critical events pay filesystem sync latency. No fixed latency claim is made: actual fsync cost depends on device/filesystem and must be measured on the target Android/Termux device before tightening the phone tick budget.

## Failure semantics

- Serialization, append and file-fsync errors reject that write.
- A failed queued write does not poison subsequent writes.
- Directory fsync is best-effort by default for cross-platform compatibility; strict mode propagates failure.
- This is not a transactional state log. A caller retry after an ambiguous fsync failure can create a duplicate diagnostic line; consumers must not interpret the journal as an idempotent command ledger.
- One unusually large serialized record can exceed maxBytes; rotation bounds normal segment growth, not an individual record payload.

## Verification

The focused suite covers concurrent ordering, flush barrier, default selective fsync policy, incoming-byte-aware rotation, queue recovery after serialization failure, and strict directory fsync. Exact-head CI must also pass the full organism runtime typecheck.
