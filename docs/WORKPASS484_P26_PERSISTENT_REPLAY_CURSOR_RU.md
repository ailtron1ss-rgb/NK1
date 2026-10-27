# WorkPass484 — Persistent replay-buffer traversal

**Date:** 2026-10-27

WorkPass483 bounded high-frequency replay to one historical sample per four fresh samples. CI then exposed an additional issue: `trainInterleaved()` initialized its replay cursor to zero inside every call. With batch-level training loops, the same prefix of the replay buffer was selected repeatedly, leaving most older experiences underrepresented.

Changes:
- Added backward-compatible `replayCursor` state to P26TrueLearningState.
- Restores and snapshots the cursor with the rest of the learning state.
- The cursor advances for every sampled replay row, including records rejected by conflict screening, and wraps by the current buffer length.
- Added a sequential benchmark assertion that the cursor movement equals the number of sampled eligible + blocked records per batch.
- Existing task-performance thresholds remain unchanged.

This change targets coverage and fairness of replay sampling; passing synthetic benchmarks still does not prove real-world generalization.
