# WorkPass481 — Live Hexis evidence-lineage ingress

**Date:** 2026-10-27

## Data path

`POST /api/organism/integration/hexis/evidence/lineage`
→ strict request validation
→ source-content SHA-256 verification
→ Hexis-specific SourceMonitor
→ HexisCanonicalEvidenceBridge
→ MemoryFabric canonical mutation gateway
→ persisted root snapshot/checkpoint.

## Guards

- Only `user`, `system`, `world` and `tool` source categories are admitted by the ingress.
- Evidence must be explicitly classified as `direct-observation` or `corroborated`.
- Content is bounded and fingerprinted; raw source content is not stored by this bridge.
- Missing, mismatched or malformed provenance is rejected before the canonical write.
- The same trace identity and provenance can be replayed idempotently. Reusing a trace ID for different content is rejected.
- Successful writes go through MemoryFabric and do not change the canonical belief confidence.
- A declared hash proves only that the supplied envelope matches the supplied content. It does not authenticate who created the content or establish factual correctness.

## Tests

The Hexis server smoke test now checks first ingestion, idempotent replay and rejection of a modified source body with a stale fingerprint. The canonical bridge test continues to verify channel deduplication, invalid-provenance rejection, unchanged confidence and direct runtime snapshot/restore.
