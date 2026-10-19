# NΩ 1.23.0+ Master Upgrade Plan

## Phase I — Make value-guided search actually cheaper
### Big Step 1 — Vectorized value inference
1. Batch feature extraction for the whole child population.
2. Batch the ensemble forward pass.
3. Add a cost model comparing value inference cost with expected verifier cost.
4. Enable value guidance only when expected savings exceed the measured threshold.
5. Record calls avoided, verifier milliseconds avoided, and total wall time.
6. Promote only after multi-seed improvement.

### Big Step 2 — Stronger partial-program targets
1. Record execution-trace prefixes.
2. Label every prefix with Monte-Carlo return and terminal verifier outcome.
3. Add failure-class targets: timeout, wrong-output, HVM mismatch, contract failure.
4. Train a multi-head value model.
5. Calibrate uncertainty against future repair success.
6. Test value ranking separately from policy generation.

## Phase II — Adaptive verifiable environments
### Big Step 3 — Blind-spot environment evolution
1. Mine current model failures.
2. Generate candidate inputs around failure boundaries.
3. Require a verified oracle for every promoted row.
4. Score novelty and disagreement.
5. Maintain frozen train/holdout/OOD partitions.
6. Remove redundant rows using semantic equivalence.
7. Re-run the suite after every promoted model.

### Big Step 4 — Environment curriculum
1. Maintain beginner/intermediate/frontier difficulty bands.
2. Promote rows when current solve rate crosses thresholds.
3. Replace solved rows with harder validated descendants.
4. Prevent environment drift from invalidating historical comparisons.
5. Keep immutable benchmark anchors.

## Phase III — Stronger learning loop
### Big Step 5 — Preference + RLVR hybrid
1. Preference learn from dense verifier reward.
2. Add on-policy rollouts only for uncertain families.
3. Reuse verified replay off-policy.
4. Add conservative value updates.
5. Separate generation reward from verification reward.
6. Freeze held-out environments before training.
7. Reject updates without reproducible gain.

### Big Step 6 — Backtracking distillation
1. Record failed branches.
2. Record the exact conflict/counterexample.
3. Record the repair operator.
4. Train a repair policy on verified corrections.
5. Add explicit stop/check/backtrack actions.
6. Test transfer to unseen families.

## Phase IV — Autonomous code improvement
### Big Step 7 — Research loop
1. detect capability bottleneck
2. form intervention hypotheses
3. implement isolated patch
4. compile/test
5. benchmark multi-seed
6. run OOD and restart checks
7. compare against immutable baseline
8. promote or rollback
9. store evidence and provenance

## Gates
Every major promotion must pass:
- targeted tests
- regression subset
- independent verifier
- OOD benchmark
- multi-seed comparison
- latency/resource check
- restart/reload check
- immutable evidence record
