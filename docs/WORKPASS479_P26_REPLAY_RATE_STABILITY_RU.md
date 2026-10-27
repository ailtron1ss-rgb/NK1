# WorkPass479 — Stabilizing P26 interleaved replay

**Date:** 2026-10-27  
**Status:** implementation committed; CI re-run pending.

## Observed failure

The broad core regression exposed a deterministic synthetic sweep failure: `interleave-1`, seed 17, new-task accuracy **0.52** against an existing threshold of **0.60**. Other tested interleave schedules passed. The test threshold was not lowered.

## Change

`P26TrueLearningEngine.trainInterleaved()` now scales the requested per-replay learning rate when replay occurs more often than once every four current examples:

```text
effectiveReplayRate = requestedReplayRate × min(1, replayEveryNCurrent / 4)
```

This caps replay's aggregate learning-rate contribution per current update at the high-frequency end. Intervals of four or more retain the requested replay rate; an interval of one uses one quarter of that rate.

## Why this is preferable

- Fresh task learning remains the primary signal when replay frequency is maximal.
- Lower-frequency replay semantics remain unchanged.
- The regression's minimum new-task performance stays at 0.60.
- No benchmark threshold was relaxed and no independent/generalization evidence is fabricated.

## Validation

Run the existing `npm run test:p26:replay-policy-sweep`, P26 Learning Validation workflow and NeuroCore core regression workflow. Until the latest-head runs complete successfully, this is an implementation change awaiting validation, not a claimed fix.
