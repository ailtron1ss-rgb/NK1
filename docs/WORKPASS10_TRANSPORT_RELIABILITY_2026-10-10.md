# Neuro-Kurisu SUPER — WorkPass 10: transport envelope/replay hardening

**Date:** 2026-10-10  
**Base archive:** `Neuro_Kurisu_SUPER_WILL_LUMINA_HEXIS_LETTA_CONSCIO_INTEGRATED_WORKPASS9_2026-10-10.zip`  
**Base SHA-256:** `21172c4b61a006cc11d0a63b4d83328c7f90623d235b5c32ad0bdba81ee3b622`  
**Canonical runtime:** Neuro-Kurisu 35.40.0 / schema 223  
**Scope:** hardening the existing WILL transport owner and the current Lumina→Will channel seam. No new runtime, queue, or delivery owner.

## Implemented

1. **Envelope identity now binds to canonical request semantics.** Identical JSON payloads (independent of object key order) replay the accepted envelope; a reused ID with a different source/type/payload/tick/correlation returns `transport-envelope-id-conflict` rather than silently aliasing the original.
2. **Bounded idempotency index.** A 4,096-entry persisted request-fingerprint index prevents old-but-still-known IDs from being enqueued again when they age out of active queue/history collections. Old snapshots backfill fingerprints from retained queue/pending/replay envelopes and preserve defaults for new diagnostics.
3. **No silent queue loss under pressure.** Queue capacity is explicit (256). New work is rejected with `transport-queue-full` when full; pending capacity throttles drain, so old pending work is not sliced away. Replay generation stops cleanly at queue capacity.
4. **ACK validation and conflict semantics.** ACKs for unknown envelopes are rejected; conflicting second ACKs are reported; exact repeats remain deduplicated. ACKing an item removes it from both queued and pending lists, preventing a queued item from dispatching after its ACK.
5. **Replay stability.** Replay envelopes are recorded in the same idempotency index and replay envelopes are never recursively replayed. The replay path remains bounded and does not overwrite queued items.
6. **Actual HTTP contracts.** `/api/organism/will/envelope` returns 409 for ID collisions/history ambiguity and 503 for queue pressure; `/api/organism/will/ack` returns 404 for unknown envelopes and 409 for ACK conflicts. Error/conflict diagnostics are persisted even when enqueue throws; queue backpressure, rejected envelopes/ACKs, key collisions and conflicting ACKs are separately observable.
7. **Closed a second seam-level bypass.** `/api/organism/integration/transport` now verifies a prior result against the canonical inbound payload before replaying it. The same explicit transport ID with changed content returns 409. If a prior reservation exists without a committed result, it fails closed with 409 `idempotency-outcome-unknown` rather than silently executing again.
8. **Regression and workflow coverage.** Added tests for idempotency collisions, JSON-key ordering, unknown/conflicting ACKs, ACK removal from queue, capacity/backpressure, replay non-recursion, invalid identifiers/payloads, legacy snapshot restoration and real HTTP statuses. Added root/runtime `audit:workpass10` commands and updated the project task list, changelog and version metadata.

## Verification actually run

- `npm run audit:workpass10` — PASS.
- WILL bridge/transport suite — 14/14 tests PASS.
- Conscio adapter and Hexis adapter regressions — PASS.
- Conscio HTTP smoke and Hexis HTTP smoke — PASS.
- Full runtime typecheck (`tsc`) — PASS.
- Server relative imports — 10 checked, 0 missing.
- UI/API linkage — 124 client routes, 48 Runtime Atlas surfaces, 5 required seams, 0 missing.
- Main server smoke — PASS, including the new WILL envelope/ACK contracts and Lumina→Will exact replay, changed-content conflict, and uncertain prior outcome.
- Existing Memory Retrieval Benchmark regression — PASS; fixture reported `promotion=not-promoted` because its recall interval does not support a reliable uplift.
- Asset audit — PASS, 0 errors, including configured Live2D and sprite references.
- Package tests are run separately from the final ZIP validation, which also verifies entry uniqueness and the package checksum.

## Important limits

- These changes improve local envelope identity, queue pressure behavior and ACK/replay semantics. They do **not** claim exactly-once delivery to arbitrary external recipients; remote idempotency, durable provider receipts, disconnect/reconnect stress and external postcondition verification still require end-to-end work.
- The Memory 2.0 benchmark fixture is synthetic and remains harness validation, not production retrieval-uplift evidence.
- Full React/Vite production build, desktop/mobile/Live2D browser E2E, clean-room restore/upgrade/rollback, multi-hour soak and final release SBOM/provenance remain open. This is an implementation workpass, not release sign-off.

## Change boundaries

Existing canonical ownership remains intact: `WillIntegrationBridge` owns WILL adapter transport state, `OrganismCore` persists it, `WillChannelAdapter` uses that bridge, and Lumina only guards inbound routing/idempotency. No parallel transport/outbox/identity/memory authority was introduced.
