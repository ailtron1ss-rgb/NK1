# RELEASE 35.6.67 — P2551–P2558 Embodied Causal Memory / Selective Foresight

## Main change
A new `AdaptiveCausalMemoryPlanner` is integrated into the canonical `NeuralExperienceBranch`.

## Functional upgrades
1. Delayed outcome credit for retrieved memories.
2. Action-conditioned semantic world rules.
3. Similar-context causal matching and transfer.
4. Matched counterfactual evidence.
5. Selective foresight based on confidence/disagreement.
6. Bounded epistemic action residual.
7. Outcome-updated action value/confidence.
8. Persistent planner state and restart verification.

## Research retention
Research for this release is stored under `research/2026-09-18/P2551_P2558/`.

## Verification
- typecheck: PASS
- P2551–P2558 lab: PASS
- NeuralExperienceBranch integration: PASS
- planner performance: PASS
- previous release neural/runtime regression suite: PASS (see final audit)
- architecture/hygiene/integrity/contract/source audits: executed for release

## Known limitations
- Semantic rules are lightweight online rules, not a full Bayesian world model.
- PPO/GRPO are not embedded into the mobile runtime.
- External sensory/embodied grounding remains a major future branch.
- Existing legacy mobile durability issue B320 remains outside this pass and is not attributed to P2551–P2558.

## Honesty rule
No claim is made that the organism has subjective consciousness or human-level intelligence.
