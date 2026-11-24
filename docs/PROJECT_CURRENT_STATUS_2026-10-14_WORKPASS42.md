# Current status — WorkPass 42 (2026-10-14)

- Current source baseline: WorkPass41.
- Release line: WorkPass 42, root `35.0.0-super-workpass42`, runtime **35.63.0**, state schema **225**.
- Cleanup-pass progress: **94/100**. Weighted project/release roadmap remains **78.0%**; release approval is not granted.
- Exact duplicate removal is hash-proven and reversible: 21 generated app Live2D shadows use a canonical runtime owner; 56 omitted path copies are recoverable through the generic manifest; the existing 3,873-entry Legacy dedup manifest remains verifiable.
- Historical integrity: **8,512/8,512** compacted source archive members and **10,427/10,427** historical snapshot records check successfully.
- 68 older root reports were moved without content changes into `docs/history/workpasses/root-reports/`.
- Five duplicated historical content blobs were consolidated into one immutable SHA-256 payload each (31,893 raw bytes saved); all manifest checks remain green.
- Embedded runtime `ReleaseContract` was corrected from stale 35.62.0 to 35.63.0; version and phase are regression-tested against runtime manifests.
- Vite production build remains blocked by absent app dependencies (`vite` executable unavailable); interactive browser/Live2D E2E, real provider receipts, independent retrieval holdout, clean-room rollback, license review and soak remain open.

Source of truth: `SUPER_VERSION.json`, `CHANGELOG.md`, `Список дел.md`; navigation: `PROJECT_FILE_MAP_WORKPASS42.md`; cleanup details: `WORKPASS42_REPORT_2026-10-14.md`.
