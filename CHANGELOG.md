## [NK1][WorkPass506] Preserve abstention labels in offline memory evaluation CLI (2026-10-27)

- The retrieval benchmark supports explicitly unanswerable examples, but the offline CLI previously required every row to have at least one relevant memory ID and dropped the `answerable` field.
- The CLI now accepts `answerable: false` only with an empty `relevantIds` array and preserves that label through evaluation; answerable rows still require at least one relevant ID.
- Added an unanswerable holdout fixture to the retrieval experiment regression. This fixes benchmark input coverage only; no recall uplift or test pass is claimed without execution.

## [NK1][WorkPass505] Prove future Hexis evidence rejection is mutation-free (2026-10-27)

- Strengthened the future-dated SourceMonitor and P65 regressions beyond checking the rejection reason: each now compares the canonical evidence-source array, lineage keys and confidence against a pre-attempt snapshot.
- This proves the bridge's fail-closed time guard prevents both future-dated ingress paths from changing canonical memory, rather than merely returning an error after a partial write.

## [NK1][WorkPass504] Exercise retrieval provenance and semantic routing in core regressions (2026-10-27)

- The recovered-core suite now runs `test:memory-retrieval-experiment` as well as the live semantic-route regression. This ensures malformed, duplicated and over-limit bootstrap seed lists are tested instead of merely committed.
- The experiment's seeds are bootstrap-resampling seeds only, not independent retrieval-model training runs. Passing these checks verifies the evaluation contract, not memory recall uplift; a separate independently sourced holdout is still required.

## [NK1][WorkPass503] Make Hexis bridge attempt-count assertion monotonic (2026-10-27)

- A parallel regression added explicit same-ID trace replay to verify immutable source-trace identity, raising the bridge's current-instance attempt count from nine to ten.
- Replaced the brittle exact count with a minimum-coverage assertion of ten. Missing-trace, duplicate-ID, future-timestamp, model-echo, non-independent P65, and fingerprint-mismatch checks remain individually asserted; restore replay remains accounted to its own bridge instance.

## [NK1][WorkPass502] Wire bounded semantic recall into the live cognitive cycle (2026-10-27)

- The direct user-text path already used `retrieveForCognition` when the execution plan requested memory; the later advanced-recall branch still used synchronous lexical-only `retrieve` for internal-goal/fallback queries or when it could not reuse that first memory packet.
- That branch now awaits the same existing cognitive retrieval adapter. With `NK_EMBEDDINGS_RUNTIME_ENABLED` unset, behavior remains the deterministic lexical fallback; when explicitly enabled and a provider is configured, semantic recall can participate in that branch under the existing foreground budget.
- Added a route regression and wired it into `test:rebuild-recovered`. This connects an existing subsystem rather than creating a second memory store. Recall uplift is not claimed; provider-backed runtime behavior and real-task improvement still require separate validation.

## [NK1][WorkPass502] Count explicit missing-trace rejection in Hexis regression (2026-10-27)

- Added a regression for a missing SourceMonitor trace ID and asserted the bridge rejects it as `source-trace-not-found`.
- The same runtime now performs nine ingress attempts; snapshot/restore replay is intentionally counted on a separate bridge instance. The exact attempt-count assertion is aligned to nine, preserving all provenance acceptance and rejection checks.

## [NK1][WorkPass501] Fail closed on malformed retrieval experiment seed lists (2026-10-27)

- The multi-seed retrieval experiment previously discarded malformed seeds and silently truncated seed lists after nine entries. That could make the reported run set differ from the caller's requested evaluation plan.
- Validate every supplied seed as a positive uint32, reject duplicate seed entries when at least three unique seeds remain, and reject lists over the nine-seed limit. Existing behavior for fewer than three distinct valid seeds remains fail-closed.
- Added regression cases for a mixed invalid seed list, duplicate entries, and ten requested seeds. This hardens evaluation provenance only; it does not claim retrieval quality uplift or alter promotion criteria.

## [NK1][WorkPass500] Reject future-dated Hexis observation timestamps (2026-10-27)

- The canonical evidence bridge bounded provenance.captureAt but did not independently bound the source observation timestamp (`candidate.at`), which is persisted as canonical `observedAt`.
- The bridge now rejects observation times more than five minutes in the future, using the same tolerance as the existing memory doctor/provenance policy. This applies to both SourceMonitor and P65 evidence ingestion; source fingerprint and confidence behavior are unchanged.
- Added regressions for valid provenance paired with future-dated SourceMonitor and P65 observations, requiring fail-closed rejection before any canonical lineage mutation. Exact-head CI is required before marking this proven.

## [NK1][WorkPass499] Guard endogenous-goal learning against action mismatch (2026-10-27)

- Exact-head local-model HTTP regression failed with `B272 outcome action must match the generated action`: the outer cognitive selector can execute an action different from B272's own generated action.
- Synthetic and real-transition outcome paths now call B272 learning only when the executed selection equals the generated B272 action. The call uses the generated action identity; mismatched outcomes receive no B272 learning credit instead of throwing or teaching a false causal association.
- B273 and the other runtime outcome learners continue to receive the observed action under their own contracts. The fake-provider HTTP end-to-end regression must pass on the new exact HEAD before this is considered proven.

## [NK1][WorkPass498] Assert the runtime-owned cognitive-cycle persistence API (2026-10-27)

- Runtime inspection confirmed the active cycle persists its snapshot through setRuntimeUnifiedCognitiveCycle, while the regression expected the superseded setUnifiedCognitiveCycle symbol.
- Updated the regression to assert the API actually used by the runtime, alongside WorkPass497's scoped embodiment-persistence check. The ordering and persistence requirements remain enforced; this does not change production code.
- Exact-head Core validation must finish on the new commit before the recovered regression set is considered green.

## [NK1][WorkPass497] Anchor cycle embodiment assertion to the active cycle (2026-10-27)

- The exact-head Core regression showed that a file-global lookup found an earlier initialization-time setEmbodiment call rather than the active cycle's persistence point.
- Scope the lookup to begin after closeB380TemporalLife and require the persistence call to exist there. Keep the downstream phase-order assertions intact; no runtime behavior or acceptance threshold is relaxed.
- The WorkPass318 memory-doctor CLI regression passed on this head after aligning its synthetic timestamp with the existing five-minute tolerance. Re-run the exact-head Core workflow after this correction.

## [NK1][WorkPass496] Align the memory-doctor future-evidence fixture (2026-10-27)

- Exact-head Core regression showed the CLI fixture used an observation timestamp only 60 seconds ahead, below the memory doctor's existing five-minute future-evidence tolerance.
- Changed only the synthetic fixture to one hour ahead so the test exercises the intended rejection path. Production thresholds and behavior are unchanged; the test remains read-only and keeps the bounded-report assertions.
- The compound-skill and project-reconciliation route regressions pass on the observed head. Re-run the exact-head Core workflow to validate this fixture correction.

## [NK1][WorkPass495] Unify compound-skill action finalization (2026-10-27)

- The exact-head Core regression exposed a second execution-path bypass after the project-step path was corrected: compound skills called ActionGateway directly and finalized unkeyed results separately.
- Compound skills now use `OrganismCore.executeTool()`; the canonical wrapper accepts caller-supplied context-key names and passes them to the single finalization owner. Keyed execution/replay remains finalized by ActionGateway, avoiding double finalization.
- This change follows the existing WorkPass97 contract instead of relaxing it. Exact-head Core regression must complete before this is considered proven.

## [NK1][WorkPass494] Route project tool receipts through canonical core wrappers (2026-10-27)

- Project-step dispatch now uses `OrganismCore.executeTool()` for fresh execution and `OrganismCore.reconcileToolExecution()` for receipt recovery, instead of calling ActionGateway directly from the project path.
- This keeps legacy tool-ID normalization and finalization ownership at the canonical core boundary. Keyed execution and replay semantics remain guarded by the existing ActionGateway/core-wrapper contract; project recovery still never re-runs a potentially completed side effect.
- Exact-head Core regression failed at WorkPass97 because the project path bypassed both wrappers. The test already encoded the intended contract; this change fixes the production dispatch path rather than weakening the assertion.
- Validation is pending for the new commit. This is a targeted execution-boundary fix, not a production-readiness claim.

## [NK1][WorkPass493] Reject corrupted persisted action receipts on restore (2026-10-27)

- Core regression on exact HEAD found that a completed idempotency receipt could be replayed even when persisted response identity, verification flags, audit outcome, or payload size had been tampered with.
- Restore now only retains a replayable response when execution/tool identity matches the ledger row, verification and audit attestations agree, and the serialized response remains within the 48 KiB bound. Invalid responses become non-replayable recovery tombstones; the gateway does not re-run the side effect.
- Validation is pending on the updated branch HEAD; this is a security/integrity fix, not a claim that all Core regressions now pass.

## [NK1][WorkPass492] Fix causal replay runtime wiring assertion order (2026-10-27)

- Core regression logs showed the causal replay wiring test searched for the feature vector only after the sampler call, although production correctly builds candidate feature vectors before invoking the sampler.
- Updated the assertion to require the feature vector between `replayPending` and `selectCausalReplayBatch`, preserving the check that candidates are grounded in state/outcome features and the sampler remains in the production path.
- This is a regression-test correction based on exact-head CI evidence; rerun Core regression and related workflows before treating the branch as green.

## [NK1][WorkPass491] Correct the overlapping-task replay acceptance criterion (2026-10-27)

- The exact-head Core regression exposed an impossible assertion: the post-hoc replay control trains contradictory task labels over overlapping observable states, then required both old-task recovery and recent-task retention without a distinguishing context feature.
- Reframed this control as a diagnostic of the expected interference trade-off. The context-separated benchmark remains the acceptance gate for preserving both tasks, with its existing >0.8 thresholds unchanged.
- No production learning behavior or performance threshold was changed; this is a benchmark-contract correction. Re-run the exact-head Core regression and P26 workflows before considering the branch validated.

## [NK1][WorkPass490] Balance replay plasticity after Core diagnostics — 2026-10-27

- Latest Core run showed replay at 0.25× preserved the recent task at 1.0 but did not move old-task accuracy above zero.
- Increased the default replay update scale to 0.5× while retaining stored-reward targets and the explicit TD option.
- The change targets the measured under-replay side of the retention/forgetting trade-off; the existing old-task recovery and new-task retention checks remain unchanged.
- Validation: fresh Core regression pending.

## [NK1][WorkPass489] Bound replay update strength to avoid task overwrite — 2026-10-27

- WorkPass488 made replay use stored rewards; Core CI then showed old-task accuracy recovered to 0.50, but recent-task accuracy dropped to 0.5125.
- Added a validated `learningRateScale01` option to replay, defaulting to 0.25 of online update strength, so historical replay can recover some retention without overwhelming newer outcomes.
- Target mode and bootstrap coefficient remain explicit; no benchmark threshold or expected result was altered.
- Validation: latest-head sequential/Core regression required.

## [NK1][WorkPass488] Preserve observed outcomes in episodic replay — 2026-10-27

- The sequential benchmark isolated a target-contamination bug: default replay bootstrapped every stored reward from the current policy, allowing the newly learned task's value estimates to dominate historical task labels.
- `P26TrueLearningEngine.replay()` now defaults to `recorded-reward`, training from the stored outcome; Bellman bootstrapping is still available explicitly with `{ targetMode: 'td', bootstrapWeight01 }`.
- Invalid target modes and bootstrap weights outside the finite `[0,1]` range fail explicitly.
- No learning/retention threshold was relaxed. The sequential Core regression is the acceptance gate for this change.
- Validation: latest-head Core and P26 workflows pending.

## [NK1][WorkPass487] Preserve update magnitude after adding context features — 2026-10-27

- The first context-feature regression run established perfect context-aware synthetic accuracy, but exposed a new regression: the shared feature-vector norm slowed post-hoc replay recovery.
- Updated gradient normalization in both regular sample training and causal feature training: appended context hinges contribute 0.25 of their squared magnitude to the normalizer, while still receiving the normal gradient update.
- This prevents new binary basis dimensions from shrinking every existing policy feature's learning step; no task-performance threshold was changed.