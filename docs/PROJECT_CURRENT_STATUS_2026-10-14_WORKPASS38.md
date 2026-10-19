# Project current status — WorkPass38 (2026-10-14)

## Scope delivered

WorkPass 38 closes a specific durability gap in action execution: completed idempotency keys are no longer silently discarded when the bounded hot ledger fills. A file-backed runtime uses `FileActionExecutionLedgerArchive` (append-only JSONL, SHA-256 record checks, fsync, offset index); receipts are archived before hot-state capacity is reclaimed, and archived responses replay after restart. Keyed calls without a durable persister fail before the external executor. Concurrent same-key requests reserve their in-flight slot before asynchronous archive reads. Restore no longer slices old records and rejects conflicting duplicate key rows.

Runtime version: **35.60.0**, schema **225**. The schema remains unchanged because the archive is a sidecar file and does not mutate the persisted object model.

## Acceptance evidence

- Focused archive + ActionGateway tests: **17/17 passed**. Runtime TypeScript typecheck, server smoke, metadata 34/34, browser-smoke verdict 51/51, app script suite 212/212, UI/API, assets, architecture, hygiene, syntax, memory compatibility, cost-policy, stable-serialization, and source-adapter tests pass independently.
- Archive stress: **40 distinct actions, 24 spilled receipts, all 40 replays after restart, zero repeated side effects**.
- Missing durable persister: rejected before executor invocation.
- Torn incomplete final append: truncated safely. Complete-line corruption and checksum mismatch: fail closed.
- Existing OrganismCore in-memory receipt restore regression remains passing.

## Still open

- Real provider/device receipt reconciliation and reconnect/replay under ambiguous remote outcomes.
- Dependency-installed React/Vite production build and browser E2E with Live2D. Build was attempted and is currently blocked by missing `app/node_modules` (`spawn vite ENOENT`).
- Independent labeled temporal retrieval holdout; current synthetic benchmark uplift remains zero, candidate not promoted.
- Clean-room restore/upgrade/rollback, long soak, and semantic behavior evidence for the UNVERIFIED function backlog.

Implementation-pass progress: **75/100**. Weighted roadmap readiness: **74.5%**. The second figure does not imply release approval.
