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
- PR #1031 is open, Draft, and targets `workpass70-source` at `960a2d540ef952486a0271a0e5332caec601b36a`.
- By this known delta, the observed minimum is **1,033 refs / 1,017 unique HEADs / 307 open PRs**. This is a derived delta, not a claim that a second full pagination was completed after PR #1031; concurrent external changes remain possible.
- No branch was deleted or force-updated. No PR was merged or closed.

## Current source

- `workpass70-source`: `960a2d540ef952486a0271a0e5332caec601b36a`
- `main`: `06e01cdd0a8e60ed70991f22e842887f544d1ebf`
- Exact source Actions for `960a2d540ef952486a0271a0e5332caec601b36a`: 11/11 SUCCESS.
- External/observed source integration: PR #868, bounded MeTTa concept export bridge, merge commit `960a2d540ef952486a0271a0e5332caec601b36a`. It serializes bounded facts only; no Hyperon execution worker is connected.

## Safety interpretation

Equal HEAD is not sufficient for branch deletion. Every alias still requires joins against open and closed PR heads/bases, tags, workflows, downstream branch ancestry, deployments, rulesets and external references. Keep the 17-ref family intact until a complete disposition ledger exists.


## Second known delta — PR #1032

- Draft documentation PR [#1032](https://github.com/ailtron1ss-rgb/NK1/pull/1032) adds `maintenance/nk1-live-checkpoint-2026-11-20` as a second new ref after the 1,032/1,016/306 full snapshot.
- Its exact head `0e8ea75638a3b51f10131e08f5a966e2f7350f22` passed 5/5 Actions.
- Together with PR #1031, the known minimum after the last full pagination is **1,034 branch refs / 1,018 unique HEADs / 308 open PRs** (157 source-base, 151 other-base). This remains a delta, not a new complete pagination.
- PR #1031 advanced to `da4bc27c716d9207de1343e9d2d3aac7efa364c2`; all 8/8 exact-head Actions passed, including explicit cap/counter restore regressions.
