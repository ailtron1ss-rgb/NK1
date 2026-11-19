# NK1 — Memory & Retrieval aspect disposition (2026-11-19)

## Scope and canonical line

- Repository: `ailtron1ss-rgb/NK1`
- Canonical source line: `workpass70-source`
- Source HEAD when this aspect branch was opened: `1fc8446d95e4e1d64547b853224250248c965a29`
- Persistent aspect branch: `aspect/memory-and-retrieval`
- The separate `main` branch remains the release/report line; it is not a substitute for source integration.
- This record covers the memory, retrieval, HMX and memory-restore cluster only. It is not a claim that every repository branch has now been audited.

## Confirmed integrated implementation

### PR #954 — canonical HMX / MemoryOS2 / semantic retrieval integration

- Merged into `workpass70-source`.
- Merge commit: `7818b5ad785a33f1e3af81428d3aaf4ccf212f3f`.
- PR head: `7a6a68fc9cbe5968b0b5d5253138e6c5e9ad5700`.
- 22 changed files; 2,756 additions and 113 deletions.
- The subsequent source HEAD `1fc8446d95e4e1d64547b853224250248c965a29` is 262 commits ahead of the merge and is not behind it.

Preserved capabilities:
- `MemoryOS2` remains the single canonical durable owner.
- `MemoryFabric` coordinates canonical lifecycle writes and keeps MultiTimescaleMemory and SemanticMemoryGraph as derived/read-only projections.
- Restore reconciles graph projections from canonical MemoryOS2 rows.
- Lifecycle link writes are routed through MemoryFabric / MemoryOS2 with receipts and bitemporal revisions.
- HMX cluster membership and typed relationships are imported through the canonical path, not through a second memory authority.
- Semantic retrieval has a conservative similarity floor (default 0.72, bounded 0.60–0.95) and retains lexical fallback when vector candidates are weak.
- The semantic evaluation and CLI fixtures are diagnostic; synthetic fixtures do not establish real-world recall uplift or justify automatic promotion.

### Forget / P62 alias regression

The former defect was that P62 could retain a semantic graph hit under `semantic:<nodeId>` after the canonical memory was explicitly forgotten.

The merged integration captures graph aliases before deleting the graph projection, removes both the canonical ID and aliases from P62 recall history, and counts graph-only projection deletion as an applied forget. Regression coverage includes:
- `P62_SEMANTIC_ALIAS_FORGET=PASS`
- `GRAPH_ONLY_ORPHAN_FORGET_RESULT=PASS`

The current source `MemoryFabric.ts` still contains the alias capture and cleanup path (blob `c02e5988c7e15eadd38cf8e0b42d3e98b56a4a5c`).

## PR / branch family disposition

| PR | Current disposition | Consolidation decision |
|---|---|---|
| #954 | Merged | Canonical integration; do not transplant again |
| #953 | Closed, superseded by #954 | Preserve provenance; do not merge |
| #892 | Closed, superseded integration candidate | Its HMX lifecycle, projection and semantic-retrieval work was carried forward into #954 |
| #890 / #891 | Closed, superseded component candidates | Preserve provenance; no duplicate merge |
| #880 / #881 / #882 | Closed, superseded component candidates | Cluster links and projection/forget logic were carried forward into the later integrated line |
| #869 | Merged earlier canonical HMX import bridge | Retain as the importer foundation used by later work |
| #866 | Open Draft, older base, 21 changed files | Do not merge wholesale; isolate the export privacy/redaction delta and reconcile it against current HMX export code first |
| #900 | Open Draft, separate Negative Space Memory feature | Not an HMX duplicate; review as its own memory feature |

The closed superseded branches/PRs remain useful historical evidence. Their old heads are not additional implementations to merge over the current source.

## Unmerged useful delta: PR #866 export privacy

The current source has a Hexis HMX export UI, API method and server route, but these paths are absent from current source:
- `runtime/neuro-kurisu/src/organism/integration/hexis/HmxExportRedactor.ts`
- `runtime/neuro-kurisu/tests/integration/hexis-hmx-export-redactor.mjs`

PR #866 adds bounded pattern-based scrubbing for private keys, credential URLs, bearer/provider/GitHub tokens, AWS keys, JWT-like values, secret assignments, email addresses and phone numbers. It explicitly states that this is not a universal PII detector.

This is a useful security candidate, but PR #866 also rewrites the export document format and HMX accept/apply route semantics, while overlapping the already-integrated importer and memory code. Therefore:
1. do not merge the old 21-file PR as a unit;
2. preserve the standalone redactor and tests as donor evidence;
3. port only after reviewing the exact current export owner, consent boundary, metadata paths, and the UI/server contract;
4. add real export-boundary tests proving what leaves the process, not only regex unit tests;
5. describe redaction as pattern-based risk reduction, never as a guarantee that free text contains no sensitive information.

## Workflow consolidation candidates

- `.github/workflows/nk1-memory-projection-retrieval-integrity.yml` adds explicit projection/forget coverage and typecheck.
- `.github/workflows/nk1-semantic-retrieval-evaluation.yml` adds the isolated semantic benchmark and local-provider CLI contract.
- Existing `nk1-memory-integrity.yml` already overlaps much of the broad restore, vector, retrieval, metadata, bilingual and typecheck coverage.

Keep the focused test steps. Before deleting or merging workflow definitions, compare triggers, path filters, branch filters, required status contexts and execution cadence. No workflow was removed in this pass.

## October 19 reference archive

The user-designated primary baseline is the release tagged `Neuro`:
- Asset: `Neuro_Kurisu_WORKPASS70_2026-10-19.zip`
- Published size: 135,290,615 bytes
- Published SHA-256 recorded in the prior consolidation inventory: `c5cf6a63661e28b30f976d03c8839a231341d73a09489b9066f062e29b224286`

The later `workpass70-hotfix1-2026-10-19` asset is a prerelease and is not substituted for the primary `Neuro` archive. In this pass the primary ZIP bytes could not be materialized, so its hash remains release/inventory metadata and was not recomputed. No byte-level archive parity claim is made.

## Changes and safety

- Created the durable aspect ref `aspect/memory-and-retrieval` from source HEAD `1fc8446d95e4e1d64547b853224250248c965a29`.
- This report is documentation-only; it does not alter runtime source or release assets.
- No branch was deleted, force-pushed or rewritten.
- No superseded/closed PR was reopened or merged.
- PR #866 and #900 remain open Draft candidates.
- Branch-ref cleanup requires a separate complete PR-head/base, ancestry, tag, workflow, ruleset and downstream-reference disposition. A same-HEAD or similar branch name is not sufficient evidence for deletion.
