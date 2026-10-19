# Neuro-Kurisu SUPER — FINAL4 release report

Date: 2026-10-08

## Canonical runtime

- Neuro-Kurisu 35.40.0
- schema 223
- canonical writable owner remains `OrganismCore` / `OrganismSystemFabric`
- WILL, Lumina, Hexis, Letta and Conscio are adapter/provenance branches, not parallel organism owners.

## Conscio integration

The selected Conscio 4.8.2 mechanisms were integrated as adapters:

1. FTS5/BM25/trigram/RRF lexical retrieval over canonical memory projections.
2. Quarantined skill federation with evidence-gated promotion and immutable post-review status.
3. Liaison peer trust + message queue/ACK/idempotency semantics.
4. Confidence calibration and evidence receipts.
5. Source-state boundaries.
6. Metabolic context advisory.

The Conscio PostgreSQL database, agent loop, standalone memory owner, standalone MCP owner and other competing engines were not promoted.

## Interface closure

All 18 Conscio API methods are directly referenced by the active `ConscioControlConsole`. The global UI audit also covers the 6 Letta governance methods. No unused methods are reported by the dedicated Conscio UI wiring test.

## Validation

- Runtime typecheck: PASS
- Conscio unit/integration: PASS
- Conscio UI wiring: 18/18 PASS
- Conscio HTTP smoke: PASS
- WILL integration/surfaces: 9/9 + 3/3 PASS
- Lumina adaptation: 3/3 PASS
- Hexis adaptation/server smoke: PASS
- Server input hardening: PASS
- Organism smoke: PASS
- Restart persistence: PASS
- Memory dedupe: PASS
- Concurrency: PASS
- Server smoke: PASS
- Architecture/core ownership/hygiene/forensics/syntax/integrity/contract/release-source: PASS
- Function-reality critical path: PASS
- Parameterized function probe: 1186/1186 attempted probes passed; 0 failures
- Archive manifest: regenerated after final changes

## Known environment-limited validation

- Full clean-room Vite/browser E2E requires installable UI dependencies.
- Long unrestricted soak requires an execution environment without sandbox time limits.
- The historical source tree has many functions intentionally marked unverified by semantic-coverage tooling; these are not automatically promoted merely because they exist.

## Provenance

Conscio raw source SHA-256:
`05cc43c834029a02e841f6318e353af3f7681c4863c176d9396715a7446b1fb6`
