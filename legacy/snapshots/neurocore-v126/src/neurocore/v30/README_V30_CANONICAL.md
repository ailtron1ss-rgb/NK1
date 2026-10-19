# NeuroCore V30 — Canonical Organism Integration

V30 is a **causal-integration upgrade**, not a module-count upgrade.

## What changed

1. **True transition timing** — the transition `t-1 -> t` is only written after the current latent `z_t` exists. V29's same-step pseudo-consequence write is removed from the canonical path.
2. **Algorithm routing is action-relevant** — selected transition law output is injected into the fused cognitive state before goal generation and planning.
3. **Planner is action-relevant** — subgoal-conditioned candidates are rolled out through an action-conditioned latent transition model; the selected planned action enters the final policy.
4. **World/Ego/Body** — persistent world, ego-conditioned state, and internal computational resource state are jointly represented and predicted.
5. **Self causal loop** — self-state influences fusion and goal generation; the chosen action updates a predicted next self-state.
6. **Intrinsic goal generation** — uncertainty, novelty, confidence and identity continuity contribute to internally generated goal pressure. External goals remain supported.
7. **Metacognition** — confidence is trained against realized predictive error rather than merely being a renamed network output.
8. **Adaptive horizon** — horizon probabilities weight actual imagined rollouts instead of being an auxiliary side prediction.
9. **Causal intervention tests** — tests explicitly lesion major pathways and check for downstream behavioural/state effects.

## What is deliberately NOT claimed

V30 does not claim consciousness, general intelligence, open-ended autonomy, human equivalence or biological equivalence. It is a research architecture with testable functional properties.

## Promotion rule

A mechanism is not counted as implemented merely because code exists. Canonical promotion requires execution + integration + downstream effect + intervention evidence, with persistence/generalization tested where applicable.
