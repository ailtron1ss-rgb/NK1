# V121 research basis

- Gated DeltaNet-2: channel-wise erase/write/decay и chunkwise/hardware-efficient implementation.
  https://github.com/NVlabs/GatedDeltaNet-2
- Mamba-3: более выразительная state dynamics, complex-valued recurrence, MIMO и hardware-aware kernels.
  https://github.com/state-spaces/mamba
- Raven: sparse routed persistent state с редактированием выбранных memory slots.
  https://arxiv.org/abs/2607.25357
- Sparse Delta Memory: sparse product-key addressing + gated delta rule, расширяющие effective memory capacity.
  https://github.com/facebookresearch/sparse-delta-memory
- TTTLA: анализ TTT/KV binding как learned linear attention; полезен как аргумент в пользу объединения дублирующих memory/update механизмов.
  https://arxiv.org/abs/2602.21204
