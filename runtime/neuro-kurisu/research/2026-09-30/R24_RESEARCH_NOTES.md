# R24 Research Notes — 2026-09-30

## Long-horizon world-model evaluation

- WorldPrediction: https://arxiv.org/abs/2506.04363 — evaluates high-level world modeling and procedural planning, including ordered action sequences and counterfactual distractors.
- PlayWorld: https://arxiv.org/abs/2608.13552 — long-horizon objective-driven interaction benchmark with persistent state evolution and action controllability.
- FF-JEPA: https://arxiv.org/abs/2606.09311 — motivates hierarchical decomposition for long-horizon planning instead of relying on flat rollout depth.

## R24 implementation consequence

The project therefore keeps three distinct evidence layers:
1. one-step transition/reward fit;
2. bounded multi-step rollout correctness at horizons 5–8;
3. future work for hierarchical goal decomposition when flat rollout regret remains above baseline.

## Memory causal evaluation

R24 introduces a retained-control A/B harness instead of assigning causal credit to post-eviction retrieval statistics. The benchmark compares identical experience streams and identical query streams under a non-binding control budget vs a bounded treatment budget.

The harness is deliberately separate from the canonical memory store because the control arm must retain information that the treatment arm is allowed to forget.
