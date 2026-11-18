# NK1 duplicate branch and PR cluster analysis — 2026-11-18

## Purpose and status

This report records evidence from the first consolidation pass. It does **not** authorize branch deletion or automatic PR closure. The audit branch is isolated from `workpass70-source`; source implementation files have not been modified.

## Confirmed repository census

- Branch refs: 1,033; unique HEAD commit SHAs: 942.
- Exact duplicate-HEAD groups: 12; duplicate refs beyond unique HEADs: 91.
- PR records: 937 total; 414 open, 310 merged, 213 closed without merge.
- Distinct PR head branch names: 921.
- Current canonical working source: `workpass70-source` @ `7547f5287b84a7d9b7109c0e5fdbe20bf95c9e33`.
- `main` is a separate release/report line at `9a789ee1af8fdaa3826dbc734d18e2fc00cde5bf`. A compare request from release tag `Neuro` to `workpass70-source` returned "No common ancestor". Do not assume a normal merge path between these histories.

Full ref/PR registers are in:
- `branch-census-2026-11-18.json/.md`
- `pull-request-census-2026-11-18.json/.md`

## Exact repeated branch tips

The largest exact-tip family contains 81 branch names at commit `82ea7a8b7c9b036e65c8b056acedd1176952dd8f`. They all point to the same commit object and tree. Four names in this family are still used as bases by open PRs and must be retained while those PRs remain open:
- `nk1-all-branches-merge-2026-10-23` — PR #109
- `nk1-integration-workspace-2026-10-22` — PR #131
- `rebuild` — PRs #121, #112, #91, #86
- `workpass206-runtime-evaluator-wiring` — PRs #138, #124

The remaining 77 names in this family have no open PR head/base reference in the census. This is a strong cleanup candidate set, but historical merged/closed PR records and any external references must still be preserved before deletion.

The other 11 duplicate-tip groups are listed in the machine-readable branch census. Some also have active PR references (e.g. #82, #83, #182, #192, #209, #284); those refs are not deletion candidates while their PR relationships remain active.

## Exact duplicate master-plan PRs on main

All three clusters below have the **same base commit** `48dffbf4f5c9b5474c8baff61f40b8bf0c5828e8`. Git commit objects were inspected: commits in each cluster have identical resulting tree SHAs and that same parent. PR file patches were also compared.

### 16-phase / 160-step plan: PRs #845, #849, #857

- Result tree SHA: `1bbd25f24f33372f3458c67ecec4b014553054d9`.
- All three commits have parent `48dffbf4f5c9b5474c8baff61f40b8bf0c5828e8`.
- All four changed-file patches are identical: `README.md`, `docs/NK1_COMPLETE_MASTER_PLAN_16_PHASES_RU.md`, `docs/PROJECT_PROGRESS_TRACKER_2026-10-30_RU.md`, `scripts/verify-master-plan-completeness.sh`.
- All three PRs are open. None of the three head branches is a base for another PR in the retrieved census.
- Proposed canonical PR candidate: #857 (latest of the three). #845 and #849 are exact tree duplicates, not additional implementation.

### 30-phase / 300-step plan: PRs #850, #858

- Result tree SHA: `323b16360994f6d9df9f58264176bbda435f7517`.
- Both commits have the same parent `48dffbf4f5c9b5474c8baff61f40b8bf0c5828e8`.
- Changed-file patch sets are identical: `README.md`, `docs/NK1_FINAL_MASTER_PLAN_2026-10-28_RU.md`, `scripts/verify-master-plan-completeness.sh`.
- Both PRs are open. Neither branch is used as another PR's base in the census.
- Proposed canonical PR candidate: #858 (latest of the pair).

### 10-stage master plan: PRs #851, #859

- Result tree SHA: `7ca0bccd2c51a2b16a3bcdf7ca21ef000429664e`.
- Both commits have the same parent `48dffbf4f5c9b5474c8baff61f40b8bf0c5828e8`.
- Both changed-file patches are identical: `docs/NK1_FINAL_MASTER_PLAN_2026-10-30_RU.md`, `scripts/verify-master-plan-completeness.sh`.
- Both PRs are open. Neither branch is used as another PR's base in the census.
- Proposed canonical PR candidate: #859 (latest of the pair).

These are exact duplicate resulting trees, not merely similarly named plans. They still target `main`, not the current canonical source branch, so they should not be merged blindly into `workpass70-source`.

## Avatar / unified-brain PR cluster — high overlap, not identical

Inspected PRs #848, #856, #844, #839, #843, #832 and #833 using complete changed-file lists and available unified patches.

- #848, #856 and #844 each touch the same 55 file paths (45 text/code/document files and 10 PNG assets).
- Their 45 comparable text patches are very close but **not all identical**:
  - #848 vs #856 differ in `README.md`, `docs/NK1_ECOSYSTEM_ANALYSIS_AND_ADAPTATION_RU.md`, `scripts/verify-organism-readiness.sh`, and `test_avatar.html`.
  - #848 vs #844 differ in `docs/NK1_ECOSYSTEM_ANALYSIS_AND_ADAPTATION_RU.md` and `test_avatar.html`.
  - #856 vs #844 differ in `README.md`, `scripts/verify-organism-readiness.sh`, and `test_avatar.html`.
- The eight Kurisu sprite PNG files have matching Git blob SHAs across the sampled heads.
- The two render/screenshot PNGs have differing blob SHAs between PR heads; they are not treated as duplicates. Preserve and review both variants.
- Each PR targets the same `main` base SHA above, but has a different head commit. Do not close or select one solely by creation date.

Further overlapping iterations exist: #839 (53 paths), #833 (45), #843 (30), #832 (28), #816 (23), #765 (19), #695 (20), #688 (17), and #641 (6). They need a fuller per-file winner/unique-content map before any merge. Shared path counts alone are not proof of duplicate implementation.

## October 19 archive baseline

Release metadata identifies:
- Primary release: `Neuro_Kurisu_WORKPASS70_2026-10-19.zip`, 135,290,615 bytes, SHA-256 `c5cf6a63661e28b30f976d03c8839a231341d73a09489b9066f062e29b224286`, tag `Neuro`.
- Later prerelease hotfix: `Neuro_Kurisu_WORKPASS70_HOTFIX1_2026-10-19.zip`, 136,354,713 bytes, SHA-256 `9effadfcf0d402b462dd9cf2fd5b5793742039c9260db80578be830952bf52eb`, tag `workpass70-hotfix1-2026-10-19`. GitHub release notes explicitly say this is an implementation hotfix, **not production-approved**.

The ZIP bytes have not been materialized in this runtime, so no archive extraction or per-file comparison has been performed. The archive hashes are recorded metadata, not evidence that current source files match those archives. The October 19 archive remains the requested reference baseline until a verified upload/extraction is available.

## Safe next actions

1. Preserve the three exact duplicate master-plan clusters in the register; choose one canonical PR per cluster only after owner confirmation, then close duplicate PRs without deleting their historical records.
2. Keep all branches that are bases or heads of open PRs. Do not delete old branch refs until every PR head/base, commit ancestry, tags and other references are checked.
3. For the avatar/unified-brain cluster, reconcile differing README claims, readiness verifier logic, ecosystem report content, HTML demo and two variant PNGs; choose/merge file-by-file rather than selecting one whole PR.
4. Review every branch outside exact-HEAD groups by commit ancestry, tree SHA, changed-file list, patch/blob hashes, dependencies, tests and PR relationships. Exact duplicate branch tips are only the first layer of the full audit.
5. Before claiming release integration, compare the selected source tree against an extracted October 19 ZIP and generate a reproducible manifest/SBOM/hash chain.

## Work performed in this pass

- Read and stored all 1,033 branch refs and HEAD SHAs.
- Read and stored all 937 PR records with head/base refs and SHAs.
- Identified all 12 exact duplicate HEAD groups.
- Compared 7 master-plan PR patches and resulting Git trees, confirming three exact tree clusters.
- Compared changed-file lists and patches for seven avatar/unified-brain PRs; checked blob SHAs for the eight sprite assets and two render/screenshot assets on selected heads.
- Created no source-code edits, did not merge any PR, did not close any PR, and did not delete any branch.
