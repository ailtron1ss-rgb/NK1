# Negative Space Memory — NK1 Idea 09

## Purpose

Keep a bounded record of consequential alternatives that the canonical decision process considered but did not select. Each option keeps its estimated outcome, confidence, rejection explanation, constraints, expected state consequences, and explicit conditions for reopening review.

## Runtime contract

- The canonical selector remains the only component that selects or executes actions.
- Alternatives are recorded only when at least one significance axis crosses 0.72: estimated decision cost, decision risk (one minus candidate confidence), or associated goal importance.
- Each decision stores at most four distinct rejected actions. The total ledger is bounded to 128 decisions.
- Actual success, gated reward, surprise, verification/independence quality, outcome source, prediction error, shortfall, and evidence are attached after the existing outcome gate resolves the result. A verified world transition or supported external postcondition maps to verification quality 1.0 even when the generic simulation learning defaults are zero.
- Replayed decision IDs are idempotent across both regret rows and negative-space records; a repeated decision cannot duplicate credit.
- A bounded exact-context index retrieves rejected alternatives from matching prior situations with the selected action's observed outcome and evidence quality. Historical estimates remain marked as estimates; retrieval never promotes them to facts or actions.
- Review eligibility requires a stored condition match and verified outcome quality of at least 0.5. Predicted or unverified outcomes stay out of the review queue, including after restore. It does not auto-select, execute, or silently promote the rejected option.
- An eligible item is marked reopened only through an explicit review call with a reason.
- `OrganismCore` exposes snapshot, diagnostics, review-queue, explicit reopen, and context-retrieval methods for upper-level inspection/review.
- The ledger is nested inside the existing `RegretState` under `facets.advanced.regret`; it does not create a second canonical memory store.
- The field is optional on restore. Pre-feature saves without `negativeSpace` remain valid.

## Validation

Run from `runtime/neuro-kurisu`:

```sh
npm run test:negative-space-memory
npm run typecheck
```

The test covers threshold boundaries, bounded alternatives/history, predicted-versus-observed success and reward, surprise/verification provenance, selective reopening, exact-context retrieval, decision-level idempotency, defensive restore of malformed snapshots, snapshot isolation, and legacy restore.
