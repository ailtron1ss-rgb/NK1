## [NK1][WorkPass598] Preserve duplicate retrieval labels through integrity validation (2026-10-28)

- Preserve repeated ground-truth IDs in canonical fingerprints and through normalization until dataset-integrity inspection.
- Add a regression with correct content hash and complete provenance proving that duplicate labels themselves block promotion.
- Exact-head integration validation is pending.

## [NK1][integration] Native signed P23 revision with three-arm host evaluation (2026-10-28)

- Ported the native signed-outcome P23 provider and its protected host-evaluator configuration loader onto the current Hexis/Mem0 branch.
- Bound signed baseline/source payload fingerprints to the canonical versioned candidate store, and added lineage revalidation across asynchronous evaluation.
- Changed the independent-evaluation wrapper to run separate host-owned evaluations for baseline, source candidate and new revision. The three method labels must be distinct and scheduled in both validation and holdout plans; empty native placeholder reports are never accepted as evidence.
- Added server fail-closed configuration, a static wiring regression, and a behavioral three-arm evaluator test. Local llama.cpp remains the default generator; GEPA is optional candidate generation only. Native activation still requires signed evidence and authenticated approval.
- **Validation:** integration workflow [40634609071](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40634609071) passed on tested code HEAD `649facadc3e8bbf1cab394f76e826ac4427f8e4d`: runtime typecheck, native provider **8/8**, host evaluator config **13/13**, native wiring **2/2**, three-arm evaluator **1/1**, GEPA **11/11**, Hexis lineage/ingest/server smoke, retrieval fingerprint/experiment, Mem0 Platform **15/15**, OSS **2/2**, runtime wiring and HTTP fake-provider smoke.
- No live Mem0 or GEPA service was contacted. The memory experiment remains `promotion: not-promoted`; these checks validate integration correctness, not learning uplift or release readiness.
## [NK1][integration] Optional GEPA/DSPy reflective candidate sidecar (2026-10-28)

- Added an opt-in, bounded HTTP adapter for candidate-payload generation through the existing P23 reflective-revision callback. Disabled by default; local llama.cpp remains the default.
- The adapter allowlists validation evidence, binds revision-target IDs to validation trials, sends only an aggregate signed holdout delta, and rejects holdout-target identifiers. Raw holdout reports are not sent.
- Optimizer score/pass/promotion claims are discarded. P23 still independently evaluates the exact returned payload and requires signed execution evidence and authenticated approval for activation.
- Configurable endpoint requires HTTPS or loopback HTTP; redirects, invalid JSON/UTF-8, timeouts, oversized request/response/payload, and malformed identities fail closed.
- Added mocked contract tests and a wiring check for the application generator callback. No live GEPA sidecar was contacted and no candidate was evaluated or promoted by the optimizer.
- **Validation:** [integration workflow 40632954283](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40632954283) passed for tested code HEAD `85932372417ac26f0624dfcb7e162303d43beb8a`: typecheck, GEPA adapter **11/11**, Hexis evidence lineage/ingest/server smoke, retrieval fingerprint/experiment, Mem0 Platform **15/15**, Mem0 OSS **2/2**, runtime wiring, and authenticated HTTP fake-provider smoke. No live GEPA service was contacted; retrieval remains `promotion: not-promoted`.
## [NK1][memory] Reproducible retrieval-dataset provenance tooling (2026-10-28)

- Exported the canonical labelled-dataset fingerprint used by the retrieval promotion gate and added `fingerprint:memory-retrieval-dataset`, which reports that value plus a raw source-file SHA-256 and split counts.
- The experiment CLI now strictly decodes UTF-8, records the raw labels digest, and rejects a supplied `rawSourceSha256` that does not match the exact labels artifact before it publishes any report.
- Added regressions for canonical stability under harmless row/query/relevant-ID ordering, exact raw-byte identity, invalid labels, and fail-closed mismatched provenance.
- Wired the new test into the Hexis/Mem0 integration closure and documented the procedure in `runtime/neuro-kurisu/docs/MEMORY_RETRIEVAL_DATASET_PROVENANCE.md`.
- **Validation:** [Integration workflow 40631987375](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40631987375) passed on the follow-up source revision: typecheck, Hexis lineage/ingest/server smoke, dataset fingerprint tests, retrieval experiment, Mem0 Platform 15/15, OSS 2/2, runtime-wiring and HTTP fake-provider smoke. The retrieval experiment still returns `promotion: not-promoted`; no quality uplift is claimed.

## [NK1][verification] Server-wired Mem0 integration closure passed (2026-10-27)

- The current code revision passed [Mem0 integration workflow 40532574354](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40532574354): Node runtime check and server syntax; runtime typecheck; Hexis canonical evidence lineage/reviewed ingest; Hexis server smoke; deterministic memory-retrieval experiment; Mem0 Platform adapter tests 15/15; self-hosted OSS REST tests 2/2; static runtime wiring; and HTTP fake-provider smoke.
- The server composition root now passes the env-configured adapter into `OrganismRuntime`, with the separate `NK_MEM0_COGNITIVE_RECALL=1` gate. Authenticated read-only diagnostics/search endpoints were exercised; missing bearer authorization is rejected, secrets are not returned, and disabling Mem0 preserves local-first behavior.
- The retrieval experiment remains `promotion: not-promoted`. The read-only live-provider test is skipped without explicit operator consent/credentials; no external Mem0 endpoint was contacted. This is not a production-ready/release claim.

## [NK1][WorkPass582] Align semantic recall contract with canonical selected reads (2026-10-27)

- Fix a stale regression assertion: `retrieveForCognition` correctly records outcome metrics from the canonical `selected` rows after `recordSelectedRetrieval`, not from the uncommitted preview `rows`.
- Strengthen the contract test to require both the canonical selected-read call and outcome accounting on the returned selected rows.
- The latest PR head has not been revalidated by a fresh Actions run; no passing CI is claimed.

## [NK1][memory] Count unique candidates in semantic recall cost signals (2026-10-27)

- The semantic preview now reports the cardinality of the union of semantic-scored, lexical-pool and backfill candidate IDs, rather than summing overlapping lists. The adaptive retrieval-cost signal is therefore bounded to the actual unique candidate set instead of double-counting overlap.
- The canonical selected-read commit preserves this current-query cost context instead of reusing stale candidate diagnostics. This is a metric integrity correction, not a claim of retrieval-quality improvement.

## [NK1][memory] Commit canonical access signals only for the selected cognitive recall (2026-10-27)

- Added `MemoryOS2.recordSelectedRetrieval` so semantic candidates selected from a read-only preview can update canonical query/access signals exactly once after selection, including adaptive-policy context, last-access time, retrieval count, temperature and candidate-cost diagnostics.
- Changed the cognitive recall path to defer live lexical retrieval until fallback is actually chosen. Provider-disabled, busy, timed-out and failed paths use canonical lexical retrieval once; successful semantic recall commits only its selected IDs. Speculative lexical rows no longer warm or age memories that were not actually used.
- Added regression assertions that preview does not mutate canonical access counts, selected reads increment once, and adaptive compute-cost diagnostics are attributed to the current selection rather than a stale candidate count.
- This is an accounting/temporal-signal integrity fix; it does not claim retrieval-quality uplift.

## [NK1][memory] Correct P62 relevance ranking and query the canonical recall corpus (2026-10-27)

- Fixed a ranking comparator that subtracted `b.relevance01` from itself, effectively eliminating relevance ordering. P62 now sorts by descending relevance, then support, then stable ID.
- Replaced insertion-order `snapshot.items.slice(0,128)` candidate input in `MemoryFabric.recall` with bounded, side-effect-free query-aware retrieval from the canonical MemoryOS2 owner. This makes older relevant memories eligible without mutating canonical retrieval diagnostics merely to prepare the recall packet.
- Added `test:p62-relevance-order` for calibrated ranking and a 150-item corpus where the target memory sits beyond the legacy first-128 window; wired it into recovered-core tests and WorkPass110 CI.
- This fixes retrieval reachability/ranking semantics; no aggregate retrieval-quality uplift is claimed until independent holdout evaluation.

## [NK1][motivation] Correct endogenous goal-vector diversity diagnostics (2026-10-27)

- Fixed `goalVectorDiversity01`: the pairwise cosine transform was inverted, so identical goals appeared maximally diverse and opposite goals minimally diverse. It now measures normalized cosine distance.
- Added calibrated boundary regressions proving identical vectors score 0 and opposite vectors score 1; wired the existing goal-genesis contract into the recovered-core suite.
- This corrects an evaluation signal; it does not itself demonstrate greater behavioral diversity, autonomy or learning improvement.

## [NK1][memory] Validate embedding vectors at the canonical memory boundary (2026-10-27)

- Added a shared finite, dimension-bounded and nonzero embedding-vector guard to MemoryOS2 semantic retrieval and background indexing.
- Invalid query vectors now use lexical fallback; invalid candidate vectors are not admitted to the index; overflow-sized finite values cannot silently normalize to zero vectors.
- If no valid semantic candidate remains while lexical recall has results, return lexical candidates with `no-valid-semantic-candidates` rather than reporting an empty semantic success.
- Added regression coverage for invalid query/candidate vectors and overflow during maintenance. Exact-head CI is required before marking this change validated.

## [NK1][memory] Prevent duplicate accounting in semantic cognitive recall (2026-10-27)

- Centralized memory-retrieval outcome accounting so the live cognitive cycle records only the result actually selected for use.
- The lexical candidate set is now side-effect-free while semantic retrieval is pending. On semantic success, only selected semantic IDs update retrieval statistics, hot-memory residency, adaptive-policy evidence and unified-memory retrieval history; on timeout or provider failure, the lexical fallback is accounted once.
- Added runtime regressions for semantic-success and provider-failure accounting; wired both semantic resilience regressions into the recovered-core suite and a focused GitHub Actions workflow.
- Validation status: code, regressions and workflow are committed; exact-head CI/test/typecheck results remain pending until the new workflow completes. No retrieval-quality uplift is claimed.

## [NK1][memory] Keep the cognitive cycle resilient to semantic-provider failure (2026-10-27)

- Route synchronous embedding-adapter throws and rejected provider promises through the same bounded semantic-recall path instead of allowing a provider failure to reject the foreground cognition cycle.
- Preserve canonical lexical recall as the fallback for failed and slow semantic work; keep in-flight tracking until the underlying provider settles so concurrent calls do not fan out requests.
- Added a runtime regression for provider rejection, synchronous throw, timeout fallback and late in-flight cleanup; wired it into `test:rebuild-recovered`.
- Validation status: regression authored and CI wiring committed, but exact-head execution/typecheck is not confirmed in this change. No retrieval-quality uplift is claimed.

## [NK1][verification] Mem0 integration closure CI evidence (2026-10-27)

- GitHub Actions run [40530677372](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40530677372) completed successfully on the PR merge ref.
- Runtime typecheck passed; Hexis evidence-lineage and reviewed-ingest checks passed; Hexis server smoke passed; retrieval experiment was deterministic on seeds 13/29/53 with promotion explicitly not granted; Mem0 Platform tests passed 14/14; self-hosted Mem0 OSS tests passed 2/2; runtime-wiring assertions and HTTP fake-provider smoke passed.
- The read-only live Mem0 API check was skipped because explicit operator opt-in and a dedicated test account were not supplied. These results validate local/mock integration contracts; they do not establish live provider compatibility or retrieval-quality uplift.
- The Release ZIP was not changed.

## [NK1][integration] Add self-hosted Mem0 OSS mode (2026-10-27)

- Follow-up: align `POST /search` with current Mem0 OSS v3 scoped-search semantics (`filters.user_id`) and include the requested server-side result cap; add a request-level regression for endpoint, payload, and `X-API-Key`. This is mock-only validation, not a live deployment claim.

- Added explicit `platform|oss` provider mode. OSS mode uses its documented `/search`, `/memories`, and `X-API-Key` contract; Platform mode remains unchanged.
- Default OSS URL is loopback HTTP only; remote cleartext requires a separate explicit opt-in. Single-memory mutations still need write enablement, per-operation approval, and an adapter-issued scoped UUID.
- Added an end-to-end mocked search → add → delete contract test and included it in CI closure. No live self-hosted server has been contacted, and no retrieval uplift is claimed.

## [NK1][Integration] Selective Mem0 recall bridge on the Hexis source stack (2026-10-27)

- Ported the opt-in Mem0 Platform adapter onto the newer Hexis canonical-apply line without merging the heavily diverged Mem0 branch.
- Connected bounded remote recall to ordinary and autonomous language paths only when a separate runtime flag and a configured adapter both permit it. Remote candidates remain low-priority, untrusted prompt data; MemoryOS2 stays the sole canonical memory owner.
- Preserved disabled-by-default networking, independent write opt-in, user-scoped IDs, bounded requests/responses, credential/Unicode-control redaction, and best-effort fallback to local cognition.
- Added adapter, runtime-wiring and read-only live-contract tests, CI, exported API entry point, and integration notes.
- **Evidence status:** code and test wiring committed; execution of these new checks, exact-head CI, live provider behavior, and independent retrieval improvement remain unverified. This does not update the Release ZIP or establish production readiness.

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

## [NK1][memory] Preserve full-corpus semantic retrieval cost evidence (2026-10-28)

- `MemoryOS2.recordSelectedRetrieval` preserves candidate counts up to the canonical 1600-item memory capacity rather than clipping semantic scans to the lexical candidate budget of 192.
- `MemoryFabric` normalizes the adaptive compute-cost signal to `[0,1]`, preventing a full semantic scan from emitting an out-of-range value.
- Added regression assertions for candidate counts of 400 and the 1600-item cap, plus normalized cost saturation. This is a metric-integrity correction, not a claim of improved retrieval quality.

## [NK1][Hexis] Reduce canonical receipt membership validation cost (2026-10-28)

- Build a `Set` from the bounded HMX receipt memory-ID list before validating `createdMemoryIds`; repeated membership checks now have expected linear total complexity rather than repeatedly scanning the receipt list.
- Preserve the stronger integration-base smoke contract: conflicting trace ID reuse must return HTTP 409, be denied, and leave the original evidence lineage readable.
- Extend the Hexis canonical apply workflow's pull-request base filter so this integration branch runs projector, rollback, server smoke, evidence-lineage and runtime typecheck checks.
- This optimizes validation cost while preserving trust semantics; it does not claim memory-quality improvement.

## [NK1][autonomy] Resolve undeliverable proactive initiatives during restore (2026-10-28)

- Tightened the durable initiative invariant: a row restored as `ready` must include a non-empty sanitized message. If it does not, restore now marks the row `deferred` immediately with a diagnostic reason instead of leaving it in the pending queue.
- This prevents a malformed/interrupted snapshot from leaving `hasPending()` true while `latestReady()` returns no deliverable message, which previously blocked newly generated autonomous dialogue until the generic 20-minute expiry.
- Added a regression that restores a ready row without a message, proves it is deferred and counted, and proves a new distinct initiative can be generated immediately. Wired the privacy/initiative restore suite into `test:rebuild-recovered` and the canonical WorkPass110 workflow.
- This is a lifecycle recovery fix; it does not claim any particular achieved level of autonomy.

## [NK1][autonomy] Resolve proactively generated turns when provider work is cancelled (2026-10-28)

- When a caller aborts the language-provider request for a spontaneous initiative, the runtime now defers that exact initiative before recording the cancellation event. The cancelled row no longer remains in the pending queue and block future initiative attempts until the generic stale-plan timeout.
- The cancellation evidence includes the affected initiative ID and records that it was deferred, without treating cancellation as user feedback or successful delivery.
- Added a runtime regression with an already-aborted signal and a real `OrganismRuntime` step; wired it into `test:rebuild-recovered` and the canonical WorkPass110 workflow.
- This closes a queue-liveness bug; it does not claim higher quality or more frequent successful autonomous dialogue.

