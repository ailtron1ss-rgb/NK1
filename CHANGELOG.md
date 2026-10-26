## NK1 [evidence] — quarantine aliases when a primary P65 claim is removed

- Runtime quarantine of a primary event ID now removes the associated claim, recent-ID dedupe entry, and all index aliases to that claim, quarantining the aliases as well.
- Restore now closes the same gap when a persisted primary ID is quarantined but a stale alias-index row still points to the removed claim.
- Added runtime and restore regressions so no alias can return a claim ID after its canonical claim has been removed.

---

## NK1 [evidence] — reject inconsistent P65 claim aliases

- A new upstream event ID can now alias an existing stable P65 claim only if the retained claim fingerprint exactly matches the candidate semantic payload.
- Fingerprint mismatch quarantines the incoming alias ID and preserves the canonical claim unchanged; it cannot insert a contradictory index entry that would be discovered only at restore time.
- Added a regression for two event IDs colliding on the stable claim key but differing in confidence.

---

## NK1 [evidence] — snapshot P65 records before processing caller input (2026-10-26)

- `P65EpistemicLedger.record` now snapshots bounded plain input before reading fields, rejects getter-backed/cyclic/exotic input without invoking getters, and fails closed before changing claim/index state.
- Added regressions for accessor and cyclic parent graphs; the existing confidence clamp behavior is retained.

---

## NK1 [evidence] — snapshot P65 persistence state before restore reads

- P65 restore now snapshots bounded plain data before touching state fields, rejects getters/cycles/exotic object graphs without invoking caller code, and resets to a clean default ledger on an invalid persisted graph.
- Added regressions for getter non-invocation and cyclic-state rejection, matching the existing RealityEvidenceLedger restore boundary.

---

## NK1 [evidence] — fail closed on conflicting restored claim IDs (2026-10-26)

- Prevented orphan event-index entries from surviving when their referenced stable claim ID has conflicting restored payloads.
- Replaced whole-object JSON tie-breaking with a bounded tuple of scalar support fields, avoiding traversal of unrelated/cyclic extension properties while compacting duplicate rows.
- Added a regression proving conflicting metadata under one stable claim ID is dropped as a group without quarantining unrelated event IDs.

---

## NK1 [evidence] — preserve P65 aliases and deduplicate restored claim IDs (2026-10-26)

- P65 restore now allows multiple upstream event IDs to reference the same stable semantic claim when their fingerprints agree; it quarantines only mismatched content rather than treating every eventId mismatch as corruption.
- Restore now retains the newest bounded claim/ID windows, drops conflicting payloads sharing one stable claim ID, and deterministically collapses exact duplicates by latest support metadata.
- Added regression coverage for event-ID aliases, deterministic deduplication, and continued fail-closed behavior on true conflicts.

---

## NK1 [evidence] — quarantine conflicting P65 event identities (2026-10-26)

- P65 now quarantines an upstream event ID when its semantic payload is rebound, removes that event's claim from active retained claims, and persists the quarantine across restore/restart.
- Restore detects duplicate event IDs with conflicting claim fingerprints or disagreement between the persisted identity index and its retained claim, rather than silently trusting the first row.
- Added runtime-conflict and corrupted-snapshot regressions. Exact event replays across different processing times remain idempotent.

---

## NK1 [validation] — run typed-runtime integration test in transform mode (2026-10-26)

- Corrected the new cross-ledger CI step to use Node.js 24's `--experimental-transform-types --experimental-strip-types` flags; the test imports the canonical OrganismCore graph, which includes TypeScript parameter properties unsupported by strip-only mode.
- The prior failure happened during module loading before test assertions. Runtime typecheck for that same commit passed.

---

## NK1 [evidence] — preserve causal parents in P65 outcome projections (2026-10-26)

- P65 outcome claims now retain the canonical CEF outcome/revision as their parent, matching the RealityEvidenceLedger causal edge.
- Tightened the cross-ledger regression to assert the stable event-ID join key (rather than expecting the opaque execution ID inside claim text), and extended the verified device-observation case to check RealityEvidenceLedger/P65 classification and parent lineage.
- The previous workflow failed on that stale test expectation; this patch aligns the assertion with the intentionally hashed stable identity and strengthens the actual lineage guarantee.

---

## NK1 [validation] — run cross-ledger evidence regressions in CI (2026-10-26)

- Extended the perception integrity workflow's path filters to include the P41 semantic snapshot contract, ActionGateway/CEF/RealityEvidenceLedger/P65 code, and the associated regressions.
- CI now runs the canonical ActionGateway → CognitiveEventFabric → RealityEvidenceLedger/P65 integration test, plus replay/quarantine/evidence identity regressions before typecheck.
- Corrected the P65 control-character regression to pass an actual newline-containing event ID, rather than a literal backslash sequence.

---

## NK1 [perception] — drain semantic vision frames independent of sensor snapshots (2026-10-26)

- Fixed P41 frame selection: the semantic perception engine also creates snapshots for sensor/text/world ingress, so slicing the raw snapshot ring by the vision observation counter could select non-vision state and starve a pending frame.
- Each P41 snapshot now records which semantic modalities actually contributed to that ingress. OrganismRuntime filters to explicitly tagged semantic-vision snapshots before draining the oldest pending frame per cycle.
- Extended the active-perception runtime regression to verify the burst queue is explicitly tagged and both intermediate/latest frames are integrated once in order.
- **Validation boundary:** source and regression are committed; the previous exact-head Action run confirmed the failure at the second frame assertion. Awaiting fresh workflow execution after this correction.

---

## NK1 [evidence] — sequence outcome projection after causal receipt creation (2026-10-26)

- Moved the canonical RealityEvidenceLedger/P65 projection after `appendToolReceiptTrace` and optional external-evidence append, so its parent CEF outcome ID is available and external-observation variables are initialized.
- This corrects the use-before-declaration errors found by the exact-head Node.js 24 workflow; that previous run failed typecheck before validating the integration.

---

## NK1 [evidence] — validate event IDs without over-escaping controls (2026-10-26)

- Corrected P65 event-ID validation to test Unicode control-code points directly, so valid canonical IDs containing ordinary letters such as `u` are not accidentally rejected.
- Added a regression that still rejects control-bearing IDs while retaining the cross-ledger event identity check.

---

## NK1 [evidence] — connect gateway outcome, reality ledger and P65 (2026-10-26)

- The canonical `OrganismCore.finalizeToolOutcome` path now projects action outcomes to `RealityEvidenceLedger` and P65 using a shared stable event ID; the reality record is parented to the canonical CEF outcome (or authoritative receipt-revision) node.
- Ordinary tool-contract receipts remain `derived` evidence and P65 inferences. Only integrated, verified source observations can be classified as device/external/user observations; simulation remains separated.
- P65 persists a bounded event-identity index, deduplicates retries across processing timestamps, and rejects reuse of one event ID with changed semantic payload.
- Extended the existing tool-receipt integration regression to assert cross-ledger identity, causal parentage, conservative evidence classification, and replay idempotency. Wired that test into the existing `test:big-pass-379:runtime` script.
- **Validation boundary:** source and regression wiring are committed together; exact-head test/typecheck/Actions results remain unverified until the hosted runner executes the steps.

---

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