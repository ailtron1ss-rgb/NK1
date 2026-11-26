# NK1 branch consolidation ledger — 2026-11-26 (post-merge)

## Canonical refs

- Repository/account: `ailtron1ss-rgb/NK1` / `ailtron1ss-rgb`
- Current source: `workpass70-source@7802c32904ceab4b22bb007cebdade0404600783`
- Current source tree: `ad12ffa8bb6b0ad72b61b18b8787d72ca9ff2fe1`
- Previous source parent: `29ab13c98b3a603bc1667a99fffb8ee33dc9560d`
- `main`: `06e01cdd0a8e60ed70991f22e842887f544d1ebf`; unchanged.

## Full census after merge

- Branch refs: **1,160** (12 REST pages).
- Unique branch HEAD commits: **1,160**.
- Duplicate HEAD groups: **0**.
- Branch delta vs 25 November: **+20** (1,140 → 1,160).
- Open PRs after merge: **265** (3 REST pages).
- Open-PR delta vs 25 November: **+15** (250 → 265); the pre-merge snapshot during this run was 266.
- Full branch records: `branch-census-2026-11-26-live-part-01.jsonl` (600) and `branch-census-2026-11-26-live-part-02.jsonl` (560).
- Full open-PR records: `open-pr-census-2026-11-26-live.jsonl` (265).

The census uses paginated GitHub REST branch and `pulls?state=open` endpoints. No duplicate commit HEADs were found. A full tree-SHA comparison across all refs was not performed; no global tree-duplicate claim is made.

## New real merge this run: PR #1191

<badge>Not applicable in source docs</badge>

- PR: [#1191 — Bind consent records to exact approval tickets](https://github.com/ailtron1ss-rgb/NK1/pull/1191)
- Donor branch: `aspect/p34-consent-reference-ledger-20261125`
- Original donor HEAD: `5bb79e0b7fd3cf9f283c6c5682423d6a538f0b85`
- Rebased exact PR head: `9e501e98a3934cf423a7aa73431861e2c41a8130`
- Merge commit: `7802c32904ceab4b22bb007cebdade0404600783`
- Merge tree: `ad12ffa8bb6b0ad72b61b18b8787d72ca9ff2fe1`
- Parents: current source `29ab13c98b3a603bc1667a99fffb8ee33dc9560d` first; exact PR head `9e501e98a3934cf423a7aa73431861e2c41a8130` second.
- 3 files; +148 / −4.
- Pre-merge compare: 4 commits ahead / 0 behind, 3 changed files.
- Exact-head checks: **31/31 success, 0 failure, 0 pending**.
- Review threads: 0; submitted reviews: 0; mergeability: clean.
- The PR branch was preserved; no branch deletion was performed.

### What was integrated

- Optional structured `ConsentRecord.referenceId` stores the exact ActionGateway approval request ID.
- P34 domain actor remains separate from ActionGateway transport principal.
- Consent restore is bounded, validates row fields, preserves legacy rows without fabricated references, deduplicates IDs and reads own data descriptors only.
- Accessor-backed rows and array slots are rejected without invoking getters; descriptor-trap failures fail closed.
- Tests cover exact approval-ticket identity, legacy restore, malformed rows, accessors and hostile Proxy traps.

### Exact blob evidence

| File | Source blob | Donor blob | Merged blob |
|---|---|---|---|
| `P34CausalPersonhood.ts` | `6b153ef70fd6e7c3bc7fc809afe92eb5f96f674b` | `5c50fe9188ddd520ef72954ba2ac0e0c3893c08c` | `4abb37d6b3e57b0cecee3c504d9c2fd1bf841026` |
| `OrganismCore.ts` | `fbec13c861953c0cbea0e9104d7d5715b48dabb4` | `698f491900d3c273c02c633b7fb77d4b6c3aafc0` | `698f491900d3c273c02c633b7fb77d4b6c3aafc0` |
| `p34-causal-personhood.mjs` | `592c83c4b20389b87959f081eb6a4ed9ba653387` | `24a63a6a31961b01726994446ab0e303dfd952b9` | `7856551a2bd3fe24566ada6b70ea28b5fdf1b6dd` |

The source, donor and merged tree SHAs differ. The three source-side blobs were identical to their old-base blobs before transplant, so the selective port did not overwrite intervening source edits.

## Other aspect groups and blockers

- #1190 actor attribution and #1187 unknown-risk approval overlap ActionGateway; their exact-head checks had 6 failures each. Do not merge.
- #1192 API rate limiting: 21/21 checks pass but is based on an older source and overlaps #1193 server identity/rate-limit semantics.
- #1193 HTTP perimeter/state growth: 75/75 checks pass but requires a current-source selective rebase and workflow/server diff review.
- #1194 memory write policy: 27/27 checks pass but is stacked on #1193; A/B measurements remain unstable and show no demonstrated retrieval-quality gain.
- #1170 runtime checkpoint envelope: 76/76 checks pass; Draft still requires independent review and a real Android/Termux restart/storage/power-loss soak.
- #1175 world-to-appraisal integration: large 169-commit/32-file line; keep blocked until exact-head CI and full diff review are complete.

## Post-merge CI

The pre-merge exact-head CI was green at 31/31. A separate post-merge run on `7802c329...` had 1/17 checks complete successfully and 16 pending at the latest capture; monitor it for regressions.

## Cleanup and release

- Branches deleted: **0**.
- Safe branch deletion candidates: **0**.
- Files/workflows/configs/links/integrations deleted: **0**.
- Published Release remains tag `Neuro`, ZIP `Neuro_Kurisu_WORKPASS70_2026-10-19.zip`, 135,290,615 bytes, GitHub metadata SHA-256 `c5cf6a63661e28b30f976d03c8839a231341d73a09489b9066f062e29b224286`.
- Binary ZIP contents and locally recomputed digest remain unverified. No changes are claimed in `main` or Release.
