# NK1 live consolidation delta after MemoryOS2 merge — 2026-11-19

## Canonical source and integrations

- Repository: `ailtron1ss-rgb/NK1`
- Canonical source: `workpass70-source`
- Current source HEAD: `7818b5ad785a33f1e3af81428d3aaf4ccf212f3f`
- Newly integrated PR: [#954](https://github.com/ailtron1ss-rgb/NK1/pull/954), squash merge.
- Validated PR head: `7a6a68fc9cbe5968b0b5d5253138e6c5e9ad5700`
- Exact-head Actions result: **50/50 success; 0 failures; 0 cancellations**.
- Superseded predecessor [#953](https://github.com/ailtron1ss-rgb/NK1/pull/953) is closed unmerged and its original test-first description is retained. Its title/body now identify #954 as successor.
- Previous consolidation PRs #950, #951 and #952 are already merged in earlier parallel work; this report does not re-claim those merges.

## Fresh live repository census

A fresh paginated read of GitHub branch refs was performed after the #954 merge. The new immutable list is `branch-inventory-2026-11-19-after-pr954.jsonl`.

| Measure | Live value |
|---|---:|
| Branch refs | **963** |
| Unique HEAD SHAs | **947** |
| Exact duplicate-HEAD groups | **1** |
| Extra refs within duplicate groups | **16** |
| PR records | **943** |
| Open PRs | **410** |
| Merged PRs | **315** |
| Closed without merge | **218** |
| Distinct branches used as open PR heads | **409** |
| Distinct branches used as open PR bases | **87** |

The previous branch inventory in this PR records 1,038 refs, 947 unique heads, 12 duplicate-head groups and 91 excess refs. Comparing its saved names with the current paginated list yields **76 old names no longer present** and one current new name, `aspect/memory-hmx-semantic-integrity-rebased-20261119`, for a net reduction of **75 refs** (1,038 − 76 + 1 = 963). The exact current list has 963 entries. This report records the observed delta; it does not attribute the 75 absent refs to a particular actor or claim that this session deleted them.

## The one remaining exact duplicate-head group

All 17 remaining names below point to the same commit/tree:

`82ea7a8b7c9b036e65c8b056acedd1176952dd8f`

- `nk1-all-branches-merge-2026-10-23`
- `nk1-integration-workspace-2026-10-22`
- `rebuild`
- `workpass79-cognitive-rebuild`
- `workpass116-seed-clustered-learning-eval`
- `workpass117-verified-replay-admission`
- `workpass118-multi-source-learning-integration`
- `workpass119-skill-retrieval-feedback-curriculum`
- `workpass120-verified-skill-revision-gate`
- `workpass121-ledger-bound-promotion-proposals`
- `workpass122-promotion-gate-coverage-hardening`
- `workpass123-authenticated-skill-lifecycle`
- `workpass124-learning-evidence-hardening`
- `workpass135-durable-shadow-run-registry`
- `workpass203-independent-candidate-evaluator`
- `workpass206-runtime-evaluator-wiring`
- `workpass313-actions-history-audit`

Exact current open-PR base dependencies in this group:

| Base ref | Open dependent PRs |
|---|---|
| `nk1-all-branches-merge-2026-10-23` | #109 |
| `nk1-integration-workspace-2026-10-22` | #131 |
| `rebuild` | #121, #112, #91, #86 |
| `workpass206-runtime-evaluator-wiring` | #138, #124 |

The remaining names also preserve historical PR relationships: e.g. the WorkPass116–124 chain and WorkPass203–318 integration line have merged PR records. Identical HEAD means there is no distinct current file tree among these names; it does not erase the refs' role in open PRs, PR history or task provenance.

**Disposition:** keep the 17 current refs for now. Four of these branch names are active bases for eight open PRs. Re-targeting those PRs requires exact diff/merge-base and dependency review before any ref is retired. The 16 extra aliases are cleanup candidates only after the remaining non-PR references are audited. This report does not delete or force-update refs.

## Archive baseline

The user-designated baseline remains the published Release asset:

- `Neuro_Kurisu_WORKPASS70_2026-10-19.zip`
- Published size: 135,290,615 bytes
- Published SHA-256 metadata: `c5cf6a63661e28b30f976d03c8839a231341d73a09489b9066f062e29b224286`

The archive bytes were not materialized in this execution environment. The digest has not been independently recomputed, and no per-file or byte-for-byte comparison against current source is claimed. Archive extraction and a path/size/SHA-256 manifest remain a blocking baseline gate before any destructive cleanup or release replacement.

## What this delta changes

- Adds a fresh 963-ref JSONL inventory after the #954 merge.
- Corrects the live count that differs from the earlier 1,038-ref snapshot.
- Records the currently remaining exact duplicate-tip family and its open-PR base dependencies.
- Records the completed #954 merge and #953 supersession.
- Does not claim all 963 refs have been exhaustively reviewed at line/blob/dependency level.
- Does not authorize deletion of the remaining 17 identical-tip refs.


## Subsequent live PR refresh — after duplicate PR #121 disposition

A new complete PR-list read after closing duplicate #121 reports:

- PR records: **943**
- Open: **406**
- Merged: **315**
- Closed without merge: **222**
- Distinct open PR head refs: **406** (no identical open head SHA groups remain)
- Distinct open PR base refs: **87**

PR #121 was closed with title `[SUPERSEDED by #102]...`. Both used the exact same head ref and SHA `typescript/runtime-typecheck-truth-2026-10-24` / `832e44bd5b59e698dc5a829d9982f31b3ed4b03d`. The only extra file shown by the older-base diff was `docs/integration/hexis/ASSIMILATION_PLAN_RU.md`, and its blob is identical to current source. PR #102 remains the single open review path. No unique code was discarded.

The duplicate-tip branch group remains 17 refs at SHA `82ea7a8b7c9b036e65c8b056acedd1176952dd8f`. The open-base dependencies now total seven PRs across four branch names: #109 (`nk1-all-branches-merge-2026-10-23`), #131 (`nk1-integration-workspace-2026-10-22`), #112/#91/#86 (`rebuild`), and #138/#124 (`workpass206-runtime-evaluator-wiring`).


## Legacy-base migration probe: PR #109

- PR #109 carries a distinct 31-file architecture/dependency-boundary patch (2,210 additions / 418 deletions in its original base view). It is not a duplicate and remains Draft.
- Its original base `nk1-all-branches-merge-2026-10-23` is the shared old tip `82ea7a8...`; its head remains `architecture/dependency-contracts-2026-10-24` @ `862472baba4b898cd0095230b5e0628aa460b411`.
- A reversible trial retarget to current `workpass70-source` produced GitHub `mergeable_state=dirty` / `rebaseable=false`; therefore the base was restored unchanged. The latest PR snapshot again reports mergeable=true but state `unstable` and `rebaseable=false` on the original base. This PR is not approved for merge.
- Its dedicated `NK1 Module Dependency Audit` exact-head workflow passed historically, but several other old WorkPass regressions on this head failed. The exact current-source integration still requires manual reconciliation of its dependency audit scripts, `DevelopmentalNeuralRuntime`, `StateMigrations`, package changes and newly introduced persistence/core modules, followed by fresh CI.
- The attempted base change made no code edits and did not alter its head commit. Keep the old base reference until the patch is reconciled and a safe retarget can be validated.


## Post-merge source-head verification

The squash merge commit `7818b5ad785a33f1e3af81428d3aaf4ccf212f3f` is the live `workpass70-source` HEAD. GitHub ran **20 Actions/check-runs directly on this merge SHA**; all 20 completed successfully, with zero failures or cancellations. This is separate from the 50/50 passing checks on the PR head `7a6a68fc9cbe5968b0b5d5253138e6c5e9ad5700`.



## Shared-tip ancestry verification

GitHub compare confirms `workpass70-source` at `7818b5ad785a33f1e3af81428d3aaf4ccf212f3f` is **1,036 commits ahead and 0 behind** the shared duplicate tip `82ea7a8b7c9b036e65c8b056acedd1176952dd8f`. Thus the 17 current refs all point to an old commit already in canonical source ancestry; they do not identify a distinct current code tree. Their remaining value is PR-base/historical provenance, so the open dependent PRs must be reconciled before removing their aliases.


## Live refresh after PR #138 and PR #131 — 2026-11-19

A fresh paginated GitHub branch read returned **953 refs**, **937 unique HEADs**, one exact duplicate-head group and **16 excess alias names**. The group remains SHA `82ea7a8b7c9b036e65c8b056acedd1176952dd8f` with 17 names. Exact current inventory: `branch-inventory-2026-11-19-live-after-pr131-pr138.jsonl` (953 rows).

Compared with the prior 963-row post-#954 inventory, **10 names are absent** and **zero new names appeared**. The names are listed in `branch-consolidation-checkpoint-after-pr131-pr138-2026-11-19.md`. This records observed ref absence only and does not attribute deletion to this session or any specific actor.

Current open-PR base dependencies:

- `nk1-all-branches-merge-2026-10-23`: open PR #109.
- `rebuild`: open PRs #112, #91 and #86.
- `workpass206-runtime-evaluator-wiring`: open PR #124.

That is **5 open PRs across 3 old base refs**. PR #131 and PR #138 are merged into `workpass70-source`; their former base aliases are no longer needed for these two PRs, but their donor branch refs remain present.

PR #131 and #138 are independently verified merges: #131 merge commit `3a185b341e85ca9a8d3f3d1679a1f4464416b6c2`, six-file selective diff, 7/7 exact-head Actions successful; #138 merge commit `08053819c8fb91861703736d63f1459ad4be121b`, four-file selective diff, 22/22 exact-head Actions successful. Donor refs are retained.

No branch refs were deleted or force-updated. SHA equality alone is not permission to delete the remaining 17 refs; PR history, tags/releases, workflow triggers, rulesets, deployments and external references still need review.


## Live consolidation refresh — 2026-11-19 (after PR #950, #951, #954 and #131)

This addendum supersedes the earlier live counts above where they differ. A new paginated read of GitHub's branch and open-pull-request APIs was completed during this refresh.

### Current refs and PR shape

| Measure | Current observed value |
|---|---:|
| Branch refs | **953** |
| Unique HEAD commit SHAs | **937** |
| Exact duplicate-HEAD groups | **1** |
| Extra refs inside exact duplicate groups | **16** |
| Open PRs | **390** |
| Distinct open PR head refs | **390** |
| Distinct open PR base refs | **86** |
| Open PRs targeting `workpass70-source` | **194** |

The only exact duplicate-tip family still present is the 17-ref group at `82ea7a8b7c9b036e65c8b056acedd1176952dd8f`, with 16 aliases beyond one representative. The names are the 17 already listed in the earlier section above. Exact equality proves the refs currently name the same commit/tree; it does not remove historical PR provenance or downstream base dependencies.

### Current open PRs still based on duplicate-tip aliases

Five live open PRs still use three names from the identical-tip family as their base:

| PR | Head branch | Existing base branch | Files | Additions / deletions | State |
|---|---|---|---:|---:|---|
| #109 | `architecture/dependency-contracts-2026-10-24` | `nk1-all-branches-merge-2026-10-23` | 31 | +2,210 / -418 | Draft |
| #112 | `workpass328-universal-interpreter` | `rebuild` | 45 | +1,684 / -142 | Draft |
| #91 | `operation-omega-hexis-2026-10-24` | `rebuild` | 108 | +44,896 / -115 | Open, non-Draft |
| #86 | `workpass328-upstream-donor-gate` | `rebuild` | 33 | +3,031 / -67 | Draft |
| #124 | `nk1-ready-unified-cycle-restore-integrity-20261025` | `workpass206-runtime-evaluator-wiring` | 66 | +1,017 / -360 | Draft |

PR #109's earlier reversible retarget probe to current source produced a dirty/non-rebaseable result, so its original base was restored. No base change or head rewrite is authorized by this census. The other four PRs remain separate review targets; their unique patch sets must be compared against current source before any retarget or merge.

PRs #131 and #138 were previously shown in older snapshots as dependent on duplicate-tip names; both are now closed/merged and are not current open dependencies. PR #131 is verified as the current source HEAD merge commit. Do not use the previous seven-PR base-dependency count as a live count.

### Confirmed integrations now present in current source ancestry

Current `workpass70-source` HEAD is `3a185b341e85ca9a8d3f3d1679a1f4464416b6c2`.

The following merged PR commits are ancestors of the current source HEAD, verified with GitHub compare (current source is ahead and zero commits behind):

| PR | Selective change | Merge commit | Changed files | Diff stats |
|---|---|---|---:|---:|
| #950 | Kurisu sprites and render-evidence asset provenance | `0a3e4c4e51d7c2ec154a87cc0912e4a1cd6752e0` | 13 | +33 / -0 |
| #951 | Isolated renderer-neutral 3D skeletal-kinematics modules and tests | `aa2b385153ddc316eadf61f87e2c0803d7d59d98` | 8 | +672 / -1 |
| #954 | HMX projections and semantic-retrieval gates with bitemporal MemoryOS2 | `7818b5ad785a33f1e3af81428d3aaf4ccf212f3f` | 22 | +2,756 / -113 |
| #131 | Node 24 installer/doctor shared runtime pin and regression tests | `3a185b341e85ca9a8d3f3d1679a1f4464416b6c2` | 6 | +134 / -13 |

Compare results:
- #950 merge commit `0a3e4c4e...`: current source is 236 commits ahead, zero behind.
- #951 merge commit `aa2b3851...`: current source is 235 commits ahead, zero behind.
- #954 merge commit `7818b5ad...`: current source is 185 commits ahead, zero behind.

This establishes ancestry, not an assertion that every merged change is fully exercised on a physical device. The connector's combined-status endpoint returned no status contexts for the four commit SHAs during this refresh; use exact commit check-runs/Actions evidence separately before making a new verification claim.

### Current-source comparisons and release boundary

The current source is substantially newer than the October 19 Release ZIP. The archive remains the designated immutable baseline at 135,290,615 bytes and published SHA-256 metadata `c5cf6a63661e28b30f976d03c8839a231341d73a09489b9066f062e29b224286`. Archive bytes still could not be materialized here, so ZIP member inventory, CRC verification, independently recomputed SHA-256 and path-by-path source parity remain **UNKNOWN / NOT DONE**.

No branch was deleted or force-updated in this refresh. No claim is made that all 953 refs have been audited file-by-file. The exact duplicate group is a cleanup candidate only after all five open dependent PRs and historical references have been reconciled.
