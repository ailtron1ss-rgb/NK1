# B309 Architecture Decisions

1. `AdaptivePolicyEngine` remains the single canonical adaptive policy learner.
2. `B297ExecutiveNeuralFusion` becomes the canonical arbitration boundary for adaptive policy influence.
3. The former early-utility adaptive bias is removed to avoid counting the same policy evidence twice.
4. Source redundancy is handled dynamically inside B297 instead of creating another deduplication subsystem.
5. Policy remains lesion-able as a first-class source.
6. Persistence schema remains 127; B309 state is additive and backward-compatible.
7. No new neural substrate is introduced; B296/B269 remain the neural execution evidence anchors.
