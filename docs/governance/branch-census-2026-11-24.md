# NK1 / NeuroCore — Git branch census and order baseline — 2026-11-24

Repository: `ailtron1ss-rgb/NK1`  
Snapshot: 2026-11-24, approximately 11:45 UTC.  
Purpose: inventory and safe triage only. This document is not a deletion authorization.

## 1. Canonical repository boundaries

- Integration/source branch: `workpass70-source` @ `87c9ed9034e09ca9fb83fd676ac52bb46434c4fe`.
- Default branch: `main` @ `06e01cdd0a8e60ed70991f22e842887f544d1ebf`.
- Keep `main` as the public release/metadata line. Do not bulk-merge donor branches into it.
- Latest published Release metadata remains the `Neuro` tag / `NeuroKurisu0.1` release from 2026-10-19. This inventory does not establish source/ZIP parity.
- No repository rulesets were present in the latest `GET /repos/{owner}/{repo}/rulesets` response.
- Current paginated branch listing returned 1,132 refs; every entry reported `protected: false`. No exact duplicate branch HEAD SHA groups were present.
- The source branch and `main` also report `protected: false`. Repository rulesets are empty. This is a confirmed absence of branch-level ruleset enforcement at this snapshot, not a conclusion about other GitHub account/org policies.

## 2. Exact branch census

- Current branch refs: **1,132**.
- Unique branch names: **1,132**.
- Unique HEAD commit SHAs: **1,132**.
- Exact duplicate HEAD groups: **0**.
- Protected branches in the paginated branch API response: **0**.
- Branches are not automatically obsolete because they have no open PR, have an old date in their name, or contain words such as `final`, `current`, `rebased`, or `v2`.
- A preceding list snapshot returned 1,131 refs; this later live snapshot returned 1,132. Use this latest count. The earlier count difference is recorded as a snapshot-boundary change, not interpreted as proof of a deletion or restoration.

### Namespace distribution

| Namespace | Branches |
|---|---:|
| `aspect` | 304 |
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

- PR records: **1,157**.
- Open PRs: **244** — **189 Draft**, **55 Ready for review**.
- Merged PRs: **539**.
- Closed without merge: **374**.
- Open PRs not updated since before 2026-11-10: **197**.
- Distinct PR head branch names: **1,123**.
- Current branches with at least one PR record: **1,021**.
- Current branches with no matching PR head record: **111**. This means “no PR found by head branch name”, not “unused”.
- Current branches with at least one open PR: **244**.
- PR head names absent from the current branch list: **102**. These are historical/deleted/renamed/external-ref candidates; the count does not prove loss or authorize recreation.
- Current branches with mixed PR history (for example, a merged PR plus an unmerged/other PR on the same head name): **12**.
- Current branch refs with more than one PR record: **27**; there are **30** such head names across the full historical PR set, including names no longer present as branches.
- Open PR HEAD SHA mismatches against their current branch tips: **0** at this snapshot.

### Current branch disposition by PR history

| Disposition | Branches | Meaning |
|---|---:|---|
| Open-PR-only history | 240 | No merged/closed-unmerged history found for that branch name |
| Merged-history-only | 429 | Has merged PR history, no open PR |
| Closed-unmerged-only | 340 | Has closed, unmerged PR history, no open PR |
| Mixed history | 12 | Multiple PR states on the same branch name |
| No PR record by head name | 111 | No matching PR record found |
| **Total** | **1,132** | |

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

## 5. First deep content/ancestry triage — four large version families

This first pass compares adjacent HEADs in each family and separately checks merged PR commits against the current `workpass70-source`. It is evidence for safe triage, not deletion approval.

### Ed25519 approval encoding — r1 through r5

- Adjacent comparisons all diverge: r1→r2 (9 ahead / 5 behind, 8 changed files); r2→r3 (17 / 6, 11 files); r3→r4 (5 / 16, 6 files); r4→r5 (11 / 4, 7 files).
- PR #146, #147, #149 are closed unmerged. r4 has no PR record. PR #152 is marked merged, but its base was `fix/mega-cognitive-progress-tracking-2026-10-26-r3`, not `workpass70-source`.
- PR #152 merge commit `a3226cbb817eb6fdfb1f54d27b7f158108070007` is **not an ancestor** of current source; source comparison reports diverged (source has 2,350 commits ahead and the merge ref has 291 commits not in source).
- The shared implementation surface includes `AuthenticatedSkillPromotionApproval.ts`, versioned skill candidate-store tests, `SkillRevisionGate.ts`, and progress/approval documentation. These are distinct donor histories; preserve all five pending a file-level salvage pass.

### Browser/Affect coherence — current/final/rebased/rebased2

- Adjacent comparisons all diverge: current→final (8 / 6, 22 changed files); final→rebased (5 / 7, 5 files); rebased→rebased2 (8 / 5, 23 files).
- PR #515, #518, #519 are closed unmerged. PR #525 is merged directly into `workpass70-source`.
- PR #525 merge commit `88bf67cb359a92bb16ea084b80dd3265e3d0c44d` is an ancestor of current source (source is 1,528 commits ahead, 0 behind).
- Shared change areas include `AvatarStage.tsx`, browser voice prosody, browser snapshot workflows, release-license review, and benchmark/evidence docs. The rebased2 merge is integrated by ancestry; the three closed-unmerged branches still need unique-diff review before retirement.

### Unified substrate runtime integration — r1 through r4

- Adjacent comparisons all diverge: r1→r2 (27 / 8, 10 files); r2→r3 (28 / 26, 15 files); r3→r4 (54 / 17, 46 files).
- r1 has no PR record; PR #150 and #153 are closed unmerged. PR #154 is marked merged, but its base was the old `fix/mega-cognitive-progress-tracking-2026-10-26-r3` branch, not the canonical source.
- PR #154 merge commit `39af7eb67c9ab05efd45d01cbd4b4d1d44751454` is **not an ancestor** of current source; source comparison reports diverged (2,350 source commits ahead and 346 commits present on the old merge ref but not current source).
- This family touches `OrganismRuntime.ts`, `UnifiedCognitiveSubstrate.ts`, runtime package manifests, tests, and CI workflows. Do not classify the family as integrated or redundant; preserve and inspect it as a high-risk salvage family.

### Affect restore integrity — original/v2/v3/rebased

- Adjacent comparisons all diverge: original→v2 (12 / 2, 47 changed files); v2→v3 (5 / 6, 14 files); v3→rebased (6 / 3, 17 files).
- PR #712, #713, #719 are closed unmerged. PR #741 is merged directly into `workpass70-source`.
- PR #741 merge commit `57103c645336a22c0a38401c790f6290be2fda94` is an ancestor of current source (source is 1,417 commits ahead, 0 behind).
- The donor history also touches emotion restore workflows, `OrganismCore.ts`, persistent personality dynamics, package metadata, and tests. The rebased merge is present in source; earlier versions remain preserved until their unique work is checked.

### Cognitive spine runtime integration — current-source/v2/v3

- current-source→v2 diverges (8 ahead / 3 behind, 24 changed files); v2→v3 diverges (7 / 6, 13 files).
- The original current-source branch has no PR record; PR #1027 (v2) is closed unmerged. PR #1029 (v3) merged directly to `workpass70-source`.
- PR #1029 merge commit `17b6ba7eebc4cee51a72557d605bfd4ceccd7d1a` is an ancestor of current source.
- The family includes `EmbodiedRecoveryController.ts`, multimodal perception/situation models, P35/P37 embodied sensorium, Avatar3DStage and avatar-animation runtime code. v2's unmerged differences remain candidates for selective salvage, not deletion.

### N.E.K.O. streaming source implementation — base/v2/v3

- base→v2 is the one clearly nested step in this tranche: v2 is ahead by 3 commits, behind by 0, with 17 changed files. v2 contains the base branch's history plus additional commits.
- v2→v3 then diverges (2 ahead / 2 behind, 14 files); this is not a clean linear progression after v2.
- Base and v2 have no PR records; PR #994 (v3) merged into `workpass70-source`. Merge commit `83756412b21252d2427dade7af881d06801c2c30` is an ancestor of current source.
- The branches contain N.E.K.O. audio-stream contracts, `AvatarBrainAffectBridge.ts`, renderer adapters, ASR transcript handling, `NekoAudioFrameBuffer.ts`, `NekoAudioStreamContract.ts`, voice-turn coordination and tests. Preserve base/v2 until their unique commits are compared with v3's merge.

### VRM normalized motor — final/rebased/rebased2/source-sync

- All three adjacent comparisons diverge: final→rebased (13 / 15, 9 files); rebased→rebased2 (10 / 13, 14 files); rebased2→source-sync (10 / 9, 9 files).
- PR #527, #530 and #531 are closed unmerged. rebased2 has no PR record. No merged PR in this family was established.
- The family contains `vrmRuntimeAdapter.ts`, normalized humanoid integration tests, runtime adapter tests, Avatar3DStage/AvatarStage changes and embodiment UI bridge tests. This is a high-risk avatar donor family; retain every ref until all unique assets, code and tests are checked against source.

### UserModel evidence — current/final/rebased

- current→final diverges (14 / 12, 23 files); final→rebased diverges (15 / 13, 10 files).
- PR #522 and #526 are closed unmerged. PR #528 (final) merged directly into `workpass70-source`; merge commit `cf9973f677e5131afffe930dadc19a3e954e4ebf` is an ancestor of current source.
- The rebased donor includes `UserModelEvidenceModel.ts`, user-model evidence tests, runtime persistence tests and related types/coordinator changes. The merged final is integrated by ancestry, but sibling branches still require unique-diff inspection before retirement.

### Inspect Memory independent group gates — v1/v2

- v1→v2 diverges (4 ahead / 6 behind, 5 changed files).
- PR #744 (v1) is closed unmerged. PR #755 (v2) merged directly into `workpass70-source`; merge commit `fd513a6e1a83243c7c8242140de5f7f2af133a1e` is an ancestor of current source.
- The diff includes `evaluation/inspect_ai/nk1_memory_evidence.py`, its tests, and `InteroceptivePrecisionAllocator.ts` plus runtime regression coverage. Keep v1 until its unique holdout/evaluation changes have been checked against the merged v2 result.

### Interpretation and limits

- A merged PR whose base is an old intermediate branch does **not** prove integration into `workpass70-source`. Check the merge commit's ancestry against the canonical source.
- A merged PR into `workpass70-source` can still have sibling branches with unique unmerged commits. Check every sibling's diff before retirement.
- GitHub compare responses for the very old family-to-source comparisons reached the 300-file response cap. The ancestry result is useful, but the truncated path list is not a complete content diff. Continue with PR file lists and targeted blob comparisons.
- No refs in these four families were changed or deleted during this pass.

## 6. Proposed GitHub creation guard — not yet enabled

The repository currently has **no rulesets**. GitHub's native `Restrict creations` rule can block creation of refs whose names match patterns; it does not detect semantic duplication when a new branch uses a completely different name.

Proposed narrow initial target:
- Root-level and namespaced branch names matching `*-v[0-9]*` / `**/*-v[0-9]*`.
- Root-level and namespaced branch names matching `*-r[0-9]*` / `**/*-r[0-9]*`.
- Root-level and namespaced branch names matching `*-rebased*` / `**/*-rebased*`.

Use only the `Restrict creations` rule, with no bypass actors, and do not add `Restrict updates` or `Restrict deletions`. That keeps already-existing branches updateable while preventing newly created version aliases. Do not initially block `current`, `final`, `consolidated`, `source-sync`, `stack`, or `refresh`; those patterns produce false positives and need a separate review.

**Status:** not enabled yet. Browser-based GitHub sign-in has not been saved, and the available GitHub connector is read-only for ruleset administration. The setup card in the chat must be completed before the UI can create and verify this ruleset. No claim of enforcement is made until the ruleset is visible in the repository settings/API.

This GitHub control only prevents matching new names; it cannot recognize semantic duplicates with unrelated names. The development preflight rule remains mandatory: search current branches and PRs, select one canonical branch per aspect/task, and continue it in place.

## 7. Safe normalization policy

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

## 8. Scope and limitations of this snapshot

- Exact branch names and HEAD SHAs are captured for all 1,132 refs; the paginated branch API verified `protected: false` for every ref.
- Full all-state PR lineage is captured for all 1,157 returned PR records and joined by exact head branch name.
- Commit dates/messages are not available from the branch-list response. They remain explicitly unavailable in the machine-readable census; fetch commit metadata for selected candidates before deciding anything.
- The census branch contains this inventory and therefore its own head SHA advances when the document is committed. Treat that branch's own row as a self-referential publication record; it is not a donor candidate.
- No branch refs were deleted, renamed, force-pushed, or recreated as part of this inventory.
- The branch-retirement workflow on `workpass70-source` is now read-only: the automatic push trigger is removed, permissions are `contents: read`, and the script has no DELETE/ref-write path. PR #1161 was merged at `87c9ed9034e09ca9fb83fd676ac52bb46434c4fe`.

Machine-readable inventory: `docs/governance/branch-census-2026-11-24.jsonl`.
