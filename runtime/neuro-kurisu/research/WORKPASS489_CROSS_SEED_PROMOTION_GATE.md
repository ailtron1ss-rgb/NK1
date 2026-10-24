# WorkPass489 — Cross-seed promotion gate contract

Status: implementation contract for the next learning-runtime pass; this document does not claim that runtime wiring or experiments have already passed.

## Objective

Prevent a skill/model revision from being promoted because it improves only one seed, one task family, or a mutable validation set. A candidate must show repeatable benefit while preserving holdout independence and bounded regressions.

## Evidence flow

1. Freeze a benchmark manifest before evaluation: task IDs, task-family labels, seed list, candidate/base revision hashes, evaluator version, metric definitions, and holdout fingerprint.
2. Run candidate and baseline on paired seeds and identical task IDs. Preserve raw outcomes, not only aggregate means.
3. Compute per-seed deltas and task-family deltas. Report mean, median, dispersion, worst regression, and sample counts; reject empty or non-finite evidence.
4. Evaluate generalization on a holdout whose fingerprint is not present in candidate-generation, repair, prompt-selection, or threshold-tuning evidence.
5. Apply explicit regression budgets to safety failures, task success, latency/resource cost, calibration, forgetting, and task-family performance. Missing metrics are “unknown”, never silently zero.
6. Produce a promotion proposal containing provenance, raw-evidence references, metric summary, regression decisions, and a deterministic reason code.
7. Keep proposal creation separate from activation. Promotion requires a distinct authorization step; rejected candidates remain inspectable and do not overwrite the current stable version.

## Fail-closed invariants

- Candidate and baseline use the same evaluation protocol and paired seeds.
- Duplicate evidence IDs, mismatched candidate hashes, stale manifests, non-finite numbers, missing required outcomes, and holdout contamination reject the run.
- A positive global mean cannot compensate for a breached hard regression limit.
- Holdout outcomes must not influence candidate generation, repair selection, or adaptive thresholds.
- Re-running the same frozen evidence must yield the same decision and reason code.
- Every decision is append-only auditable; no silent replacement of previous evidence.

## Required reports

Publish the per-seed table, task-family breakdown, confidence/dispersion summary, worst-case regression, resource cost, holdout fingerprint, evaluator/manifest hashes, and final gate decision. A single percentage or aggregate score is insufficient.

## Integration sequence

A. Bind this contract to the existing P23/Hermes candidate evaluator and verified outcome ledger rather than creating a parallel learning subsystem.
B. Add adversarial tests for seed mismatch, duplicated outcomes, holdout contamination, NaN/Infinity, missing task families, and a positive mean with a severe per-family regression.
C. Wire the gate to the existing promotion API; verify that failed evidence cannot mutate the active skill.
D. Run multi-seed experiments and record results before changing any default thresholds.

## Success criterion

The same candidate is promoted only when the frozen evidence is complete, reproducible, holdout-clean, and within every hard regression budget. This is an engineering criterion for reliable continual learning, not a claim of consciousness.
