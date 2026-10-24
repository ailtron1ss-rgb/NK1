# WorkPass447 — task-cluster bootstrap interval for learning diagnostics

**Date:** 2026-10-23  
**Branch:** `feature/learning`  
**Status:** implementation and regression coverage committed; exact-HEAD execution unverified.

## What the interval estimates

For each of `taskSuccess`, `skillQuality`, and `trajectoryQuality`, the metric layer computes each task's baseline and candidate means across validated matched trials, then forms one paired task delta:

`delta(task) = mean(candidate scores for task) - mean(baseline scores for task)`.

A deterministic percentile bootstrap resamples those task deltas with replacement. The report exposes task sample count, 2,000 resamples, 95% confidence level, point estimate and lower/upper percentile bounds. The pseudo-random stream is reproducible from the metric dimension and sorted task identities.

## Why tasks are the resampling unit

The number of repeated seeds can differ by task. Bootstrapping every trial as though it were an independent task-family observation would let a heavily repeated task dominate uncertainty estimation. Aggregating each task first keeps the inferential unit aligned with the task-balanced point of view already used in this module.

This interval targets the **task-balanced macro-mean delta**; it is not a confidence interval for the IQM or median. The bootstrap is descriptive and is not reliable evidence of population-wide improvement when task families are few, dependent, or not representative.

## Boundary behavior and integration

- Fewer than two distinct tasks yields `null` for the between-task interval; it does not fabricate a bound.
- The diagnostic summary schema is version 2.
- The summary keeps `diagnosticOnly: true`; this interval is not read by eligibility, promotion, safety or approval gates.
- It does not replace the independent untouched holdout, task-family coverage checks, paired-seed confidence reports, artifact provenance, or rollback lifecycle.

## Regression coverage and limitations

The existing `workpass406-learning-robust-metrics.mjs` test now asserts sample count/settings and ordered bounds, preserves exact summary invariance under shuffled input, checks that a positive point estimate can still have an interval reaching zero, and verifies null uncertainty for a single task. An all-ceiling/no-change case checks zero bounds.

The source and test changes are committed to `feature/learning`. This environment has not produced a successful exact-HEAD test/typecheck run, so these cases are **added but not claimed as executed PASS**. No measured learning uplift is claimed.
