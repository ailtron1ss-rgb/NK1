# RELEASE NOTES — 35.6.1 / BIG PASS 175

BIG PASS 175 focuses on making autonomous projects operational rather than decorative.

### Canonical changes
- SelfProjectEngine schema upgraded to v2 with explicit evidence and lifecycle accounting.
- AutonomousProjectExecutor schema upgraded to v4 with plan revision, failure and lifecycle telemetry.
- Verified project-tool execution now updates project progress and the linked goal.
- External independent promoted evidence can become replicated evidence for project completion.
- Repeated project-tool failures can pause a project rather than silently loop forever.
- Added direct regression tests for project life, recovery/reopen, scheduler behaviour and migration.
- Added strict function reality report for pass 175.

### Verification policy
A function is not considered implemented merely because it exists in source. VERIFIED requires behavioural evidence; stateful functions additionally require restart/replay evidence. Unsafe external/destructive functions are not auto-promoted.

### Known limitations
The full aggregate historical regression orchestrator exceeds sandbox runtime budget. Long 250-cycle profiling also exceeds this environment budget. These are explicitly not reported as PASS; bounded and constituent gates are recorded separately.
