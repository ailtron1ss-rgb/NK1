# Negative Space Memory — NK1 Idea 09

## Purpose

Keep a bounded record of consequential alternatives that the canonical decision process considered but did not select. Each option keeps its estimated outcome, confidence, rejection explanation, constraints, expected state consequences, and explicit conditions for reopening review.

## Runtime contract

- The canonical selector remains the only component that selects or executes actions.
- Alternatives are recorded only when at least one significance axis crosses 0.72: estimated decision cost, decision risk (one minus candidate confidence), or associated goal importance.
- Each decision stores at most four distinct rejected actions. The total ledger is bounded to 128 decisions.
- Actual outcome, prediction error, shortfall, and evidence are attached after the existing outcome gate has resolved the result.
- Review eligibility is raised only when a stored condition matches. It does not auto-select, execute, or silently promote the rejected option.
- An eligible item is marked reopened only through an explicit review call with a reason.
- `OrganismCore` exposes snapshot, diagnostics, review-queue, and explicit reopen methods for upper-level inspection/review.\n- The ledger is nested inside the existing `RegretState` under `facets.advanced.regret`; it does not create a second canonical memory store.
- The field is optional on restore. Pre-feature saves without `negativeSpace` remain valid.

## Validation

Run from `runtime/neuro-kurisu`:

```sh
npm run test:negative-space-memory
npm run typecheck
```

The test covers significance gating, bounded alternatives/history, predicted-versus-observed outcomes, conditional review, explicit reopening, idempotency, and legacy restore.
