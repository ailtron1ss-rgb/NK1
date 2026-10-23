# NK1 learning: Pareto-frontier curriculum (2026-10-23)

## What changed

The P23 active-learning curriculum can now rank targets with the `pareto-frontier` strategy. It computes non-dominated layers over six normalized objectives: uncertainty/information value, readiness, transfer evidence, novelty, repair value, and lower verification cost. A bounded (n ≤ 512), deterministic O(n²) dominance graph keeps candidate selection practical and reproducible. Targets in earlier layers are considered before dominated alternatives; scalar score and code-unit ID ordering remain tie-breakers. Blocked targets are placed after eligible targets.

The default `weighted-score` behavior remains available for existing callers. P23 recommendations explicitly use Pareto-frontier mode. Curriculum families now identify the diagnosed failure mechanism (`reflection:<failure-kind>:<action>`) or verification debt (`verification-debt:<action>`) so the queue does not mistake two learning intents as one family just because they call for the same action.

## Why this adaptation

- **GEPA** reads trajectory feedback to diagnose why a candidate failed and preserves Pareto-optimal candidates with complementary strengths instead of collapsing every outcome into a single scalar. NK1 adopts the *selection principle*, not GEPA's Python optimizer or its execution environment.
- **Hermes Agent Self-Evolution** separates trace-driven diagnosis, variant generation, constraint checks and holdout evaluation before proposing a change. NK1 keeps its existing signed evidence, independent evaluator, validation/holdout and explicit activation approval as stronger runtime boundaries.
- **CleanRL** emphasizes reproducible, seeded experiments. This change is deterministic and adds no random selection or new dependency.

## Sources inspected

- GEPA implementation and design (MIT): https://github.com/gepa-ai/gepa
- GEPA reflective optimization paper / ICLR 2026: https://proceedings.iclr.cc/paper_files/paper/2026/hash/0e9e708b6f48e14fd0ac29e167413f76-Abstract-Conference.html
- Hermes Agent Self-Evolution (MIT): https://github.com/NousResearch/hermes-agent-self-evolution
- Hermes skill evolution source inspected: https://github.com/NousResearch/hermes-agent-self-evolution/blob/main/evolution/skills/evolve_skill.py
- Hermes evaluation workflow plan (train/validation/holdout and human approval): https://github.com/NousResearch/hermes-agent-self-evolution/blob/main/PLAN.md

No upstream source file was copied verbatim. The new TypeScript implementation adapts the Pareto-selection concept to NK1's existing normalized learning targets and trust boundaries. No Python/DSPy/GEPA runtime dependency was added because the NK1 learning runtime is TypeScript and already owns independent evaluation, signed receipts and promotion gating.

## Safety and completion boundary

This selector only prioritizes experiments. It does not verify outcomes, approve candidates, change active skills, or bypass the canonical promotion gate. It does not claim that the organism is conscious or that learning quality improved; those require behavioral and empirical validation.

## Targeted validation

Run from `runtime/neuro-kurisu`:

```sh
npm run test:p23:learning
npm run typecheck
```

Validation is pending until these commands or the exact-head GitHub Actions runner complete successfully.
