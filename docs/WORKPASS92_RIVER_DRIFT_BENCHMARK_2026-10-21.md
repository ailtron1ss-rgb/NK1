# WorkPass92 — River-inspired drift detector evaluation

Date: 2026-10-21

## Selected upstream

- Project: River, online machine learning for streaming data.
- Page-Hinkley source: https://github.com/online-ml/river/blob/main/river/drift/page_hinkley.py
- License: https://github.com/online-ml/river/blob/main/LICENSE (BSD-3-Clause).
- Related upstream implementation: https://github.com/online-ml/river/blob/main/river/drift/adwin.py

## What changed in this pass

Added `tests/p28-drift-detector-benchmark.mjs`, a deterministic synthetic-stream benchmark for the existing project-native `AdaptiveWindowDriftDetector` and `PageHinkleyDriftDetector`. It evaluates five fixed seeds over four stream types:

1. Stable low-noise signal.
2. Stable but noisy signal.
3. Abrupt mean shift.
4. Gradual mean shift.

For each detector/scenario it reports detection rate, mean detection delay, false alarms per run and mean total alarms. The benchmark is attached to the existing P26 learning-validation workflow, so a relevant pull request can execute it alongside typecheck and detector/controller regressions.

## Interpretation boundaries

- This is a reproducible detector benchmark, not evidence that the model learns better or that the controller improves real task success.
- Synthetic streams are deliberately simple, bounded scalar error signals. They do not cover autocorrelation, seasonality, missing labels, adversarial noise, multiple simultaneous shifts, or task-dependent reward distributions.
- The benchmark prints measurements rather than asserting that one detector must win. Thresholds need calibration against representative held-out traces and the cost of false alarms vs delayed detection.
- The current exact-window adaptive detector is an ADWIN-inspired implementation, not River's compressed ADWIN2 implementation. Page-Hinkley is an independent TypeScript algorithmic adaptation, not a byte-for-byte port of River's Python module.
- No benchmark results are recorded here because the repository test and GitHub Actions run have not yet been observed for this commit.

## Transfer coverage estimate

- Page-Hinkley core behavior adapted into the project: ~85% of the relevant detector mechanism (not 85% of River as a whole).
- Drift signal to replay-policy integration: ~75% of the currently scoped path; the controller consumes trusted held-out quality and selects balanced vs prioritized replay, but task-level causal improvement remains unmeasured.
- Evaluation coverage after this pass: ~55% of the minimum detector-evaluation matrix. Stable/noisy-stable/abrupt/gradual scalar streams are covered; realistic trace replay, seasonality/autocorrelation, calibration sweeps, confidence intervals and downstream learning outcomes remain open.
- River project overall ported: only a narrow, selected slice. No claim of transferring River wholesale.

## Next mechanisms worth extracting

1. Broader drift benchmark methodology and detector calibration from River, including recurring/gradual changes and false-positive budgets.
2. Streaming preprocessing and feature-drift checks where input features are available and trustworthy.
3. A task-level evaluation adapter that correlates alarms with held-out loss, replay-policy changes and later success/forgetting, without treating an alarm itself as proof of improvement.
4. More faithful ADWIN2 bucket compression only if profiling shows the current bounded exact-window scan is too expensive; preserve the existing bounded-memory fallback.

## Verification status

The benchmark is wired into CI, but wiring is not a pass result. Typecheck, the new benchmark, and full workflow status must be read from the actual GitHub Actions run before calling them successful.
