# NK1 branch consolidation execution ledger — 2026-11-19

## Scope and invariant

Repository: ailtron1ss-rgb/NK1.
Canonical source line: workpass70-source; default branch main is release/documentation infrastructure and is not the source target. Historical delivery baseline remains tag Neuro, asset Neuro_Kurisu_WORKPASS70_2026-10-19.zip, expected SHA-256 c5cf6a63661e28b30f976d03c8839a231341d73a09489b9066f062e29b224286.

**Non-destructive rule:** no branch is deleted, force-updated, merged, or closed solely because of its name or because another ref has the same HEAD. Every distinct delta must first be inventoried (files, blob IDs, modes, symlinks, submodules/LFS pointers, workflow/config/docs/assets), compared against the canonical source and the 19 October archive, then transferred and verified in a reviewable PR.

## Current live snapshot

- Collected: 2026-11-19 ~05:11 UTC.
- Branch refs: **1038**.
- Unique HEADs: **947**.
- Exact duplicate groups: **12**.
- Excess duplicate refs: **91**.
- Protected branches: **0**.
- Current source ref: 0a3e4c4e51d7c2ec154a87cc0912e4a1cd6752e0.
- Current main ref: 9a789ee1af8fdaa3826dbc734d18e2fc00cde5bf.
- Open PRs inspected in page 1: **100**. Full open/closed/merged PR linkage sweep remains required.

Full branch-to-SHA inventory: branch-inventory-2026-11-19.jsonl.
Exact duplicate groups: duplicate-head-groups-2026-11-19.md.

## Consolidation families (target architecture)

1. Core runtime and cognitive cycle.
2. MemoryOS2, episodic/semantic/associative memory and persistence.
3. Learning, neuroplasticity, replay, evaluation and transfer.
4. Motivation, autonomy, planning, goals and action policy.
5. Personality, affect, interoception and self-model.
6. Embodiment, avatar, skeletal kinematics, 2D/2.5D/3D and motor control.
7. Voice, ASR, TTS, turn-taking and audio/animation synchronization.
8. Tools, plugins, MCP, external coding/research adapters and integrations.
9. Security, trust, provenance, consent, permissions and evidence receipts.
10. Evaluation, benchmarks, holdouts, ablations and scientific validation.
11. Infrastructure, deployment, mobile, packaging, CI and reproducible builds.
12. UI/UX, applications, Live2D viewer and user-facing control surfaces.
13. Research, source assimilation, design records and documentation.

These are consolidation families, not a mandate to create one branch for every family. Prefer a small set of long-lived aspect branches plus isolated short-lived PR branches; keep main and workpass70-source roles distinct.

## Per-branch review record (required before integration)

For every one of the 1038 refs, record:

- branch name, exact HEAD SHA, merge-base with canonical source, ahead/behind and full changed-file list;
- every commit since divergence, including merge commits and patch-equivalent commits;
- path-level and blob-level comparison; preserve executable bit, symlink target, submodule pointer and LFS pointer metadata;
- imports, call sites, runtime registration, DI/provider wiring, env vars, dependency manifests/lockfiles, scripts, CI/workflows, assets, docs and external references;
- useful delta vs already merged work, duplicate/obsolete/conflicting content, and any branch-specific behavior;
- exact focused test commands + CI run IDs on the exact HEAD; runtime/integration status; merge target family;
- disposition: merge, cherry-pick, preserve as donor, duplicate-ref candidate, superseded, or investigate.

No unreviewed branch is silently discarded. For text/source files, compare full blobs; for binary assets, compare byte SHA-256/size and metadata. The 19 October ZIP baseline must be extracted and manifested before a branch is described as fully compared against the historical project. Its expected digest is a verification target, not yet independently recomputed in this checkpoint.

## Immediate findings and blockers

- Twelve exact duplicate-HEAD groups exist; 91 refs are excess relative to one ref per HEAD group. This is only a ref census; no deletion eligibility has been granted.
- One large shared HEAD group contains 81 refs. Because it contains both historical workpass names and multiple integration/learning tracks, it requires PR ancestry/reference analysis before any cleanup.
- Current source branch moved during this pass. Any PR with an older pinned base must be retested/rebased against the fresh source tip before merge.
- PR #949 is the active consolidation audit PR. Its base was observed at an earlier source SHA; reconcile its base before final merge.
- PR #951 remains a separate, bounded 3D kinematics donor port. It does not wire the solver into OrganismBus/OrganismState or a production actuator, and cannot be described as end-to-end embodiment.
- PR #953 carries memory projection/retrieval changes into canonical source. It is a distinct semantic-memory integration candidate, not a branch duplicate; inspect all 22 files and exact-head CI before merge.
- The 19 October Release ZIP has not yet been materialized in this execution environment; no byte-level archive comparison has occurred.

## Execution gates

A family consolidation PR may be merged only when: (1) its diff is limited to reviewed family deltas; (2) every donor change has a provenance record; (3) duplicate or conflicting implementations are resolved explicitly; (4) focused tests and the relevant full workflow pass on the exact HEAD; (5) base SHA is current; (6) there are no unexplained deletions/configuration changes; (7) the merge result is re-read and recorded.

A branch may be deleted only after its complete content and ancestry are preserved in a canonical branch, commit, tag, PR, or archive; all open and closed PR references and dependent branches are checked; all workflow/docs references are checked; the exact duplicate-ref group is documented; and a canonical ref remains. For branches with unique changes, deletion is forbidden until those changes are transferred and verified.

## Checkpoint status

- Inventory: live ref census collected and recorded.
- Exact duplicate groups: identified and recorded.
- Per-branch content/ancestry analysis: not complete.
- 19 October archive byte verification: not complete.
- Family branch creation/integration: not yet performed in this checkpoint.
- Branch deletion: none performed.


## Status correction — after PR #951 merged (2026-11-19)

This addendum supersedes earlier live values above where they differ:

- Current `workpass70-source` HEAD is `aa2b385153ddc316eadf61f87e2c0803d7d59d98`. Relative to checkpoint `7547f5287b84a7d9b7109c0e5fdbe20bf95c9e33`, GitHub compare is 4 ahead / 0 behind.
- Branch refs remain **1,038**, unique HEADs **947**, duplicate-HEAD groups **12**, excess names **91**. Current full inventory is in `branch-census-2026-11-19.json` and `.md`.
- Full PR pagination now returns **942 PRs: 412 open, 313 merged, 217 closed without merge**. The open PR head refs are 411 distinct values; one head ref is used by two open PRs. Current full register is `pull-request-census-2026-11-19.json` and `.md`.
- PR #951 is **merged** at `2026-11-19T05:14:52Z`, merge commit `aa2b385…`. Exact-head Actions query for its tested head `0a289c1…` returned 44 workflow runs, all 44 completed successfully. The multi-effector test had previously failed on a fully extended singular fixture; the follow-up changed the fixture to a nonsingular configuration, not the solver algorithm. The modules are now in source, but remain a standalone kinematics capability—not production planner/actuator/renderer wiring.
- PR #953 remains Draft at head `fbab11da4e07a09282b8cb043904a05a4f638663`, 22 files (+2,668/-113). Its exact-head workflow query later returned **50 completed successful runs and 0 pending/failed**. Nevertheless, its compare with current source `aa2b385…` is diverged (PR head 22 ahead, source 2 ahead from merge-base `9742b5a…`). Rebase/revalidate and review the full patch before considering merge; the Draft state remains intentional.
- PR #949 remains Draft and report-only. The audit branch now contains the refreshed census records and this status correction, but its PR base is still the old source checkpoint; compare against current source is diverged (26 ahead / 4 behind at the time checked). Rebase/revalidate before merge.
- PR #950 and #952 remain merged; #950 stores visual assets and evidence without renderer wiring, while #952 documents the N.E.K.O. plugin family.

The 19 October Release ZIP remains the hard parity gate; its bytes have not been materialized, and no byte-level comparison is claimed. No branch refs were deleted in this pass.
