# Neuro-Kurisu — Strict Recheck Audit 35.6.12 / B359

## Release verdict
B359 PASS for multi-episode compositional structural plasticity. Brick 5 predictive planning remains LOCKED until the long-horizon clean-exit gate is closed.

## Step 1 — archive/base recheck
Source archive was extracted and rechecked before modification. B358 evidence was present. B356 was explicitly marked TIMEOUT/OPEN because its functional output was produced but its process did not terminate inside the shorter external runner window.

## Step 2 — implementation correction
A concrete correctness defect was found in B276: after structural reordering, `executionPlan` and `nodes` were reordered but `stepCredits01` were still indexed according to the previous structure. B359 fixes this by applying the identical permutation to `stepCredits01`.

## Step 3 — multi-episode plasticity gate
Test: `tests/big-pass-359-multi-episode-program-plasticity.mjs`

Acceptance evidence:
- 5/5 independent seeds PASS.
- 2 sequential structural revisions per seed.
- 10/10 revision events PASS.
- Revision 1 and revision 2 both survive restart.
- Step-credit arrays survive restart exactly without index drift.
- Unseen-context transfer gain exceeds matched sham in all 5 seeds.

Representative transfer results:
- Seed 1: 0.6303007 trained vs 0.4348900 sham.
- Seed 2: 0.6140350 trained vs 0.4180968 sham.
- Seed 3: 0.6129720 trained vs 0.4178896 sham.
- Seed 4: 0.6065977 trained vs 0.4116626 sham.
- Seed 5: 0.5945045 trained vs 0.4084308 sham.

## Step 4 — regression
- B358 structure revision/restart/ablation: PASS.
- B357 consequence learning/unseen transfer/Core integration: PASS in 175s runner allowance.
- B356 long-horizon trajectory: functional test output contains `pass=true` and all 5 seeds completed, but clean process termination was not observed under the external runner window. Status remains OPEN for clean-exit/runtime acceptance and is not promoted to PASS.

## Step 5 — engineering checks
- TYPECHECK: PASS (`tsc`).
- CLEAN_ARCHITECTURE: PASS, sourceFiles=1243, canonicalFiles=400, missing=0, cycles=0, legacyLeakage=0.
- CLEAN_INTEGRITY: PASS, files=2696, release=35.6.12, schema=127.
- RELEASE_CONTRACT: PASS.
- SOURCE_TRUTH: PASS.
- RELEASE_SOURCE: PASS.
- LOCKFILE: PASS, zero-dependency tree.
- SOURCE_HYGIENE: 0 errors, 7 historical duplicate-content warnings. The post-run process did not terminate inside the external hygiene timeout, so the status is recorded as diagnostic PASS-with-timeout rather than clean-exit PASS.
- ARCHIVE_MANIFEST: PASS, files=2921, missing=0, hash mismatch=0, extra=0.

## Current progress
- Brick 0: 100/100.
- Brick 1: 100/100.
- Brick 2: 75/100 host-mobile profile; physical Android/Termux OPEN.
- Brick 3: 100/100 host causal replication.
- Brick 4 execution: 100/100.
- Brick 4 consequence learning/transfer: 100/100.
- Brick 4 structural revision/ablation: 100/100.
- Brick 4 multi-episode plasticity: 100/100.
- Brick 4 long-horizon clean-exit/runtime: 60/100 OPEN.
- Brick 5 predictive planning: LOCKED.

## Required next step
1. Isolate and close the clean process-exit/runtime issue observed in B356 and hygiene tooling.
2. Re-run the multi-episode trajectory with a clean exit and longer repeated holdout.
3. Add trajectory-level causal ablation after the second revision and unseen-context transfer.
4. Unlock Brick 5 only after those gates are clean.

## Explicit non-claims
No phenomenal consciousness claim. No physical Android/Termux success claim. No claim that the compositional program is yet a general planner.
