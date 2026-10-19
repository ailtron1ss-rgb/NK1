# V120 Research Memory

## Sparse Delta Memory
Paper: https://arxiv.org/abs/2607.07386
Official implementation: https://github.com/facebookresearch/sparse-delta-memory
Key finding relevant to NeuroCore: sparse product-key addressing expands recurrent state capacity efficiently; the published system reports long-context retrieval gains and a learned-initial-state ablation. Upstream code is CC-BY-NC 4.0; NeuroCore V120 reimplements only the mechanism, not the source code.

## Mamba-3
Paper: https://arxiv.org/abs/2603.15569
Official implementation: https://github.com/state-spaces/mamba/blob/main/mamba_ssm/modules/mamba3.py
Key mechanism used as a candidate: positive heavy-tail activation for data-dependent state dynamics. It is dependency-free here and remains candidate-only.

## HiPPO / S4
Official source: https://github.com/state-spaces/s4
Relevant code path: `models/hippo` and S4 initialization for `legs`. NeuroCore uses an independent LegS-style fixed transition.

## Gradient-Update Alignment
Paper: https://arxiv.org/abs/2609.01558
Official code: https://github.com/JingXiao10/GUA
Relevant lesson: conflict-free pre-optimizer gradients do not imply conflict-free applied optimizer updates.
