## NK1 [perception] — runtime sensor and world-context integrity (2026-10-24)

- Fixed canonical runtime perception so one sensor event updates only its own baseline; simultaneous changes remain detectable on subsequent perception cycles.
- Stale or missing device telemetry now fails closed for sensor-event generation.
- Hardened world-context normalization: null/blank/non-finite values use declared defaults, boolean flags require actual booleans, text arrays reject non-string entries, and invalid evidence kinds/source IDs are discarded.
- Added runtime regressions `tests/perception-engine-signal-integrity.mjs` and `tests/world-context-normalizer-integrity.mjs`, plus package scripts for both.
- Retired the disconnected UI-shell prototype after finding the existing canonical runtime perception owners.
- **Validation boundary:** implementation and tests are committed on `feature/perception`; tests, typecheck and exact-head CI remain unverified.

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