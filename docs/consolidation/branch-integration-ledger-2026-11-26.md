# NK1 branch consolidation ledger — 2026-11-26

## Canonical refs

- Repository: `ailtron1ss-rgb/NK1`
- Authenticated account: `ailtron1ss-rgb`
- Canonical source: `workpass70-source@29ab13c98b3a603bc1667a99fffb8ee33dc9560d`
- Source tree: `f4a11dabb3ce566d05673bb85d6a819bae942c5c`
- `main`: `06e01cdd0a8e60ed70991f22e842887f544d1ebf`; not changed.

## Full census

- Branch refs: **1,160**, all 12 REST pages.
- Unique branch HEAD commits: **1,160**.
- Duplicate HEAD groups: **0**.
- Branch delta vs 2026-11-25: **+20** (1,140 → 1,160).
- Open PRs: **266**, all 3 REST pages.
- Open-PR delta vs 2026-11-25: **+16** (250 → 266).
- Method: paginated GitHub REST `GET /branches?per_page=100&page=N` and `GET /pulls?state=open&per_page=100&page=N`.

Full records are stored in:
- `branch-census-2026-11-26-live-part-01.jsonl` — first 600 branch refs.
- `branch-census-2026-11-26-live-part-02.jsonl` — remaining 560 branch refs.
- `open-pr-census-2026-11-26-live.jsonl` — all 266 open PRs.

No duplicate commit HEADs were found. A full tree-SHA comparison across all 1,160 refs was not performed; no global tree-duplicate claim is made.

## Selected aspect: P34 approval-ticket provenance

### Selective integration

- Existing PR: [#1191](https://github.com/ailtron1ss-rgb/NK1/pull/1191)
- Reused branch: `aspect/p34-consent-reference-ledger-20261125`
- Original donor HEAD: `5bb79e0b7fd3cf9f283c6c5682423d6a538f0b85`
- Original donor tree: `e1444f2d70af7f7b5120f633f223fe51dec85448`
- Original base: `9008a8982a5173304456bee2c604bd0bc8665964` (9 commits behind current source).
- First current-source integration: `88e0e4a014e3ee02d3c7ee0644cbd1d171bf2ac6`.
- Current exact PR head: `9e501e98a3934cf423a7aa73431861e2c41a8130`.
- Current tree: `ad12ffa8bb6b0ad72b61b18b8787d72ca9ff2fe1`.
- Current source is first parent; prior integration commit is second parent, preserving donor ancestry.
- PR compare: 3 commits ahead, 0 behind; exactly 3 files, +148 / −4.
- No other open PR uses the P34 branch as its base.

The donor was not merged wholesale. The three changed source files were identical to the old base at their source-side blobs, so the port did not overwrite intervening source changes. The selected source, donor and integration trees are distinct.

### Exact blob evidence

| File | Source blob | Donor blob | Current integration blob |
|---|---|---|---|
| `P34CausalPersonhood.ts` | `6b153ef70fd6e7c3bc7fc809afe92eb5f96f674b` | `5c50fe9188ddd520ef72954ba2ac0e0c3893c08c` | `4abb37d6b3e57b0cecee3c504d9c2fd1bf841026` |
| `OrganismCore.ts` | `fbec13c861953c0cbea0e9104d7d5715b48dabb4` | `698f491900d3c273c02c633b7fb77d4b6c3aafc0` | `698f491900d3c273c02c633b7fb77d4b6c3aafc0` |
| `p34-causal-personhood.mjs` | `592c83c4b20389b87959f081eb6a4ed9ba653387` | `24a63a6a31961b01726994446ab0e303dfd952b9` | `7856551a2bd3fe24566ada6b70ea28b5fdf1b6dd` |

### Preserved implementation

- Adds optional `ConsentRecord.referenceId` for the exact ActionGateway approval request ID.
- Keeps ActionGateway transport identity separate from P34's domain actor.
- Bounds and validates restored consent records; preserves legacy rows without fabricated references; deduplicates IDs.
- Uses own data descriptors for consent rows and array slots. Accessors are not invoked; throwing Proxy descriptor traps fail closed.
- Tests cover exact approval-ticket identity, legacy compatibility, malformed rows, accessors, array accessors and hostile proxies.

### CI gate

- First rebased head `88e0e4a...` exposed one test-fixture mistake: the test itself read a deliberately hostile Proxy via its `get` trap. The production descriptor-only path had passed preceding tests.
- The fixture now compares against the literal ID and is on current head `9e501e9...`.
- Latest exact-head status captured: **28/31 success, 0 failures, 3 pending**.
- PR remains open and unmerged. Merge only after all checks are complete and successful.

## Adjacent aspect candidates

- #1190 actor attribution and #1187 unknown-risk approval both touch ActionGateway; their exact-head runs had 6 failures each. Do not merge.
- #1192 API rate limiting: 21/21 checks pass, but base is stale and server behavior overlaps #1193. Reconcile proxy/client identity semantics first.
- #1193 HTTP perimeter/state growth: 75/75 checks pass; base is stale and workflow/server paths need selective rebase.
- #1194 memory write policy: 27/27 checks pass, but it is stacked on #1193. Its A/B measurements are unstable and show no demonstrated retrieval-quality gain; keep as shadow/opt-in research.
- #1170 runtime checkpoint envelope: 76/76 checks pass, but Draft remains pending independent review and real Android/Termux restart, storage and power-loss soak.
- #1175 world-to-appraisal integration: large 169-commit/32-file change; do not merge until exact-head CI and whole-diff review are complete.

## Cleanup decisions

- Branches deleted: **0**.
- Safe branch deletion candidates: **0**.
- Files, workflows, configs, links and integrations deleted: **0**.
- Exact HEAD uniqueness is not proof of tree uniqueness or absence of external consumers. Preserve every uncertain ref until dependency and blob/tree evidence is complete.

## Release boundary

- Published tag: `Neuro`; ZIP: `Neuro_Kurisu_WORKPASS70_2026-10-19.zip`.
- GitHub metadata: 135,290,615 bytes; SHA-256 `c5cf6a63661e28b30f976d03c8839a231341d73a09489b9066f062e29b224286`.
- The available GitHub text connector did not provide the binary asset for local download. ZIP contents and a locally recomputed digest are therefore unverified.
- No changes are claimed in `main` or the published Release ZIP.
