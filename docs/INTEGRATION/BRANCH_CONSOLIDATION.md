# NK1 integration map and branch consolidation

Status date: 2026-10-23

## Canonical source line

The integration target for source-line work is `workpass203-independent-candidate-evaluator`. The default `main` branch is a separate release/report line and was not changed by this pass.

## Actual merges recorded

- PR #55, WorkPass206–272: merged into `workpass203-independent-candidate-evaluator` at `1870606b93b2468b9309df04528b780b91d23729`.
- PR #57, WorkPass313 Actions-history audit: merged into `workpass206-runtime-evaluator-wiring` at `538841d6df24bbcc681f1ae3a4c680e6e83e8ef4`.
- PR #58, runtime evaluator + Actions-history audit convergence: merged into `workpass203-independent-candidate-evaluator` at `a2b309af0d4b572437e3ef419eafc0bc2511a18f`.

GitHub confirmed these merges. This does not imply tests passed or the runtime is production-ready.

## Branch compatibility sweep

Compared the 49 `workpass*` branches returned by the repository's first branch-list page against `workpass203-independent-candidate-evaluator`.

- `workpass203-independent-candidate-evaluator`: identical to the target at the time of comparison.
- `workpass206-runtime-evaluator-wiring`: initially 20 commits ahead / 2 behind; PR #58 was opened, GitHub's mergeability refreshed to true, and it was merged.
- `workpass286-multiscale-brain-system-plan`: 113 commits ahead / 94 behind after the integration line advanced; still diverged and PR #56 remains unmerged.
- `workpass313-actions-history-audit`: 19 commits ahead / 2 behind in its branch comparison; its change set was brought into the canonical line via PR #57 into WorkPass206 and then PR #58 into WorkPass203.
- WorkPass70–94: several branches are divergent from the current source line (for example WP70 143 commits ahead with a 300-file comparison; WP71 learning-eval 56 commits ahead / 17 files; WP93 Hermes gate 126 commits ahead / 46 files). These require content-level reconciliation; ahead counts alone do not establish whether changes are unique or already represented.
- WorkPass79 cognitive rebuild and WorkPass116–124, WP135, and WP150–202 were reported as behind the target with zero commits ahead in the comparison. They appear to be historical/ancestral snapshots relative to this integration target; this is evidence they need no merge commit, not authorization to delete branches.
- `main`, `rebuild`, and `nk1-integration-workspace-2026-10-22` have distinct histories; `main` and WorkPass203 have no common ancestor according to GitHub compare. Do not attempt an automatic merge into `main`.

This sweep did not enumerate beyond the first 100 branches, nor did it run source-level semantic equivalence analysis on every divergent branch. No branch deletion was performed.

## Remaining blocker: PR #56

PR #56 (`workpass286-multiscale-brain-system-plan`) remains open and draft. GitHub reports `mergeable: false`. It touches core runtime, learning, ActionGateway, causal experience, package metadata, workflows, docs and tests. The 36-file patch includes overlapping edits to `OrganismRuntime.ts`, `OrganismCore.ts`, `CausalExperienceStream.ts`, `P23CompoundRepairRevisionCoordinator.ts`, `UnifiedLearningSubstrate.ts`, `ActionGateway.ts`, and `OutcomeVerificationService.ts`, plus new regression workflows/tests. It must be reconciled against the now-updated base; do not force-merge or discard either side.

## Desired organization (proposal, not yet applied)

Keep canonical runtime owners in place; organize supporting material by domain without duplicating runtime implementations:

- `runtime/neuro-kurisu/src/organism/core/` — cognitive cycle and organism orchestration
- `runtime/neuro-kurisu/src/organism/learning/` — causal experience, P23 and candidate lifecycle
- `runtime/neuro-kurisu/src/organism/system/` — action gateway and outcome verification
- `runtime/neuro-kurisu/tests/` — executable regression tests
- `.github/workflows/` — CI and regression workflows
- `docs/architecture/` — architecture maps and source contracts
- `docs/research/` — upstream adaptations and research notes
- `docs/workpasses/` — historical pass reports and migration notes

Do not move runtime files just for visual tidiness until imports, workflow path filters, documentation links and ownership are checked. A move should be a separate, reviewable commit.

## Next actions

1. Resolve PR #56 by reconciling overlapping runtime files and retaining unique changes from both histories.
2. Run focused causal-learning, ActionGateway, P23 repair, cognitive-contract tests, and runtime/app typechecks on the exact resulting SHA.
3. Recheck every branch page (including pagination), compare each remaining divergent branch, and only delete a branch after proving its changes are retained and confirming it is not an active working branch.
4. Physically reorganize supporting files only with import/path updates and regression checks.
5. Update the release asset only after the intended source is built and the exact archive contents are verified.

## Honesty boundary

This document records confirmed PR merges and the current merge blocker. It does not claim that all branches were merged, all branch pages were checked, folders were reorganized, CI passed, or the release asset was updated.
