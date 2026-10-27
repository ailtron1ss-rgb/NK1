# WorkPass479 — P26 replay schedule stability

**Date:** 2026-10-27

The initial WorkPass479 attempt scaled the per-replay learning rate. That reduced replay's aggregate update contribution but failed the sequential retention benchmark: the model did not recover old-task skill (task A remained at 0.0125). That attempt is not considered successful.

The revised implementation, committed as WorkPass483, preserves the configured learning rate for each rehearsal and bounds the schedule instead:

```text
effectiveReplayEveryNCurrent = max(4, requestedReplayEveryNCurrent)
```

This caps replay frequency at one replay update per four fresh updates without reducing the magnitude of each accepted rehearsal. Both the sequential benchmark and the multi-seed replay-policy sweep now assert this ratio. The original new-task performance thresholds remain unchanged.

Validation must pass the sequential benchmark, replay-policy sweep and broad core regression before the correction is considered validated.
