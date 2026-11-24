# RESEARCH REVIEW B1101–B1350 — 16.09.2026

## 1. Selective episodic memory

EMA (ACL 2026) uses episodic memory units plus a learned filtering module to reduce irrelevant context and improve efficiency. This motivated the explicit memory-manager and selective retrieval layer in B1350.

Source: https://aclanthology.org/2026.findings-acl.250/

## 2. Learned memory operations

Memory-R1 (ACL 2026) models memory management as learned ADD / UPDATE / DELETE / NOOP operations rather than fixed storage heuristics. B1350 adopts this idea in a bounded computational form.

Source: https://aclanthology.org/2026.acl-long.583/

## 3. Meta-cognitive memory abstraction

MCMA treats abstraction level as a learnable memory-management skill and organizes memories hierarchically for transfer under distribution shift. B1350 implements episodic → schema abstraction and transfer weighting.

Source: https://aclanthology.org/2026.findings-acl.1535/

## 4. Adaptive world-model lookahead

Imagine-then-Plan proposes adaptive imagination horizons rather than fixed-length simulation. B1350 therefore scales lookahead depth with uncertainty/complexity budget.

Source: https://arxiv.org/abs/2601.08955

## 5. When world models fail

ACL 2026 evidence shows that giving an agent a world model does not guarantee useful foresight; deciding when to simulate and how to integrate simulation can be the bottleneck. B1350 therefore couples lookahead with budget, verifier and downstream action bias instead of exposing a raw simulator output.

Source: https://aclanthology.org/2026.acl-long.623/

## 6. Counterfactual credit assignment

C3 uses context-matched counterfactual alternatives and fixed-continuation replay to isolate decision-level causal contribution. B1350 uses a lightweight leave-one-out action baseline to drive alternative-action credit without requiring a large external RL framework.

Source: https://arxiv.org/abs/2603.06859

## 7. Continual learning / replay / alignment

Replay and gradient-alignment techniques have empirical support for reducing forgetting under distribution shift in continual learning. B1350 retains bounded replay and uses task-aware retrieval and protected schema state rather than replaying everything equally.

Source: https://arxiv.org/abs/2508.01908

## 8. Automated curriculum

Current recursive self-improvement literature continues to emphasize curriculum selection as a key bottleneck: the learner should spend compute where it has learning value rather than uniformly sampling experience.

Reference discussion: ICLR 2026 Workshop on AI with Recursive Self-Improvement: https://openreview.net/pdf?id=HuLoDnvC29

## 9. Proposed next experimental combination

The highest-value next combination is not simply “more modules”. It is:

`hidden-task factors → causal intervention → adaptive lookahead → selective memory → abstraction → self-generated curriculum → neural consolidation → long-horizon holdout`

The project should measure:

- recovery time after hidden rule changes;
- sample efficiency;
- forgetting of previously mastered tasks;
- cross-task transfer;
- calibration of world-model confidence;
- causal lesion strength;
- mobile resource cost.

Published benchmark gains are not directly transferable to Neuro-Kurisu. Any claimed improvement must be reproduced on project-local matched controls.
