# NK1 consolidation checkpoint after PR #952 merge — 2026-11-19

## Current refs and PR inventory

Fresh paginated GitHub reads after the #952 merge:

- Branch refs: **1,037** (10 × 100 + 37).
- Unique branch HEAD SHAs: **946**.
- Exact duplicate-HEAD groups: **12**.
- Excess refs in duplicate-HEAD groups: **91**.
- PR records: **941** (9 × 100 + 41).
- Open PRs: **413**.
- Merged PRs: **311**.
- Closed without merge: **217**.

These values supersede the earlier live checkpoint at 1,036 refs / 945 unique heads and 414 open / 310 merged PRs. Earlier dated census files remain historical snapshots and are not rewritten.

## Current source SHA

`workpass70-source` is now at **`9742b5a82966e11ba9c913074615b2420736bcee`**.

The immediately preceding source SHA was `a7f1342b1ab129c83b5f84bb5acaddd4b7605d5d`. The only commit between those SHAs is the squash merge of PR #952; GitHub compare reports exactly two added files, both documentation:
- `runtime/neuro-kurisu/docs/NEKO_PLUGIN_MANIFEST_POLICY_RU.md`
- `docs/consolidation/neko-plugin-branch-reconciliation-2026-11-19.md`

No runtime source, package manifest, workflow or release artifact changed in that merge.

## PR #952 — completed documentation integration

- PR: #952
- Head: `ab756cd7b84300205fa710e7e048cbc3729ffc7d`
- Base before merge: `a7f1342b1ab129c83b5f84bb5acaddd4b7605d5d`
- Merge commit / new source head: `9742b5a82966e11ba9c913074615b2420736bcee`
- Result: merged (squash).
- Changed paths: exactly the two documentation files above.
- Exact-head Actions before merge: 3 success, 0 failure.

This preserves the unique policy contract from historical PR #784 while keeping the current atomic all-or-nothing registry restore and the shared plugin composition workflow. The old adapter/registry code and the redundant standalone policy workflow were not reintroduced.

## Other exact-head checks

- PR #950 asset preservation: 4 Actions success / 0 failure. Still Draft; asset rights/visual review and source-base synchronization remain separate gates.
- PR #951 skeletal 3D kinematics: 44 Actions success / 0 failure on head `0a289c1ddc4c19da4def7409b4e28ef85cb6854c`. Still Draft pending API/numerical/integration review; this library is not yet wired into production actuators or OrganismBus.
- PR #949 audit branch: head `5800016a572e89e2b0749295387d94f9b8c11098`; current `workpass70-source` is now 17 commits ahead / 2 behind from the audit branch's merge base. The two behind commits are the ProductOS config import and the #952 docs merge. All 14 changed paths in the audit PR are under `docs/consolidation/`; no runtime files are changed. Keep Draft and synchronize/rebase before finalizing.

## Branch cleanup

The branch refs are still at 1,037; merging #952 did not delete its feature branch or any historical branch. No refs were deleted in this pass. The exact duplicate-head families remain 12 groups / 91 excess refs. Any deletion requires a per-ref audit of open/closed PR heads and bases, tags, Actions workflows, rulesets/protection, deployments, external references and complete commit/blob provenance.

## October 19 archive gate

The release metadata SHA-256 for `Neuro_Kurisu_WORKPASS70_2026-10-19.zip` remains `c5cf6a63661e28b30f976d03c8839a231341d73a09489b9066f062e29b224286`. The ZIP bytes still have not been materialized; no extraction manifest or per-file/byte comparison has been performed. No archive parity claim is made.
