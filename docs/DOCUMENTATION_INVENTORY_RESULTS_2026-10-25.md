# Documentation ordering results — 2026-10-25

**Measurement source commit:** `b8ff2b50b4e3208aedd6dd1e09c2839d7002bda8`  
**Successful exact-head GitHub Actions run:** [Documentation links and dependency boundaries — run 40168716043](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40168716043) — **success** on that exact SHA.  
**Purpose:** measure the project/documentation order after the first two reversible historical-report batches; this is not a claim of overall runtime or release readiness.

## 1. Repository-tree snapshot

The recursive Git tree for the measurement commit was not truncated.

| Measure | Count |
|---|---:|
| Tree entries (files and tree nodes) | 10,635 |
| Tracked file blobs | 9,761 |
| Markdown / MDX files in the full tree | 2,992 |
| Markdown / MDX files under `docs/` | 348 |
| All file blobs under `docs/` | 649 |

## 2. Exact-content duplicates

The full tracked Markdown tree was grouped by Git blob SHA, including upstream/vendor-like trees excluded by the active-scope scanner.

**Full-tree exact duplicate groups: 2 groups / 5 files.** Neither group touches `docs/`.

| Git blob SHA | Identical files | Paths |
|---|---:|---|
| `71b68ff6752d68b4b71f97aa025b57f768429ef3` | 3 | `app/.grok/skills/generate2dmap/SOURCE.md`; `app/.grok/skills/generate2dsprite/SOURCE.md`; `app/.grok/skills/video2dsprite/SOURCE.md` |
| `0ed6e442960139749f1c78c2dd8ad64dc6382ed2` | 2 | `legacy/input-archives/hexis-main-2026-10-08/README.md`; `legacy/input-archives/hexis-selected-2026-10-24/README.md` |

Those matches remain preserved: the path provenance matters, and equal README content does not prove that either upstream archive can be removed.

## 3. Active-scope inventory

The integrated `npm run audit:doc-inventory` output on the measurement SHA reported:

| Measure | Count |
|---|---:|
| Markdown files scanned | 2,646 |
| Recognized local Markdown link destinations | 203 |
| Exact-content duplicate groups in included scope | 0 |
| Repeated filename families | 11 |
| Files matching repeated filename families | 215 |
| Zero inbound Markdown-link candidates | 2,584 |
| Non-Markdown source/config/manifest text files scanned | 4,640 |
| Markdown targets with a reference from non-Markdown text | 2,289 |
| Non-Markdown reference hits (source/target hits) | 17,281 |
| No inbound reference in either scanned tree | 320 |
| Text-file read errors | 0 |
| Missing/unreadable Markdown files | 0 |

### Repeated filename families

| Family | Files |
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

A filename family is a review queue, not proof of duplicate content. A zero-inbound count is also only a candidate signal; the scanner cannot prove the absence of external consumers, issue references outside indexed GitHub search, recovery/packaging dependencies, or unique historical value.

## 4. Exact-head validation

The successful workflow passed all steps:

- Markdown-link regression suite: **5 passed, 0 failed**.
- Documentation-inventory regression suite: **3 passed, 0 failed**.
- Architecture/dependency boundary suite: **4 passed, 0 failed**. Audit output: `sourceFiles=2229`, `canonicalFiles=634`, `dependencyEdges=4550`, `missing=0`, `cycles=0`, `legacyLeakage=0`, `boundaryViolations=0`.
- Transitive server-import graph test: **1 passed, 0 failed**; `checkedFiles=575`, `checkedEdges=1873`, `unresolvedCount=0`.
- Strict canonical navigation check: **17 files, 0 issues**.

The report file and its new history-index links were then revalidated on follow-up commit `eeb46e851a45dbb0966153ecb51d3ed339dc7245` by [successful Actions run 40168858480](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40168858480). The inventory counts above remain measured on the explicitly named source SHA `b8ff2b50b4e3208aedd6dd1e09c2839d7002bda8`; the follow-up run verifies the committed report/links and the same audit gates after the new files were added.

This gate validates link extraction, local path resolution for the canonical page set, the specific architecture-boundary rules under test and the server's transitive relative-import graph. It does not prove absence of every dynamic import, prove all external integrations work, or replace runtime behavioral/production-release tests.

## 5. Archive batches completed

### Historical reports dated 2026-10-06

Three reports were archived to `docs/history/reports/`: the old final-status report, structural inventory and conflicts/gaps report. Their original paths, SHA-256 values, Git blob identities, copy commits and source-removal commits are in [`docs/history/reports/archive-manifest.json`](history/reports/archive-manifest.json). The originals' claims remain historical.

### Status reports for WorkPass22, WorkPass24 and WorkPass36

The reports were moved to [`docs/history/workpasses/project-status/INDEX.md`](history/workpasses/project-status/INDEX.md). Each archived copy was re-read before deletion and matched the original content and Git blob SHA. The [relocation manifest](history/workpasses/project-status/relocation-manifest.json) records the source/archive paths, content SHA-256, size, copy commit and source-removal commit.

Associated JSON status snapshots remain at their original paths until they receive separate reference/provenance review. The [top-level WorkPass history index](history/workpasses/INDEX.md) now marks its old WorkPass42 content as a historical snapshot.

## 6. Release boundary

A live GitHub Releases check on 2026-10-25 found the attached ZIP assets were still WorkPass70 artifacts dated 2026-10-19:

- Stable tag [`Neuro`](https://github.com/ailtron1ss-rgb/NK1/releases/tag/Neuro): `Neuro_Kurisu_WORKPASS70_2026-10-19.zip`, 135,290,615 bytes, SHA-256 `c5cf6a63661e28b30f976d03c8839a231341d73a09489b9066f062e29b224286`.
- Hotfix prerelease [`workpass70-hotfix1-2026-10-19`](https://github.com/ailtron1ss-rgb/NK1/releases/tag/workpass70-hotfix1-2026-10-19): `Neuro_Kurisu_WORKPASS70_HOTFIX1_2026-10-19.zip`, 136,354,713 bytes, SHA-256 `9effadfcf0d402b462dd9cf2fd5b5793742039c9260db80578be830952bf52eb`.

This documentation pass did not rebuild, upload or replace the canonical release archive.

## 7. Next gates

- For each subsequent archival batch, rerun the ordering gate on the resulting HEAD and record its exact SHA/Actions URL; keep the current report as a dated snapshot rather than silently overwriting historical measurements.
- Continue only with small review batches. Before moving any candidate, check all local paths, source/config/manifest references, GitHub issue/PR path searches, semantic uniqueness, recovery/packaging needs and provenance; archive it byte-for-byte and write a reversible manifest.
- Review the JSON companions separately.
- Do not delete the two exact duplicate groups under `.grok` and `legacy/input-archives/` solely because their blobs match.
- Keep PR #106 draft until review. Runtime cognition efficacy, full application build, restore/rollback and release approval remain separate gates.

