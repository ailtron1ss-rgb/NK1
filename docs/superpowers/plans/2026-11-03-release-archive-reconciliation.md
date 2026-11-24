# Release Archive Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Inspect exact published NK1 Release ZIP bytes and produce a reproducible manifest and source-drift report.

**Architecture:** Python standard library handles ZIP validation, hashing and source comparison. GitHub Actions downloads the recorded stable and prerelease assets using the read-only GitHub CLI token; it uploads reports only.

**Tech Stack:** Python 3 standard library, GitHub Actions, GitHub CLI.

**Spec:** `docs/superpowers/specs/2026-11-03-release-archive-reconciliation-design.md`

## Global Constraints
- No new runtime or workflow dependencies beyond standard runner tooling.
- Do not extract archive members.
- Do not modify `RELEASE_LICENSE_REVIEW.json` or approve redistribution.
- Do not publish, retag or overwrite a release.
- Source drift is evidence, not an integrity failure.

## Review Focus
- ZIP traversal paths and duplicate members must fail closed.
- Symlink entries and encrypted/corrupt members must not be extracted or accepted.
- SHA or byte-size mismatch against GitHub metadata must fail the workflow.
- A single-root-folder ZIP must compare correctly without changing archived path names in the report.
- Missing source files and changed file hashes must be reported without conflating them with archive corruption.

---

### Task 1: Archive inspector and deterministic tests

**Files:**
- Create: `tools/release_archive_inspector.py`
- Test: `tools/test_release_archive_inspector.py`

**Interface:**
- `audit_release_archive(archive_path, source_root, expected_sha256=None, expected_size=None, archive_prefix="auto", release_tag=None) -> dict`
- CLI writes the complete JSON report to `--out`; exit non-zero only for invalid archive, unsafe structure, or release metadata mismatch. Source drift remains a report field.

- [ ] Add tests for valid archive/hash/source match, auto-prefix mapping, changed/missing/extra files, unsafe paths, duplicate names, wrong digest/size and corrupt ZIP bytes.
- [ ] Run `python3 -m unittest tools.test_release_archive_inspector -v`.
- [ ] Implement bounded, no-extraction inspection with ZIP member SHA-256, CRC/read checks, path validation, source hashes and version extraction.
- [ ] Re-run the same unit test command and confirm all cases pass.

### Task 2: Exact-release CI inspection

**Files:**
- Create: `.github/workflows/nk1-release-archive-inspection.yml`

- [ ] Add a path-filtered `pull_request` workflow for `workpass70-source` and manual dispatch.
- [ ] Download the stable `Neuro` asset and prerelease `workpass70-hotfix1-2026-10-19` asset with `gh release download`.
- [ ] Read the asset digest/size from GitHub release metadata; compare both to downloaded bytes.
- [ ] Run the inspector against the checked-out source tree and save separate JSON reports.
- [ ] Upload the reports and include integrity + drift counts in the Actions job summary.
- [ ] Verify exact-head unit + release archive workflow results.

### Task 3: Evidence handoff

- [ ] Open a Draft PR against `workpass70-source` with issue #604 references.
- [ ] Record exact HEAD/base SHA, release tags/assets, job IDs, report artifact IDs and integrity/parity status.
- [ ] Keep the PR separate from the human legal approval issue #485; no license status changes.
