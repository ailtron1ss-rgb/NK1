## WorkPass282 score update (2026-10-22)

- **Scores unchanged:** P23 symbolic core **61%**; evidence-grounded learning maturity **36%**; project-wide lifelong-learning roadmap **30%**; overall learning engineering maturity **57/100**.
- WorkPass282 reduces disagreement between the learning engine and independent evaluator over which values can be fingerprinted; it does not demonstrate improved generalization, transfer, task success or autonomous self-development.
- Typecheck and regression tests were not run in this pass. No external dependency or upstream code was added.

---

## WorkPass281 score update (2026-10-22)

- **Scores unchanged:** P23 symbolic core **61%**; evidence-grounded learning maturity **36%**; project-wide lifelong-learning roadmap **30%**; overall learning engineering maturity **57/100**.
- WorkPass281 improves input canonicalization and execution-identity hygiene; it does not demonstrate higher task success, generalization, transfer or autonomous self-development.
- Regressions were authored but not executed. No new upstream project or dependency was integrated in this pass.
- No empirical score uplift claimed.

---

## WorkPass279–280 score update (2026-10-22)

- **Scores unchanged:** P23 symbolic core **61%**; evidence-grounded learning maturity **36%**; project-wide lifelong-learning roadmap **30%**; overall learning engineering maturity **57/100**.
- These passes improve causal-memory input integrity and evidence-envelope canonicalization. They do not establish improved task success, transfer, or autonomous self-development.
- Regression cases are committed but have not been executed in this pass. The currently visible Actions runs for the relevant workflows report failures; their root cause is not established from available logs.
- No dependency added; no empirical score uplift claimed.

---

## WorkPass273 — remove caller-controlled trust from external causal intake (2026-10-22)

- **Code:** `recordExternalLearningEvent()` now canonicalizes all imported events to `provenance: 'external'` and `stateGrounded: false`; caller-supplied provenance and grounding booleans are not authentication.
- **Learning boundary:** imported events cannot become consolidated state-transition memories or policy-replay candidates solely because an upstream caller marks them grounded. The existing runtime `recordOutcome()` path remains the only path in this stream that mints grounded runtime-outcome evidence from a decision trace and observed post-action state.
- **Regression:** tests now assert provenance canonicalization, forced ungrounded status, replay exclusion, and rejection from consolidation even when an external caller supplies `stateGrounded: true`.
- **Compatibility:** the external API remains available for imported signals and scoring; those signals are retained as unverified evidence rather than discarded. No new dependency or parallel ledger.
- **Validation:** source and regression changes are committed on the existing PR branch. Exact-head test/typecheck remains unverified until GitHub Actions exposes actionable job steps/logs. Learning scores remain unchanged; no measured task-success uplift is claimed.

---

## WorkPass272 — enforce storage-root separation by path and filesystem identity (2026-10-22)

- **Code:** extracted one canonical storage-root separation predicate and use it for both per-authority run/survive roots and cross-authority roots.
- **Security invariant:** roots are considered disjoint only if their resolved paths are not equal/nested and their filesystem identities are distinct. This covers alternate paths that refer to the same device/inode, such as mount aliases. Path comparisons are case-insensitive on Windows.
- **Regression:** added pure contract assertions for same filesystem identity under different path strings, distinct independent roots, and nested roots. The existing host-owned subprocess regression is already invoked by WorkPass110 CI.
- **Boundary:** identity checks are defense-in-depth; they do not create an OS/container sandbox or prove the verifier/scanner are independently administered.
- **Validation:** exact-head CI/test/typecheck remains unverified because available Actions job metadata exposes no steps/logs. No dependency or learning-score increase.

---

## WorkPass271 — quarantine normalized trace-ID collisions during snapshot restore (2026-10-22)

- **Code:** snapshot restoration now canonicalizes all bounded trace IDs before reconciling records. Exact duplicate rows that normalize to the same record are collapsed; conflicting rows that normalize to the same trace ID are all excluded from active causal history.
- **Dedup safety:** both valid and quarantined normalized IDs remain in the bounded duplicate guard. A retry cannot recreate an ambiguous event after restore.
- **Regression:** added legacy-snapshot cases for exact duplicate Unicode variants, conflicting payloads that collide under NFKC, quarantined-row exclusion and retry rejection without outcome-count mutation.
- **Integration:** remains within the existing CausalExperienceStream owner; no second event store and no new dependency.
- **Validation:** source/tests committed, but exact-head test/typecheck remains unverified because available GitHub Actions jobs expose no steps/logs. Learning scores remain unchanged.

---

## WorkPass270 — preserve raw normalized task ID until validation (2026-10-22)

- **Code:** removed the pre-validation trim from the external task-ingestion path. It now checks whether the NFKC-normalized value is blank without replacing it, then passes the untrimmed normalized input to the shared bounded ID validator.
- **Failure prevented:** trailing/leading task-ID control characters can no longer be erased at the call site before the shared C0/DEL/C1 guard sees them.
- **Regression:** existing task-ID boundary-control case now exercises the actual runtime ingestion path rather than only the helper's trace-ID path.
- **Validation:** exact-head runtime test/typecheck remains unverified because recent Actions jobs expose no steps or logs. No new dependency; no learning score uplift.

---

## WorkPass269 — reject boundary controls before trimming causal identifiers (2026-10-22)

- **Code:** bounded ID normalization now checks C0/DEL/C1 controls immediately after NFKC normalization and only then trims ordinary surrounding whitespace. Leading/trailing newline or tab characters can no longer disappear before validation.
- **Regression:** added leading-trace, trailing-trace and trailing-task control-character cases; all must fail before outcome state changes.
- **Integration:** the change stays in canonical CausalExperienceStream; the existing WorkPass110 causal-stream regression step covers the test path.
- **Validation:** exact-head runtime test/typecheck remains unverified because current Actions attempts expose no step list or logs. No new dependency and no learning-score uplift.

---

## WorkPass268 — broaden causal identity validation and preserve idempotency after eviction (2026-10-22)

- **Code:** causal IDs now reject C0, DEL and C1 control characters as well as blank, non-string and overlong values. The existing NFKC normalization and 120/180-character limits remain.
- **Bounded-memory behavior:** added a regression proving that when a causal record ages out of the 64-row record window, its retained deduplication identity still prevents a late retry from creating another outcome.
- **Regression:** added C1 trace-ID and C0 task-ID cases; rejected inputs must leave outcome counts unchanged. Added a bounded-window retry test.
- **Integration:** no duplicate storage subsystem and no new package dependency; the existing WorkPass110 workflow already watches the causal source/test paths.
- **Validation:** code/test changes are committed, but the GitHub Actions attempts still expose no runnable steps/logs. Do not report the regression or typecheck as passed until an actionable exact-head run is available.
- **Progress accounting:** learning scores remain unchanged; this is data-integrity/recovery hardening, not measured learning uplift.

---

## WorkPass267 — reject conflicting payloads under a reused causal event ID (2026-10-22)

- **Code:** external causal-event idempotency now accepts a repeated normalized trace ID only when the normalized event payload agrees with the existing record. Reusing the same ID with a changed task/action/outcome/identity-relevant field raises causal-external-trace-id-conflict rather than silently returning the old outcome.
- **Durable behavior:** the same conflict check applies when the deduplication record survives snapshot/restore. If the record itself has been evicted but the bounded trace-ID guard still remembers the ID, the stream remains fail-closed and does not create another outcome.
- **Regression:** added same-process and restored-state tests for changed success/reward under the same trace ID; both require an explicit conflict and unchanged outcome count.
- **Integration:** reuses CausalExperienceStream's existing owner and WorkPass110 regression path; no parallel ledger or package dependency added.
- **Validation:** the regression source is committed, but exact-head execution/typecheck remains unverified until Actions provides actionable steps/logs. Learning score estimates remain unchanged.
- **Next trust audit:** trace all external-ingestion call sites and replace caller-asserted grounding flags with canonical state-transition or verifier provenance after the contract is mapped.

---

## WorkPass266 update — lossless event identity and regression reachability (2026-10-22)

- CausalExperienceStream now rejects rather than truncates overlong task/trace identities, including control-bearing values; restore drops malformed trace identity entries.
- Added behavioral regression cases for collision prevention, unchanged state after rejected intake, and persisted-state sanitization.
- Wired the regression into the WorkPass110 CI workflow along with Legacy-avatar and Live2D integrity regressions.
- **Scores unchanged:** P23 symbolic core **61%**, evidence-grounded learning maturity **36%**, project-wide lifelong-learning roadmap **30%**, overall learning engineering **57/100**. Identity integrity improves implementation quality, but no externally measured transfer or task-success gain has been produced by this pass.
- **Validation unresolved:** the latest retrieved WorkPass110 job has a failed conclusion with steps=null and logs_url=null. A retry was requested; exact-head test/typecheck is not yet confirmed.

---


## WorkPass264 update — external event contract validation (2026-10-22)

- External causal event intake now rejects blank task identities and invalid action labels before state mutation.
- The mechanism is based on a focused review of the older `ContinualReplayBuffer` intake contract, adapted into the current `CausalExperienceStream` rather than copying its parallel storage/training implementation.
- **Scores unchanged pending empirical evidence:** P23 symbolic core **61%**, evidence-grounded learning maturity **36%**, project-wide lifelong-learning roadmap **30%**, overall learning engineering **57/100**.
- Regression authored; execution and typecheck are not confirmed. The current score remains an engineering estimate, not measured learning performance.

---

## WorkPass259–263 update — causal integrity, replay diversity, and runtime isolation (2026-10-22)

- **WorkPass259:** bounded NFKC trace identity, persisted outcome deduplication, and state-grounded-only consolidation.
- **WorkPass260:** task/context-diverse prioritized replay and consolidation selection.
- **WorkPass261:** external causal events are idempotent across normalized source IDs and snapshot/restore; the regression is wired to `npm run test:big-pass-90:causal-stream`.
- **WorkPass262:** Legacy avatar canvas dimensions are only reassigned when layout dimensions change.
- **WorkPass263:** host-owned evaluator blocks inherited environment variables that commonly carry credentials or alter runtime loading, and rejects duplicate inherited keys.
- **Validation state:** the latest HEAD has no commit status records. The available PR-triggered workflow records show three failures before any visible job steps; step lists are empty and log downloads return BlobNotFound, so they do not establish a code/test failure. Targeted regressions and runtime/app typechecks are not confirmed executed successfully.
- **Scores intentionally unchanged:** P23 symbolic core **61%**, evidence-grounded learning maturity **36%**, project-wide lifelong-learning roadmap **30%**, overall learning engineering **57/100**. The new code improves integrity and implementation coverage, but there is not yet external-task benchmark evidence to justify increasing measured maturity estimates.

---

## WorkPass116 update — seed-clustered evidence comparisons (2026-10-20)

- Added seed-level paired comparison methods to the canonical `VerifiedOutcomeLedger`. The evaluator now has an explicit path where each seed contributes one aggregate observation, not one observation per correlated task cell.
- Requires complete attempt-1 coverage for the exact task set; incomplete seeds and retries do not inflate the sample. Family-level comparisons are available for diagnostic breakdowns.
- CI currently cannot be treated as a pass: GitHub reports the triggered job as failed with zero executed steps and no retrievable job log (runner ID 0). This does not identify a code failure or establish that the new regression passed; runner/Actions execution remains unresolved.
- Research adaptation: SkillLearnBench's separate skill/trajectory/outcome evaluation, ContinualSkillBench's order/domain-dependent transfer findings, and Berkeley Continual Learning Bench's interacting task sequences motivate future controlled task-stream evaluation. NK1 did not vendor their task datasets or runner.
- **Scores intentionally unchanged pending behavioral evidence:** overall learning engineering **57/100**; evidence-grounded maturity **36%**; P23 symbolic core **61%**; project-wide lifelong-learning roadmap **30%**. This pass improves statistical validity and measurement infrastructure, not demonstrated learning ability.
- **Next P0:** restore runnable exact-head CI; connect signed/independently retrieved verifier evidence to replay/skill-promotion decisions; then compare no replay, recent, multi-timescale, surprise, diversity and reservoir strategies on the same versioned task manifest, seeds and memory budget. Measure skill quality, trajectory, success, forgetting, transfer, latency and memory; do not promote automatically.

## WorkPass113 update — family-level regression visibility (2026-10-20)

- The outcome matrix now reports verified pass rates at each checkpoint split by task family, plus family-specific forgetting and backward transfer.
- This follows the benchmark lesson from AgentMemoryBench and SkillLearnBench: online/replay/transfer/repair and skill/trajectory/outcome are distinct dimensions; a single aggregate can mask task-specific regressions. NK1 implements the reporting layer but has not yet run a real cross-family stream.
- No score increase: overall learning engineering **57/100**; evidence-grounded maturity **36%**; P23 symbolic core **61%**; project-wide lifelong-learning roadmap **30%**.

## WorkPass112 update — per-cell outcome uncertainty (2026-10-20)

- `ContinualOutcomeMatrix.ts` now exposes each task × stage's verified sample count, successes, pass rate, task family and Wilson 95% interval, in addition to aggregate retention/transfer metrics.
- Fixed the pre-training test fixture so task `b` uses real numeric seed IDs; expanded coverage for matched baseline seeds, missing baseline evidence and interval behavior.
- The intervals are descriptive binomial intervals for each cell. They do not adjust for dependence between tasks/seeds, establish causal improvement, or replace repeated paired comparisons. With four seeds, intervals are necessarily broad.
- Current scores remain unchanged: overall learning engineering **57/100**; evidence-grounded maturity **36%**; P23 symbolic core **61%**; project-wide lifelong-learning roadmap **30%**. This pass improves measurement granularity, not demonstrated learning.

## WorkPass109 update — signed artifact provenance boundary (2026-10-20)

- Added `VerifiedOutcomeArtifact.ts`: verifies Ed25519 signatures over canonical payloads and binds them to the current manifest fingerprint and the manifest's task version/verifier ID before recording the result.
- Added tamper, unknown-key, manifest-drift, task-version, malformed-payload and duplicate-attempt regressions. The signature covers the outcome and run/artifact identifiers, so payload edits invalidate the signature.
- The verifier public-key registry is injected by the caller; no private key is stored in NK1. A signature authenticates possession of a configured key, not verifier neutrality or real-world correctness.
- **Scores remain unchanged pending external task evidence:** overall learning engineering **57/100**; evidence-grounded maturity **36%**; lifelong-learning roadmap **30%**. This pass strengthens evidence intake, not demonstrated learning quality.
- **Still open:** independently retrieve verifier artifacts; define operational trust-root provisioning/rotation/revocation; connect signed evidence to controlled replay/skill updates; compare same-seed replay strategies on independent RU/EN holdouts; measure retention, transfer, repair under corrupted feedback, and real-model outcomes.

# P23 continual-learning scorecard and comparative roadmap — 2026-10-20

## WorkPass108 update — paired identity and manifest-bound evidence (2026-10-20)

- Paired outcome comparison now encodes `taskId`, `seed`, and `attempt` as a JSON tuple rather than delimiter concatenation, avoiding ambiguous composite keys.
- `manifestFingerprint()` supplies a deterministic digest over sorted manifest entries. Tests assert stability under insertion-order changes and sensitivity to prompt, version, verifier, and split changes.
- Added CI coverage for both regressions and included them in the full verified-outcome test suite.
- **Scores unchanged:** overall learning engineering **57/100**; evidence-grounded maturity **36%**; overall lifelong-learning roadmap **30%**. This pass improves evidence identity and evaluation reliability, not demonstrated task-solving ability.
- **Remaining P0:** verifier-run artifacts must carry this manifest digest and be independently retrieved/validated; evidence needs authenticated provenance. Next, build the same-seed outcome benchmark across context-only, online-only, recency, surprise, reservoir, and multi-timescale approaches, with old-task retention and forward-transfer measurements. Do not enable automatic promotion from synthetic fixtures.


This is an engineering assessment of the current repository implementation, not a claim of human-level learning. Scores are provisional expert estimates based on implemented code paths and test coverage. They must be replaced or calibrated with repeated external-task benchmark results.

## Progress estimate

- **P23 symbolic continual-learning core: 61%** — experience capture, bounded replay, contextual action values, skill promotion/rejection, nearby-context transfer, retention decay, rollback and persistence exist. This measures implementation coverage against the currently scoped P23 core, not success rate.
- **Evidence-grounded learning maturity: 36%** — independent outcome verification, reliable holdout splits across task families, delayed retention measurements and external task outcomes remain incomplete.
- **Project-wide learning ambition: 30%** — this is a broad roadmap estimate across autonomous, cross-domain, lifelong learning; it is not a measured capability metric.
- **WorkPass100 replay-selection integration: implemented; exact-head CI pending** — production and benchmark now share one bounded selector; runtime exposes a safe configurable quota for controlled ablations; tests cover boundary conditions and 16/32/48 recent quotas. This improves implementation coverage, not evidence of task-success uplift.

Do not add these percentages together. Their denominators differ and each is a planning estimate.

## Provisional scorecard (1–100)

| Aspect | Score | Evidence and main limitation |
|---|---:|---|
| Experience ingestion and malformed-label rejection | 72 | Deduplication and non-finite label rejection are implemented; source truth/reliability is not independently established. |
| Replay budget and bounded resource use | 79 | Runtime hard cap remains 64 updates per consolidation; a typed selector config supports smaller controlled ablations without raising the ceiling. |
| Replay diversity and multi-timescale retention | 66 | Shared selector guarantees a configurable recent quota, then chooses historical context/action representatives and surprise-ranked fill; no validated retention/forward-transfer win on a task stream. |
| Skill formation and promotion/rejection | 61 | Context/action skills, held-out validation windows and promotion rollback exist; validation is still narrow and largely synthetic. |
| Contextual transfer | 58 | Conservative near-context transfer and distant-context rejection are tested; task-semantic similarity is represented by coarse state buckets. |
| Forgetting and retention bookkeeping | 70 | Half-life decay, expiry, fresh-evidence refresh and rollback exist; delayed repeated task tests are missing. |
| Outcome verification / causal grounding | 36 | There are feedback labels, shadow comparisons and ablations, but no universal independent verifier for real actions or claims. |
| Calibration and uncertainty reporting | 43 | Prediction error and calibration metrics exist; sample-count-aware confidence intervals and drift alarms are incomplete. |
| Benchmark quality / baselines | 35 | Shared production selector is compared against recency-only and surprise-only baselines at 16/32/48 recent quotas; task-verifier outcomes, retention and transfer remain unmeasured. |
| Persistence and state integrity | 69 | Snapshot/restore and checksum mechanisms exist; long-horizon corruption and migration fault injection need wider coverage. |
| Observability and experiment reproducibility | 49 | Metrics are exposed, but there is not yet a durable experiment ledger with versioned seeds, benchmark manifests and confidence intervals. |

**Provisional overall score: 57/100.** This is a weighted engineering judgment, not a measured benchmark score. It deliberately discounts synthetic-test coverage where external outcome truth is absent. The strongest implemented areas are boundedness, validation rollback and retention bookkeeping; the weakest are external grounding and comparative empirical evaluation.

## Comparison with established and experimental systems

| System | Strength to learn from | Difference from NK1 | Adaptation priority |
|---|---|---|---|
| [Voyager](https://github.com/MineDojo/Voyager) (MIT) | Executable/compositional skill library, automatic curriculum, environment feedback and self-verification | Minecraft-specific, LLM/tool-driven; not a drop-in TypeScript cognition module | High: add versioned skill contracts, invocation traces, verifier outcomes and safe rollback; review relevant files/license before importing code. |
| [ARROW](https://github.com/Cerenaut/ARROW) (paper: https://arxiv.org/abs/2603.11395) | Separate recent and long-term replay; long-term distribution matching to mitigate forgetting | Neural world-model RL and Python/PyTorch dependencies; current P23 is symbolic contextual replay | High: next benchmark should test fixed 50/50 against 25/75 and 75/25, with context/action distribution coverage and old-task retention. Do not import the neural stack wholesale. |
| [SkillLearnBench](https://github.com/cxcscmu/SkillLearnBench) (MIT) | Real-world task suite with separate skill quality, trajectory and final outcome metrics; teacher feedback versus self-feedback baselines | Requires LLM APIs, Docker and task-specific setup; costly to run fully | Very high: borrow the three-level evaluation model and task verifier patterns; start with a small local subset, preserve upstream attribution/license. |
| [ContinualSkillBench](https://arxiv.org/abs/2608.03874) (2026) | Sequential task streams and tests whether learned skills actually transfer, not merely accumulate | Research benchmark, not a runtime library | High: add increasing-difficulty task streams and compare skill-memory use against context-only adaptation. |
| Replay-based recurrent RL ([paper/code](https://github.com/amazon-science/replay-based-recurrent-rl)) | Modular replay baseline and controlled continual-RL comparisons | Neural policy, different representation and compute assumptions | Medium: use as evaluation-design reference; avoid transplanting incompatible training code. |

Research sources are design references, not proof that their gains transfer to NK1. In particular, ARROW's neural results do not establish that the current symbolic replay policy improves outcomes; only an NK1-controlled benchmark can do that.

## Required benchmark protocol

Compare these baselines on the *same deterministic, versioned stream*:

1. No replay / online-only update.
2. Recency-only replay.
3. Surprise-priority replay.
4. Current multi-timescale replay (default 32 recent + up to 32 historical representatives; total cap 64).
5. Multi-timescale recent quotas 16/48 (with the default 32 as middle arm); report realized composition, not just configured ratio.
6. Context/action-stratified replay without surprise ranking.

Report at least:
- task success against an independent verifier;
- old-task retention after new-task blocks;
- forward transfer on unseen but related contexts;
- skill promotion precision and rollback latency;
- context/action stratum coverage;
- updates per consolidation, memory footprint and wall-clock cost;
- per-task sample counts and uncertainty intervals.

Do not promote a strategy just because its replay batch is diverse or its internal TD error decreases. Those are diagnostics, not outcome success. Split training/validation/test by task family or environment instance to avoid leakage. External/self-generated feedback must be labelled separately.

## Next implementation order

1. **P0 — trustworthy outcomes:** attach provenance, verifier identity, timestamp and confidence to feedback; prevent unverified self-judgment alone from promoting high-impact skills.
2. **P1 — benchmark baselines:** make replay strategy selectable behind a typed policy/config, with a deterministic task-stream harness and machine-readable results.
3. **P1 — adaptive replay allocation:** tune recent/historical ratio from measured drift/retention signals only after controlled ablations; retain a fixed safe default.
4. **P1 — transferable skills:** explicit preconditions, expected effects, contraindications, versioning, invocation and postcondition checks.
5. **P2 — long-horizon validation:** delayed recall/retention, task-family holdouts, recovery after corrupted persistence and drift detection.
6. **P2 — upstream integration:** audit specific files and licenses; prefer small interoperable algorithms and benchmark fixtures over adding large incompatible ML dependencies.

## Research references

- ARROW: https://arxiv.org/abs/2603.11395 and https://github.com/Cerenaut/ARROW
- SkillLearnBench: https://arxiv.org/abs/2604.20087 and https://github.com/cxcscmu/SkillLearnBench
- ContinualSkillBench: https://arxiv.org/abs/2608.03874
- Voyager: https://arxiv.org/abs/2305.16291 and https://github.com/MineDojo/Voyager
- Replay-based recurrent RL: https://arxiv.org/abs/2205.14495 and https://github.com/amazon-science/replay-based-recurrent-rl

## WorkPass99 code addition

Added `tests/p23-replay-strategy-benchmark.mjs` and `.github/workflows/workpass99-replay-strategy-benchmark.yml`. The harness compares recent-only, surprise-only and multi-timescale sample selection under a deterministic distribution shift. It asserts bounded batch size, exact recent quota, no duplicate IDs and nontrivial historical/context coverage. It deliberately reports proxy metrics only and must not be represented as proof of better task outcomes until the workflow runs and a verifier-grounded task stream is added.


## WorkPass100 — production-shared replay selector (2026-10-20)

- Extracted the replay-selection algorithm into `ReplaySelectionPolicy.ts`; the production `P23LearningEngine` and the deterministic benchmark now call the same implementation instead of maintaining parallel copies.
- Added a typed `configureReplaySelection({ maxBatchSize, recentQuota })` seam for controlled ablations. Runtime max is clamped to 64; defaults remain 64 total / 32 recent, and the policy does not auto-tune from unverified feedback.
- The selector guarantees unique trace IDs, chronological deterministic output, a recent quota, historical context/action-stratum representatives, and surprise-ranked fill. It clamps malformed/oversized configuration at the boundary.
- Added tests for zero/oversized quotas, batch cap, duplicates, deterministic ordering, historical retention, small-batch preservation, and actual runtime integration. Benchmark sweeps recent quotas 16/32/48 against recent-only and surprise-only baselines.
- **Exact tested code head CI PASS:** `891e56f58373377ea6a325552fe2d1e389f6d71b` — [replay selector/quota sweep](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39421560741), [P23 learning](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39421553511), [runtime regression](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39421553534), [verification input binding](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39421553538). Later scorecard/changelog commits are documentation-only. The benchmark remains a selection-quality proxy; no task-success, retention or transfer uplift is claimed.
- New research reference: [Adaptive Replay Buffer (ARB), AISTATS 2026](https://proceedings.mlr.press/v300/song26d.html), which dynamically weights online/offline trajectories using a policy-alignment signal. NK1 adapts the *experimental direction*—measuring whether experiences match the current policy—rather than copying its offline-to-online RL implementation. Follow-up must first add outcome provenance and controlled task-stream evaluation.
- Upstream skill evaluation reference: [SkillLearnBench](https://github.com/cxcscmu/SkillLearnBench) (MIT) separates skill artifact quality, execution trajectory, and verifier-based task outcome; [SkillsBench](https://github.com/benchflow-ai/skillsbench) (Apache-2.0) offers broader skill-utility tasks. Their task harnesses have different dependencies and are evaluation references, not drop-in runtime dependencies.


## WorkPass101 implementation update

- Shared selector now supports opt-in `ageHalfLifeTicks` to discount stale historical surprise while preserving the existing default (infinite half-life).
- Context/action stratum keys are tuple-encoded to avoid delimiter collisions. Tests cover collision behavior and invalid configuration fallback.
- **Implementation coverage:** replay selector options expanded; keep replay/diversity maturity at **66/100** pending outcome-based ablation. Do not raise empirical quality scores based on selector-only tests.
- **Next experiment:** on identical versioned task streams, compare infinite, 1k, 100, and 10 tick half-lives alongside 16/32/48 recent quotas; report independently verified success, old-task retention, forward transfer, replay composition, latency and memory with paired uncertainty intervals.
- **Current status:** IMPLEMENTED; exact-head CI pending. No production default change and no uplift claim.



## Research update — 2026-10-20

- [Distribution-aware sampling of replay buffer for mitigating catastrophic forgetting](https://www.sciencedirect.com/science/article/pii/S0020160026005712), published 15 Oct 2026, reports state-action-space-aware sampling outperforming the compared alternatives in its evaluated setting. Adaptation for NK1: measure state/action coverage and task retention together; the current stratum representative selector is a lightweight hypothesis, not an implementation of the paper's clustering method.
- [Prioritized Model Experience Replay (ICML 2026)](https://proceedings.mlr.press/v306/tao26c.html) argues that globally low model error may still hide policy-relevant local error under distribution shift. Adaptation: prioritize only where policy-relevant prediction error is available and independently measured; NK1 does not currently have the model-based transition learner needed to reproduce PMER.
- [Revisiting Replay and Gradient Alignment for Continual Pre-Training of Large Language Models (Lifelong Learning Agents 2026)](https://proceedings.mlr.press/v330/abbes26a.html) evaluates replay and gradient alignment at large language-model scale. Adaptation: use its comparison framing, not its gradients or reported scores; NK1's symbolic replay selector and small parametric policy are not directly comparable to 100B-token model pretraining.
- [Improvements to dark experience replay and reservoir sampling](https://www.frontiersin.org/journals/artificial-intelligence/articles/10.3389/frai.2026.1649239/full) is open access (CC BY) and studies consolidation/plasticity balance. Candidate next step: implement reservoir sampling as a separate baseline and test order sensitivity before considering any code reuse; no upstream code copied in WorkPass101.

**Decision:** keep the recent-quota default and age half-life disabled. The latest work adds a controlled parameter sweep; only verifier-grounded task success, old-task retention, transfer and uncertainty intervals can justify changing defaults. Paper results from neural RL/LLM settings are not NK1 results.


## WorkPass102 — seeded reservoir baseline (2026-10-20)

- Added `ReservoirReplayPolicy.ts`: bounded Algorithm R sampling without replacement, deterministic explicit seeds, duplicate-ID protection (first occurrence wins), stable chronological output, and capacity clamp 0–512. It is a baseline only and is not wired as the production default.
- Added focused regression coverage for capacity, reproducibility, seed sensitivity, input immutability, duplicate ingestion, and stable seed normalization.
- Expanded the strategy benchmark to report five fixed reservoir seeds (7, 19, 42, 101, 2026) alongside recent-only, surprise-only, quota-stratified multi-timescale replay and age-decay sweeps. This remains a replay-composition proxy; it does not establish task-success, retention, or transfer uplift.
- Added a dedicated Node 24 GitHub Actions workflow for the reservoir regression and strategy comparison.
- **Status:** code and workflow committed; CI must finish on the exact latest head before recording PASS. No upstream code copied; Algorithm R is a standard baseline implemented locally.
- **Next:** add a verifier-labelled deterministic task stream and compare strategies on identical seeds, reporting success, old-task retention, forward transfer and paired confidence intervals. Keep all defaults unchanged until outcome evidence supports a change.


## WorkPass103 — replay baseline robustness (2026-10-20)

- Added a 400-seed inclusion-frequency regression for Algorithm R with a broad positional-bias guardrail. It tests whether the implementation behaves plausibly as a uniform reservoir over the deterministic fixture; it does not measure task success, forgetting or transfer.
- Repaired the WorkPass102 workflow failure: setup-node v7 was auto-detecting npm from `package.json` and failing because no supported lockfile exists at repository root. The harness has no install step, so package-manager caching is explicitly disabled rather than creating an unrelated lockfile.
- **Exact-head status:** reruns were triggered after the workflow fix and the statistical regression. Do not mark CI PASS until all required runs finish on the final head.
- **Scores unchanged:** replay budget 79/100, diversity/multi-timescale 66/100, benchmark quality 35/100, overall learning engineering 57/100. More sampler tests improve implementation confidence but do not demonstrate real learning gains.
- **Next major capability gap remains:** verifier-labelled outcome stream, same-stream ablations of online-only / recency / surprise / multi-timescale / reservoir, delayed old-task retention and forward transfer with per-task confidence intervals. Keep replay defaults unchanged until these are measured.


## WorkPass104 — multi-seed proxy uncertainty (2026-10-20)

- The replay-composition benchmark now uses 50 deterministic reservoir seeds and summarizes proxy metrics with mean, sample standard deviation and approximate 95% intervals. It reports historical/post-shift coverage, oldest-stream representation, context/action-stratum count and mean surprise.
- This is a better view of sampler seed sensitivity than a few hand-picked examples, but its intervals describe only this synthetic stream and these seeds. They are **not** uncertainty intervals for task success, retention or forward transfer.
- **Scores remain unchanged:** benchmark quality 35/100 and overall learning engineering 57/100. No increase is justified until independent verifiers score real task outcomes on identical task streams.
- CI for the newest code head must complete before this pass is marked fully validated.


## WorkPass105 — verifier-grounded evaluation substrate (2026-10-20)

- Added a versioned manifest + outcome ledger that rejects self-reported outcomes as truth, validates task version/verifier/evidence provenance, prevents duplicate attempts, and rejects normalized prompt fingerprints shared across train/validation/holdout splits.
- Added paired baseline/candidate metrics over identical task + seed + attempt cells: pass rate, absolute gain, discordant wins and approximate 95% interval. Missing pairs are excluded rather than imputed.
- New fixture has 3 manifest entries and paired synthetic outcomes. This validates metric plumbing and guardrails only; it is not a benchmark result for NK1.
- **Integration boundary:** the ledger is not yet connected to the production learner, storage, or skill promotion. That is deliberate until outcome contracts are reviewed and the held-out set can be protected from training leakage.
- **Scores unchanged:** real outcome validation 34/100; benchmark quality 35/100; overall learning engineering 57/100. A scoring substrate is progress toward measurement, not proof of improved task success.
- **Next:** persist signed/versioned evidence, add task-family-level paired summaries and retention-after-interference measurements, then connect only externally verified outcomes to the learning stream. Keep the holdout unavailable to training and model-authored labels.



## WorkPass106 — outcome-based promotion guard (2026-10-20)

The verifier ledger now has a separate conservative eligibility gate for candidate-vs-baseline results. By default it requires at least 30 paired outcomes, at least three task families, aggregate absolute gain of at least 2 percentage points, a positive lower bound on the approximate paired 95% interval, and no family regression worse than 5 percentage points. These are initial engineering guardrails, not statistically universal thresholds; tune them only against a pre-registered benchmark protocol. A deliberately relaxed confidence setting exists for exploratory diagnostics and is not the default.

The gate prevents several common false promotions: tiny samples, positive aggregate gains driven by one family while another collapses, no usable uncertainty interval, and missing family-level comparisons. It is still only a calculation over already verified outcomes: it does not authenticate evidence artifacts, execute verifiers, persist a ledger, or change the production learner. Current fixture tests are synthetic and do not justify increasing the overall 57/100 engineering score.

### Research adaptation update

- [SkillLearnBench](https://github.com/cxcscmu/SkillLearnBench) separates skill quality, execution trajectory, and final verifier-based task outcome. NK1 should retain this layered evaluation rather than treating an internal skill score as task success. The upstream benchmark contains 20 tasks / 100 verified instances and reports mixed method wins, so one replay policy should not be assumed universally superior. ([repo](https://github.com/cxcscmu/SkillLearnBench), [paper](https://arxiv.org/abs/2604.20087))
- [ContinualSkillBench](https://arxiv.org/abs/2608.03874) finds that in-context adaptation can be competitive with explicit skill maintenance, and skill reuse gains vary by domain. NK1 therefore needs a context-only baseline as well as explicit replay/skill arms.
- [AgentMemoryBench](https://github.com/solomoon313/AgentMemoryBench) emphasizes online learning curves, replay retention, cross-environment transfer, and repair after erroneous feedback. Adapt these as separate outcome metrics, not a single aggregate memory score.
- [Continual Learning Bench](https://arxiv.org/abs/2606.05661) warns that memory systems do not automatically produce genuine learning and can underperform simpler in-context baselines. This supports leaving production promotion disabled until verifier-backed comparisons show reliable gains.

### Remaining high-priority work

1. Connect independently executed verifiers to durable evidence artifacts and stable task/version IDs.
2. Add task-family-level retention and forward-transfer evaluation after process restart.
3. Run context-only, no-replay, recency, surprise, reservoir, and multi-timescale policies on the same held-out streams.
4. Add delayed and corrupted-feedback repair tests; do not treat self-report as ground truth.
5. Only after repeated paired gains and family-level safety checks, consider production promotion. Live llama.cpp, real RU/EN retrieval uplift, long-horizon persistence, and full application E2E remain separate release gates.



## WorkPass107 — checksummed ledger persistence and restart recovery (2026-10-20)

- Added a versioned JSON envelope for the verifier outcome ledger with deterministic canonical SHA-256 checksum. The checksum detects accidental corruption and payload drift; it is **not** a cryptographic signature and does not authenticate the writer or evidence URI.
- Added restore support that validates the envelope, checksum, schema, manifest invariants, every accepted outcome, and rejection history/counts before returning a ledger. A malformed or modified accepted outcome is rejected instead of silently becoming trusted training data.
- Snapshot schema now carries its manifest, so the restored ledger remains bound to task IDs, task versions, task families, split assignments, verifier IDs and normalized prompt fingerprints.
- Added persistence tests for round-trip equivalence, paired metric equivalence after restore, malformed JSON, unsupported envelopes, payload tampering, rehashed invalid outcomes and cross-split manifest corruption. Wired the test into package scripts and the WorkPass106 CI workflow.
- **Boundary:** this is a persistence codec, not yet an atomic filesystem/database adapter; checksum is integrity detection, not signing. Production learning/promotion remains disconnected and disabled.
- **Scores remain unchanged:** overall learning engineering 57/100; evidence-grounded learning maturity 36%; overall lifelong-learning roadmap 30%. Persistence hardening alone is not measured learning improvement.
- **Next implementation:** add immutable evidence artifact references with verifier-run IDs and task-manifest digests; build a deterministic benchmark runner comparing context-only, no-replay, recency, surprise, reservoir and multi-timescale policies over identical task streams, then measure delayed retention and forward transfer.


### WorkPass107 extension — atomic file-backed persistence

- Added a local file-store adapter over the checksummed envelope. It writes to a unique same-directory temporary file, syncs the file, atomically renames it into place, attempts directory sync, and cleans up temporary files after failures.
- Added size caps and a restrictive `0600` mode for the temporary data file. Added round-trip/replacement/size-limit/corrupt-file tests and wired them into the same CI gate and package scripts.
- Explicit limits: this is single-writer local persistence, not a distributed transaction store. It has no cross-process lock, encryption, authenticated signatures, or trusted evidence retrieval; those must be provided before a production service relies on it.


## WorkPass110 — explicit sequential retention/transfer metrics (2026-10-20)

- Added `ContinualLearningMetrics.ts`, a reusable evaluator for a task-by-stage score matrix. It reports final mean score, peak-to-final forgetting, backward transfer, and forward transfer relative to a declared reference policy.
- Added validation for square task/stage matrices, duplicate task IDs, non-finite/out-of-range scores, and missing pre-training baselines. Forward transfer is `null` when it cannot be computed; it is not imputed.
- Added a dedicated Node 24 workflow and wired the regression into the full P23 verified-outcome suite.
- **Scores unchanged:** engineering estimate 57/100; P23 symbolic core 61%; evidence-grounded maturity 36%; lifelong-learning roadmap 30%. This is measurement infrastructure, not proof of actual learning uplift.
- Next empirical step: connect the evaluator to a same-manifest, same-seed run recorder for context-only, no-replay, recency, surprise, reservoir and multi-timescale conditions; retain per-task raw scores and confidence intervals. Do not use synthetic fixtures as benchmark evidence or enable automatic promotion.


## Research review — benchmark design and what to adapt (2026-10-20)

- **AgentMemoryBench** (<https://github.com/solomoon313/AgentMemoryBench>): adapt its separation of online learning, replay retention, cross-environment transfer, and repair after incorrect feedback. NK1's next benchmark should report each axis separately, not one aggregate “learning score”.
- **SkillLearnBench** (<https://github.com/cxcscmu/SkillLearnBench>, COLM 2026; <https://arxiv.org/abs/2604.20087>): adapt its three-level evidence chain—skill quality, execution trajectory, and verified task outcome. Its report warns that self-feedback can drift and that external feedback can matter; NK1 should preserve independent verifier outcomes and inspect raw trajectories before changing skill policy.
- **MemoryBench** (<https://proceedings.mlr.press/v306/ai26e.html>, ICML 2026): use service-time feedback and continual-learning tasks as a comparator to static long-context recall; design tests around updates from feedback rather than only memory retrieval.
- **AgentMemBench / MESA** (<https://github.com/mazaiying/AgentMemBench>): complement task outcome tests with memory middleware dimensions such as temporal consistency, isolation/privacy, write efficiency and retrieval quality. This is an evaluation roadmap, not a claim that NK1 passes those tests.
- No upstream benchmark code or datasets were copied in WorkPass110. The new metrics and paired comparator are original NK1-local implementations inspired by public evaluation designs. Before importing external code/data, pin a commit, inspect its license and data terms, and adapt only the minimum compatible interface.
- **No score uplift yet:** the new code measures supplied scores; no real model runs were executed by this change. Keep engineering 57/100, symbolic P23 core 61%, evidence-grounded maturity 36%, and project-wide roadmap 30% until repeated, externally verified, same-seed task runs demonstrate improvements.
\n\n## WorkPass111 — evidence-backed sequential matrix adapter (2026-10-20)\n\n- Added `ContinualOutcomeMatrix.ts` to bridge the verified outcome ledger and sequential retention/transfer evaluator. It calculates per-task pass-rate checkpoints over matched seeds and records task versions, families, seed IDs, authority counts, and the exact manifest fingerprint with the resulting metrics.\n- The adapter only includes `independent-verifier` and `human-review` outcomes from the chosen split and attempt 1. It rejects incomplete task/stage cells and unequal seed sets instead of filling gaps. This prevents retry inflation and invalid unpaired comparisons.\n- Test fixtures are synthetic contract tests, not model-performance evidence. The new bridge is not yet wired to a production task runner or a real NK1 learning loop.\n- Research comparator: AgentMemoryBench separates online learning, replay retention, transfer and repair; SkillLearnBench separates skill artifact, trajectory and task outcome. NK1 is adapting that separation into an evidence ledger + sequential score matrix, not importing their benchmark dependencies or claiming comparability yet.\n- **Scores unchanged:** overall learning engineering 57/100; symbolic P23 core 61%; evidence-grounded maturity 36%; lifelong-learning roadmap 30%. Raise only after real, independently verified matched-seed runs.\n