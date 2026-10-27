## [NK1][WorkPass511] Add a fail-closed human license readiness gate (2026-10-27)

- Added a hash-bound review manifest for root/runtime project policies, the locked npm SBOM component fingerprint, every source archive, and every detected repository LICENSE/NOTICE.
- Allow a six-hour maximum age for inventory generated at release-audit start so a long test chain does not fail only because execution took more than 15 minutes.
- The release audit rejects pending reviews, missing/extra inventory entries, stale hashes, changed dependency fingerprints, stale SBOM/provenance timestamps, and any decision without a human reviewer plus evidence reference.
- Wired the unit regression into recovered Core CI and the audit into WorkPass70/release audit paths. The initial manifest is intentionally pending; this makes unresolved licensing an explicit release blocker rather than treating license-file detection as approval.
- This is a process-integrity gate, not legal advice or a declaration that any specific third-party archive is approved for redistribution.

## [NK1][WorkPass510] Gate release audits on current SBOM provenance (2026-10-27)

- Wire the existing `test:provenance-current` into root `audit:workpass70` and runtime `release:audit`, `release:final`, and `release:final3`.
- Release validation now regenerates and checks the CycloneDX SBOM and source-archive/license-evidence inventory instead of silently relying on the older tracked report.
- This proves inventory/hash structure only. Ambiguous imported-source licensing still requires manual review; no release ZIP, legal approval, or readiness score is advanced by this change.

## [NK1][WorkPass509] Harden Hexis source-trace identity and future evidence bounds (2026-10-27)

- `SourceMonitor.record` now treats trace IDs as immutable: exact replay is idempotent; conflicting payload reuse increments the conflict counter and cannot replace the first record.
- Restore deduplicates persisted trace IDs, preserves the first valid lineage and counts conflicting duplicates rather than silently shadowing the observation.
- The canonical Hexis evidence bridge independently rejects future-dated observation timestamps even if `provenance.capturedAt` is fresh; writes continue through `MemoryFabric.attachEvidenceSource`.