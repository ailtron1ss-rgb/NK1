# NK1 — project map, source-of-truth rules and repository ordering

**Snapshot date:** 2026-10-24  
**Purpose:** make the real codebase easier to navigate and safer to integrate without destroying useful history.  
**Status:** governance/navigation change only. It does not claim that all branches are merged, that CI passed, or that the release ZIP was rebuilt.

## 1. Read this first

Use this document as the repository's navigation and ordering index. It does not replace live GitHub state: before every implementation pass, refresh the exact branch SHA, diff, open PRs, and Actions results.

| Need | Canonical starting point | How to treat it |
|---|---|---|
| Repository map and branch/release rules | This file | Current navigation and policy; refresh when the layout or branch model materially changes |
| Work rules and evidence standards | [`AGENTS.md`](../AGENTS.md) | Normative working rules |
| Latest continuation notes | [`NEUROCORE_START_HERE.md`](../NEUROCORE_START_HERE.md) | Useful handover ledger, but branch names, PR numbers, and test state inside it must be rechecked live |
| Product direction and cognitive architecture | [Master strategy / brain map](NEUROCORE_MASTER_STRATEGY_AND_BRAIN_MAP.md) | Strategic reference; not proof that each layer is implemented |
| Remaining work | [Canonical backlog](NEURO_KURISU_FULL_RELEASE_BACKLOG_CANONICAL.md) | Planning queue; deduplicate against live code/issues before selecting work |
| Research and upstream candidates | [Research intake ledger](RESEARCH_INTAKE_LEDGER.md) | Queue only; a listed source is not automatically integrated or validated |
| Branch reconciliation | [Dated 104-ref branch inventory](BRANCH_INVENTORY_2026-10-24.md), [cross-branch inventory](CROSS_BRANCH_INTEGRATION_INVENTORY.md) and [integration workspace notes](INTEGRATION_WORKSPACE.md) | The dated inventory is a names snapshot, not a mass-merge/delete instruction |
| Dependency boundaries | [Module dependency contracts](architecture/module-dependency-contracts-ru.md) | Target-layer rules and audit scope; only exact-head test evidence can establish the current status |
| Hexis source selection and adaptation | [Operation Omega report](OPERATION_OMEGA_HEXIS_INTEGRATION_2026-10-24.md) | Explains source provenance, the archive boundary, and the limited NK1 adaptation |
| Old handovers, numbered passes and research reports | `docs/history/`, `docs/reports/`, and older files in `docs/` | Historical evidence, not a live status authority unless linked from a current handover |

**Rule:** an old report may explain *why* something exists, but current source code, the exact current diff, a reproducible test, and live GitHub state decide *whether it works now*.

## 2. Runtime and directory ownership

There must be one writable owner for each capability. Adapters can expose a capability; they must not silently become competing implementations.

| Path | Responsibility | Boundary |
|---|---|---|
| `runtime/neuro-kurisu/` | Canonical organism runtime: cognition, memory, motivation, learning, action and persistence | The only canonical writable organism/runtime owner |
| `runtime/neuro-kurisu/src/organism/core/` | Shared core policies, runtime coordination and stable primitives | Reuse shared policies; do not fork equivalent local copies |
| `runtime/neuro-kurisu/src/organism/developmental/MemoryOS2.ts` | Canonical memory storage/authority called out by existing repository rules | Memory adapters and legacy representations do not gain write authority |
| `runtime/neuro-kurisu/src/organism/memory/` | Retrieval components, experiments and benchmarks | Benchmarks/experiments must not mutate live memory or promote themselves |
| `runtime/neuro-kurisu/tests/` | Runtime behavioral regressions | A test file existing is not evidence it ran; record exact command and result |
| `app/` | UI, delivery shell, HTTP adapters, avatar and presentation | No second cognitive organism, memory authority, or shadow action gateway |
| `contracts/` | Ownership contracts, schemas, provenance, SBOM and integration manifests | Preserve source revision, license, digest and compatibility information |
| `tools/` | Audits, repository maintenance, verification and developer utilities | A tool's output is evidence only to the degree the check actually establishes |
| `scripts/` | Release/integration and project-level automation | Scripts must be repeatable, bounded and safe to rerun |
| `research/` | Experiments and candidate systems | Isolated/read-only by default; no implicit promotion into live runtime |
| `legacy/` | Historical source, pinned upstream snapshots and provenance | Preserve licenses/manifests; archived code is not an active dependency |
| `docs/` | Current navigation, architecture, runbooks, research decisions and historical records | Separate canonical pages from time-stamped reports; do not create a new competing master document |
| `app/.grok/` | App-builder/editor-specific references and workspace assets | Preserve its local platform contract; do not treat it as the canonical NK1 cognition layer |

The detailed current owner may move only with a coordinated code change: update contracts, imports/adapters, tests, manifests, and documentation together. A new module name is not permission to create a second owner.

## 3. Branches are work streams, not a release hierarchy

The repository contains multiple active-looking branch families: `main`, `rebuild`, `integration`, `feature/*`, `operation-omega-hexis-2026-10-24`, and many `workpass*` branches. Branch suffixes or higher pass numbers do not prove ancestry, completeness, or merge status.

### Observed state on 2026-10-24

- `main` pointed to `84119539afca904a91d5617b86ae334917a9e578` (last observed commit time: 2026-10-22 15:58 UTC).
- `integration` pointed to `cb0872f77c63396799a81b8e9a469b4fa6ddc936` (branch update observed 2026-10-24 11:43 UTC).
- `operation-omega-hexis-2026-10-24` pointed to `acbada2ff00092927070fce83d59871110dcd8a0` (branch update observed 2026-10-24 14:03 UTC).
- GitHub compare between `integration` and `operation-omega-hexis-2026-10-24` returned `status=diverged`, with 39 commits on the operation branch side and 17 commits on the integration side not shared by the other side. They are **not interchangeable snapshots**.
- `workpass331-unified-cognitive-kernel-2026-10-24` pointed to `5f318ad801f30ddd82150ed6be56baafc1c567a9` (commit time 2026-10-24 18:24 UTC). Compare against the operation branch returned `ahead`, 61 commits, 0 behind; this is a later source stream than the Hexis branch alone.
- Compare of `integration` to that unified-kernel branch returned `diverged`, `ahead_by=100`, `behind_by=17`, and 135 changed paths. Treat it as a large reconciliation; the returned count is not a validation result.
- `architecture/dependency-contracts-2026-10-24` and `optimization/deep-pass-2026-10-24` were updated near 19:26–19:27 UTC. Their compares to the unified-kernel branch remained divergent, with 2 and 6 unique commits respectively.
- The branch inventory query returned 104 refs including this documentation branch; see [the complete names snapshot](BRANCH_INVENTORY_2026-10-24.md). Only the selected heads and comparisons in that file were inspected in detail.
- The GitHub connector showed release assets dated 2026-10-19 (see §4), older than these source branches.

These are a dated observation, **not** a permanent statement of current HEAD. Recheck before acting.

### Operational branch policy

1. Keep `main` stable; do not push broad integration or experimental rebuilds directly into it.
2. Use the branch chosen for a specific work stream as the task base; state the exact base SHA in the work report. Do not claim that a task branch is the canonical release simply because it is newest by timestamp.
3. Before importing a branch, inspect the common ancestor, ahead/behind counts, changed paths, open PRs and exact-head checks. If histories diverge or have no common ancestor, port selected files deliberately rather than merging entire histories blindly.
4. Preserve all source branches while their content/provenance or PR state is unresolved. Do not mass-delete, force-push, or move branch refs based only on names, dates, or a pass number.
5. For each imported change record: source branch and SHA, target path, adaptation, license/provenance, regression added, exact tests run, and unresolved gates.
6. Keep one coherent PR/workstream per change category. Do not open concurrent PRs that rewrite the same files from unrelated bases.
7. A merged documentation/governance PR must not be presented as runtime integration or a completed release.

## 4. Release artifacts are separate from branch commits

The GitHub release listing inspected on 2026-10-24 returned two release entries. The newest published entry was the `workpass70-hotfix1-2026-10-19` prerelease and attached `Neuro_Kurisu_WORKPASS70_HOTFIX1_2026-10-19.zip` (136,354,713 bytes). The stable tag `Neuro` attached `Neuro_Kurisu_WORKPASS70_2026-10-19.zip` (135,290,615 bytes). Both are from 2026-10-19 and therefore do **not** establish that source changes made on 2026-10-20–24 are present in the shipped binary.

Release rules:

- A source commit, tag, release note or checksum file does not by itself replace a binary asset.
- A release is current only after the archive was built from an identified approved commit, uploaded, and the actual asset name/size/digest were re-read from GitHub.
- Preserve the previous asset until the replacement is verified. Keep a SHA-256 checksum and a release report tied to the exact commit.
- Never claim the user's canonical release ZIP has been refreshed unless the uploaded asset and its digest are independently observed.
- The GitHub file-write integration used for this work can update UTF-8 text files but cannot upload/replace a 135+ MB release ZIP. Binary release publication is therefore outside this pass.

## 5. Documentation ordering and historical reports

The docs area has accumulated many time-stamped snapshots at one level: numbered integration matrices, repeated backlog versions, `PROJECT_CURRENT_STATUS_*`, `WORKPASS*_HANDOVER`, research reviews, audits and implementation reports. Some are still valuable as evidence; their age and names make them poor navigation.

Use these rules immediately:

- Add no new numbered WorkPass report to the repository root. Put the concise durable handover in the canonical entry point, and the detailed report in `docs/reports/` or `docs/history/YYYY-MM/` according to whether it remains operational or is historical.
- Keep only one canonical current project map, one strategic brain map, one canonical backlog, one research intake ledger and one current operational runbook. Link to older reports rather than copying them into a new master file.
- Treat `CHANGELOG.md` as append-only concise change evidence. It is not a second full backlog or a substitute for a tested PR.
- Retain old reports until their links, provenance and unique decisions have been audited. Similar names are not proof of duplicate content.
- Run `npm run test:markdown-links` for the link-parser regression suite and `npm run audit:canonical-links` for strict checks of the canonical navigation pages. `npm run audit:markdown-links` inventories links across the non-vendored Markdown tree without failing the command on findings; do not enable strict full-tree mode until legacy/history debt has been triaged.
- Before moving a historical file, search all Markdown links, workflows, scripts, manifests and references in the release packaging path. Move only when the move preserves the historic record and all active links are updated. Prefer an index/redirect stub for externally referenced material.
- Maintain a dated archive manifest containing original path, new path, reason, SHA-256, and the commit that moved it. Never rewrite a historical report to make it look current.
- Clearly label documents `CURRENT`, `HISTORICAL`, `RESEARCH-ONLY`, `UNVERIFIED` or `SUPERSEDED` where that avoids ambiguity. For status evidence use the labels from `AGENTS.md`; never convert file counts or proposed work into a quality score.

**This pass intentionally does not mass-move or delete files.** Moving hundreds of documents before auditing links and release/restore references would make the repository less reliable, not more ordered.

## 6. Recommended execution order

### P0 — establish one navigation and truth model
1. Keep this map linked from `AGENTS.md` and the continuation ledger.
2. At every session, refresh live branch/PR/Actions state and note the chosen baseline SHA.
3. Distinguish source code, branch history, a proposed change, a tested change, and an uploaded release artifact.

### P1 — document and branch inventory
1. Build a current branch manifest with branch head SHA, last commit, open PR, ancestry group, owner/workstream, and status (active / candidate / merged / stale / unresolved).
2. Group flat historical docs by type/date in an inventory without moving them yet; calculate exact content hashes before declaring duplicates.
3. Inventory README/Markdown links, workflow paths, source-archive manifests and restore scripts; identify links to files that are proposed for relocation.
4. Confirm which of `integration`, `rebuild`, `workpass70-source` and newer work streams is the approved active source for the next release—do not infer it from a timestamp.

### P2 — reversible archival
1. Move one small, well-understood group at a time into `docs/history/YYYY-MM/` and keep its contents byte-for-byte unchanged.
2. Update all relative links and produce a move manifest plus a link-check regression.
3. Verify restore/packaging scripts and historical manifests after each group. Roll back the group if any reference is unresolved.

### P3 — release and ref consolidation
1. Once an approved source branch and its merge ancestry are explicit, run exact-head tests/typecheck and the targeted integration suite.
2. Build the canonical ZIP from that exact commit in the release pipeline; verify file manifest, size, digest and release asset after upload.
3. Only after PR/ref/asset checks settle should stale branches be marked for retirement. Never delete a branch while it is the only surviving pointer to evidence.

## 7. Session completion checklist

A work report must distinguish the following:

- **Changed:** exact files and commit(s), with a real GitHub URL.
- **Validated:** exact command/Actions run and result; write `NOT RUN` or `BLOCKED` when appropriate.
- **Preserved:** history, candidate sources and source provenance that were deliberately not deleted or merged.
- **Not done:** remaining content migration, branch reconciliation, runtime verification, and release synchronization.
- **Next:** one concrete highest-value step tied to a canonical owner.

Do not report a completion percentage for repository ordering based on the number of docs written. Progress should be measured against the explicit P0–P3 gates above.
