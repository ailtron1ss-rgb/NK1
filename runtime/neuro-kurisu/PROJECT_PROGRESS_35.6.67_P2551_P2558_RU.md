# Neuro Kurisu — Progress 35.6.67 / P2551–P2558

## Goal
Развивать автономный искусственный организм как единый continuously-learning neural system с памятью, world model, self/goal coupling, causal action learning, persistence и возможностью дальнейшего embodied grounding.

## Code-first work share
- 86% — executable code + integration + tests
- 9% — regression/profiling/audit
- 5% — research retention/release artifacts

## New executable code
### `AdaptiveCausalMemoryPlanner.ts`
- delayed memory outcome credit;
- action-conditioned semantic transition rules;
- similar-context causal matching;
- transfer scoring;
- selective foresight;
- epistemic action residual;
- action-value/confidence learning;
- persistent causal trace ledger.

### `NeuralExperienceBranch.ts`
- planner integrated before decision;
- selected memory IDs carried into experience token;
- outcome fed back into planner;
- memory utility credit returned to canonical memory manager;
- causal/transfer/foresight diagnostics persisted.

### `AdaptiveNeuralContinuityController.ts`
- public `applyMemoryCredit()` closes delayed causal feedback into memory utility.

## Results
### P2551–P2558 causal-memory lab
- 2400 updates
- 4 learned semantic rules
- 256 retained traces
- 11,394 matched causal comparisons
- transfer01 = 0.9567
- causalSensitivity01 = 0.2141
- longHorizonConsistency01 = 0.9200
- retained foresight = 2400

### Neural integration
- 360 cycles
- 15 learned semantic rules
- causalSensitivity01 = 0.1552
- transfer01 = 0.9055
- foresightQuality01 = 0.8878
- computeCost01 = 0.4196
- restart preserved planner rules and transfer state

### Performance
- 20,000 planner cycles
- ~23,379 cycles/s local Node microbenchmark
- 239,916 matched causal comparisons

## Scores
- Engineering maturity: 83/100
- Toward artificial organism: 73/100
- Neural branch: 89/100
- Neural continuity: 85/100
- Memory architecture: 84/100
- Temporal learning: 85/100
- Causal action learning: 73/100
- World model: 79/100
- Semantic world memory: 68/100
- Anti-forgetting: 73/100
- Adaptive compute: 68/100
- Autonomy/goal coupling: 73/100
- Personality coupling: 66/100
- Persistence: 90/100
- External grounding: 48/100
- Android feasibility: 62/100
- Consciousness-related functional substrate: 34/100

## Remaining bottlenecks
1. B2521 generative loop still has low coverage and only moderate accuracy.
2. Full runtime RSS remains high.
3. External sensory/embodied grounding is still weak compared with internal simulated experience.
4. Causal ownership needs stronger matched-action ablation tests.
5. Semantic world rules are intentionally lightweight and should next be compared with a compact learned latent rule model.

## Honesty
These results are controlled engineering experiments. They do not prove subjective consciousness, biological equivalence, or human-level intelligence.
