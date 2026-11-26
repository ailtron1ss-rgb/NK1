# NK1 P0 Persistence Integration — Execution Checkpoint

**Date:** 2026-11-26  
**Base:** `workpass70-source@7e601680c765d6dc94e51e4c8f5e729b48a6f56e`  
**Branch:** `aspect/p0-persistence-integration-20261126`

## Ownership contract

1. Core is the single canonical durable-save authority.
2. Runtime prepares one bounded generation envelope before the Core save.
3. RecoveryWatchdog advances `lastCheckpointAt` only inside the successful Core store commit callback.
4. RuntimeCheckpointCommitObserver projects sidecar owners only after that Core commit resolves.
5. ContinuityLedger remains append-only and uses a durable `.rollback` marker.
6. On Core save failure, the watchdog marker and speculative envelope generation must roll back; no sidecar projection may run.

## Joint regression

The integration test asserts:
- failed Core save does not advance `lastCheckpointAt`;
- the in-memory envelope generation returns to the previous committed generation;
- no OpenLoop sidecar projection occurs on failure;
- the next successful save advances exactly one generation;
- sidecar projection occurs only after Core save succeeds.

The first integration commit intentionally does not restore the speculative envelope, to demonstrate RED before the production fix.

## Acceptance gates

- [ ] Joint regression red for the intended generation rollback defect.
- [ ] Minimal rollback fix and focused green test.
- [ ] Exact-head CI and semantic runtime typecheck.
- [ ] Independent review.
- [ ] Android/Termux cold-restart and storage-loss soak.
- [ ] Later canonical integration in a separate reviewed step.

No modifications to `main`, Release assets, `gearonone.zip`, or `workpass70-source`.
