# V124 Research Sources

1. Mamba-3 — richer recurrence, complex-valued state tracking and MIMO; official implementation: https://github.com/state-spaces/mamba/blob/main/mamba_ssm/modules/mamba3.py ; paper: https://arxiv.org/abs/2603.15569
2. Gated DeltaNet-2 — decoupled channel-wise erase/write gates and distinct recurrent kernels: https://github.com/NVLabs/GatedDeltaNet-2/blob/main/lit_gpt/gdn2.py
3. Sparse Delta Memory — large sparse product-key memory with gated delta updates: https://github.com/facebookresearch/sparse-delta-memory
4. Hierarchical Memory Mamba — explicit motivation for overcoming fixed recurrent-state representation bottlenecks: https://arxiv.org/abs/2608.02347
5. Elastic Memory — compressive recurrent memory aimed at long-context online function approximation: https://arxiv.org/abs/2602.11212
6. Titans — learned test-time long-term memory combined with short-term attention: https://arxiv.org/abs/2501.00663
7. Continual plasticity / consolidation review: https://arxiv.org/abs/2405.16922

## V124 admission decision

Исследование использовано для выбора направления, но ни один внешний механизм не был промотирован только по названию или по наличию кода upstream. Все current изменения реализованы локально и прошли собственную qualification.
