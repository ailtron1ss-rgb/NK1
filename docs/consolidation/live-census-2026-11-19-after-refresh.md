# Live branch and PR census — 2026-11-19

## Scope and method

Fresh paginated GitHub REST API reads of all branch refs and all pull requests in `ailtron1ss-rgb/NK1`. Branch counts below are ref counts, not estimates from the repository UI's first page. No repository refs or pull request states were mutated while taking this census.

## Current totals

- Branch refs: **954**
- Unique branch HEAD commit SHAs: **938**
- Exact duplicate-HEAD groups: **1**
- Refs in that exact duplicate group: **17**
- Excess aliases in the group: **16**
- Pull requests: **946 total** — **390 open**, **323 merged**, **233 closed without merge**
- Open PRs with distinct head refs: **390**
- Duplicate head-SHA groups among open PRs: **0**
- Open PRs targeting `workpass70-source`: **195**

## Exact duplicate branch group

All 17 refs below point to the exact same commit SHA:

`82ea7a8b7c9b036e65c8b056acedd1176952dd8f`

1. `nk1-all-branches-merge-2026-10-23`
2. `nk1-integration-workspace-2026-10-22`
3. `rebuild`
4. `workpass79-cognitive-rebuild`
5. `workpass116-seed-clustered-learning-eval`
6. `workpass117-verified-replay-admission`
7. `workpass118-multi-source-learning-integration`
8. `workpass119-skill-retrieval-feedback-curriculum`
9. `workpass120-verified-skill-revision-gate`
10. `workpass121-ledger-bound-promotion-proposals`
11. `workpass122-promotion-gate-coverage-hardening`
12. `workpass123-authenticated-skill-lifecycle`
13. `workpass124-learning-evidence-hardening`
14. `workpass135-durable-shadow-run-registry`
15. `workpass203-independent-candidate-evaluator`
16. `workpass206-runtime-evaluator-wiring`
17. `workpass313-actions-history-audit`

Every one of these refs is unprotected in the current API response. This proves identity of the commit/tree they reference; it does not by itself authorize deleting every ref because some are still bases of open PRs.

### Open PR dependencies on the duplicate group

- `nk1-all-branches-merge-2026-10-23`: PR #109 — Architecture dependency boundaries.
- `rebuild`: PR #91 — Hexis source transfer; PR #86 — P23/Hermes evidence gate.
- `workpass206-runtime-evaluator-wiring`: PR #124 — cognitive-state persistence and learning integrity.

The other 13 aliases have no currently open PR using them as a base. Their historical/closed PR references remain preserved in GitHub metadata.

## Ancestry check

Compared duplicate tip `82ea7a8b7c9b036e65c8b056acedd1176952dd8f` to the live `workpass70-source` ref:

- Current `workpass70-source` HEAD: `f8f70ad88a219dcdfb613136e4ca20a51f1f052f`
- Compare status: `ahead`
- Ahead: **1,283 commits**
- Behind: **0 commits**
- Merge base: exactly the duplicate tip.

Therefore the shared duplicate tip is already an ancestor of the current source branch. The 17 aliases do not carry divergent commits beyond that common tip. The four active dependent PRs still require individual patch/base reconciliation before their base refs can be retired.

## PR concentration

The largest active base concentration is `workpass70-source` (195 open PRs), followed by `main` (57). The remaining open PRs are distributed across older stacked/aspect bases. All 390 active PR head refs are distinct, so the current duplication problem is primarily excess branch refs and historical base fragmentation, not duplicate open PR heads.

## October 19 release baseline

GitHub Release metadata identifies the later October 19 baseline as:

- Tag: `workpass70-hotfix1-2026-10-19`
- Published: `2026-10-19T14:40:04Z`
- Asset: `Neuro_Kurisu_WORKPASS70_HOTFIX1_2026-10-19.zip`
- Size: **136,354,713 bytes**
- GitHub API asset digest: `sha256:9effadfcf0d402b462dd9cf2fd5b5793742039c9260db80578be830952bf52eb`

This digest is GitHub-provided metadata; it was not independently recomputed in this session. The ZIP itself could not be materialized because the execution container could not resolve `github.com`, and the web retrieval path rejected the binary asset. Consequently, a byte-level archive-to-source comparison remains **NOT VERIFIED** and is a hard gate before any release/parity claim.

## Actions taken in this census pass

- No branch ref was deleted, moved, or force-updated.
- No open PR was closed, retargeted, or merged.
- No runtime source file was changed.
- This file is an additive, dated census record on the existing Draft consolidation PR branch. Earlier snapshots are retained as historical records rather than overwritten.
