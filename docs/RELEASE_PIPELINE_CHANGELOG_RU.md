# Release pipeline change log

## 2026-10-31 — Publish after exact-SHA core validation

- Removed the immediate `push` publisher trigger. The release publisher now starts from `workflow_run` after `NeuroCore core regression validation` completes on `workpass70-source`.
- The packaging job runs only when that triggering core regression succeeded.
- The exact-SHA `source-lineage-contract` check, provenance and human license gates, source freshness checks, and no-overwrite tag guard remain mandatory.
- This avoids duplicate publisher runs and the race where packaging waits for a core regression job that has not yet finished.
- No Release asset is created or replaced by this workflow edit.
