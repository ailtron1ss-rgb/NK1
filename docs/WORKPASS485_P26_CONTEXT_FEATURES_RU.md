# WorkPass485 — Explicit cognitive-state context features

**Date:** 2026-10-27  
**Status:** implementation committed; Core regression and P26 validation required.

The sequential-learning regression showed that replay scheduling and a persistent replay cursor were necessary but insufficient to retain the old task. The parameterized policy already represented continuous energy/novelty and their product, but it lacked an explicit basis for the threshold-separated context tested by continual learning.

Added three named policy features:
- `energyBelowHalf`
- `noveltyBelowHalf`
- `energyNoveltyClassInteraction`

They are appended after the existing `actionCost` feature, which remains addressed by semantic feature name. This keeps prior action-cost weights stable during snapshot migration. New feature weights initialize to zero, so old snapshots retain their prior behavior until subsequent training supplies evidence for the new features.

The schema migration test now verifies the 21-feature version, unchanged legacy action-cost weight, zero initialization of new features and separation of two novelty contexts. The sequential benchmark logs its context-aware result before asserting the existing unchanged performance thresholds. Synthetic benchmarks are diagnostic only; they do not prove external-task generalization.


## Follow-up — WorkPass487

The first regression run demonstrated that the added context features separated the context-aware tasks (both synthetic accuracies reached 1.0), but adding three full-weight terms to the shared feature norm slowed post-hoc replay recovery. The policy trainer now discounts only their contribution to the normalization denominator (0.25 multiplier) while retaining unscaled feature gradients. This aims to preserve legacy update magnitude while learning the extra basis; re-run Core CI remains the validation gate.
