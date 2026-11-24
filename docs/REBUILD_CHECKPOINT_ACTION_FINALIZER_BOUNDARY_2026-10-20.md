# NK1 checkpoint — action finalizer boundary (2026-10-20)

## Code change
Added tests/workpass96-action-finalizer-boundary.mjs against the real ActionGateway implementation. It checks:
- a fresh keyed execution invokes the host finalizer exactly once before reporting a committed receipt;
- a successful replay invokes neither the executor nor the finalizer a second time;
- a thrown finalizer after executor entry returns idempotency-recovery-required;
- retrying the unresolved operation does not automatically repeat the external side effect or rerun finalization.

## Command
From runtime/neuro-kurisu:

npm run test:workpass96:finalizer-boundary

Expected output:

NK1_ACTION_FINALIZER_BOUNDARY=PASS successFinalizedOnce=true replayNoFinalize=true failureBlocksRetry=true

The test is registered in .github/workflows/workpass79-cognitive-regression.yml.

## Scope boundary
This strengthens a real gateway invariant. It does not establish that every planner or project-execution entry point calls the gateway with the correct decision, approval and idempotency context. Those call sites still need separate classification and end-to-end tests. No claim of consciousness or complete autonomy is implied.
