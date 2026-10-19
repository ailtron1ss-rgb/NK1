# NeuroCore V143 Release Notes

## Release
`1.43.0`

## Main changes
- FwPKM candidate improved with cosine-equivalent IDW routing (avoids `cdist`).
- Correct weighted routing-mass normalization for fast-state rewrites.
- Differentiable local rewrite objective for actual slow codebook gradients.
- New research-only `FwPKMLanguageBridge` connecting FwPKM to the byte-language path.
- Bridge residual logits are zero-initialized, so creation is behaviorally neutral.
- Capacity/revision benchmark and real-text bridge benchmark included.

## Evidence
- 8/8 V143 tests pass.
- 3-seed shared-state FwPKM benchmark: mean recall 0.96282 after 256 distractors.
- Revision: new-value cosine 0.95498 mean; old-value cosine 0.26719 mean.
- IDW route microbenchmark: ~1.185x faster than previous `cdist` implementation in the CPU control environment.
- Real-text bridge initial delta loss = 0.0 because bridge is zero-initialized; no language promotion is claimed.

## Status
FwPKM remains `CANDIDATE`; language bridge remains `PENDING / NO PROMOTION`.
Canonical memory ownership remains singular.
