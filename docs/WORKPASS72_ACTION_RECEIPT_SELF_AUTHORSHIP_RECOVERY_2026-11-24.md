# WorkPass72 — ActionGateway receipt to SelfAuthorship recovery

**Base:** `2dae0a2fa897539d6592369d5b6fc0012392dfaa`  
**Branch:** `aspect/p0-actionreceipt-selfauthorship-recovery-20261124`

## Defect

ActionGateway already persisted a pending receipt before entering an external executor, kept ambiguous outcomes pending, prevented retrying the side effect and supported read-only provider reconciliation. Core finalization projected the verified outcome into OutcomeCognition and CognitiveEventFabric, but it did not close the pending SelfAuthorship intent linked to the selected decision. A real autonomous side effect could therefore be durably verified while the organism's authorship counter remained unresolved until a separate manual feedback call.

## Implementation

- `OrganismCore.finalizeToolOutcome` creates one local settlement closure after the non-executed reconciliation gate.
- The closure runs only when the ActionGateway passed its ephemeral exact decision-linked external postcondition attestation, Core found the same real selected decision trace, and the final result is `ok`, `verified`, and externally postcondition-verified.
- The exact original `decisionId` is passed to the existing SelfAuthorship pending ledger. Only that pending row can be consumed; its own autonomous/external-request guard remains authoritative.
- The selected goal title is taken from the matching persisted decision trace.
- The SelfAuthorship facet is saved with the normal Core snapshot at the same ActionGateway persistence boundary that commits the completed execution receipt and causal projections.
- Both first verified completion and authoritative provider reconciliation call the closure; replay stays idempotent because ActionGateway does not rerun finalization for a completed receipt and SelfAuthorship consumes each pending decision once.

No new receipt ledger, no parallel recovery engine, no changes to ActionGateway's fail-closed behavior.

## Regression

`action-receipt-selfauthorship-recovery-workpass72.mjs` uses a real temporary FileStateStore and the Core-owned FileActionExecutionLedgerArchive:
1. Select a substantive autonomous decision.
2. Persist the Gateway pending receipt with the same decision ID.
3. Execute one external state change, then simulate loss of the provider acknowledgement.
4. Restart a fresh Core against the same persisted state and archive.
5. Reconcile with a read-only provider receipt lookup.
6. Assert a single verified execution receipt and one SelfAuthorship credit tied to the original decision.
7. Replay the idempotency key and assert no second effect or credit.

The dedicated Actions workflow first requires the exact expected assertion failure on the test-only pre-fix commit, then runs the scenario and the existing archive, crash, verification, restart and runtime type/syntax regressions.