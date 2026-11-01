# Release pipeline change log

## 2026-10-31 — Fail-closed workflow_run job condition

- The publisher was already configured to trigger from `workflow_run` after `NeuroCore core regression validation` on `workpass70-source`.
- Tightened the package job condition to require `github.event_name == workflow_run`, a successful triggering workflow, and the canonical `workpass70-source` branch.
- This removes the permissive `push` fallback from the job-level condition; it does not remove or change the configured event trigger.
- The exact-SHA `source-lineage-contract` check, provenance and human license gates, source freshness checks, and no-overwrite tag guard remain mandatory.
- No Release asset is created or replaced by this workflow edit.
