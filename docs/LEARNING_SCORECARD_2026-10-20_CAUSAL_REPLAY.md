# NK1 learning scorecard — causal replay pass (2026-10-20)

**Branch:** `rebuild`  
**Scope:** P26 parametric learner + causal-experience replay path  
**Status:** WorkPass104 implementation and synthetic regressions passed on exact code head `86a741e74bde63ed6194fc3a7a24b7152087fac7` (Actions run [39429062750](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39429062750)); exact-head Actions also passed on `69e921d63e7fa61c863c0cd445b153988a4375f3` (run [39429299853](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39429299853)), including feature-schema migration.  
**Interpretation:** percentages are engineering coverage estimates, not measured intelligence or task-success rates.

## Progress estimates

- P26 replay/holdout and contextual-feature implementation coverage: **74%** (engineering estimate, not a measured success rate).
- Outcome-grounded learning evidence maturity: **40%** (independent-evidence registration exists; external task outcomes remain unproven).
- End-to-end continual-learning ambition across memory, policy, skills and transfer: **32%**.
- Current learning-system engineering score: **58/100** (unchanged; synthetic retention tests expose a forgetting/replay trade-off but do not establish external-task uplift).

These are not interchangeable metrics. The implementation percentage tracks presence and wiring of mechanisms; evidence maturity tracks independent outcome/holdout evidence; the 1–100 score summarizes engineering maturity and remaining risks.

## WorkPass101 implementation

1. Added `CausalReplaySampler.ts`, a bounded deterministic replay selector shared by P26 runtime and its benchmark.
2. The sampler validates feature-vector shape, de-duplicates stable experience IDs (keeping the latest tick), guarantees a configurable recent window, then selects high-priority representatives across action/coarse-state strata before filling remaining capacity.
3. Wired `P26TrueLearningEngine.replayCausalRecords` to the shared selector; this replaces the previous “take the first 32” truncation, which could over-represent whichever records happened to be first.
4. Added selector invariants, a recent-only / priority-only / stratified benchmark, npm scripts and the WorkPass79 Actions workflow step.
5. Retained existing P26 online learning and P23 policy ownership; no duplicate learner or parallel memory owner was added.
6. Corrected evidence accounting: same-call replay splits are labelled `in-batch-diagnostic` and cannot increment `generalizationEvidence01`.
7. Added `trainingExposure01` separately; update counts no longer masquerade as generalization evidence.
8. Added `recordVerifiedHoldout(...)`, requiring task, protocol, verifier and sample-set identifiers plus independent/verified flags. Evidence IDs are deduplicated and persisted; legacy `recordHoldout(...)` is diagnostic-only.
9. Normalized bounded TD targets as `(reward + gamma * nextValue) / (1 + gamma)` rather than clipping the unnormalized sum, preserving low-reward signal on the [0,1] scale.
10. Added a sequential task-shift benchmark measuring old-task retention and new-task plasticity; bounded replay correction strength was tuned against the probe.

## Aspect scores (engineering estimates)

| Aspect | Score / 100 | Main remaining gap |
|---|---:|---|
| Experience ingestion and finite-value guards | 78 | Bind verifier claims to runtime-issued receipts |
| Replay bounds and deterministic behavior | 82 | Runtime-level persistence and load tests under large streams |
| Replay diversity across actions/contexts | 70 | Measure retention/transfer on controlled sequential tasks |
| Priority signal quality | 52 | Priority is heuristic; calibrate against verified utility |
| Skill formation and promotion | 61 | Independent verification must govern all promotion routes |
| Contextual transfer | 61 | Interaction features are added; independent external-task and cross-domain holdout evidence remains open |
| Delayed credit assignment | 63 | Validate causal attribution against intervention controls |
| Calibration and uncertainty | 43 | Reliability curves and abstention metrics on holdout |
| Benchmark and baselines | 48 | Sequential synthetic task shift now measures retention/plasticity; independent external task outcomes remain open |
| Persistence and replay idempotency | 72 | Full restart/replay duplication and schema migration campaign |
| Experiment reproducibility | 58 | Versioned data manifests and paired confidence intervals across more seeds |

## Research and adaptation choices

- **SkillLearnBench (MIT; COLM 2026):** adapt the separation of skill quality, execution trajectory and verifier-based task outcome. Its full Python/Docker/API benchmark stack is not a drop-in dependency for NK1's TypeScript runtime. Source: https://github.com/cxcscmu/SkillLearnBench
- **XSkill (ICML 2026):** its separation of reusable task skills and action-level experiences is architecturally relevant; adapt the distinction and retrieval/evaluation protocol, not the multimodal API-heavy pipeline wholesale. Source: https://github.com/XSkill-Agent/XSkill
- **RethinkSkill (MIT):** use matched multi-round feedback experiments and preserve candidate/evidence provenance; avoid assuming self-feedback alone improves skill quality. Source: https://github.com/HKUST-KnowComp/rethinkskill
- **AgentSynth (MIT):** use end-state verifiers and seeded scenario packs; do not score transcripts as world-state outcomes. Source: https://github.com/agentsynth/agentsynth
- **AgentMemoryBench:** adapt its separation of online learning, replay/forgetting, transfer and repair into distinct evaluation modes; its Python/Docker suite is too heavyweight to import wholesale into NK1's TypeScript/mobile runtime. Source: https://github.com/solomoon313/AgentMemoryBench
- **MemSkill:** explore evolving *how to remember* separately from stored experience, after provenance and retention are stronger. Source: https://github.com/ViktorAxelsen/MemSkill

No third-party source code or datasets were copied in this pass. Recheck licences and dependencies before importing any implementation.


## WorkPass102–104 — interleaving, conflict gating and contextual feature basis

- Added experimental `P26TrueLearningEngine.trainInterleaved` with bounded update counts, separate current/replay learning-rate controls, TD-target default, and a direct-reward option for controlled supervised-style comparisons.
- Added same-action, nearest-state conflict screening: strongly contradictory outcomes for near-identical states can be excluded from replay. This adapts the principle of blocking inconsistent replay from the 2026 A2ER/O2S study, not its implementation.
- Expanded the P26 feature basis from 15 to 18 features with energy×novelty, energy×goal-pressure and novelty×goal-pressure interactions. Restore maps old weights by feature name so the previous action-cost weight is not reassigned to a new feature.
- CI evidence, synthetic only: context-free contradictory targets still force a plasticity/consolidation trade-off. In the latest passing benchmark, online-only reached Task A 1.25% after interference and Task B 99.375%; post-hoc replay reached Task A 1.25%→2.5% and Task B 95.625%; conflict-gated interleaving reached Task A 1.25% and Task B 99.375%, with 5,648 conflicting replay records blocked and 1,256 replay updates. This is not a win in old-task retention.
- Context-separated synthetic test: Task A 98.75% before task B, Task A 100% after, Task B 90%; 20,160 eligible replay records, zero blocked. This supports only the tested synthetic setup; it is not external-task evidence.
- Exact-head CI: [run 39429062750 — PASS](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39429062750), code head `86a741e74bde63ed6194fc3a7a24b7152087fac7`.
- **Important integration boundary:** `trainInterleaved` remains an experimental API not yet wired into the ordinary runtime learning caller. Therefore overall learning-system score stays **58/100**; outcome evidence maturity stays **40%**, and end-to-end continual-learning scope stays **32%**. The engineering-coverage estimate rises to 74% because the feature/migration/replay mechanisms are implemented, not because generalization is proven.

### New research/source comparison

- **Kobayashi (Frontiers in Artificial Intelligence, 19 Feb 2026), “Improvements to dark experience replay and reservoir sampling…”** proposes adaptive consolidation/plasticity, blocking inconsistent replay, correcting stale outputs, and multiple connected reservoirs. NK1 currently adapts conflict screening and keeps the design dependency-free; adaptive weighting and multi-buffer storage remain future work. https://doi.org/10.3389/frai.2026.1649239
- **ARROW (Cerenaut)** proposes short-term plus long-term distributions and replay through a world model. The Python/PyTorch/DreamerV3 pipeline is not suitable for direct wholesale import into NK1's TypeScript/mobile runtime; its two-timescale buffer design remains a source candidate. https://github.com/Cerenaut/ARROW
- **Dark Experience Replay + reservoir sampling (MIT-licensed example)** stores old outputs as well as experiences; useful as a research baseline, but a logits-distillation pipeline is not a drop-in fit for the current small parametric policy. https://github.com/FabriDeCastelli/dark-experience-replay

No third-party implementation or dataset was copied. The feature-schema migration regression is wired into the learning-replay CI group and passed on exact head `69e921d63e7fa61c863c0cd445b153988a4375f3`.

## Evidence boundary

The selector benchmark measures replay-set composition. The sequential benchmark is synthetic: task A accuracy was 98.75% before a conflicting task, fell to 2.5% after task B, and recovered only to 3.75% after three replay passes; task B remained at 94.375%. This exposes severe forgetting and weak recovery under the tested budget. It does **not** establish real-world task success, causal efficacy, cross-domain transfer or human-like learning. The P26 in-batch score comparison remains a diagnostic and must not be described as an independent task holdout. Promotion decisions need independent verifiers and a frozen, versioned sequential-task holdout.

## Next implementation gate

1. Improve replay/online interleaving and tune retention/plasticity across multiple fixed seeds; current recovery from severe task shift remains weak.
2. Bind holdout registration to runtime-issued verifier receipts and immutable sample manifests, not caller-supplied flags alone.
3. Extend the sandboxed memory-to-action benchmark with corrected preferences, superseded facts, ambiguity, false feedback and restart/replay.
4. Compare no-memory, online-only, recent-only, priority-only and stratified replay on identical task seeds.
5. Report pass rate, retention, transfer, stale-fact use, abstention, latency and memory cost separately with paired intervals; test on target local hardware before claiming production improvement.


## WorkPass105 — bounded conflict-screening cost and research implications

- Runtime code: `P26TrueLearningEngine.trainInterleaved` now caps per-action conflict candidates at 64 by default (configuration clamped to 8–128). Conflict comparisons are counted and returned with the result so runtime/benchmarks can report the work performed.
- Regression: sequential benchmark asserts comparisons do not exceed `replayRows × conflictCandidateCap` in both the contradictory-context and separable-context experiments. The existing `test:learning-replay` workflow already executes this benchmark; no parallel learner or dependency was introduced.
- **Limitation:** deterministic representative sampling reduces cost but is approximate. It can miss contradictory current examples not included in the sample; it must not be treated as an authoritative safety/provenance filter. Follow-up work should measure false-negative/false-positive rates against exhaustive screening across fixed seeds and compare latency.
- **Research comparison:** the 2026 PMLR paper *Replay can provably increase forgetting* is a warning against assuming replay always helps; it strengthens the decision to report old-task retention and new-task plasticity separately. ARROW uses complementary short-term and long-term buffers for distribution matching; A2ER/O2S focuses on balancing consolidation and plasticity with bounded resources. NK1 currently adapts conflict gating and boundedness, not their full model/training stacks. Sources: https://proceedings.mlr.press/v330/mahdaviyeh26a.html ; https://github.com/Cerenaut/ARROW ; https://doi.org/10.3389/frai.2026.1649239
- No external code or datasets copied. Current score remains **58/100**; no task-quality uplift is claimed from this efficiency change.


## WorkPass106 — multi-seed policy comparison

- Added a three-seed sweep across online-only and three replay schedules (1:8, 1:4, and 1:1 fresh-to-replay cadence) on context-separated task shifts. Each run records old-task accuracy before/after, new-task accuracy, retention delta, replay update count, blocked/eligible history and conflict-screening comparisons.
- Wired the new sweep into `test:learning-replay` and therefore into the existing WorkPass79 cognitive regression workflow. The benchmark uses fixed deterministic seeds and checks bounded comparison work; it does not treat synthetic scores as generalization evidence.
- This experiment is designed to expose the consolidation/plasticity Pareto frontier, not assume a denser replay ratio is better. Results must be read from the exact-head Actions logs before tuning defaults.
- Current scorecard remains **58/100 overall**, **40% evidence maturity**, **32% end-to-end continual-learning scope** until the run passes and evidence is reviewed. No external code/datasets copied.
