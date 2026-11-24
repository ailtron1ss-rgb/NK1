# NK1 / NeuroCore — Git branch census and order baseline — 2026-11-24

Repository: `ailtron1ss-rgb/NK1`  
Snapshot: 2026-11-24, approximately 11:25 UTC.  
Purpose: inventory and safe triage only. This document is not a deletion authorization.

## 1. Canonical repository boundaries

- Integration/source branch: `workpass70-source` @ `87c9ed9034e09ca9fb83fd676ac52bb46434c4fe`.
- Default branch: `main` @ `06e01cdd0a8e60ed70991f22e842887f544d1ebf`.
- Keep `main` as the public release/metadata line. Do not bulk-merge donor branches into it.
- Latest published Release metadata remains the `Neuro` tag / `NeuroKurisu0.1` release from 2026-10-19. This inventory does not establish source/ZIP parity.
- No repository rulesets were present in the latest `GET /repos/{owner}/{repo}/rulesets` response.
- Current paginated branch listing returned 1,131 refs; every entry reported `protected: false`. No exact duplicate branch HEAD SHA groups were present.
- The source branch and `main` also report `protected: false`. Repository rulesets are empty. This is a confirmed absence of branch-level ruleset enforcement at this snapshot, not a conclusion about other GitHub account/org policies.

## 2. Exact branch census

- Current branch refs: **1,131**.
- Unique branch names: **1,131**.
- Unique HEAD commit SHAs: **1,131**.
- Exact duplicate HEAD groups: **0**.
- Protected branches in the paginated branch API response: **0**.
- Branches are not automatically obsolete because they have no open PR, have an old date in their name, or contain words such as `final`, `current`, `rebased`, or `v2`.
- A preceding list snapshot returned 1,130 refs; this later live snapshot returned 1,131. Use this latest count. The earlier count difference is recorded as a snapshot-boundary change, not interpreted as proof of a deletion or restoration.

### Namespace distribution

| Namespace | Branches |
|---|---:|
| `aspect` | 303 |
| Unprefixed | 257 |
| `fix` | 183 |
| `work` | 159 |
| `consolidation` | 69 |
| `feature` | 44 |
| `docs` | 33 |
| `integrate` | 25 |
| `feat` | 18 |
| `audit` | 6 |
| `research` | 5 |
| `planning` | 4 |
| `cline` | 3 |
| `architecture` | 2 |
| `optimization` | 2 |
| `rebase` | 2 |
| `governance` | 2 |
| Other one-off namespaces | 13 |

The one-off namespaces are `automation`, `ci`, `compat`, `experiment`, `jules`, `maintenance`, `nk1`, `perf`, `prototype`, `salvage`, `test`, `typescript`, and `verify` (13 names). This detailed list supersedes the aggregate “other one-off” shorthand above; count the individual namespaces, not the shorthand row.

## 3. Pull-request lineage crosswalk

Full all-state PR snapshot, joined to current branch refs by exact `head.ref`:

- PR records: **1,155**.
- Open PRs: **242** — **187 Draft**, **55 Ready for review**.
- Merged PRs: **539**.
- Closed without merge: **374**.
- Open PRs not updated since before 2026-11-10: **197**.
- Distinct PR head branch names: **1,121**.
- Current branches with at least one PR record: **1,019**.
- Current branches with no matching PR head record: **112**. This means “no PR found by head branch name”, not “unused”.
- Current branches with at least one open PR: **242**.
- PR head names absent from the current branch list: **102**. These are historical/deleted/renamed/external-ref candidates; the count does not prove loss or authorize recreation.
- Current branches with mixed PR history (for example, a merged PR plus an unmerged/other PR on the same head name): **12**.
- Current branch refs with more than one PR record: **27**; there are **30** such head names across the full historical PR set, including names no longer present as branches.
- Open PR HEAD SHA mismatches against their current branch tips: **0** at this snapshot.

### Current branch disposition by PR history

| Disposition | Branches | Meaning |
|---|---:|---|
| Open-PR-only history | 238 | No merged/closed-unmerged history found for that branch name |
| Merged-history-only | 429 | Has merged PR history, no open PR |
| Closed-unmerged-only | 340 | Has closed, unmerged PR history, no open PR |
| Mixed history | 12 | Multiple PR states on the same branch name |
| No PR record by head name | 112 | No matching PR record found |
| **Total** | **1,131** | |

Do not use a merged PR status alone as proof that every change on its branch is integrated. Check the exact merge commit, target ancestry, changed files, test evidence, later reversions, and any unique follow-up commits.

Examples that require careful lineage handling:
- `consolidation/cognitive-core-absorption-current-20261123`: multiple PRs with a merged progression and a currently open continuation.
- `fix/workpass569-session-lineage-metadata-guard-2026-10-27`: four PR records, including several closed unmerged attempts and one merge.
- `workpass71-body-systems`: several different PR heads and target baselines; the branch name alone is not enough to decide its fate.
- `aspect/chrono-truth-bitemporal-memory-20261117`: a merged PR and a later closed-unmerged PR on the same head branch name.

## 4. Version-like naming candidates

A lexical scan found **298 branch names** with one or more version/status suffix markers, grouped into **241 normalized name families**. This is a candidate list, not a semantic-duplicate verdict.

### Stronger version-like suffixes

- `-vN`: 37 refs.
- `-rN`: 86 refs.
- `-rebased` / `-rebasedN`: 46 refs.
- Unique refs with at least one of those three markers: **167**, across **130 normalized families**.

### Softer context markers (do not block blindly)

- `-current`: 99 refs.
- `-final`: 31 refs.
- `-consolidated`: 2 refs.
- `-source-sync`: 5 refs.
- `-stack`: 3 refs.
- `-refresh`: 5 refs.

Examples of families needing detailed comparison include:
- `work/nk1-ed25519-approval-encoding-closure-2026-10-26-r1...r5`
- `work/nk1-browser-affect-coherence-2026-11-01` (current/final/rebased/rebased2)
- `work/nk1-unified-substrate-runtime-integration-2026-10-26-r1...r4`
- `work/nk1-vrm-normalized-motor-2026-11-01` (final/rebased/rebased2/source-sync)
- `aspect/affect-restore-integrity-20261103` (v2/v3/rebased)
- `consolidation/cognitive-spine-runtime-integration-source-20261120` (current-source/v2/v3)
- `consolidation/neko-streaming-source-implementation-20261119` (base/v2/v3)

Some similarly named refs contain legitimate newer ports, unique tests, or unique integration work. Their distinct HEAD SHAs mean the ref names cannot be treated as byte-identical copies. Every candidate requires merge-base, ahead/behind, changed-path/blob, PR, workflow, and source-tree checks before any retirement decision.

## 5. Proposed GitHub creation guard — not yet enabled

The repository currently has **no rulesets**. GitHub's native `Restrict creations` rule can block creation of refs whose names match patterns; it does not detect semantic duplication when a new branch uses a completely different name.

Proposed narrow initial target:
- Root-level and namespaced branch names matching `*-v[0-9]*` / `**/*-v[0-9]*`.
- Root-level and namespaced branch names matching `*-r[0-9]*` / `**/*-r[0-9]*`.
- Root-level and namespaced branch names matching `*-rebased*` / `**/*-rebased*`.

Use only the `Restrict creations` rule, with no bypass actors, and do not add `Restrict updates` or `Restrict deletions`. That keeps already-existing branches updateable while preventing newly created version aliases. Do not initially block `current`, `final`, `consolidated`, `source-sync`, `stack`, or `refresh`; those patterns produce false positives and need a separate review.

**Status:** not enabled yet. Browser-based GitHub sign-in has not been saved, and the available GitHub connector is read-only for ruleset administration. The setup card in the chat must be completed before the UI can create and verify this ruleset. No claim of enforcement is made until the ruleset is visible in the repository settings/API.

This GitHub control only prevents matching new names; it cannot recognize semantic duplicates with unrelated names. The development preflight rule remains mandatory: search current branches and PRs, select one canonical branch per aspect/task, and continue it in place.

## 6. Safe normalization policy

1. Keep `workpass70-source` as the only current integration source; keep `main` on the release/metadata boundary.
2. Reuse the current aspect branch when continuing the same task. Do not make `v2`, `r2`, `current`, `final`, `rebased`, or `refresh` copies merely to carry the previous branch forward.
3. Create a new branch only for a genuinely independent aspect/experiment, not because the original branch is inconvenient or behind.
4. Before integrating a donor, inspect all commits, merge-base, changed paths and blobs, PR history, workflow checks, dependent PR bases, and unique tests/docs.
5. Port only verified unique changes onto the current source. Do not bulk-merge stale branch trees.
6. Keep a durable branch/PR ledger; Git branches are flat refs, so use a registry/ledger for the domain hierarchy rather than creating nested copies.
7. Retire a branch only after a branch-specific evidence record proves that all unique content is preserved in the canonical source, dependent PRs/bases are resolved, and the user separately authorizes the retirement.
8. Never delete, rename, force-push, recreate, or mass-close branches/PRs based on name, age, a “merged” label alone, or this lexical scan.

Suggested long-lived domain tracks (as a registry/concept, not an instruction to create 12 more branches):
1. Core runtime
2. Memory and retrieval
3. Agency and autonomy
4. Learning and skills
5. World perception
6. Self, affect, and identity
7. Embodiment and avatar
8. Speech and interaction
9. Platform and device
10. Persistence, reliability, and security
11. Governance and release
12. Research and source assimilation

## 7. Scope and limitations of this snapshot

- Exact branch names and HEAD SHAs are captured for all 1,131 refs; the paginated branch API verified `protected: false` for every ref.
- Full all-state PR lineage is captured for all 1,155 returned PR records and joined by exact head branch name.
- Commit dates/messages are not available from the branch-list response. They remain explicitly unavailable in the machine-readable census; fetch commit metadata for selected candidates before deciding anything.
- The census branch contains this inventory and therefore its own head SHA advances when the document is committed. Treat that branch's own row as a self-referential publication record; it is not a donor candidate.
- No branch refs were deleted, renamed, force-pushed, or recreated as part of this inventory.
- The branch-retirement workflow on `workpass70-source` is now read-only: the automatic push trigger is removed, permissions are `contents: read`, and the script has no DELETE/ref-write path. PR #1161 was merged at `87c9ed9034e09ca9fb83fd676ac52bb46434c4fe`.

Machine-readable inventory: `docs/governance/branch-census-2026-11-24.jsonl`.
