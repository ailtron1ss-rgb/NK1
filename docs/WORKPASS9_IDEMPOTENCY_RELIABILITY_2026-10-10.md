# Neuro-Kurisu SUPER — WorkPass 9: idempotency and external-action reliability

**Date:** 2026-10-10  
**Base archive:** `Neuro_Kurisu_SUPER_WILL_LUMINA_HEXIS_LETTA_CONSCIO_INTEGRATED_WORKPASS8_2026-10-10.zip`  
**Canonical runtime:** Neuro-Kurisu 35.40.0 / schema 223  
**Scope:** targeted reliability implementation in the existing Conscio and Hexis adapter owners; no new transport/outbox owner.

## Implemented

1. **Conscio peer messages:** an idempotency key now identifies the same sender, recipient, space and canonical payload. A semantic match returns the original message; the same key bound to a different request returns `idempotency-key-conflict` with only the existing message ID (not the original payload) and does not enqueue a second message.
2. **Hexis outbox:** empty keys are rejected. Reusing a key for a different kind, channel, or payload returns an explicit conflict. The lookup includes terminal failed rows, because an external effect may have succeeded even when its acknowledgement was lost; replay does not silently create another logical delivery.
3. **HTTP contract:** key conflicts produce HTTP 409; a missing required Hexis outbox key produces HTTP 400. The Conscio adapter keeps its optional-key compatibility for callers that do not request idempotent queueing.
4. **Observability and persistence:** persisted counters `peerIdempotencyConflicts` and `outboxIdempotencyConflicts` track conflicts. Restore applies default values when loading earlier snapshots that lack the new counters.
5. **Regression coverage:** tests cover canonical object key ordering, replay of identical requests, same-key/different-payload conflicts, blank keys, terminal-state replay, metrics, older snapshot defaults, and both HTTP endpoints.
6. **Repeatable package command:** `npm run audit:workpass9` runs adapter tests, real Conscio/Hexis HTTP smoke tests, runtime typecheck, server import audit and UI/API linkage audit.

## Verification actually run

- `npm run audit:workpass9` — PASS.
- Conscio adapter regression — PASS.
- Hexis adapter regression — PASS.
- Conscio HTTP server smoke — PASS, including idempotency replay and HTTP 409 conflict.
- Hexis HTTP server smoke — PASS, including replay, HTTP 409 conflict and HTTP 400 missing-key response.
- Runtime TypeScript typecheck — PASS (`TYPECHECK=PASS mode=tsc`).
- Server-relative imports — 10 checked, 0 missing.
- UI/API linkage — 124 client routes, 48 Runtime Atlas surfaces, 5 required seams, 0 missing.
- Backward-regression spot checks: WorkPass 8 Memory Retrieval Benchmark regression — PASS; general server smoke — PASS.
- Archive contents and SHA-256 — checked after packaging; see the external package-check JSON and checksum sidecar.

## Boundaries and remaining work

- This implementation prevents accidental key reuse from silently aliasing a different logical request and reduces one common duplicate-delivery failure mode. It does **not** claim exactly-once delivery to arbitrary external systems; that requires the receiving system's idempotency contract, durable transport receipts and end-to-end reconnect/replay testing.
- The Memory Retrieval Benchmark remains a harness tested on a synthetic fixture; its measured interval is not production uplift evidence. A real independently labeled, provenance-verified, pre-registered multi-seed holdout is still needed.
- Full React/Vite production build, desktop/mobile/Live2D browser E2E, clean-room install/restore/upgrade/rollback, multi-hour soak and final SBOM/release provenance remain open. This pass is an implementation workpass, not release sign-off.
- Historical roadmap percentages and task counters are not silently recalculated.
