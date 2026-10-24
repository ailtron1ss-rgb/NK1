# NK1 / Hexis deep integration pass — 2026-10-24

## Scope and source of truth

This pass continues the Hexis adaptation on `operation-omega-hexis-deep-pass-2026-10-24`, based on the existing `operation-omega-hexis-2026-10-24` work. The upstream reference is [QuixiAI/Hexis](https://github.com/QuixiAI/Hexis), inspected at upstream tree commit `9e718951dc2a50dfcdc6f22513a1916315840132`. The HMX 1.7 contract was checked against [schemas/hmx-1.7.schema.json](https://github.com/QuixiAI/Hexis/blob/main/schemas/hmx-1.7.schema.json), blob `33289a9e14234776676465b93092f254ad64ba8f`.

NK1 remains the canonical runtime and memory owner. The imported Python/PostgreSQL Hexis snapshot stays under `legacy/input-archives/`; no Hexis SQL migration is run against NK1.

## Defect addressed

The earlier `HexisAdaptationFabric.stageHmx()` accepted partially shaped documents, did not require a well-formed HMX version/export identifier/source envelope, could stage unknown sections, and truncated oversized arrays without marking them as unsafe to accept. That weakened the review boundary: a partial import could look like a complete candidate to the operator.

## Implemented change

- Validate JSON-object input, numeric HMX major/minor versions, canonical `exp_<16 lowercase hex>` export IDs, source export intent and timestamp.
- Require HMX source provenance fields: instance ID, schema version, embedding model, positive embedding dimension and Hexis lineage ID.
- Restrict staged sections to the section names understood by NK1 and validate whether each section is an array of records or an object.
- Bound the HMX envelope to 1,000,000 characters, each array section to 256 records, and total staged records to 1,024. Oversize inputs create explicit conflicts; bounded staged content cannot be accepted while any conflict remains.
- Preserve the existing protected-section rule: telepathy and analysis requests cannot accept identity/worldview/drives/emotional-trigger/narrative/goals sections through this path.
- Keep unsupported sections out of the staged payload instead of silently passing them through to later import code.

## Regression coverage added

Updated `runtime/neuro-kurisu/tests/integration/hexis-adaptation.mjs` to use a complete HMX-shaped test envelope, and cover missing source provenance, unknown future sections, oversized arrays and invalid import intent. Existing tests continue to cover evidence duplicate suppression, temporal assertions, review decisions, protected sections, outbox idempotency, connector-policy limits and execution placement.

## Boundaries

The work adds validation and test cases; **it does not yet establish test success or end-to-end production readiness**. The exact-head Node 22/24 runtime and server smoke tests must run in GitHub Actions. The HMX adapter remains a staging/review layer, not an automatic replacement for NK1 memory, identity or policy state. No measured learning uplift is claimed.
