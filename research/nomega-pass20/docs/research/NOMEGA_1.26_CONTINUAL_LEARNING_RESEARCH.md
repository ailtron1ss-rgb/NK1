# NΩ 1.26 Continual Learning Research Basis

Date: 2026-09-21

## Research signals used

1. Wang, Chandra & Zhang, **Experience Replay Addresses Loss of Plasticity in Continual Learning** (arXiv:2503.20018, 2025). The work reports that replay can materially reduce loss of plasticity in several continual-learning settings. NΩ therefore measures replay as an experimental intervention rather than assuming that replay is universally sufficient.
   https://arxiv.org/abs/2503.20018

2. He et al., **Spectral Collapse Drives Loss of Plasticity in Deep Continual Learning** (arXiv:2509.22335, 2025). The paper connects loss of plasticity with Hessian spectral collapse and motivates preserving effective feature rank / regularization. NΩ 1.26 therefore adds plasticity diagnostics and a fresh-initialized control; structural expansion is kept for the later 1.27/1.28 track instead of hard-coding one remedy.
   https://arxiv.org/abs/2509.22335

3. Liu & Mou, **Do Neural Networks Lose Plasticity in a Gradually Changing World?** (arXiv:2602.09234, 2026). The study reports that some plasticity loss observed in abrupt-task settings is mitigated when the environment changes gradually. NΩ therefore separates shift/novelty detection from the online update decision and records stream phase transitions instead of assuming abrupt task boundaries.
   https://arxiv.org/abs/2602.09234

4. Kong & Sutton, **Plasticity of Growing and Elastic Neural Networks in Online Continual Learning** (arXiv:2608.01475, 2026). The paper studies adaptive growth/shrinkage as a way to preserve plasticity in online continual learning. NΩ 1.26 does not promote structural growth automatically; it records the evidence needed for the later self-optimization stage where structural adaptation can be experimentally compared against fixed-size baselines.
   https://arxiv.org/abs/2608.01475

## Engineering consequences for NΩ 1.26

- Immutable holdout/OOD/regression fingerprints prevent silent benchmark drift.
- Replay selection includes uncertainty, transfer, interference, diversity, recency and anchor protection, with an explicit negative-transfer veto.
- Gradient conflict is measured separately from behavioral damage; promotion depends on external evaluation.
- Functional anchor loss is optional and controlled, so it can be compared against a no-anchor baseline.
- Online adaptation is transactional: snapshot → update → evaluate → commit/rollback.
- Restart equivalence is checked by saving a model checkpoint, reloading into a fresh process/model instance, and replaying the same evaluation bundle.
- The benchmark includes a fresh-initialized control so incumbent adaptation efficiency is not confused with raw loss reduction.

## Important interpretation rule

NΩ 1.26's auxiliary continual-learning benchmark is evidence about the adaptation machinery. It is not by itself sufficient to promote the project's main neurality ladder from N1 to N2/N3. Main neurality milestones still require the NOMEGA execution-learning benchmark to demonstrate held-out verified gains using its own verifier/evidence stack.
