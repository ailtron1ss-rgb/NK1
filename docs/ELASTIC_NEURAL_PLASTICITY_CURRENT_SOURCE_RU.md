# Elastic Neural Plasticity — current-source integration

- P26 gains opt-in sparse policy updates; ordinary SGD remains unchanged.
- The controller enforces parameter allowlists, protects identity/action-cost coordinates, bounds coordinate count and L2 delta, scores retention importance using Fisher/ablation estimates, blocks duplicate identities/stale proposals, and supports one-shot compare-and-restore rollback.
- Staged proposals do not mutate live weights. Commit is gated by the module-created P29 governance instance and existing conflict/resource-budget arbitration.
- P26/P28/P29/P30 checkpoint projection and runtime train/rollback methods are included.

Evidence boundary: caller-supplied holdout pairs are local preflight, not independently authenticated generalization or delayed-retention evidence. No arbitrary LLM tensor fine-tuning, automatic production activation or measured performance gain is claimed.

Provenance: selectively adapted from historical PR #923. Its donor branch was 412 commits behind current source; the old branch history and unrelated edits were not merged. Current learning owners were retained and extended.
