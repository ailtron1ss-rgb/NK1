# WorkPass132 — bootstrap-backed learning evidence gate

**Date:** 2026-10-21  
**Branch:** `workpass124-learning-evidence-hardening`  
**PR:** [#12 — draft, unmerged](https://github.com/ailtron1ss-rgb/NK1/pull/12)  
**Scope:** seed-clustered statistical evidence used by verified skill-promotion proposals.

## Why this change

NK1 already compares paired outcomes at the independent seed level and computes a small-sample Student-t interval. A parametric interval alone can be sensitive to distributional assumptions, especially with bounded seed-level pass-rate deltas and very few independent seeds. This pass adds a deterministic non-parametric sensitivity interval while preserving the existing Student-t result rather than replacing it silently.

## Implemented code changes

1. **`runtime/neuro-kurisu/src/organism/learning/VerifiedOutcomeLedger.ts`**
   - Added deterministic 4,000-resample percentile bootstrap over seed-level paired deltas.
   - The independent unit is still one complete seed aggregate; task cells and retries are not resampled as independent samples.
   - Bootstrap PRNG initialization is derived from the method pair, split/family and observed deltas, so identical inputs produce identical intervals.
   - Returns `bootstrap95CI: null` when fewer than two independent seed aggregates exist.
   - Retains the existing Student-t interval for side-by-side sensitivity; the new result is not presented as an exact or universally valid confidence interval.

2. **`runtime/neuro-kurisu/src/organism/learning/VerifiedSkillPromotion.ts`**
   - The seed-clustered gain gate now requires the existing Student-t lower bound **and** the bootstrap lower bound to be above zero.
   - Existing minimum gain, complete seed coverage, unique task coverage, authenticated evidence, and family-regression gates remain in force.
   - No automatic activation was enabled; this only tightens eligibility for review.

3. **Regression tests**
   - `tests/p23-seed-clustered-outcome-comparison.mjs`: deterministic interval, observed mean inside interval, and no interval from a single independent seed.
   - `tests/p23-verified-skill-promotion-proposal.mjs`: accepted fixture must have a positive bootstrap lower bound in addition to the parametric interval.
   - Both tests are already wired into `.github/workflows/workpass110-continual-learning-metrics.yml`; no separate workflow path was required.

## Research intake and adaptation

- [SkillLearnBench (COLM 2026)](https://github.com/cxcscmu/SkillLearnBench): its three-level evaluation distinguishes skill artifact quality, execution trajectory and verified task outcome, and its results show that continual skill methods do not dominate consistently across tasks. NK1 retains multi-level diagnosis rather than collapsing these into one score. Upstream benchmark data/runner was not copied.
- [SkillsBench v1.1](https://www.skillsbench.ai/): broad paired with-skill/without-skill comparisons and task-level variation motivate preserving controls and family-level regressions.
- [Storage-aware replay evaluation protocol](https://www.mdpi.com/2504-4990/8/7/212): its use of bootstrap uncertainty and a declared strongest-baseline protocol motivated a narrow bootstrap adaptation. Equal-byte replay comparisons, non-inferiority tests and multiplicity correction were **not** implemented in this pass.
- No upstream code or datasets were copied; no dependency was added. Full source/license audit is not claimed beyond the upstream declarations noted in the intake ledger.

## Commits

- `f04a91313fc81359f168058505614309235b8010` — deterministic seed-cluster bootstrap interval.
- `3cbd734326f1406f0ec5d8c315cb82ad335f1215` — require bootstrap sensitivity at promotion gate.
- `8e4631fed93d96fc308abce68e6b8ad6184e620d` — bootstrap regression matrix.
- `9a56cd0d1533e36140f46d6bef0504c55959b102` — promotion-gate regression.
- `bbfaa8b319331fc41fe60955d955e51312edceec` — changelog.
- `7d86390b3719b60b951d17944313e5c8541fa4ca` — research intake ledger.
- `4a52e1b2d425c163e711835f5f241e72c036d8cf` — durable handover.

## Verification status

**IMPLEMENTED:** code and regression source changes are committed.

**NOT VERIFIED:** this pass has not run the Node tests or runtime typecheck in a working local environment. Exact-head GitHub Actions status still must be inspected; an absent workflow result is not a pass. No learning benchmark was executed and no measured gain/retention/transfer result is claimed.

## Remaining P0 work

1. Run `npm run test:p23:seed-clustered-outcomes`, `npm run test:p23:verified-skill-promotion-proposal`, and `npm run typecheck`; repair any failures.
2. Inspect exact-head Actions jobs/logs and fix the workflow infrastructure issue instead of treating missing logs as success.
3. Wire the trusted shadow-context resolver to supervisor-owned run records, configure production verifier keys and authenticated approval authority, and audit every candidate-store constructor and activation path.
4. Connect verified outcomes to real sequential holdout runs; compare replay strategies under equal task, seed, compute and storage budgets; measure transfer, forgetting, per-family regressions and confidence intervals.
5. Keep PR #12 draft and unmerged until those gates pass.

**Scientific boundary:** a narrower promotion gate is an integrity improvement. It does not demonstrate that NK1 learns better, generalizes, or retains knowledge over time.


## Follow-up hardening after the initial report

- Sorted seed aggregates by numeric seed before calculating the interval, so the bootstrap does not depend on the order in which evidence arrived.
- Added a reverse-arrival-order regression that reconstructs the same task/seed outcomes in reverse order and requires an identical bootstrap interval.
- Clarified API comments so the bootstrap helper is not documented as the ledger class.
- Follow-up commits: `8e3fb2eca6e3a7be6884f9b7f5c32477cb825049` (seed-order invariance), `c8aa0f15b3dc0b838473a209e206e0798ee707be` (reverse-order regression), `449283c27becda9a3597ead6d063733ad8b6140d` (documentation correction).
- CI retry of the existing continual-learning workflow still returns a failed job with `steps: null` and `logs_url: null`; the log endpoint returns 404 `BlobNotFound`. This is an unresolved CI observability/execution blocker, not evidence that the new tests failed or passed.


### Latest exact-branch CI observation

- Latest observed head: `5c456ce2ada5f352d730012aec4726259517e566`; PR #12 remains draft and unmerged.
- Actions reported the continual-learning metrics workflow as failed in run [39550562873](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39550562873), but its job has `steps: null`, `logs_url: null`; attempts to retrieve the job log return 404 `BlobNotFound`. The paired-evidence and verified-outcome workflows show the same empty-job failure pattern in runs [39550562782](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39550562782) and [39550562853](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39550562853).
- Therefore **no new test/typecheck result can be attributed to the bootstrap change**. The exact-head verification gate remains open until the runner produces actual step results and readable logs.
