# WorkPass488 — Recorded-outcome replay targets

**Date:** 2026-10-27  
**Status:** implementation committed; sequential Core regression pending.

## Defect

P26 replay used `stored reward + 0.78 × max(current-policy(nextState))` for every historical experience. When task B contradicted task A, replaying task A used task B's current estimates to form target values. This contaminated the historical outcome signal and could leave old-task accuracy at zero despite thousands of replay updates.

## Change

- Default `P26TrueLearningEngine.replay()` target is the validated, recorded reward.
- Bellman/TD bootstrapping remains available explicitly with `{ targetMode: 'td', bootstrapWeight01 }`.
- The bootstrap coefficient must be finite and in `[0,1]`; invalid values fail closed.
- Replay still uses the same update rate, metrics, synchronization and stored experiences. The change only makes the learning target explicit and prevents the current policy from silently rewriting historical outcomes.

## Validation

The existing sequential-learning benchmark keeps its original post-hoc recovery and new-task retention thresholds. A green Core regression is required before claiming the fix is validated. This synthetic test does not establish external-task generalization.
