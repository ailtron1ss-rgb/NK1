# Neuro-Kurisu SUPER × WILL — implementation report

Date: 2026-10-08

## Scope

This pass integrates selected, high-value mechanisms from `will-main` into the canonical Neuro-Kurisu runtime. The original WILL source archive is preserved at `legacy/input-archives/raw-source-archives/will-main.zip`. WorkPass35 removes its byte-identical expanded directory from the default package and keeps a SHA-256-verifying materializer (`python3 tools/materialize_legacy_archive.py will`) for exact on-demand restoration; the active runtime receives only adapter-level contracts and state.

The canonical owner remains `runtime/neuro-kurisu/src/organism/core/OrganismCore.ts`. No second organism, memory authority, identity authority, or policy owner is introduced.

## Implemented in code

### 1. Agency / affordance semantics

`src/organism/integration/will/WillIntegrationBridge.ts` implements the selected WILL competition formula (goal, reward, novelty, drive, habit, plan, will, social, cost, inhibition, risk, repetition and settled-action terms) as a bounded score delta. It is applied late in canonical candidate formation, before constitutional/final selection, so existing NK governance remains authoritative.

### 2. Reafference and competence

Committed decisions are recorded together with action-gateway authorization. Feedback outcomes update a compact portable competence artifact per action, including uses, success rate, confidence and observed cost/surprise.

### 3. Portable mind artifact

`OrganismCore.exportWillPma()` exports a self-contained compact WILL-style continuity artifact beside the existing Neuro-Kurisu PortableSubjectContract. Fingerprinting and exact validation are implemented, and a structural fidelity score is recorded for round-trip comparisons.

### 4. Known entities and conversation continuity

A normalized dossier stores stable handles, aliases, familiarity, reliability, valence, trust, attachment and reputation. Conversation aims support open-turn expectations and explicit completion conditions.

### 5. Context budget / lossless accounting

Text observations produce an explicit estimated-token/retained-token/dropped-token record with a reason. This gives the language layer a persistent accounting seam rather than silent truncation.

### 6. External transport / replay

A deterministic envelope format carries payload hashes and envelope hashes. Queue → pending → ACK flow is deduplicated and replay history is retained. ACKs are idempotent.

### 7. Deterministic vector retrieval

A dependency-free seeded vector index is integrated behind the WILL adapter. It uses deterministic hashing and cosine ranking, survives snapshot/restore, and is intentionally not promoted as a semantic replacement for the canonical MemoryFabric until benchmark evidence exists.

### 8. Tamper-evident records

Each important WILL adapter event is chained to the previous digest: decisions, outcomes, context cuts, known-entity updates, transport events, vector indexing and PMA operations.

### 9. Persistence and APIs

The adapter state is persisted inside the canonical `OrganismSystemState.willIntegration` projection and restored at startup. New runtime surfaces:

- `GET /api/organism/will`
- `GET /api/organism/will/pma`
- `POST /api/organism/will/pma/validate`
- `POST /api/organism/will/envelope`
- `POST /api/organism/will/ack`
- `GET /api/organism/will/vector/search?q=...&k=...`

## Verification

- Adapter unit/integration tests: **5/5 passed**.
- Runtime TypeScript contract: **PASS**.
- Organism smoke: **PASS**.
- Server smoke: **PASS**.

## Progress metric

For the dedicated WILL integration block this pass, **12 of 16 defined deliverables are implemented = 75%**.

This percentage is not the release readiness of Neuro-Kurisu as a whole. Remaining integration work is concentrated in native HNSW benchmarking/promotion, full MCP/SDK/channel adapters, and browser/clean-room E2E.
