# WorkPass489 — feedback and outcome reconciliation contract

## Purpose

Separate intended action, tool response, and verified world change. Learning must consume observed consequences, not planner-reported success.

## Reconciliation states

- `planned`: decision ticket exists; execution is not implied.
- `dispatched`: canonical gateway accepted the action.
- `executed`: receipt confirms tool returned; world-state success is not implied.
- `verified`: a postcondition observer confirms the expected effect.
- `failed`: execution or postcondition failed with a classified reason.
- `unknown`: evidence is absent, stale, contradictory, or unavailable.
- `compensated`: a verified compensating action addressed a side effect; original history remains immutable.

## Invariants

1. Every receipt references exactly one decision ticket; orphan receipts are quarantined.
2. Tool `success: true` does not automatically satisfy a world-state postcondition.
3. Retries reuse an idempotency key when supported; otherwise retries require explicit side-effect policy.
4. Conflicting observations retain provenance and remain unresolved until a reconciliation policy resolves them.
5. Delayed effects can update current state but never rewrite historical receipts.
6. Learning labels derive from verified outcomes. Unknown outcomes are not silently treated as reward or failure.
7. Replay samples retain ticket, receipt, postcondition, and observation references required to reproduce their labels.

## Required failure tests

- Gateway accepted but tool timed out.
- Tool returned success while postcondition remained false.
- Duplicate callback/receipt delivery.
- Delayed postcondition after timeout.
- Conflicting observers with different timestamps and confidence.
- Restart between execution and verification.
- Retry of a non-idempotent action.
- Missing or invalid provenance.

## Integration target

Bind these states to the existing ActionGateway/finalizer and verified-outcome ledger. Do not create a second receipt database or alternate execution path. This is an implementation contract until runtime wiring and tests demonstrate otherwise.
