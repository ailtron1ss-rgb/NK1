# CHANGELOG — NeuroCore / NK1

## [Unreleased] — 2026-10-30

### Added
- Established official **NK1 Final Master Plan** (`docs/NK1_FINAL_MASTER_PLAN_2026-10-30_RU.md`) covering all 10 vital stages towards a working digital personality.
- Added updated **Project Progress Tracker** (`docs/PROJECT_PROGRESS_TRACKER_2026-10-30_RU.md`) mapping exact commit SHAs (`c51bdd9920c317baa13ad86a04851b125a8f440b` on `main`, `ad564d1879028f00549be41ec5172a2f72e25897` on `workpass70-source`), stage statuses according to the status progression protocol, and open release gates.
- Added automated Stage 1 verification script `scripts/verify-release-reproducibility.sh` for bash/Linux environments.

### Verified (Stage 1 — Reproducibility & Packaging)
- Packaging and workflow inspection for `.github/workflows/publish-workpass70-main-sync.yml` and `scripts/publish-workpass70-main-sync.ps1`.
- Executed `./scripts/verify-release-reproducibility.sh`: verified archive generation, zip member integrity (`z.testzip() == None`), and SHA-256 provenance manifest rules.
- Confirmed setup-node npm cache policy and lockfile handling for release packaging and source branches.
