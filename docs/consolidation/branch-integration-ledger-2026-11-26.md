# NK1 branch consolidation ledger — 2026-11-26 (final post-merge)

## Canonical refs

- Repository/account: `ailtron1ss-rgb/NK1` / `ailtron1ss-rgb`
- Current source: `workpass70-source@7e601680c765d6dc94e51e4c8f5e729b48a6f56e`
- Source tree: `bd5eb23dc2d7c029c6b9ae9e10c49257590e571e`
- Previous source parent: `7802c32904ceab4b22bb007cebdade0404600783`
- `main`: `06e01cdd0a8e60ed70991f22e842887f544d1ebf`; unchanged.

## Current full census after the #1139 merge

- Branch refs: **1,160** across 12 REST pages.
- Unique branch HEAD commits: **1,160**.
- Duplicate HEAD groups: **0**.
- Branch delta vs 25 November: **+20** (1,140 → 1,160).
- Open PRs after the #1139 merge: **264** across 3 REST pages.
- Open-PR delta vs 25 November: **+14** (250 → 264); 265 were open immediately before #1139 merged.
- Full branch records: `branch-census-2026-11-26-live-part-01.jsonl` (600) and `branch-census-2026-11-26-live-part-02.jsonl` (560).
- Full open-PR records: `open-pr-census-2026-11-26-live.jsonl` (264).

The census uses paginated GitHub REST branch and `pulls?state=open` endpoints. No duplicate commit HEADs were found. A full tree-SHA comparison across all refs was not performed; no global tree-duplicate claim is made.

## Earlier 26 November merge recorded in the prior snapshot: PR #1191

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


## Additional real merge in this execution: PR #1139

- PR: [#1139 — Preserve revision edges across transaction-time corrections](https://github.com/ailtron1ss-rgb/NK1/pull/1139)
- Existing aspect branch reused: `aspect/memory-integrity-regression-suite-current-port-20261123`; ref remains at `a96bdcd466df6cfad719379aec3b9e58d04c58ae` and was not deleted.
- PR head was rebuilt on exact current source `7802c32904ceab4b22bb007cebdade0404600783`, retaining prior branch head `a3d424517ba668b31cefcc50a2773c385e9bfdd6` as a second parent. Compare against current source: 8 commits reachable / 0 behind; only two changed paths.
- Code change: `normalizeMemoryRevisionGraph` validates parent→child revision edges by immutable `createdAt` order, not mutable `recordedFromAt`. A later transaction-time correction to a historical predecessor must not invalidate its original revision edge.
- Regression: `memory-conflict-revision-graph.mjs` now constructs a valid lineage where parent `recordedFromAt` is later than the child while immutable creation order remains valid; restore preserves both reciprocal edge IDs and emits no invalid-edge finding.
- Exact-head PR commit: `a96bdcd466df6cfad719379aec3b9e58d04c58ae`; tree: `bd5eb23dc2d7c029c6b9ae9e10c49257590e571e`.
- Squash merge result: `7e601680c765d6dc94e51e4c8f5e729b48a6f56e`; result tree is identical (`bd5eb23dc2d7c029c6b9ae9e10c49257590e571e)); sole parent is the pre-merge source `7802c32904ceab4b22bb007cebdade0404600783`.
- New MemoryOS2 blob: `6160b7f2e0bab534658a34f52fbfbafa2ed0da62`; regression test blob: `aab97bc825095f28523749a00dc95420ea52f836`.
- Exact-head Actions census: **34/34 completed successfully**, 0 failures, 0 pending. Memory-integrity run `45777866397` explicitly logged `MEMORY_REVISION_IMMUTABLE_CREATION_ORDER=PASS`; revision-lineage restore run `45777866246` also succeeded.
- No unresolved review threads. Current source was the first parent, and the post-merge `workpass70-source` ref now equals `7e601680c765d6dc94e51e4c8f5e729b48a6f56e`.
- This is one new real merge in this execution. The earlier #1191 merge is historical and is not recounted.

## Memory-aspect duplicate and supersession evidence

- The earlier #1139 port's workflow commands and prior test lines were already represented in current source: 9 of 13 old test blobs were exact matches; the remaining four current tests are expanded replacements. The current workflow contains all previous workflow lines plus broader memory-integrity gates.
- The earlier #1139 MemoryOS2 changes were also present in source before this new fix: byte-estimate normalization, implicit-conflict byte accounting, reverse contradiction-link byte accounting, historical-ID revision-tip resolution and update-signal tip resolution. The old branch history remains reachable through the updated branch's second parent; no branch or file was deleted.
- Selected whole-tree SHAs are distinct: source-before `ad12ffa8bb6b0ad72b61b18b8787d72ca9ff2fe1`; #1139 result `bd5eb23dc2d7c029c6b9ae9e10c49257590e571e`; #1149 `8aa0ce38174116d0117e635e694d5ab00bbf8903`; #1153 `efc1faa0a6686ca5f5f356da1da515f25fbbdd80`; #1194 `077a8ba72738113282cc14a5bfde907229d70d1e`; MemoryOS2 modernization branch `9b1855004803e4513cb772c4d60501ef5ca1f1e6`; capacity-lifecycle branch `f9cb34fa02e31997d95ff8ea673dba80c7486740`. No whole-tree duplicate was found in this selected group.
- Global duplicate HEAD census remains 0 across 1,160 branches. A global tree-SHA census was not performed.
- Open memory work remains blocked: #1149 (explicit-ID/write integrity; 46 ahead / 18 behind and 15 changed paths in the current-source compare), #1153 (mixed with already-integrated SelfAuthorship; 5 ahead / 18 behind), and #1194 (29 changed paths and based on the separate HTTP-perimeter aspect line, not `workpass70-source`). They remain open and untouched; no unique changes were discarded.
- Safe branch-retirement candidates: **0**. No branches, files, workflows, links or configs were deleted.

## Current release boundary

- `main` remains `06e01cdd0a8e60ed70991f22e842887f544d1ebf`; it was not changed.
- Release tag `Neuro` remains `c2e8e4a78431734612f89318e79d3491643f24f3`, with `Neuro_Kurisu_WORKPASS70_2026-10-19.zip` (135,290,615 bytes; GitHub metadata digest `sha256:c5cf6a63661e28b30f976d03c8839a231341d73a09489b9066f062e29b224286`).
- The ZIP binary could not be downloaded in this execution environment, so its bytes were not re-hashed and its contents were not inspected. No claim is made that #1139 is in `main` or the Release ZIP.
- `workpass70-source` and `main` currently have no common ancestor in GitHub compare; the Release tag is 35 commits behind `main`. Source/main divergence remains a separate release-lineage blocker.
