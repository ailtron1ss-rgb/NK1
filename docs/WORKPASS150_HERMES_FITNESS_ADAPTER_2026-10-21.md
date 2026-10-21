# WorkPass150 — Hermes reflective fitness adaptation (2026-10-21)

## Code changes

- Ported the native TypeScript `SkillLearnBenchAdapter` and its behavioral regression suite from the Hermes-inspired WorkPass93 branch onto `workpass135-durable-shadow-run-registry`, preserving the current verified-shadow lifecycle as the base.
- Kept the adaptation dependency-free: no Python/DSPy/GEPA packages are added to the runtime.
- Retained the three weighted dimensions already used by the candidate gate: independently verified task success (50%), trajectory quality (30%), and skill quality (20%).
- The adapter rejects empty reference rubrics, duplicate task/trial evidence, malformed aggregates and unsafe candidates; trajectory completeness penalizes both omitted and unexpected actions.
- Registered the regression command in the runtime package and wired the test into the WorkPass106 verified-promotion workflow path filters and job steps.

## Source provenance

- Hermes Agent: https://github.com/NousResearch/hermes-agent
- Hermes Agent Self-Evolution: https://github.com/NousResearch/hermes-agent-self-evolution
- Fitness design reference: https://github.com/NousResearch/hermes-agent-self-evolution/blob/main/evolution/core/fitness.py
- Evolution-loop reference: https://github.com/NousResearch/hermes-agent-self-evolution/blob/main/evolution/skills/evolve_skill.py
- Adapted native gate lineage: https://github.com/ailtron1ss-rgb/NK1/tree/workpass93-hermes-reflective-learning-gate

The Python reference's LLM-as-judge and GEPA optimizer are not copied into the runtime. The source's heuristic metric can reward keyword overlap without validating correctness, so the current implementation continues to prioritize independent task-verifier evidence and explicit trajectory/skill rubrics.

## Validation status

- IMPLEMENTED: adapter, regression suite, package command and workflow wiring are committed to this branch.
- NOT YET VERIFIED: no test execution, typecheck or exact-head GitHub Actions result is claimed in this report. The PR workflow must provide the evidence.
- OPEN: this is the evaluation mechanism port, not yet proof that the gate is called on every production candidate path or that skills achieve measured independent holdout uplift. The next code pass must connect the evaluator to the verified lifecycle without bypassing the authenticated approval/activation controls, then test stage → shadow run → evaluation → approval → activation/restart.

## Acceptance criteria

1. The P29 regression and runtime typecheck pass on the exact PR head.
2. The current WorkPass135 verified-shadow and authenticated-promotion tests remain green.
3. Candidate evaluation is wired into the sole canonical lifecycle path; no side path can auto-activate a candidate.
4. Holdout evaluation is independently sourced and paired, with task identity and evidence provenance preserved.
5. Any future quality claim cites raw run results and baseline comparison; synthetic regression fixtures alone are not learning-uplift evidence.
