# WorkPass351 — avoid orphaned learning-run scratch directories (2026-10-26)

- [RELIABILITY] Validate inherited and explicit environment entries before creating per-run directories. Invalid supervisor configuration now fails without creating a scratch root.
- [RELIABILITY] If trusted shadow-run registration rejects or cancellation is observed before process spawn, remove the newly allocated run directory before propagating the error. No process is started and no orphan scratch directory is left masquerading as an execution record.
- [TEST] Extend `p23-learning-process-supervisor.mjs` with regression coverage for invalid environment configuration and a failed trusted-run registration. Successful/started runs still retain their receipt and evidence directories.
- [CI] Dedicated WorkPass349 security workflow now also runs the supervisor cleanup regression. Run #40285085066 passed on SHA `0d1af65888b7d89fd3b0484bc2fbca8b9f369b9b`: native P23 dataset suite 10/10, supervisor regression PASS, and runtime `TYPECHECK=PASS`.
- **Boundary:** this is pre-spawn filesystem cleanup; it does not claim that child processes are sandboxed or that the organism is production-ready.

