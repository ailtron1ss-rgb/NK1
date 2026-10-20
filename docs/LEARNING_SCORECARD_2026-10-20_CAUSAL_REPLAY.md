# NK1 learning scorecard — causal replay pass (2026-10-20)

**Branch:** `rebuild`  
**Scope:** P26 parametric learner + causal-experience replay path  
**Status:** code and regression suite passed on exact code head `db5f1a0850d9987ffec3ffe0f449c8ef97fb0c48`; documentation updates trigger a fresh run.  
**Interpretation:** percentages are engineering coverage estimates, not measured intelligence or task-success rates.

## Progress estimates

- P26 replay/holdout instrumentation implementation coverage: **70%** (engineering estimate, not a measured success rate).
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
| Contextual transfer | 58 | External-task and cross-domain holdout evidence |
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

## Evidence boundary

The selector benchmark measures replay-set composition. The sequential benchmark is synthetic: task A accuracy was 98.75% before a conflicting task, fell to 2.5% after task B, and recovered only to 3.75% after three replay passes; task B remained at 94.375%. This exposes severe forgetting and weak recovery under the tested budget. It does **not** establish real-world task success, causal efficacy, cross-domain transfer or human-like learning. The P26 in-batch score comparison remains a diagnostic and must not be described as an independent task holdout. Promotion decisions need independent verifiers and a frozen, versioned sequential-task holdout.

## Next implementation gate

1. Improve replay/online interleaving and tune retention/plasticity across multiple fixed seeds; current recovery from severe task shift remains weak.
2. Bind holdout registration to runtime-issued verifier receipts and immutable sample manifests, not caller-supplied flags alone.
3. Extend the sandboxed memory-to-action benchmark with corrected preferences, superseded facts, ambiguity, false feedback and restart/replay.
4. Compare no-memory, online-only, recent-only, priority-only and stratified replay on identical task seeds.
5. Report pass rate, retention, transfer, stale-fact use, abstention, latency and memory cost separately with paired intervals; test on target local hardware before claiming production improvement.
