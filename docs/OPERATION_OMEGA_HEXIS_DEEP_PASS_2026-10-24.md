# NK1 / Hexis deep integration pass — 2026-10-24

## Source of truth

NK1 remains the runtime and canonical memory owner. The upstream reference is [QuixiAI/Hexis](https://github.com/QuixiAI/Hexis); the interoperability envelope is [HMX 1.7](https://github.com/QuixiAI/Hexis/blob/main/schemas/hmx-1.7.schema.json). Hexis Python/PostgreSQL files remain a reference archive under `legacy/input-archives/`; its migrations are not run against NK1.

## WorkPass330 — format bridge and import boundary

- Added `Nk1HmxExportAdapter.mjs` and wired it to the server's HMX export endpoint so NK1-native identity, memories, skills, goals, relationships and episodes are converted into an HMX 1.7 envelope rather than passing through an incompatible native object.
- The adapter produces the required export ID, intent, timestamp, lineage, capabilities, privacy, scope and statistics fields. NK1 native skills become procedural-memory records. Unsupported or malformed native extensions are preserved in metadata/config rather than silently discarded.
- The export explicitly says `privacy.redaction_policy: none` and warns that no automatic redaction was performed. It also records that source vectors were not exported and must be re-embedded before vector retrieval.
- Hardened HMX staging: validates the envelope and source lineage, limits payload/section/aggregate sizes, rejects unknown sections, and checks the required memory reference/type/content fields before approval.
- Hardened the HTTP decision endpoint: `accept` records approval only, `apply` is a separate operation, invalid requests return 400, missing stages return 404, and conflicted stages cannot be accepted.

## WorkPass331 — actual canonical-memory projection

The missing apply path is now implemented, rather than treating an accepted stage as completed learning.

- Added `HexisCanonicalMemoryProjector.mjs`, bound in `OrganismSystemFabric` to the existing `MemorySubsystemRuntime.fabric`.
- The projector writes through the canonical `MemoryFabric.encode()` boundary into `MemoryOS2`; it does not edit persisted JSON directly and it does not create a competing store.
- Only records in HMX `sections.memories` are written in this pass. Each record carries export/ref/lineage context and external provenance, is never silently promoted to a fact, and uses stable source/reference/content identity plus a persisted command ID for retry safety.
- Re-importing the same lineage, reference and content is deduplicated. If a batch write fails, newly created records are removed through the canonical `MemoryFabric.forgetById()` command; the HMX stage remains accepted and can be retried with a new application-attempt ID.
- The persisted application receipt records imported/deduplicated counts, canonical memory IDs, source lineage, attempt/digest, and all deferred sections. An applied stage can be replayed without repeating the write.

## Explicit limits — not claimed complete

The application receipt intentionally marks the import as partial when non-empty sections remain. `identity`, `goals`, `relationships`, `narrative`, `config`, `audit_records` and `in_flight_work` are not yet projected into their respective canonical subsystems. In particular, an HMX identity section cannot overwrite NK1's identity model through this memory path. A later pass must add separate, validated projections for goals and graph relationships, plus protected identity replacement with consent, fidelity checks and rollback.

Embeddings are not transferred; the current adapter warns that re-embedding is required. No measured learning uplift or production-readiness claim is made.

## Validation

GitHub Actions run [40127219359](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40127219359) at code commit `7363c8c490af9b28f41901a32cb85fc3ae02ee4d` completed all five Hexis steps successfully:

1. Signed skill review-inbox regression.
2. Epistemic memory-provenance regression.
3. Source-monitor lineage regression.
4. HMX format/staging/canonical apply regression, including idempotent re-import and injected-failure rollback.
5. Server smoke, including real HTTP export → stage → approve → apply and explicit deferred-section reporting.

The parallel WorkPass110 metrics workflow still fails on the independent pre-existing `tests/big-pass-90-causal-learning-stream.mjs:18` assertion (`record` is null). It is not attributed to Hexis.

## Pull request status

Changes are on `operation-omega-hexis-deep-pass-2026-10-24` and tracked in [PR #95](https://github.com/ailtron1ss-rgb/NK1/pull/95). The PR is open and is not merged into its base branch.
