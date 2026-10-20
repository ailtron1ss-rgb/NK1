# P23 continual-learning scorecard and comparative roadmap — 2026-10-20

This is an engineering assessment of the current repository implementation, not a claim of human-level learning. Scores are provisional expert estimates based on implemented code paths and test coverage. They must be replaced or calibrated with repeated external-task benchmark results.

## Progress estimate

- **P23 symbolic continual-learning core: 61%** — experience capture, bounded replay, contextual action values, skill promotion/rejection, nearby-context transfer, retention decay, rollback and persistence exist. This measures implementation coverage against the currently scoped P23 core, not success rate.
- **Evidence-grounded learning maturity: 34%** — independent outcome verification, reliable holdout splits across task families, delayed retention measurements and external task outcomes remain incomplete.
- **Project-wide learning ambition: 29%** — this is a broad roadmap estimate across autonomous, cross-domain, lifelong learning; it is not a measured capability metric.
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
| Outcome verification / causal grounding | 34 | There are feedback labels, shadow comparisons and ablations, but no universal independent verifier for real actions or claims. |
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
