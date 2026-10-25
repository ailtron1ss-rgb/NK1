## NK1 [perception] — runtime sensor and world-context integrity (2026-10-25)

- Fixed canonical runtime perception so one sensor event updates only its own baseline; simultaneous sensor changes are surfaced across successive perception cycles.
- Added explicit `sensor-availability` events for signal loss/recovery. Missing readings are no longer confused with numeric zero or a confirmed absence of movement/proximity/light/network.
- Sensor telemetry fails closed when freshness is out of range, stale duration is invalid/negative, or staleness exceeds the accepted bound.
- World-object normalization now preserves knowledge state separately from fallback values: `valueKnown`, `visibilityKnown`, and `collectionKnown` distinguish unknown data from measured zero/false.
- Preserved complete cognitive-cycle evidence lineage through bounded intermediate evidence nodes rather than truncating parent IDs; prevented endogenous-goal learning from receiving credit when the executed action came from another subsystem.
- Repaired existing regression-suite defects discovered by the new CI path: malformed literal newlines in the unified-loop test, duplicate evaluator bindings, and Node typings incompatibility in the learning process supervisor.
- Added focused perception/world-context CI and connected the regressions to the existing cognitive-contract workflow; both run Node.js 24, execute runtime integration, audit script/test references, and type-check the canonical runtime.
- **Validation boundary:** focused perception/world-context/runtime integration, script integrity, and canonical runtime typecheck passed on commit `b1f2273b235574cf9a3b650978afca7e01318879`. The latest follow-up that adds explicit unknown-vs-observed object flags is being revalidated on the current branch head; see [perception workflow](https://github.com/ailtron1ss-rgb/NK1/actions).

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