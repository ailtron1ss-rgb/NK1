# NK1 pull-request census — 2026-11-19

## Live result

- Total PRs: **942**
- Open: **412**
- Merged: **313**
- Closed without merge: **217**
- Distinct PR head refs: **926**
- Distinct open PR head refs: **412**

## Delta from previous census

- Previous total: 937 (414 open / 310 merged / 213 closed unmerged).
- The live census includes all PRs returned by all API pages; no PRs were closed or merged by the census update.

## Open PRs by base branch (top 15)

| Base branch | Open PRs |
|---|---:|
| `workpass70-source` | 206 |
| `main` | 65 |
| `integration` | 13 |
| `work/nk1-final-release-gate-2026-10-26-r3` | 9 |
| `aspect/neurok-engineering-os-20261103` | 5 |
| `audit/repository-wiring-contracts-2026-10-25` | 5 |
| `nk1-hexis-canonical-apply-2026-10-27` | 4 |
| `nk1-workpass508-retrieval-abstention-evidence-2026-10-27` | 4 |
| `fix/outcome-projection-index-restore-2026-10-26` | 4 |
| `workpass334-inner-imperative-homeostasis-2026-10-24` | 4 |
| `rebuild` | 4 |
| `aspect/memory-spatial-recall-20261103` | 3 |
| `aspect/neko-voice-perception-adapters-20261104` | 2 |
| `aspect/code-assimilation-archive-extraction-20261104` | 2 |
| `feature/memory` | 2 |

## PRs #949–#953

| PR | Title | State | Draft | Head | Base |
|---:|---|---|---|---|---|
| [#949](https://github.com/ailtron1ss-rgb/NK1/pull/949) | [NK1][Consolidation] Полная перепись веток и карта дублирующихся PR | open | yes | `consolidation/nk1-branch-census-20261118` | `workpass70-source` |
| [#950](https://github.com/ailtron1ss-rgb/NK1/pull/950) | [NK1][Embodiment] Сохранить канонические спрайты Курису и варианты render-доказательств | closed / merged | no | `aspect/kurisu-embodiment-assets-20261118` | `workpass70-source` |
| [#951](https://github.com/ailtron1ss-rgb/NK1/pull/951) | [NK1][Embodiment] Port isolated 3D skeletal kinematics into canonical source | open | yes | `aspect/embodiment-skeletal-3d-kinematics-20261119` | `workpass70-source` |
| [#952](https://github.com/ailtron1ss-rgb/NK1/pull/952) | [NK1][Consolidation] Сохранить спецификацию N.E.K.O. plugin policy | closed / merged | no | `aspect/tooling-neko-plugin-integrity-20261119` | `workpass70-source` |
| [#953](https://github.com/ailtron1ss-rgb/NK1/pull/953) | [NK1][Memory] Reconcile HMX projections and semantic gates with bitemporal MemoryOS2 | open | yes | `aspect/memory-hmx-semantic-integrity-20261119` | `workpass70-source` |

## Consolidation notes

- #949 remains Draft and audit-only; its recorded base checkpoint is `7547f528…`, while current source has since advanced after #952 and #950. Recheck merge-base and rebase before merge.
- #950 is merged: 8 sprite PNGs, one provenance note and 4 visual-evidence PNGs were added to the canonical source. This preserves assets, but does not prove renderer/UI integration.
- #952 is merged: N.E.K.O. policy reconciliation and Russian manifest-policy documentation were added; the file-level report identifies old gateway/ingress branches whose useful code is already superseded by stronger merged code.
- #951 and #953 remain Draft. Review every changed file and exact-head CI before integration; neither is treated as disposable or safe to merge merely by similar naming.
- No branch deletion is authorized by this census. Preserve head/base refs and provenance until dependency and code-level review completes.

## Post-merge refresh — PR #951

- #951 now **MERGED** at `2026-11-19T05:14:52Z`; merge commit `aa2b385153ddc316eadf61f87e2c0803d7d59d98` is the current `workpass70-source` HEAD. It introduced three renderer-neutral kinematics modules plus tests and package-script wiring.
- #953 remains Draft. Current comparison against source `aa2b385…` is diverged: PR head is 22 commits ahead, source is 2 commits ahead of merge-base `9742b5a…`. It should be rebased/revalidated after #951.
- #953 has 22 changed files (+2,668/-113) in the latest PR metadata. Workflow runs associated with its head include two pending jobs (`Hexis HMX canonical memory bridge`, `WorkPass81 memory restore integrity`); the other listed runs were completed successfully at the time checked.
- #950 and #952 remain merged; #949 remains Draft/audit-only.


## Latest exact-head workflow refresh

- #951 is merged. Its donor head `0a289c1…` has 44/44 completed successful workflow runs.
- #953 remains Draft (22 files, +2,668/-113). Its latest exact-head workflow query returned 50/50 completed successful runs, with no pending or failed runs. The earlier two-pending note above records a prior sample and is superseded.
- #953 still has a source divergence: 22 PR commits ahead and 2 source commits ahead of merge-base `9742b5a…`. A green CI run does not remove the need to reconcile that base and review the complete patch.
