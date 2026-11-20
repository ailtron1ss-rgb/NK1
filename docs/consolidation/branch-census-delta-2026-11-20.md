# NK1 branch / PR census delta — 2026-11-20

## Last fully paginated snapshot

The complete GitHub API pagination performed before opening PR #1031 returned:

- **1,032 branch refs**
- **1,016 unique HEAD SHAs**
- **1 exact duplicate-tip family** with 17 refs
- **16 excess aliases**
- **306 open PRs**: 155 based on `workpass70-source`, 151 on other refs
- **72 distinct open-PR base refs**, 306 distinct head refs

The 17-ref family remains at `82ea7a8b7c9b036e65c8b056acedd1176952dd8f`; its full names are in [the 19-Nov live census](consolidation/branch-census-2026-11-19.md) and the later [20-Nov execution log](consolidation/branch-consolidation-execution-log-2026-11-19.md).

## Known delta after that snapshot

- PR [#1031](https://github.com/ailtron1ss-rgb/NK1/pull/1031) added one new branch ref: `fix/neurosymbolic-concept-restore-integrity-20261120`.
- PR #1031 targeted `workpass70-source` at `960a2d540ef952486a0271a0e5332caec601b36a` and is now merged as `950989fe0081e3760471d44beb6e95bb9e0bc82b`.
- PR #1032 adds the second known ref. After #1031 merged and #1032 remained open, the derived known minimum is **1,034 refs / 1,018 unique HEADs / 307 open PRs**. This is a derived delta, not a claim that a second full pagination was completed; concurrent external changes remain possible.
- PR #1031 was squash-merged. No branch was deleted or force-updated.

## Current source

- `workpass70-source` runtime baseline after #1031: `950989fe0081e3760471d44beb6e95bb9e0bc82b` (before the documentation-only update in #1032).
- `main`: `06e01cdd0a8e60ed70991f22e842887f544d1ebf`
- Exact source Actions for `960a2d540ef952486a0271a0e5332caec601b36a`: 11/11 SUCCESS.
- External/observed source integration: PR #868, bounded MeTTa concept export bridge, merge commit `960a2d540ef952486a0271a0e5332caec601b36a`. It serializes bounded facts only; no Hyperon execution worker is connected.

## Safety interpretation

Equal HEAD is not sufficient for branch deletion. Every alias still requires joins against open and closed PR heads/bases, tags, workflows, downstream branch ancestry, deployments, rulesets and external references. Keep the 17-ref family intact until a complete disposition ledger exists.


## Second known delta — PR #1032

- Documentation PR [#1032](https://github.com/ailtron1ss-rgb/NK1/pull/1032) uses `maintenance/nk1-live-checkpoint-2026-11-20` as the second new ref after the 1,032/1,016/306 full snapshot.
- Its prior exact head `dcdac4cebfedd451f89406ba0eec3357cb58179f` passed 5/5 Actions; this checkpoint refresh adds a new head that must be revalidated before merge.
- After #1031 merged, the known minimum was **1,034 branch refs / 1,018 unique HEADs / 307 open PRs**. This remains a delta, not a new complete pagination; no second full PR-base pagination was performed.
- PR #1031 final head `46d4179171ae16a2b9fb2876efc7db0a815eef03` passed all 8/8 exact-head Actions and was merged as `950989fe0081e3760471d44beb6e95bb9e0bc82b`.
