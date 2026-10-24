# NK1 / Hexis deep integration pass — 2026-10-24

## Scope and source of truth

This pass continues the Hexis adaptation on `operation-omega-hexis-deep-pass-2026-10-24`, based on the existing `operation-omega-hexis-2026-10-24` work. Upstream reference: [QuixiAI/Hexis](https://github.com/QuixiAI/Hexis), tree commit `9e718951dc2a50dfcdc6f22513a1916315840132`. The interoperability contract is [HMX 1.7](https://github.com/QuixiAI/Hexis/blob/main/schemas/hmx-1.7.schema.json), blob `33289a9e14234776676465b93092f254ad64ba8f`.

NK1 remains the canonical runtime and memory owner. The Python/PostgreSQL Hexis snapshot stays under `legacy/input-archives/`; no Hexis SQL migration is executed against NK1.

## Problems found against the live NK1 server

The existing `GET /api/organism/integration/hexis/hmx/export` forwarded an NK1-native object as if it were HMX 1.7. In a real Node 24 server smoke, the export had a UUID `export_id` instead of the HMX `exp_<16 lowercase hex>` identifier, omitted required `export_intent`, `exported_at`, and `source` metadata, emitted the NK1-only `skills` section, and could expose `in_flight_work` / `audit_records` as null. Tight validation correctly refused to accept that payload.

The import boundary also needed hardening: incomplete source metadata, unknown sections, malformed section shapes, and truncated oversized arrays must not be treated as acceptable imports.

## Implemented

- Added `Nk1HmxExportAdapter.mjs` and wired it into the real server HMX export route. It converts the native identity, goals, memories, skills, relationships and episodes into HMX-shaped records; maps NK1 skills to procedural memories; creates stable canonical export/reference IDs; supplies the required metadata envelope; and preserves native-only or malformed records under `sections.config.nk1NativeSections` / record metadata rather than silently dropping them.
- The adapter emits upstream-shaped `capabilities`, `privacy`, `export_scope`, and `statistics` fields. It explicitly warns that native NK1 export has no embedding-vector payload; it does not claim that source vectors were transferred. Consumers must re-embed before vector retrieval.
- Tightened `HexisAdaptationFabric.stageHmx()`: require the HMX 1.x version/envelope, canonical export ID, export intent/date-time/source lineage and supported section shapes.
- Added bounded staging limits: 1,000,000 characters per envelope, 256 records per array section, and 1,024 aggregate stored array records. Over-limit, malformed, protected-by-intent or unsupported payloads retain explicit conflicts and cannot be accepted.
- Added regressions for missing provenance, unknown sections, invalid intent, per-section and aggregate overflow, NK1-to-HMX export conversion, skill-to-procedural-memory mapping, reference conversion, native-extension preservation, and required HMX metadata.
- Updated the Node 24 workflow to run the HMX adapter test plus the actual server smoke, and to trigger when the adapter or server path changes.

## Validation and remaining boundary

A GitHub Actions run at an intermediate commit after the server adapter was wired reported **success for all five Hexis steps**, including the server smoke that performs HMX export, staging and acceptance, memory provenance, source monitoring, and the signed skill-review inbox. The added independent round-trip/schema-shape test was then extended; exact-head CI must confirm those latest additions.

The separate `WorkPass110 continual learning metrics` workflow has also failed on an unrelated pre-existing `tests/big-pass-90-causal-learning-stream.mjs:18` assertion (`record` is null). That failure is not reported as a Hexis regression.

The adapter is still a format/consent boundary, not an automatic replacement for NK1 identity, memory, or policy state. No measured learning uplift is claimed, and this PR remains open until the exact head's validation is green.
