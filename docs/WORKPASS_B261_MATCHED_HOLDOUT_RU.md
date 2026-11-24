# WorkPass — B261 matched holdout baseline

## Defect

B261 previously initialized `holdoutBefore01` to a fixed 0.5 and then used it as the baseline for every later holdout. The reported delta therefore was not a measured before/after comparison and could feed an unsupported positive value into `transferGain01`.

## Corrected contract

- Capture a frozen B261 snapshot before candidate training or adaptation.
- Evaluate the same bounded (maximum 256) holdout samples against both the frozen baseline and current candidate.
- Without a baseline snapshot, report `baselineAvailable=false` and `delta01=null`; do not update transfer gain.
- Validate action, finite vector dimensions, reward range, and baseline version/dimension before changing diagnostics.
- Evaluation uses the pure transition predictor and does not increment prediction counters or train model weights.
- Legacy snapshots without the baseline-availability flag restore as unavailable, with no trusted delta.
- Invalid baseline input is rejected before any candidate state mutation.

## Evidence boundary

This corrects the measurement contract only. It does not demonstrate world-model superiority, continual learning, behavioral transfer, or independent cognitive improvement. A future performance claim still requires immutable holdout data and paired multi-seed evaluation.

## Integration boundary

This is a selective current-source port of the useful measurement rule from Draft PR #861. The old PR branch is not merged or rewritten. No planner, OrganismBus, MemoryOS2, user data, `main`, or Release ZIP changes are included.
