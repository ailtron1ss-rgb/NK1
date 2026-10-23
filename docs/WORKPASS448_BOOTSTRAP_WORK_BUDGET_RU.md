# WorkPass448 — bounded bootstrap-work budget

**Date:** 2026-10-23  
**Scope:** shared native utility `PairedSeedConfidence.ts`.

## Change

A percentile bootstrap runs a nested workload proportional to sample count × resamples. A maximum resample count alone does not bound that product. The utility now permits at most **16,000,000 draws per invocation** and rejects an over-budget combination with `paired-seed-bootstrap-work-budget-exceeded`.

The work-budget check occurs after the trust-boundary snapshot and validation of numeric values and configuration, but before creation of the bootstrap result array and before the sampling loop. Since the snapshot happens first, the change is not a complete limit on input parsing/copy cost; it bounds the expensive repeated sampling stage.

## Behavior and compatibility

- Requests within the budget retain the existing random generator, seed semantics, percentile quantiles, confidence level and returned interval shape.
- The utility does not silently decrease `resamples`, because silently changing a requested statistical setting would make the resulting interval harder to interpret.
- Over-budget inputs fail closed with a stable reason code; callers can choose a smaller legitimate resample count or split the evaluation into properly declared independent units.
- No dependency was introduced and the P23 promotion rule was not changed.

## Regression and verification

The WorkPass404 test now covers a 5,000-value × 4,000-resample workload (20,000,000 requested draws), which must fail before bootstrap sampling. Existing tests cover deterministic replay, interval direction, malformed scores/config, and hostile accessors.

The change and regression are committed on `feature/learning`. The exact-head runtime test/typecheck remains unconfirmed because the available Actions attempts terminate without step-level logs. No test PASS or learning uplift is claimed.
