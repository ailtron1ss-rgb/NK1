# Documentation ordering results — 2026-10-24

**Exact source commit:** `76ddaa452fbda6810aa89158f1b627dbffa102fc`  
**GitHub Actions:** [Documentation links and dependency boundaries](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40129179747) — **success** on that exact SHA.  
**Scope:** repository-tree inventory, active-scope Markdown/reference inventory, link regression suite, architecture dependency boundaries and transitive server-import graph. This is an engineering inventory, not a claim that the whole project is release-ready.

## 1. Repository tree counts

The recursive Git tree returned on the exact commit was not truncated.

| Measure | Count |
|---|---:|
| Tree entries | 10,631 |
| Tracked file blobs | 9,758 |
| Markdown / MDX files in the full tree | 2,990 |
| Markdown files under `docs/`, including nested folders | 346 |
| All file types under `docs/`, including nested folders | 646 |
| Markdown files directly under `docs/` (not nested) | 290 |

## 2. Exact content duplicates vs repeated file-name families

The full Git tree was grouped by Git blob SHA. This comparison covers the full Markdown tree, including vendor/upstream snapshots that are excluded from the active-scope inventory scanner.

**Full-tree exact duplicates: 2 groups / 5 files.** None of those groups touches `docs/`.

| Blob SHA | Identical files | Paths |
|---|---:|---|
| `71b68ff6752d68b4b71f97aa025b57f768429ef3` | 3 | `app/.grok/skills/generate2dmap/SOURCE.md`; `app/.grok/skills/generate2dsprite/SOURCE.md`; `app/.grok/skills/video2dsprite/SOURCE.md` |
| `0ed6e442960139749f1c78c2dd8ad64dc6382ed2` | 2 | `legacy/input-archives/hexis-main-2026-10-08/README.md`; `legacy/input-archives/hexis-selected-2026-10-24/README.md` |

These are preserved. Their locations carry upstream/source-archive provenance, and identical README content does not prove that either archive directory can be removed.

The active-scope scanner excludes `.git`, `node_modules`, `dist`, `coverage`, `legacy/input-archives/` and `app/.grok/`. Within that scope, it found **0 exact-content duplicate groups** on this run.

Repeated filename patterns are a separate signal, not exact duplicates:

| Snapshot family | Files |
|---|---:|
| Current-status snapshots | 57 |
| WorkPass reports / implementation reports | 36 |
| WorkPass handovers | 30 |
| WorkPass task lists, including Cyrillic lists | 22 |
| Roadmap-gap snapshots | 21 |
| Full-release backlog versions | 15 |
| WorkPass code-change ledgers | 14 |
| Integration matrices | 8 |
| WorkPass audit/inventory ledgers | 6 |
| WorkPass checkpoints | 4 |
| Open-source review snapshots | 2 |
| **Total family matches** | **215** |

Content differences and unique decisions must be reviewed before any family is consolidated.

## 3. Active-scope local-reference inventory

The output of `npm run audit:doc-inventory` on the exact SHA reported:

| Measure | Count |
|---|---:|
| Markdown files scanned | 2,644 |
| Local Markdown link destinations | 187 |
| Exact duplicate groups in included scope | 0 |
| Filename families | 11 |
| Files matching the filename families | 215 |
| Zero inbound Markdown-link candidates | 2,588 |
| Non-Markdown text/config/source files scanned | 4,639 |
| Markdown files with a matching reference from scanned non-Markdown text | 2,283 |
| Source-file / target reference hits | 17,271 |
| Files with no inbound links in either scanned tree | 324 |
| Text-file read errors | 0 |
| Missing/unreadable Markdown files | 0 |

A no-inbound result means only that this scanner did not find a local path or basename reference within the formats and directories it scanned. It does **not** prove that a file is disposable: external links, Git history, user expectations, unscanned generated/opaque files, release provenance and semantic value remain separate considerations.

## 4. Validation evidence

The exact-head workflow passed every stage:

- Markdown-link parser regressions: **5 passed, 0 failed**.
- Documentation-inventory regressions: **3 passed, 0 failed**.
- Architecture/dependency boundary regressions: **4 passed, 0 failed**. The auditor reported `sourceFiles=2229`, `canonicalFiles=634`, `dependencyEdges=4550`, `missing=0`, `cycles=0`, `legacyLeakage=0`, `boundaryViolations=0`.
- Transitive server-import audit: **1 passed, 0 failed**; `checkedFiles=575`, `checkedEdges=1873`, `unresolvedCount=0`.
- Strict canonical navigation/archive links: **15 files, 0 issues**.
- Runtime cognition tests, application build and release ZIP regeneration were not part of this documentation/architecture workflow and are not claimed to have passed.

## 5. Two verified historical-report moves

Both files were archived only after their copy was re-read and confirmed byte-identical to the source Git blob. The source was deleted only after verification. The move manifest is [`docs/history/reports/archive-manifest.json`](history/reports/archive-manifest.json), and the navigation index is [`docs/history/reports/INDEX.md`](history/reports/INDEX.md).

| Former path | Archive path | SHA-256 | Source-removal commit |
|---|---|---|---|
| `docs/FINAL-STATUS-2026-10-06.md` | `docs/history/reports/FINAL-STATUS-2026-10-06.md` | `57189f6459fac20b68fecaf58d44a39d46d4f08381e56e1d962d5b4d103b9c0a` | `e87c8c390acd0f600dd3fca83b9d2c8e9639d987` |
| `docs/INVENTORY.md` | `docs/history/reports/STRUCTURAL-INVENTORY-2026-10-06.md` | `49582f96c756b938186a910f09b6c4fd1021771beb505195ae6ff9a63527caaa` | `0211c0ac5a9198b3c0d381616aff0d62c34780fc` |

GitHub issue/PR path searches found no direct references to either former path; the local inventory found no inbound Markdown/source/config/manifest reference. The first report contained old 35.40.0/schema 223 status claims; the second contained a structural role/connection map dated 2026-10-06. They remain available byte-for-byte in history rather than being silently discarded.

## 6. Next gates

- Re-run this report after any substantial documentation/archive batch and bind each result to the exact head SHA.
- Continue with only one small archive batch at a time. Search local source/config/manifests and GitHub issues/PRs, compare content and provenance, preserve a checksum/path manifest, and run the strict link + inventory + architecture checks afterward.
- Do not delete the exact upstream duplicates under `app/.grok/` or `legacy/input-archives/` simply because blob SHA matches.
- Keep PR #106 in draft until the latest exact-head workflow is green and the wider runtime/release gates are handled separately.
- Do not replace the canonical large ZIP release artifact until a new archive has been built from an approved source commit, uploaded and verified by its actual asset digest.
