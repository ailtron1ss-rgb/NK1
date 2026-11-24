# NK1 / NeuroCore — branch integration ledger — 2026-11-24

## Current repository snapshot

- Branch refs: **1121**.
- Unique branch HEAD commits: **1121**.
- Exact duplicate HEAD groups: **0** in the `git/matching-refs/heads` snapshot.
- Open PRs: **235** (pages: 100 + 100 + 35).
- Current canonical source: `workpass70-source` @ `8328336c2156369875b21f0db06da71c3d83d6b9`.
- Current `main`: `06e01cdd0a8e60ed70991f22e842887f544d1ebf`.

Previous persisted census in PR #1133 recorded 1,124 refs / 1,106 unique HEADs / 3 exact duplicate groups / 18 excess refs and 250 open PRs. Current snapshot is 3 fewer refs and 15 fewer open PRs. The current branch census uses Git's `matching-refs/heads` endpoint; the prior snapshot used the paginated branches endpoint, so the count delta is retained as observed and should not be interpreted as proof that exactly three branch refs were deleted.

## Completed aspect consolidation — Avatar brain/render projection

<https://github.com/ailtron1ss-rgb/NK1/pull/1159> merged successfully.

- Donor #1155: 46 changed paths, HEAD tree `4c9144d51b4533922ec422678055e0e3a00dea4c`.
- Donor #1150 is an exact ancestor of #1155: 20 commits ahead, 0 behind.
- Donor #1154: 14 of 15 paths are represented by newer consolidated blobs; its unique UI integration note was preserved byte-for-byte as blob `db2c9eeaa38d665eacd0fb103898a5a7825362ea`.
- Donor #1148: fail-closed 3D quality gate, hidden unverified procedural geometry, retry/import/Live2D recovery, VRM disposal, and matching regression assertions were verified in the consolidated tree.
- Final source commit: `8328336c2156369875b21f0db06da71c3d83d6b9`; tree: `54a3571a8daf88a735938d3fd90cf1ba8910103a`.
- Parent: previous source `1d2509e0c71b5e4142c0bedcfcb339337e727ec5`.
- 47 files, +2,749 / −188. All 32 exact-head checks passed; Live2D browser acceptance passed after classifying intentional `net::ERR_ABORTED` cancellation of Live2D assets separately from transport failures.
- The final tree preserves the three newer MemoryOS2 source files from the current base; no stale MemoryOS2 blobs were imported.
- No package manifest or lockfile changes were included.
- Donor PRs #1148, #1150, #1154, #1155 were closed as superseded; their branch refs remain intact.

## SHA and duplicate evidence

The selected avatar trees are distinct: current source before merge `9b1855004803e4513cb772c4d60501ef5ca1f1e6`; #1155 `4c9144d51b4533922ec422678055e0e3a00dea4c`; #1154 `1a168692b8384b3109968305dee543e32bcf2379`; #1150 `dc4cf27860bf03ac1a899aa75c27aa8d41273fc1`; #1148 `5e4e7678cc659a2dd7ef07b2bde3a984f31c593d`; merged result `54a3571a8daf88a735938d3fd90cf1ba8910103a`. No exact tree duplicates were found in this selected group. The full current branch snapshot has no duplicate commit HEADs; a repository-wide 1,121-tree/blob equivalence scan has not been claimed.

## Cleanup and dependencies

- Branch refs deleted: **0**.
- Safe branch deletion candidates: **0** pending repository-wide workflow/document/reference consumer audit.
- Four donor PRs were closed only after verifying their implementation/tests/docs in the merged tree. Their branch refs remain available for historical comparison.
- Other stale branches remain preserved where ancestry, PR bases, or external references are not proven redundant.

## Release and main boundary

- `main` remains `06e01cdd0a8e60ed70991f22e842887f544d1ebf`; no changes from this aspect merge were pushed to main.
- Latest published Release tag `Neuro` points to `c2e8e4a78431734612f89318e79d3491643f24f3`; the tag is 35 commits behind current main.
- Release asset: `Neuro_Kurisu_WORKPASS70_2026-10-19.zip`, 135,290,615 bytes, metadata digest `sha256:c5cf6a63661e28b30f976d03c8839a231341d73a09489b9066f062e29b224286`.
- The binary ZIP could not be downloaded/materialized for content inspection. Its metadata digest is not a locally recomputed hash; no source/ZIP parity is claimed.

## Census artifacts

- Full branch snapshot: `docs/consolidation/branch-census-2026-11-24-live.jsonl`.
- Full open PR snapshot: `docs/consolidation/open-pr-census-2026-11-24-live.jsonl`.
