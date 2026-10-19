# NΩ 1.0+ Research Roadmap

## Phase A — Generalization
- Expand task generator diversity and compositionality.
- Generate adversarial holdouts that deliberately break lexical shortcuts.
- Train on execution traces from actual NΩ experts.
- Add program-equivalence and counterexample-driven learning.

## Phase B — Joint cognition
- Jointly optimize latent representation + router + NeuralInvent + verifier-aware reward.
- Train retrieval against outcome usefulness, not raw similarity.
- Convert repeated verified traces into reusable executable skills.
- Add learned tool selection with tool-specific correctness tests.

## Phase C — Memory and continual learning
- Prioritized replay from mistakes and rare skills.
- Fisher/EWC + distillation + rehearsal ensemble.
- Detect skill interference before promotion.
- Add skill versioning and rollback lineage.

## Phase D — Planning/world model
- Multi-step learned transition model.
- Counterfactual planning with verifier feedback.
- Search over latent + symbolic actions.
- Calibrate model uncertainty against actual planning failures.

## Phase E — Multimodality
- Real image/audio encoders or compact adapters trained with contrastive alignment.
- Cross-modal retrieval evaluation.
- Grounded tool actions.
- Distribution-shift tests.

## Phase F — Mobile deployment
- Actual Android/Termux runtime benchmark.
- INT8 and mixed-precision kernels.
- KV/cache and activation memory profiling.
- Battery/thermal measurements.
- Dynamic quality/latency policies per device class.

## Phase G — Research frontier
Experimental tracks should remain isolated and falsifiable: recurrent-state alternatives, novel routing objectives, verifier-guided generation, program-memory consolidation, and other theoretically motivated architectures.
