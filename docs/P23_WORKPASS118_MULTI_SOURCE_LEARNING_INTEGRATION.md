# WorkPass118 — Multi-source learning integration

## Source survey: 20 projects/papers reviewed as design references
1. [Avalanche](https://github.com/ContinualAI/avalanche) — reservoir replay and continual-learning strategies.
2. [Tianshou](https://github.com/thu-ml/tianshou) — prioritized replay and importance weights.
3. [Prioritized Experience Replay](https://arxiv.org/abs/1511.05952) — learning-signal-based replay priority.
4. [SkillLearnBench](https://github.com/cxcscmu/SkillLearnBench) — task outcomes, trajectories and skill evaluation.
5. [AgentMemoryBench](https://github.com/solomoon313/AgentMemoryBench) — memory/replay/transfer/repair evaluation themes; license requires checking before vendoring.
6. [XSkill](https://github.com/thu-ml/xskill) — skill/action experience separation; canonical repository and license need exact-revision confirmation.
7. [Letta](https://github.com/letta-ai/letta) — stateful agents and persistent memory lifecycle.
8. [Mem0](https://github.com/mem0ai/mem0) — memory extraction, update and retrieval lifecycle.
9. [Generative Agents](https://github.com/joonspk-research/generative_agents) — salience, reflection and retrieval.
10. [Voyager](https://github.com/MineDojo/Voyager) — accumulated executable skills and feedback.
11. [Reflexion](https://github.com/noahshinn/reflexion) — iterative outcome feedback.
12. [LangGraph](https://github.com/langchain-ai/langgraph) — checkpointed stateful workflows.
13. [OpenHands](https://github.com/All-Hands-AI/OpenHands) — task execution and outcome feedback.
14. [Stable-Baselines3](https://github.com/DLR-RM/stable-baselines3) — reproducible RL baselines and stable interfaces.
15. [CleanRL](https://github.com/vwxyzjn/cleanrl) — compact algorithm implementations and ablations.
16. [Berkeley Continual Learning Benchmark](https://sky.cs.berkeley.edu/project/continual-learning-bench/) — sequential retention and transfer evaluation.
17. [ContinualSkillBench](https://arxiv.org/abs/2608.03874) — skill acquisition, forgetting and transfer.
18. [MemoryBank](https://github.com/zhongwanjun/MemoryBank) — long-term memory and forgetting-aware retrieval.
19. [Hugging Face TRL](https://github.com/huggingface/trl) — preference/outcome learning interfaces; heavyweight training stack not imported.
20. [Ray RLlib](https://github.com/ray-project/ray) — distributed RL patterns; orchestration overhead not imported.

This is a mechanism-level survey, not a claim that all 20 repositories were vendored or that every license was cleared. We avoid copying large unrelated runtimes. Existing Avalanche/Tianshou replay primitives already have attribution in UpstreamReplayPrimitives.ts; this pass adds independent TypeScript adaptations and keeps upstream licenses/source provenance separate.

## Code changes
- Added MultiSourceLearningMechanisms.ts with replay priority, adaptive batch/budget, bounded PER-style weighting, adaptive learning rate, Bellman target, Wilson lower confidence bound, evidence-gated promotion/rollback, curriculum ranking, deterministic task split, evidence identity, transfer confidence, forgetting risk, repair opportunity, calibration and retention deltas.
- Wired replay scoring and adaptive budget into the live P23LearningEngine.replayPending path; the existing selector remains the final bounded selector.
- Added regression coverage for resource limits, replay ranking, promotion and rollback, curriculum, transfer, forgetting, repair and deterministic identity/splits.
- No score increase is claimed until CI runs and matched-seed task-stream evaluation measures improvement.
