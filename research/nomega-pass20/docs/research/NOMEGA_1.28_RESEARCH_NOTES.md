# NΩ 1.28 Research Notes

## 2026 research inputs

1. Kong & Sutton, *Plasticity of Growing and Elastic Neural Networks in Online Continual Learning* (2026-08-02, arXiv:2608.01475). The paper reports that adaptive growing networks can preserve plasticity in online continual learning and that elastic networks can grow new units while pruning estimated dead units to keep a compact size. NΩ 1.28 therefore treats structural growth/pruning as a gated research mechanism, not an unconditional self-edit. https://arxiv.org/abs/2608.01475

2. Zhou et al., *Self-Evolving Coding Agents* (2026-08-04, arXiv:2608.03392). The survey emphasizes executable feedback, repository-level context and coding trajectories as distinctive evidence sources for self-evolution, while highlighting risks including benchmark overfitting, feedback unreliability, safety and maintainability. NΩ 1.28 follows this pattern by requiring executable verification and explicit provenance for repair outcomes. https://arxiv.org/abs/2608.03392

3. Kini, *NeuroSynth: A Biologically Inspired Continual Reinforcement Learning Architecture for Mitigating Catastrophic Forgetting* (2026-07-24, arXiv:2607.28663). The work motivates separating rapid acquisition from slower consolidation. NΩ already has replay/anchor machinery from 1.26; 1.28 keeps repair learning separate from long-term promotion so a fast successful repair cannot silently overwrite stable capabilities. https://arxiv.org/abs/2607.28663

## Design decision

The neural repair policy is advisory. The verifier remains authoritative. Structural plasticity is transactional and can be rolled back when equal-budget utility does not improve. This avoids treating a learned predictor as a correctness oracle.
