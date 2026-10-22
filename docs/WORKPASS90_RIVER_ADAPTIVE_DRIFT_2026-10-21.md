# WorkPass90 — River adaptive-window drift control (2026-10-21)

## Source and inspected implementation
- Project: River, https://github.com/online-ml/river
- License: BSD 3-Clause; upstream LICENSE: https://github.com/online-ml/river/blob/main/LICENSE
- Inspected: https://github.com/online-ml/river/blob/main/river/drift/adwin.py and the public drift module exports.
- Upstream ADWIN delegates to River's Rust-backed `AdaptiveWindowing` implementation. Porting only the Python wrapper would not port the detector; the wrapper's docstring describes variable-length windows, subwindow mean comparison, a significance parameter, periodic checks, bucket compression, minimum subwindow length, and grace period.
- Algorithm reference in upstream docs: Albert Bifet and Ricard Gavaldà, “Learning from time-changing data with adaptive windowing,” SIAM SDM 2007.

## What was implemented
1. `AdaptiveWindowDriftDetector.ts`
   - Streaming updates for bounded normalized values [0, 1].
   - Adaptive window, periodic checks, minimum subwindow length, grace period, significance `delta`, maximum window bound, and a Hoeffding-style split test.
   - Removes a stale prefix after a statistically significant change; reports width, mean estimate, variance, total, detection count and the current update's alarm.
   - Validated configuration and inputs, bounded memory, snapshot/restore and reset.
2. `DriftAwareLearningController.ts`
   - End-to-end bridge from a trusted held-out quality signal into the existing `trainWithExperienceReplay` path.
   - Converts quality to error consistently. Stable stream keeps balanced replay; on a detected shift it selects prioritized replay and increases the replay batch by a configurable, capped multiplier.
   - Preserves detector state and rejects invalid quality, batch size and multiplier values.
3. Regression tests cover a stationary stream, a clear distribution shift, stale-window reduction, snapshot/restore, validation and the actual detector-to-replay-training control path.
4. The P26 learning workflow now includes both new tests and watches both implementation files.

## Completeness boundary (important)
This is a complete, runnable **exact-window ADWIN-style detector and drift-to-replay control path**, not a byte-for-byte or algorithmically identical port of River's ADWIN2. River's implementation uses exponential bucket compression in a Rust core; this adaptation instead scans candidate cuts over a bounded exact window, which is simpler to audit but has higher per-check cost. The maximum window bounds that cost and memory. We do not claim River's exact complexity, guarantees, or parity.
No River Python/Rust code or runtime dependency was copied into Neuro Kurisu; the public algorithmic approach was adapted into independent TypeScript. BSD-3 source and license provenance are recorded here.

## Safe integration contract
- `heldOutQuality01` must come from the trusted evaluator and be comparable over time, not from an agent's unverified self-rating.
- Drift is a signal to change replay sampling, not proof that the environment changed; noise, task mixture changes, and evaluator changes can also trigger it.
- On drift, prioritized replay can over-focus on noisy/high-error examples. The controller therefore caps the batch multiplier at 4 and uses the existing priority sampler; production deployment should compare against balanced replay on held-out sequences.
- This module provides an explicit integration API; it is not silently wired into every existing production learner call because the trusted evaluation event/source must be selected deliberately.

## Progress estimate
- **~70% of the useful River ADWIN drift-control concept for this runtime**: streaming statistics, adaptive window, statistical cut, alarms, bounded state, persistence and the replay response are implemented.
- **Not 70% of River overall**, and not full ADWIN2 parity. Still extractable: bucket-compressed ADWIN2 for lower update cost, River's Page-Hinkley and KSWIN as complementary detectors, drift-retraining orchestration with cooldown/hysteresis, and benchmark protocols measuring detection delay/false alarms.
- Next best work: benchmark this detector against stationary, abrupt-shift and gradual-drift streams with fixed seeds; then compare balanced vs drift-triggered prioritized replay using held-out quality and false-alarm cost.

## Verification status
The branch includes the detector, controller, two regression files and updated workflow. Tests, TypeScript typecheck and CI have not yet been confirmed passing in the available run results; no real learning-quality uplift is claimed.
