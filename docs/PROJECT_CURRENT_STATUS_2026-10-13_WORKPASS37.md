# Neuro-Kurisu — project status / WorkPass 37 — 2026-10-13

**Canonical runtime:** `runtime/neuro-kurisu` version **35.59.0**, persisted state schema **225**. **Archive base:** WorkPass36 plus WorkPass37 code and documents. **Implementation progress for this pass: 85/100. Weighted roadmap score: 73.7%.** This is not release approval.

## Delivered

- A durable `ActionGateway` idempotency ledger protects one logical action across concurrent calls, retries and process restore. Reusing a key for a different request conflicts; restored pending entries and failed receipt persistence fail closed rather than replay an uncertain side effect.
- Reusable-skill steps use stable child keys. Project/tool/step APIs accept `Idempotency-Key`; a replay returns receipts without repeating tool effects, outcome learning or causal observations.
- An independently declared tool observation source can route verified postconditions through `ExternalObserverFabric`. Temporal credit is only attached to an exact caller-supplied pending `decisionId`; it is never guessed from the execution ID. The observer/outcome projection is finalized before a completed durable receipt is committed.
- Runtime package, package lock, `ReleaseContract`, `SUPER_VERSION` and integration manifest agree on **35.59.0 / schema 225**. Regression tests cover migrations from schema 223 and 224, default ledger initialization and preservation of a persisted ledger row.
- Retrieval benchmark fixtures and candidate now share explicit historical-time semantics. Benchmark completes, but synthetic recall uplift is **0**; candidate remains **not promoted**.
- Root/runtime WorkPass37 audit entrypoints and integration provenance are updated.

## Evidence

- ActionGateway idempotency suite: **13/13** targeted scenarios.
- WILL agency pre-arbitration suite: **17/17**.
- Runtime TypeScript typecheck and server smoke: PASS.
- Release contract migration regression: PASS for schema 223 and 224 to schema 225.
- Existing app script, asset, API/UI linkage, memory lineage and release metadata suites are included in the root audit.

## Still open

1. Validate a real external provider/device postcondition, including reconnect and remote receipt replay.
2. Run an independently labelled temporal retrieval holdout and demonstrate improvement before promoting retrieval.
3. Install app dependencies with the project installer, then run the React/Vite production build, semantic app typecheck and browser E2E with real Live2D interaction.
4. Perform clean-room state restore/rollback, multi-hour resource-growth soak, final SBOM/license/provenance review and release sign-off.

No claim is made that every function is behaviorally verified or that this is release-ready. Historical source archives and Legacy lineage remain available through the immutable manifests; only proven duplicate representations are eligible for removal.
