# NK1 checkpoint — restored action receipt integrity (2026-10-20)

## Change
`ActionGateway.restoreExecutionLedger` now validates a completed response against the enclosing ledger row before trusting it for replay. It requires the execution ID and tool ID to match, a known outcome class, a structured result, and consistent `ok`/`verified` values across the response, verification record and audit record.

A malformed completed row is retained as a key tombstone with its response omitted. A retry returns `idempotency-recovery-required` rather than inventing a success or invoking the tool a second time.

## Regression
Command from `runtime/neuro-kurisu`:

`npm run test:workpass95:receipt-integrity`

The test exercises four corrupted snapshots (forged execution identity, verification contradiction, audit/outcome mismatch, oversized payload), confirms no duplicate executor call, and confirms valid receipts still replay.

Expected output:

`NK1_RESTORED_ACTION_RECEIPT_INTEGRITY=PASS corruptCases=4 validReplay=true duplicateExecution=false`

## Evidence boundary
This guards restored local receipt integrity. It does not prove every production planner path is routed through the canonical gateway; the direct planner-to-gateway bypass audit remains open. Exact-head GitHub Actions must pass before this checkpoint is marked CI-validated.
