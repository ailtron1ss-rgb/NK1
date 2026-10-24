# WorkPass456 — shared upstream evidence-event identity

**Branch:** feature/perception  
**Date:** 2026-10-23  
**Status:** ledger boundary and regression added; full cross-system call-site wiring remains the next step.

## Change

RealityEvidenceLedger.record now accepts an optional upstream eventId, intended to carry an existing execution/decision/observation identifier instead of manufacturing a second logical event ID. The ledger derives a stable record key from that event identity, stores it in the evidence row and handles replay as follows:

- same event ID + identical evidence payload: return the existing record, do not increment total;
- same event ID + changed claim, source, timestamp, reality class or other payload field: reject with reality-evidence-event-identity-conflict;
- no upstream event ID: preserve WorkPass451's content-derived stable ID and idempotence behavior;
- restore: validate event IDs and collapse duplicate event identities without allowing them to masquerade as additional sources.

This creates a shared boundary that other NK1 consumers can reference. It is not yet proof that ActionGateway, P65 and outcome reflection all pass the same event ID in the live runtime; the next pass must inspect and wire those actual call sites.

## Regression

The existing workpass451-reality-evidence-ledger.mjs now covers explicit event ID, exact replay idempotence, and fail-closed conflicting payload reuse. It remains wired through test:p2841.

## Architecture rule

The event identity is a join key, not proof of truth or independence. Multiple consumers of the same receipt must not count it as multiple independent observations. Independent corroboration requires distinct trusted source identities with appropriate provenance.

## Follow-up

Wire the verifier-owned action receipt to the ledger and P65's evidenceId, retain a single execution/decision lineage in reward/reflection, and prove same-ID replay cannot inflate confidence or learning credit. Exact-head tests/typecheck remain unverified.
