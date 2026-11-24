# Neuro-Kurisu SUPER — WorkPass 40 current status — 2026-10-14

**Implementation progress this pass: 85/100. Official weighted roadmap: 77.2%.** These are distinct measures; neither implies release approval.

## Implemented with code
- `restoreBackup` atomically acquires the runtime maintenance lock, checksum-verifies staged state files, rejects symlink backup entries and restores the exact supported-state file set. Existing state is moved to rollback staging before commit; partial commit errors trigger best-effort rollback.
- CycloneDX SBOM inventory covers 464 locked npm components with declared dependency-license/integrity data and ten embedded source archives with SHA-256 and archive member counts. `contracts/SOURCE_PROVENANCE_LICENSES_WORKPASS40.json` inventories repository notices and archive license evidence; detected license files are not treated as legal sign-off.
- Optional `llama.cpp` OpenAI-compatible chat adapter is wired into the existing P40 model ecology. Only loopback HTTP is allowed; model selection, bounded input/output, timeout, provider-health/cooldown and old-snapshot migration share existing owners. No model weights are bundled and no actual target-host inference is claimed.
- Package version, lock root, ReleaseContract, VERSION, RELEASE_MANIFEST, SUPER_VERSION and integration manifest are aligned to runtime **35.62.0 / schema 225 / WorkPass40**.

## Open release blockers
- Install app dependencies from the pinned lockfile and run full TypeScript check plus Vite production build. Current environment has no `node_modules` and npm registry resolution may be unavailable.
- Browser E2E with interactive UI and Live2D; clean-room upgrade/restore/rollback with injected commit failure; target hardware local model latency/VRAM; real provider/device receipts, reconnect/replay and soak.
- Independent labelled temporal-memory holdout: current synthetic retrieval recall uplift is zero, so candidate remains not-promoted.
- Manual review of nested upstream source licenses and a signed release provenance record.

## Verified in this pass
State restore tests cover exact-set replacement, symlink rejection, path traversal, stale backup removal and rollback staging. SBOM tests ensure locked dependency fields and source-archive checksums are recorded. Local-provider tests use a mock OpenAI-compatible endpoint and verify loopback-only restrictions and model-ecology migration.

See `PROJECT_PROGRESS_SCORECARD_2026-10-14_WORKPASS40.json`, `WORKPASS40_TASKS_2026-10-14.md`, `INTEGRATION_MATRIX_WORKPASS40_2026-10-14.md`, and `OPEN_SOURCE_INTEGRATION_REVIEW_WORKPASS40.md`.
