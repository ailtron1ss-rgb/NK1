## [NK1][WorkPass508] Prevent duplicate memory rows inflating precision (2026-10-27)

- Retrieval benchmark precision now counts unique relevant memory IDs rather than duplicate result rows.
- Added a regression fixture with a duplicate corpus ID: the report must block promotion for corpus integrity and count the repeated relevant ID only once in Precision@k.
- This fixes a metric-integrity bug; no retrieval uplift is claimed. Test execution and CI remain unverified.

## [NK1][WorkPass507] Include abstention quality in experiment determinism checks (2026-10-27)

- The multi-seed memory experiment's determinism signature now includes answerable/unanswerable counts, unsupported retrieval rate, correct abstention rate, and false-abstention metrics.
- Added regression assertions that unsupported retrieval and correct-abstention rates remain stable across bootstrap seeds.
- This closes a reporting blind spot: the determinism gate can no longer ignore changes in abstention-quality metrics. Test execution and CI remain unverified.

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