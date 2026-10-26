## NK1 [evidence] — align live and restored event replay semantics (2026-10-26)

- Corrected the timestamp rule to match the existing WorkPass510 contract: `at` is ingestion/processing metadata and does not change the identity of an otherwise identical upstream event.
- Live retries now stay idempotent when processing time differs; restore applies the same semantic-payload comparison and collapses duplicate event IDs deterministically using the earliest recorded timestamp.
- Added regressions for replay at a different timestamp and restore row-order independence. This entry supersedes the preceding pass's incorrect treatment of explicit `at` changes as an identity conflict.

---

## NK1 [evidence] — reset quarantine with rejected restore state (2026-10-26)

- Fixed an inconsistent restore failure path: when an unsafe persisted snapshot is rejected, the ledger now clears old records, totals, and in-memory event-ID quarantines together.
- Added a regression for conflict quarantine followed by hostile-restore rejection and valid reuse after the reset.

---

## NK1 [evidence] — keep implicit timestamp retries idempotent (2026-10-26)

- Refined the replay contract: an explicit `at` value is immutable event payload, while a missing `at` is ledger-generated ingestion metadata and is not used to reject a retry.
- Added a regression proving a repeated upstream `eventId` without `at` reuses the original record without increasing the ledger total.

---

## NK1 [evidence] — preserve event time in live identity checks (2026-10-26)

- Fixed a mismatch between live writes and restore validation: an existing upstream `eventId` conflicts when an explicitly supplied observation timestamp changes, rather than being accepted as an exact replay. When `at` is omitted, the ledger's local ingestion timestamp does not break idempotent retries.
- Added a regression that proves timestamp mutation fails closed, quarantines the event ID, and blocks later reuse of that ID.
- **Validation boundary:** source, regression and changelog are committed together; hosted exact-head execution remains unverified until Actions can run test steps.

---

## NK1 [perception] — runtime sensor and world-context integrity (2026-10-25)

- Fixed P41 semantic-vision burst handling: when multiple vision snapshots arrive between runtime cycles, the runtime drains the oldest pending snapshots one per cycle instead of advancing the observation counter to the total and silently skipping intermediate frames.
- Added a regression that injects two semantic frames before a cycle and verifies both appear once in oldest-first order, with no later replay.

- Fixed canonical runtime perception so one sensor event updates only its own baseline; simultaneous sensor changes are surfaced across successive perception cycles.
- Wired runtime-owned `PerceptionEngine` events into multimodal observation and cognitive `novelty`/`surprise` ingress, with evidence-bus parent lineage into the canonical observation event; the runtime still keeps action selection inside `OrganismCore`.
- Added deterministic runtime integration regressions for fresh-baseline establishment, motion change, sensor loss and recovery during user-text cycles, proving unavailable samples are not fabricated into zero-valued physical observations.
- The sensor loss/recovery regression passed the exact-head [perception workflow](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40169166470).
- Added a bridge from newly produced P41 semantic-vision snapshots into the runtime multimodal event stream, cognitive novelty/surprise, and parent-linked observation evidence.
- Extended runtime integration coverage to prove the same P41 snapshot is integrated once and is not replayed as a fresh vision event on later cognitive cycles; exact-head CI for this idempotency guard is pending.
- Added explicit `sensor-availability` events for signal loss/recovery. Missing readings are no longer confused with numeric zero or a confirmed absence of movement/proximity/light/network.
- Sensor telemetry fails closed when freshness is out of range, stale duration is invalid/negative, or staleness exceeds the accepted bound.
- World-object normalization now preserves knowledge state separately from fallback values: `valueKnown`, `visibilityKnown`, and `collectionKnown` distinguish unknown data from measured zero/false.
- Preserved complete cognitive-cycle evidence lineage through bounded intermediate evidence nodes rather than truncating parent IDs; prevented endogenous-goal learning from receiving credit when the executed action came from another subsystem.
- Repaired existing regression-suite defects discovered by the new CI path: malformed literal newlines in the unified-loop test, duplicate evaluator bindings, and Node typings incompatibility in the learning process supervisor.
- Added focused perception/world-context CI and connected the regressions to the existing cognitive-contract workflow; both run Node.js 24, execute runtime integration, audit script/test references, and type-check the canonical runtime.
- **Validation:** the runtime perception-ingress code passed the exact-head [dedicated perception workflow](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40168983658) on code commit `d0e8a494ee6435971b1c97ef3da57427630c01b5`. Passed steps: simultaneous/stale sensor integrity, strict world-context normalization, runtime-level active-perception integration (including the new sensor-baseline/motion regression), npm-script/test-reference audit, and canonical runtime typecheck. The preceding [cognitive-contract workflow](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40167248769) also passed.

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