# NK1 branch consolidation — post-merge live census

Snapshot date: 2026-11-19, GitHub API observations around 05:49 UTC.  
Repository: `ailtron1ss-rgb/NK1`  
Canonical source line: `workpass70-source` (not `main`).  
Current source SHA at snapshot: `f6f8720b02748ac229635d56e81c115e83c96a62`.

## Live inventory

- Branch refs: **963**.
- Unique branch HEAD SHAs: **947**.
- Duplicate HEAD groups: **1**.
- Excess refs inside duplicate group: **16**.
- Open pull requests: **402** (five-page live listing).

All 17 names in the remaining duplicate-HEAD group point to the same commit `82ea7a8b7c9b036e65c8b056acedd1176952dd8f`:

```text
nk1-all-branches-merge-2026-10-23
nk1-integration-workspace-2026-10-22
rebuild
workpass79-cognitive-rebuild
workpass116-seed-clustered-learning-eval
workpass117-verified-replay-admission
workpass118-multi-source-learning-integration
workpass119-skill-retrieval-feedback-curriculum
workpass120-verified-skill-revision-gate
workpass121-ledger-bound-promotion-proposals
workpass122-promotion-gate-coverage-hardening
workpass123-authenticated-skill-lifecycle
workpass124-learning-evidence-hardening
workpass135-durable-shadow-run-registry
workpass203-independent-candidate-evaluator
workpass206-runtime-evaluator-wiring
workpass313-actions-history-audit
```

This group is **not safe to delete as a unit**. Seven open PRs use members of the group as base refs: #86, #91, #109, #112, #124, #131 and #138. These PR heads are divergent and contain distinct work. The shared base commit is an ancestor of the current source, but that ancestry alone does not make their heads duplicates.

A previous census recorded 1,038 branch refs / 947 unique HEADs. In the later comparison, 75 old branch names were absent, while their tips remained represented by surviving refs or ancestors; 63 names appeared only in closed-PR history and 12 did not appear as a PR head/base in the saved census. This historical comparison is not proof that external scripts, workflow triggers, documentation, or integrations never refer to a branch name. No branch refs were deleted in this consolidation pass.

## Completed memory/HMX integration

### PR #954 — merged

Merged to `workpass70-source` as `7818b5ad785a33f1e3af81428d3aaf4ccf212f3f`, with exact integrated head `7a6a68fc9cbe5968b0b5d5253138e6c5e9ad5700`.

- 22 files, +2,749 / −113 lines.
- 50/50 check runs succeeded on the exact merged head.
- Consolidated HMX semantic/temporal/causal/contradiction relationships, canonical MemoryOS2 projections, forget cleanup including P62 semantic aliases, semantic retrieval benchmark/CLI, and regression workflows/tests.

### Superseded PRs closed; branch refs retained

The following were closed as superseded after checking changed paths, tree/blob content and feature coverage against the #954 result. Their branch refs and commit history were not deleted:

- #953 — earlier HMX semantic-integrity attempt, superseded by rebased #954.
- #890, #891, #892 — overlapping memory lifecycle/HMX/semantic abstention branches; #892 combined the smaller lines.
- #880, #881 — earlier HMX cluster/link projection branches.
- #882 — earlier memory projection/forget integrity branch.

Closure means the review request is redundant; it does not mean its branch was deleted.

## Active integration candidates

### PR #948 — P25 monotonic replay anchor

- Head: `b5f60e30caf5b5b2ce7b47609614fad9682cc91c`.
- Base: `workpass70-source` at `f6f8720b02748ac229635d56e81c115e83c96a62`.
- 7 changed paths, +622 / −30 lines; 14 commits including a no-tree-change CI refresh commit.
- GitHub reports mergeable/clean when the latest CI is pending.
- Current CI snapshot: 18/19 succeeded, 1 targeted/regression check still running, no failures at observation time.
- Feature: host-owned monotonic replay anchor interface, atomic compare-and-swap contract, fail-closed restore/reconcile and activation rules. This PR defines the runtime interface and tests; it does **not** supply a production durable anchor-store backend. Strict production activation requires a separately protected host implementation.

Do not merge until the remaining exact-head check completes successfully and mergeability is rechecked.

### PR #866 — explicit HMX 1.7 apply and import redaction

- Retargeted base to current source; GitHub reports `mergeable_state=dirty`.
- 79 commits, 21 files, +1,650 / −116 lines; preserve as Draft.
- Not a duplicate of the #954 graph bridge. It uniquely adds a separate explicit apply transition, external HMX upload path, two-step UI confirmation, transactional canonical projection/rollback, known-pattern redaction and real-server tests/workflow.
- Five paths are absent from current source; 16 existing paths contain overlapping or later-edited runtime/UI wiring.
- Historical exact-head CI was 29/30 with one unrelated ACP import failure (`ModuleNotFoundError: acp.helpers`); this predates the current source base and is not current validation.
- Next step is a selective port onto the current HMX bridge, followed by fresh UI/server/workflow tests. Do not merge the old 21-file diff wholesale.

### PR #109 — module dependency contracts

- 115 commits, 31 changed paths, +2,210 / −418; divergent and not safe to merge wholesale.
- 24 changed paths are absent from current source and 7 existing paths have changed blobs.
- Unique material includes import-specifier scanner, dependency-boundary policy and budgets, CI audit workflow, graph report/docs, four DevelopmentalInstanceGroup modules and StateFacetDefaults/domain-owned persistence builders.
- Preserve the branch and review as a separate architecture migration. Do not close it as a duplicate.

## Disposition policy

1. Keep `workpass70-source` as the canonical integration base; do not move runtime code to `main` just because it is the default branch.
2. Compare actual tree paths/blobs and commit ancestry; branch names and PR titles are not evidence of duplication.
3. Keep any ref used by an open PR until the dependent PR is migrated/closed after content review.
4. Close superseded PRs only after proving their implementation is covered by a newer merged integration; keep branch refs for audit.
5. Before deleting any branch ref, scan workflows, scripts, docs, release material, PR bases/heads and external automation references. No branch deletion is authorized by this report.
6. The 2026-10-19 Release ZIP remains the primary baseline artifact. This source-branch consolidation does not by itself change or certify that release artifact.

## Current result

The memory/HMX family has one verified integrated path (#954), and the P25 monotonic anti-replay anchor is now integrated through #948. Seven redundant review requests were closed without deleting refs. #866 and #109 remain open for selective integration because they contain distinct functionality.

## Subsequent verified integration — PR #948

Merged 2026-11-19 at 05:53:40 UTC into `workpass70-source`:
- Merge commit: `2d8a71cd937ed7196f69b6cef68f4fa016b508ee`.
- Exact tested PR head: `9372c5e90dc2124f08251a14170283dba6ade020`.
- Base before merge: `ab4cc42101dcbd30a51c39f840490a6a2f642639`.
- 7 changed paths, +622 / −30 lines; 19/19 exact-head checks passed; mergeability was clean.
- Added the host-owned monotonic replay-anchor contract, atomic compare-and-swap semantics, fail-closed restore/reconcile and activation checks, plus regression tests.
- Scope limitation: the PR adds the interface/runtime integration and tests, not a production durable anchor-store implementation. Production activation requires a host-supplied protected implementation and `synapticReplayAnchorRequired` configuration.

Source HEAD immediately after merge: `2d8a71cd937ed7196f69b6cef68f4fa016b508ee`.
