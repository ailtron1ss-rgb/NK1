# NK1 branch consolidation ledger — 2026-11-26 (final post-merge)

## Canonical refs

- Repository/account: `ailtron1ss-rgb/NK1` / `ailtron1ss-rgb`
- Current source: `workpass70-source@7802c32904ceab4b22bb007cebdade0404600783`
- Source tree: `ad12ffa8bb6b0ad72b61b18b8787d72ca9ff2fe1`
- Previous source parent: `29ab13c98b3a603bc1667a99fffb8ee33dc9560d`
- `main`: `06e01cdd0a8e60ed70991f22e842887f544d1ebf`; unchanged.

## Full census after merge

- Branch refs: **1,160** across 12 REST pages.
- Unique branch HEAD commits: **1,160**.
- Duplicate HEAD groups: **0**.
- Branch delta vs 25 November: **+20** (1,140 → 1,160).
- Open PRs after merge: **265** across 3 REST pages.
- Open-PR delta vs 25 November: **+15** (250 → 265); 266 were open immediately before #1191 merged.
- Full branch records: `branch-census-2026-11-26-live-part-01.jsonl` (600) and `branch-census-2026-11-26-live-part-02.jsonl` (560).
- Full open-PR records: `open-pr-census-2026-11-26-live.jsonl` (265).

The census uses paginated GitHub REST branch and `pulls?state=open` endpoints. No duplicate commit HEADs were found. A full tree-SHA comparison across all refs was not performed; no global tree-duplicate claim is made.

## One new real merge this run: PR #1191

- PR: [#1191 — Bind consent records to exact approval tickets](https://github.com/ailtron1ss-rgb/NK1/pull/1191)
- Donor branch: `aspect/p34-consent-reference-ledger-20261125`
- Original donor HEAD: `5bb79e0b7fd3cf9f283c6c5682423d6a538f0b85`
- Rebased exact PR head: `9e501e98a3934cf423a7aa73431861e2c41a8130`
- Merge result: `7802c32904ceab4b22bb007cebdade0404600783`
- Merge tree: `ad12ffa8bb6b0ad72b61b18b8787d72ca9ff2fe1`
- Parents: current source `29ab13c98b3a603bc1667a99fffb8ee33dc9560d` first; exact PR head `9e501e98a3934cf423a7aa73431861e2c41a8130` second.
- 3 files; +148 / −4.
- Pre-merge compare: 4 commits ahead / 0 behind, 3 changed files.
- Exact-head checks: **31/31 success, 0 failure, 0 pending**.
- Post-merge checks on merge commit: **17/17 success**.
- Review threads: 0; submitted reviews: 0; mergeability: clean.
- Donor branch remains present; no branch deletion was performed.

### Integrated behavior

- Optional structured `ConsentRecord.referenceId` stores the exact ActionGateway approval request ID.
- P34 domain actor remains distinct from ActionGateway transport principal.
- Consent restore is bounded, validates row fields, preserves legacy rows without fabricated references, deduplicates IDs and reads own data descriptors only.
- Accessor-backed rows and array slots are rejected without invoking getters; descriptor-trap failures fail closed.
- Tests cover exact approval-ticket identity, legacy restore, malformed rows, accessors and hostile Proxy traps.

### Exact blob evidence

| File | Source blob | Donor blob | Merged blob |
|---|---|---|---|
| `P34CausalPersonhood.ts` | `6b153ef70fd6e7c3bc7fc809afe92eb5f96f674b` | `5c50fe9188ddd520ef72954ba2ac0e0c3893c08c` | `4abb37d6b3e57b0cecee3c504d9c2fd1bf841026` |
| `OrganismCore.ts` | `fbec13c861953c0cbea0e9104d7d5715b48dabb4` | `698f491900d3c273c02c633b7fb77d4b6c3aafc0` | `698f491900d3c273c02c633b7fb77d4b6c3aafc0` |
| `p34-causal-personhood.mjs` | `592c83c4b20389b87959f081eb6a4ed9ba653387` | `24a63a6a31961b01726994446ab0e303dfd952b9` | `7856551a2bd3fe24566ada6b70ea28b5fdf1b6dd` |

The source, donor and merged tree SHAs are distinct: source `f4a11dabb3ce566d05673bb85d6a819bae942c5c`, donor `e1444f2d70af7f7b5120f633f223fe51dec85448`, merge `ad12ffa8bb6b0ad72b61b18b8787d72ca9ff2fe1`. The OrganismCore donor blob was reused exactly in the merge; the other two merged blobs include the added restore hardening/tests.

The three source-side blobs matched their old-base blobs before transplant, so the selective port did not overwrite intervening source changes.

## Adjacent aspect candidates and blockers

| PR | Current-source compare | Exact-head checks | Decision |
|---|---:|---:|---|
| #1187 | 3 ahead / 14 behind, 2 files | 8/14 success, 6 failures | Blocked; overlaps ActionGateway with #1190 |
| #1190 | 3 ahead / 14 behind, 7 files | 70/76 success, 6 failures | Blocked; ActionGateway actor attribution needs repair |
| #1192 | 5 ahead / 14 behind, 4 files | 21/21 success | Stale; reconcile server client-identity semantics with #1193 |
| #1193 | 2 ahead / 14 behind, 10 files | 75/75 success | Stale; selectively rebase server/workflow paths |
| #1194 | 7 ahead / 14 behind, 29 files | 27/27 success | Stacked on #1193; A/B byte effects unstable, no demonstrated retrieval-quality gain |
| #1170 | 19 ahead / 5 behind, 12 files | 76/76 success | Draft; independent review and Android/Termux restart/storage/power-loss soak still required |
| #1175 | 169 ahead / 14 behind, 32 files | Whole current diff not accepted as verified | Keep blocked pending exact-head CI and full diff review |

## Cleanup decisions

- Branches deleted: **0**.
- Safe branch deletion candidates: **0**.
- Files/workflows/configs/links/integrations deleted: **0**.
- Exact HEAD uniqueness does not prove tree uniqueness or absence of external consumers. Preserve uncertain refs until complete dependency and blob/tree evidence exists.

## Release boundary

- Published tag: `Neuro`; ZIP: `Neuro_Kurisu_WORKPASS70_2026-10-19.zip`.
- GitHub metadata: 135,290,615 bytes; SHA-256 `c5cf6a63661e28b30f976d03c8839a231341d73a09489b9066f062e29b224286`.
- Binary asset could not be downloaded through the available GitHub text connector. ZIP contents and a locally recomputed digest are unverified.
- No changes are claimed in `main` or the published Release ZIP.
