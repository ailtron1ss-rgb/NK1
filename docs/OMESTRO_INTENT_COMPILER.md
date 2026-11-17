# Intent Compiler — NK1 integration

**Concept:** OmeStro idea 12 (Intent Compiler).

## Core implementation

- `runtime/neuro-kurisu/src/organism/cognition/IntentCompiler.ts`
  - Immutable, source-digest-bound intent contract with semantic extraction separated from the original request.
  - Conservative English/Russian risk escalators, including critical secret/token exfiltration patterns.
  - Fail-closed validation of malformed assumptions, nested extraction, risk labels, action identifiers, allow/deny collisions and truncated lists.
  - HMAC-attested contracts with bounded 15-minute approval lifetime and read-only-only expiry reconciliation.
  - Explicit approval authority: `human` is distinct from `autonomous-planner`.
- `runtime/neuro-kurisu/src/organism/system/IntentExecutionRuntime.ts`
  - Core-owned compilation, exact-scope host ticket consumption, contract lifecycle, bounded restore and execution lineage.
  - Human approval uses the canonical ActionGateway one-shot approval centre.
  - Autonomous planner approval is minted only when a Core-provided verifier validates a real CEF plan receipt; it cannot self-approve high/critical risk or material assumptions.
- `runtime/neuro-kurisu/src/organism/system/IntentActionGatewayBridge.ts`
  - Separate execute and read-only reconciliation routes; preserves canonical decision identity.
- `runtime/neuro-kurisu/src/organism/core/OrganismCore.ts`
  - Exposes compile, compileWith, request/resolve/approve/reject, execute and reconcile APIs.
  - Persists approved contracts in `OrganismSystemState.intentContracts` and restores only valid HMAC attestations.
  - The autonomous resource/tool/life planner now compiles and approves its exact CEF-bound intent before dispatching through `executeIntent`.
- `runtime/neuro-kurisu/src/organism/system/ActionGateway.ts`
  - Adds a canonical audited pre-execution refusal result; ActionGateway remains the authority for permissions, one-shot tickets, input contracts, idempotency, finalization and receipt reconciliation.

## Human approval lifecycle

The user-facing path creates a one-shot `system.intent.approve` ticket in ActionGateway. Core resolves and consumes that exact ticket before creating the signed intent approval. A boolean or caller-provided evidence string alone cannot authorize execution, and a consumed ticket cannot be replayed for another contract.

## Autonomous approval lifecycle

The integrated `autonomous-resource-tool-life` planner receives a distinct `autonomous-planner` signature after Core checks the canonical CEF plan event ID, tick, planner identity, selected tool, alias normalization and deterministic intent hash. Only low/medium-risk, assumption-free, single-action contracts are eligible. High/critical or assumption-bearing intent requires human approval. The signed contract is checkpointed before any external side effect.

## Execution and recovery

- New dispatch goes through Intent Gate → IntentActionGatewayBridge → OrganismCore.executeTool → ActionGateway.
- The canonical host `decisionId` is preserved; intent ID is separately returned as `contractId`.
- Before dispatch, Core checkpoints the contract/tool/decision link and a SHA-256 digest of the exact idempotency key. The raw key is never copied into the intent snapshot. After restart, receipt reconciliation requires the same contract, tool and key digest before attempting the read-only lookup. Missing local receipt data is not proof of non-execution and keeps the intent blocked; no automatic retry is allowed.
- Expired approvals cannot start new work. The distinct reconciliation path performs only a read-only lookup against the original idempotency receipt and never calls the side-effect executor. Its result reports that lookup was attempted; an unknown or missing receipt is not reported as resolved and does not authorize a retry.
- Keyed receipts, finalizer semantics and reconciliation remain owned by ActionGateway.

## Boundaries

Project-execution and compound-skill routes still use the canonical Core `executeTool()` wrapper and ActionGateway safeguards, but not every legacy tool call has a separately persisted Intent Contract yet. Universal interception is a follow-up migration; it must retain ActionGateway policy, decision IDs, idempotency and finalizer/recovery semantics.

Production restore across restart requires `OrganismConfig.intentApprovalKey` or `NEURO_INTENT_APPROVAL_KEY` backed by a stable secret store. The key is never persisted in the contract or repository. Without that key, contracts fail closed after restart.

## Verification

From `runtime/neuro-kurisu`:

```sh
npm run test:intent-compiler
npm run test:intent-core-integration
npm run typecheck
npm run test:workpass97:planner-route
```

A clean focused test validates the implemented boundary; it does not establish semantic extraction accuracy or release readiness. The PR remains Draft until fresh governance CI and independent review pass.
