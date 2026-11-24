# WorkPass91 — River Page-Hinkley + drift-controlled replay (2026-10-21)

## Source inspected
- Upstream project: River, https://github.com/online-ml/river
- Source file: https://github.com/online-ml/river/blob/main/river/drift/page_hinkley.py
- Repository license: BSD-3-Clause, https://github.com/online-ml/river/blob/main/LICENSE
- The upstream implementation maintains a running mean, two exponentially faded cumulative deviations, extrema, a minimum sample count, and directional modes (up/down/both). It resets an already-signaled detector before consuming the next observation. The Page-Hinkley method traces to E. S. Page, “Continuous Inspection Schemes,” Biometrika 41 (1954).

## Actual changes
1. Added `PageHinkleyDriftDetector.ts`: online mean update, faded increase/decrease accumulators, running extrema, minimum-instance gate, up/down/both direction, finite-value/config validation, constant-size state, snapshot/restore/reset.
2. Extended `DriftAwareLearningController.ts` with selectable `adaptive-window`, `page-hinkley`, and `either` modes. The latter alarms when either detector alarms; it is a sensitivity/false-alarm trade-off, not a claim of better accuracy.
3. The controller still uses the existing replay trainer: stable stream → balanced replay; detected shift → prioritized replay and a capped batch multiplier. Quality input remains explicitly sourced from the trusted held-out evaluator.
4. Added a regression that exercises upward and downward mean shifts, persistence/validation, and the Page-Hinkley-to-replay path; registered it in P26 learning CI.

## What is and isn't a full transfer
This is a self-contained TypeScript adaptation of the Page-Hinkley mechanism and its relevant control integration, not a line-by-line copy of River's Python class or the whole River library. The adaptation follows the update equations and mode/reset behavior, but uses project-native interfaces and normalized-signal-oriented defaults. It has no River runtime dependency and does not include unrelated River subsystems. Source provenance/license are recorded above.

## Progress estimate
- Page-Hinkley mechanism: **~85% of the relevant detector behavior** adapted (online mean, two directional cumulative statistics, fading, thresholds, minimum observations, reset semantics, persistence, validation).
- River overall: **not a percentage of the entire library**. Learning-system use case coverage across WorkPass90+91 is estimated **~75% of the selected concept scope**: detector(s), state persistence, replay control and regression hooks exist. This is a subjective implementation-scope estimate, not a measured performance score.
- Still extractable from River: KSWIN distribution-window test; bucket-compressed ADWIN2 (requires careful port of the Rust-backed core); drift cooldown/hysteresis and detector arbitration; reproducible false-alarm/detection-delay benchmark harness. Before choosing defaults, benchmark each detector against stable, abrupt-shift, gradual-shift and noisy streams.

## Verification honesty
A test file and CI step have been committed, but passing test/typecheck/CI results are not yet confirmed. No improvement in real model quality is claimed. The new Page-Hinkley defaults are not universal; threshold and delta must be calibrated on held-out sequences and false alarms tracked before production use.
