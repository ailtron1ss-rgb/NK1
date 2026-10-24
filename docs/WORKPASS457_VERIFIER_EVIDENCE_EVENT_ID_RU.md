# WorkPass457 — stable verifier-bound evidence event ID

**Branch:** feature/feedback  
**Date:** 2026-10-23  
**Status:** implementation and regressions added; exact-head execution remains unconfirmed.

## Change

OutcomeVerificationService now derives optional evidenceEventId for an external postcondition result only when it retains an explicit external-evidence shape and the isolated host context contains a valid gateway execution ID and decision ID. The generated key is a SHA-256-derived digest over the canonical tuple:

- canonical tool identity;
- exact gateway execution ID;
- exact decision ID;
- verifier observation ID;
- complete canonical action input.

A replay of the same tuple receives the same ID. Changing the decision, execution, input, tool, or observation changes the key. Missing/malformed host lineage cannot mint an event ID. The result remains trusted only through the existing process-local WeakMap binding; the string hash is a join key, not proof or authority by itself.

## Why this is not sufficient alone

The verifier-produced ID is now compatible with WorkPass456's optional RealityEvidenceLedger.eventId. But full runtime propagation is not yet complete. Callers must pass the identifier into the reality ledger and P65 evidence revision only after the existing verifier authority checks succeed. A copied JSON verification object loses verifier authority and must not be accepted merely because it contains evidenceEventId.

## Regression

The existing workpass294-correlated-postcondition test now asserts:
- valid verifier-bound tuple produces an outcome:<40 hex> event ID;
- an exact tuple replay reproduces the ID;
- another decision produces a different ID;
- missing host execution/decision lineage produces no ID;
- existing object-identity, complete-input and decision-binding security checks remain.

## No false promotion

No promotion gate was relaxed. Contradictory postcondition evidence remains distinct from verified success; the ID is a correlation mechanism. No new runtime dependency was added.

## Next pass

Wire the exact trusted outcome through ActionGateway/Core to the RealityEvidenceLedger and P65 revision APIs. Verify that replayed event IDs yield one underlying evidence event and that changed payload reuse is quarantined.
