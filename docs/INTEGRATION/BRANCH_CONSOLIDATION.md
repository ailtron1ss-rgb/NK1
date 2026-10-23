# NK1 integration map and branch consolidation

Status date: 2026-10-23

## Canonical source line

The current integration target for source-line work is `workpass203-independent-candidate-evaluator`. The default `main` branch remains separate and is not treated as the integration target for these source-line PRs.

## Integrated in this pass

- PR #55, WorkPass206–272: merged into `workpass203-independent-candidate-evaluator` at commit `1870606b93b2468b9309df04528b780b91d23729`.
- PR #57, WorkPass313 Actions history audit: merged into `workpass206-runtime-evaluator-wiring` at commit `538841d6df24bbcc681f1ae3a4c680e6e83e8ef4`.

These merges confirm GitHub accepted the PR merges; they do not imply runtime tests or production readiness.

## Pending integration

- PR #56, WorkPass286–302: not merged. Its head `workpass286-multiscale-brain-system-plan` is 113 commits ahead and 72 commits behind `workpass203-independent-candidate-evaluator`; GitHub reports the histories as diverged and the PR as not mergeable. It changes core runtime, learning, ActionGateway, causal experience, package metadata, workflows, docs and tests. A conflict-aware integration is required; do not force-merge or discard either side.
- The older WorkPass70–202 branches remain historical source branches. Their presence alone does not prove unique changes are missing from the canonical source line, nor that they are safe to delete.

## Desired repository layout

Keep runtime owners in their existing canonical code paths; organize supporting material by domain rather than duplicating runtime implementations:

- `runtime/neuro-kurisu/src/organism/core/` — cognitive cycle and organism orchestration
- `runtime/neuro-kurisu/src/organism/learning/` — causal experience, P23 and candidate lifecycle
- `runtime/neuro-kurisu/src/organism/system/` — action gateway and outcome verification
- `runtime/neuro-kurisu/tests/` — executable regression tests
- `.github/workflows/` — CI and regression workflows
- `docs/architecture/` — architecture maps and source contracts
- `docs/research/` — upstream adaptations and research notes
- `docs/workpasses/` — historical pass reports and migration notes

Do not move files solely for visual tidiness until imports, workflow path filters, documentation links and ownership are checked. A move should be a separate, reviewable commit.

## Safe next sequence

1. Resolve PR #56 against the updated integration target by reconciling overlapping runtime files and retaining both sides' unique changes.
2. Run focused causal-learning, ActionGateway, P23 repair, and cognitive-contract tests plus runtime/app typechecks on the exact resulting SHA.
3. Retarget and merge only after conflicts are resolved and checks are actionable.
4. Compare remaining historical branches against the integrated commit; delete only branches proven redundant and preserve unique work.
5. Update the release asset only after the intended integrated source is built and its exact contents are verified.

## Honesty boundary

This document records actual PR merges and the current merge blocker. It does not claim that all branches have been merged, that the repository has been physically reorganized into the proposed folders, or that CI passed.
