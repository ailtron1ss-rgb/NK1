# WorkPass119 — Skill retrieval, outcome reflection and active curriculum

## Why this pass is broader than replay
WorkPass118 added adaptive replay mechanics. This pass adds three other learning capabilities and wires them into the existing P23 engine: retrieval over validated skills, structured hypotheses from outcome patterns, and ranking of next learning targets. This avoids treating one replay algorithm as the whole learning architecture.

## Research and source comparison
- [SR-Agents / SRA-Bench](https://github.com/oneal2000/SR-Agents): skill-retrieval augmentation distinguishes retrieval of reusable capabilities from retrieval of factual knowledge. Adaptation: retrieve a bounded, evidence-ranked subset, provide reasons, and suppress weakly supported/candidate skills.
- [SkillLearnBench](https://arxiv.org/abs/2604.20087) and [its source](https://github.com/cxcscmu/SkillLearnBench): evaluate skill quality, trajectories and end-task outcomes; paper reports no single method wins consistently and warns that self-feedback alone can drift. Adaptation: reflection produces hypotheses and requested evidence, not automatic promotion.
- [Voyager](https://github.com/MineDojo/Voyager): reusable skill library, automatic curriculum and feedback-driven iterative repair. Adaptation: next-target ranking and skill retrieval, without importing its Minecraft-specific runtime.
- [STATE-Bench](https://opensource.microsoft.com/blog/2026/05/19/introducing-state-bench-a-benchmark-for-ai-agent-memory/): measure whether memory improves task completion, reliability and efficiency rather than only whether retrieval works. Adaptation: future evaluation should compare task outcomes, verification cost and repeated turns.
- [MemSkill](https://github.com/ViktorAxelsen/MemSkill): learning memory-operation skills from difficult cases. Candidate for a later memory-specific pass; not copied here.
- [SkillRL](https://github.com/aiming-lab/SkillRL): hierarchical reusable skills from prior experience. Candidate for later hierarchical skill representation; not copied here.
- [Memento-Skills](https://github.com/gemacjr/memento-skills): deployment-time skill evolution via task feedback. Candidate for controlled skill revision, but automatic mutation needs sandboxing and independent evaluation before production use.
- Prior WorkPass118 references remain relevant: Avalanche, Tianshou/PER, Letta, Mem0, Generative Agents, Reflexion, LangGraph, OpenHands, SB3, CleanRL, TRL, RLlib, MemoryBank and continual-skill benchmarks.

These references are design candidates, not a claim that every repository was exhaustively audited or vendored. No third-party runtime code was copied in this pass. Check exact revisions and license terms before future vendoring.

## Cross-component integration defect found and fixed
- The process supervisor emits execution receipts with schema version 2 and the execution coverage audit also requires version 2, but the outcome-evidence bridge rejected every receipt except schema version 1. This made a clean real process receipt unable to reach the verified outcome ledger. The bridge now requires schema version 2, and the existing execution-evidence regression explicitly rejects schema version 1.

## Implemented
- `SkillRetrievalAugmentation.ts`: feature-position context similarity for six-bucket state keys; filters candidate skills without sufficient validation; ranks by contextual match, held-out success, evidence volume, confidence, recency and prior use; returns reasons; bounds retrieval and reduces duplicate context/action results; computes small positive/negative transfer bias.
- `OutcomeReflectionCurriculum.ts`: groups experiences by context/action, diagnoses prediction gap, low outcome, repeated failure and surprise; proposes controlled repair and states the independent evidence needed; ranks learning targets with blocked prerequisites excluded.
- `P23LearningEngine.ts`: uses retrieved skill bias before the conservative legacy transfer fallback; exposes `reflectionHypotheses()` and `recommendLearningTargets()`; includes both in `learningSummary()`.
- Added a regression script and wired it into package scripts and the learning workflow.

## Boundaries and risks
- Reflection and curriculum scores are heuristics; they are not proof of intelligence or causal improvement.
- The context matcher assumes the current six-bucket key format. Other key formats only match exactly.
- Retrieved skill transfer bias is intentionally small; do not increase it without a matched-seed test.
- The engine's ordinary recorded outcomes are not automatically transformed into verified-ledger outcomes. Evidence authentication and end-to-end verified intake remain separate work.
- No claim of CI success is made until the exact head has completed its workflow.

## Next code priorities
1. Run CI and correct any failures before merging.
2. Add an end-to-end verified-outcome adapter that binds artifact digests and verifier identity, then feeds eligible experiences into the live learner.
3. Evaluate no-memory / memory-only / retrieved-skill / reflection-curriculum variants on the same task manifest and seeds.
4. Add explicit skill revision proposals in a sandbox with rollback, rather than allowing reflection to rewrite live skills directly.
5. Extend evaluation beyond success rate: calibration, transfer to unseen task families, retention after reset, number of retries, verifier cost and latency.
