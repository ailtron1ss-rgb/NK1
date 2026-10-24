## NK1 [perception] — canonical world-model evidence boundary (2026-10-24)

- Added a pure perception boundary with typed modality/source metadata, timestamp validation, bounded confidence and freshness decay.
- Added deterministic claim fusion with idempotent event-ID deduplication and explicit contradiction reporting; incompatible values are never averaged into false consensus.
- Added regression cases for malformed provenance, stale evidence, duplicate delivery, conflicts and predicate separation.
- Added `docs/PERCEPTION_WORLD_MODEL_PASS_2026-10-24.md` describing data flow, integration contract and acceptance gates.
- **Integration status:** implementation and tests committed on `feature/perception`; not yet connected to the canonical runtime cycle.
- **Validation status:** tests have not been executed in this GitHub edit pass; do not treat this as runtime-verified or production-ready.

---

## NK1 WorkPass514 — fail closed on malformed restored evidence lineage (2026-10-24)

- RealityEvidenceLedger restore now applies the same parent-lineage validation as live writes: malformed, duplicate, whitespace-only, or over-limit parent IDs invalidate the restored row instead of being silently filtered.
- This preserves the causal meaning of persisted evidence; damaged provenance cannot be reinterpreted as a valid root observation during restart.
- Added restore regressions for whitespace-only and duplicate lineage IDs in the existing perception evidence-ledger test.
- **Validation boundary:** code and regression committed; exact-head test/typecheck/CI have not been executed or verified.

---

## NK1 WorkPass459 — validate canonical evidence parent lineage (2026-10-24)

- **Fixed:** RealityEvidenceLedger rejects parent IDs that are whitespace-only, contain control characters, are not NFKC-canonical, exceed the canonical text boundary, or repeat within one record.
- **Regression added:** malformed parent-lineage cases assert rejection before evidence enters the ledger.
- **Architecture:** preserves the existing reality-evidence owner and upstream event-ID mechanism; no new dependency or parallel ledger.