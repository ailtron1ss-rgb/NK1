# NK1 learning scorecard — causal replay pass (2026-10-20)

**Branch:** `rebuild`  
**Scope:** P26 parametric learner + causal-experience replay path  
**Status:** implementation committed; exact-head Actions validation pending after the final evidence-accounting fix.  
**Interpretation:** percentages are engineering coverage estimates, not measured intelligence or task-success rates.

## Progress estimates

- P26 replay-selection implementation coverage: **64%** (prior internal baseline 60%; engineering estimate).
- Outcome-grounded learning evidence maturity: **36%**.
- End-to-end continual-learning ambition across memory, policy, skills and transfer: **30%**.
- Current learning-system engineering score: **58/100** (unchanged overall; this pass strengthens replay selection, not independently verified learning gains).

These are not interchangeable metrics. The implementation percentage tracks presence and wiring of mechanisms; evidence maturity tracks independent outcome/holdout evidence; the 1–100 score summarizes engineering maturity and remaining risks.

## WorkPass100 implementation

1. Added `CausalReplaySampler.ts`, a bounded deterministic replay selector shared by P26 runtime and its benchmark.
2. The sampler validates feature-vector shape, de-duplicates stable experience IDs (keeping the latest tick), guarantees a configurable recent window, then selects high-priority representatives across action/coarse-state strata before filling remaining capacity.
3. Wired `P26TrueLearningEngine.replayCausalRecords` to the shared selector; this replaces the previous “take the first 32” truncation, which could over-represent whichever records happened to be first.
4. Added selector invariants, a recent-only / priority-only / stratified benchmark, npm scripts and the WorkPass79 Actions workflow step.
5. Retained existing P26 online learning and P23 policy ownership; no duplicate learner or parallel memory owner was added.
6. Corrected an evidence-accounting defect: the same-call replay split is now explicitly labelled `in-batch-diagnostic` and no longer increments `generalizationEvidence01`. The test asserts this metric remains unchanged by the diagnostic.

## Aspect scores (engineering estimates)

| Aspect | Score / 100 | Main remaining gap |
|---|---:|---|
| Experience ingestion and finite-value guards | 72 | More independent outcome provenance and correction paths |
| Replay bounds and deterministic behavior | 80 | Runtime-level persistence and load tests under large streams |
| Replay diversity across actions/contexts | 70 | Measure retention/transfer on controlled sequential tasks |
| Priority signal quality | 52 | Priority is heuristic; calibrate against verified utility |
| Skill formation and promotion | 61 | Independent verification must govern all promotion routes |
| Contextual transfer | 58 | External-task and cross-domain holdout evidence |
| Delayed credit assignment | 63 | Validate causal attribution against intervention controls |
| Calibration and uncertainty | 43 | Reliability curves and abstention metrics on holdout |
| Benchmark and baselines | 40 | Synthetic selector proxy and a guard against inflating generalization metrics; independent task outcome benchmark open |
| Persistence and replay idempotency | 69 | Full restart/replay duplication and schema migration campaign |
| Experiment reproducibility | 53 | Versioned data manifests, fixed seeds, paired confidence intervals |

## Research and adaptation choices

- **SkillLearnBench (MIT; COLM 2026):** adapt the separation of skill quality, execution trajectory and verifier-based task outcome. Its full Python/Docker/API benchmark stack is not a drop-in dependency for NK1's TypeScript runtime. Source: https://github.com/cxcscmu/SkillLearnBench
- **XSkill (ICML 2026):** its separation of reusable task skills and action-level experiences is architecturally relevant; adapt the distinction and retrieval/evaluation protocol, not the multimodal API-heavy pipeline wholesale. Source: https://github.com/XSkill-Agent/XSkill
- **RethinkSkill (MIT):** use matched multi-round feedback experiments and preserve candidate/evidence provenance; avoid assuming self-feedback alone improves skill quality. Source: https://github.com/HKUST-KnowComp/rethinkskill
- **AgentSynth (MIT):** use end-state verifiers and seeded scenario packs as a design reference for future outcome-grounded learning tests. Source: https://github.com/agentsynth/agentsynth

No third-party source code or datasets were copied in this pass. Recheck licences and dependencies before importing any implementation.

## Evidence boundary

The new benchmark measures replay-set composition (capacity, recent quota, action/state-stratum diversity, duplicate IDs and priority). It does **not** measure environment task success, causal efficacy, forgetting resistance, cross-task transfer or human-like learning. The P26 in-batch score comparison remains a diagnostic and must not be described as an independent task holdout. Promotion decisions need independent verifiers and a frozen, versioned sequential-task holdout.

## Next implementation gate

1. Add outcome provenance to the learning sample boundary and reject promotion evidence lacking the required verifier/protocol/task identity.
2. Build a sandboxed memory-to-action sequential benchmark with corrected preferences, superseded facts, ambiguous evidence and restart/replay.
3. Compare no-memory, current policy, recent-only, priority-only and stratified replay on identical task seeds.
4. Report pass rate, retention, transfer, stale-fact use, abstention, latency and memory cost separately; use paired intervals.
5. Re-run on the target local model/device before claiming production learning improvement.
