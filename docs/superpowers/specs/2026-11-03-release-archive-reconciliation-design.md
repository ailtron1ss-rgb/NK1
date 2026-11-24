# Release Archive Reconciliation Design

**Intent:** Make the actual published NK1 ZIPs inspectable and comparable with the canonical `workpass70-source` tree. This closes the evidence gap tracked by issues #604 and #485 without changing the license decisions or publishing a replacement release.

**Why:** Source CI can be green while the downloadable Release ZIP remains older. The release artifact is the deliverable, so archive integrity, exact digest, file manifest and source drift must be measured against the exact downloaded bytes.

**Goals**
- Download both currently recorded deliverables: stable tag `Neuro` and prerelease tag `workpass70-hotfix1-2026-10-19`.
- Verify GitHub's published SHA-256 digest, byte size, ZIP CRC/readability, safe member paths and duplicate member names.
- Create a SHA-256 manifest of archive members and compare path/content hashes with the checked-out canonical source tree.
- Report version metadata, source-only files, archive-only files and same-path content changes.
- Preserve the audit report as a GitHub Actions artifact and job summary.

**Non-goals**
- Do not extract the ZIP to disk.
- Do not change `RELEASE_LICENSE_REVIEW.json`, infer rights from LICENSE files, or automatically approve redistribution.
- Do not build, tag, publish, overwrite or delete any release.
- Do not claim that a green archive inspection makes the current source releasable.

**Approaches considered**
1. Manual download and local inspection: useful for a one-off, but not reproducible and hard to attach to an exact source SHA.
2. A CI inspection job using the GitHub CLI and Python's standard ZIP/hash libraries: chosen because it runs against exact release bytes and a pinned source checkout without new packages or release permissions.
3. Integrate archive inspection into the release publisher: rejected for now because the publisher is still blocked by human license review; inspection must be independently runnable and non-publishing.

**Implementation choice:** A focused Python standard-library inspector, deterministic unit tests with temporary ZIP fixtures, and a path-filtered pull-request workflow that downloads both existing assets, compares them to the PR's source tree, and uploads only the JSON reports. Source drift is reported, not treated as ZIP corruption; digest, integrity and unsafe-archive errors fail the workflow.

**Constraints:** Use read-only `contents` permission. No dependency changes, no secrets beyond the workflow's read-only `GITHUB_TOKEN`, no archive extraction, and no mutation of release or license records.

**Success:** The workflow produces exact SHA/size/integrity results and a machine-readable member manifest for each release, with explicit source parity counts and no claims of redistribution approval.
