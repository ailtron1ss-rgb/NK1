# NK1 Intent Compiler — OmeStro idea 12

## Purpose

Compile a request into a versioned, inspectable execution contract before
planning or dispatch. The contract preserves the source request, separates
semantic interpretation, captures constraints and acceptance criteria, labels
assumptions, and defines a narrow action scope.

The compiler is not a claim that deterministic code fully understands
arbitrary natural language. A local or remote extraction provider may propose
semantics; its output is untrusted and must pass bounded validation.

## Runtime integration

- `IntentCompiler` — immutable contracts, source digest, conservative
  multilingual risk escalation, extraction completeness checks, approval
  attestation, expiry and restore validation.
- `IntentExecutionRuntime` — Core-owned approval, action-scope binding,
  HMAC-backed contract lifecycle, bounded persistence and execution lineage.
- `IntentActionGatewayBridge` — separates new execution from read-only
  receipt reconciliation; both are delegated to the canonical ActionGateway.
- `OrganismCore` — public compile/approve/execute/reconcile methods; approved
  contracts are checkpointed in `OrganismSystemState.intentContracts` and
  restored during `init()`.
- `ActionGateway` — remains the sole tool policy, one-shot approval,
  idempotency, durable receipt, finalization and reconciliation authority.
- Autonomous `autonomous-resource-tool-life` planner — now creates an intent
  contract from its canonical CEF plan event, obtains a distinct
  `autonomous-planner` attestation only after Core verifies the CEF event, and
  dispatches through `OrganismCore.executeIntent()`.

## Approval authorities

### Human approval

1. Core compiles a draft. It cannot execute.
2. `requestIntentApproval()` creates an exact, one-shot ticket in the
   ActionGateway approval centre under `system.intent.approve`.
3. The user/owner resolves that ticket through
   `resolveIntentApprovalRequest()`.
4. `approveIntent()` consumes the ticket against the same contract ID, action
   subset, risk and assumption acknowledgement payload.
5. Only after successful ticket consumption does Core create the HMAC
   attestation and checkpoint the approved contract.

A caller-supplied boolean or evidence string is not sufficient. The ticket is
consumed once; it cannot approve a different contract or be replayed.

### Autonomous planner approval

The current autonomous resource/tool/life planner uses a separate
`authority: autonomous-planner` value. It is not represented as a user
confirmation. Core validates the exact CEF plan event ID, tick, planner source,
selected tool, canonical tool alias and intent hash before the compiler signs
the contract.

This internal authority is deliberately narrower than human approval:
- only low/medium-risk intents are eligible;
- no assumption requiring confirmation may be self-acknowledged;
- the contract must contain one exact planner-selected action;
- the approved contract is checkpointed before ActionGateway can start the
  side effect;
- execution still passes through ActionGateway's independent policy and
  durable receipt gates.

High/critical intent and material assumptions return to the human approval
centre. A missing or inconsistent CEF event produces an audited refusal
before executor entry.

## Contract invariants

1. Source text is retained separately from extracted goal; its full digest is
   bound even if the visible text exceeds the bounded input size.
2. Free text never creates tool permissions. Allow/deny action IDs are
   validated separately. Wildcards, malformed IDs, conflicts and truncated
   lists fail closed; denials dominate allows.
3. Expected outcome, acceptance criteria, explicit action scope and stop
   conditions are required before approval.
4. Material or low-confidence assumptions require explicit acknowledgement.
   Unknown severity is escalated and malformed assumptions block approval.
5. Destructive language raises risk; credential/token/secret exfiltration
   signals are critical. English and Russian patterns are covered, but lexical
   rules are not a substitute for policy analysis.
6. An upstream extractor cannot lower deterministic risk. Provider failure or
   timeout results in an incomplete non-executable contract.
7. HMAC attestation binds the contract, exact action subset, acknowledgements,
   authority, evidence reference and approval timestamps.
8. Approval expires after 15 minutes. An expired contract cannot begin a new
   action. It may authorize only read-only receipt reconciliation; ActionGateway
   still enforces the original idempotency receipt and any separate one-shot
   reconciliation approval required for protected tools.
9. The reconciliation bridge reports that a read-only lookup was attempted, not that the provider outcome is resolved. An unknown/missing receipt remains pending and must not be treated as success or as permission to re-execute. ActionGateway remains the final source of receipt resolution.\n10. Intent contract identity does not replace cognitive decision identity.
   The bridge preserves the host's canonical `ActionGateway decisionId` and
   returns `contractId` separately for correlation.
11. The Intent Gate does not bypass ActionGateway's tool permissions, input
    contracts, idempotency ledger, finalizer, verification or reconciliation.

## Key lifecycle and persistence

Core accepts the stable HMAC key through `OrganismConfig.intentApprovalKey`
or `NEURO_INTENT_APPROVAL_KEY`. Use a secret manager and pass the same key
after restart. The key is never placed in the contract, logs, source tree or
Release ZIP. Rotating the key intentionally invalidates old attestations.

Without a configured stable key, the process-scoped key allows in-process use
but approved contracts will not be restorable after process restart. Restore
drops contracts that fail HMAC verification. This is fail-closed by design.

The bounded approved-contract/lineage snapshot is stored in
`OrganismSystemState.intentContracts`. Before dispatch, Core checkpoints an
intent execution link containing the contract ID, canonical tool, decision ID
and SHA-256 digest of the original idempotency key. The raw key is never copied
into this snapshot. On restart, read-only receipt lookup is permitted only when
the same contract/tool/key digest matches a pending intent execution. The
canonical ActionGateway execution ledger remains separate and authoritative
for real-world side effects.

## Core API

```ts
const draft = core.compileIntent({
  requestId,
  text: userRequest,
  extraction: proposedStructuredIntent,
});

const ticket = await core.requestIntentApproval(draft, {
  allowedActions: ['organism.inspect'],
  acknowledgedAssumptions: [],
  riskAcknowledged: false,
}, 'Review requested inspection');

await core.resolveIntentApprovalRequest(ticket.request.id, true, 'owner');

const approved = await core.approveIntent(draft, {
  allowedActions: ['organism.inspect'],
  acknowledgedAssumptions: [],
  riskAcknowledged: false,
  evidenceRef: ticket.request.id,
});

const result = await core.executeIntent(approved, {
  toolId: 'organism.inspect',
  input: {},
  reason: 'intent-bound inspection',
  options: { decisionId: canonicalDecisionId },
});
```

Receipt recovery is intentionally separate:

```ts
await core.reconcileIntentExecution(approved, {
  toolId: 'organism.inspect',
  input: originalInput,
  reason: 'receipt-recovery',
  options: { idempotencyKey: originalIdempotencyKey },
});
```

## Current integration boundary

The Intent Contract is integrated into the Core public API and the
`autonomous-resource-tool-life` planner route. Existing project-execution and
compound-skill routes still use the canonical Core `executeTool()` wrapper and
ActionGateway finalizer/receipt model, but they do not yet require a separately
persisted Intent Contract at every call site. Universal interception of every
legacy internal tool call remains a follow-up migration; it must not bypass
ActionGateway or rewrite decision IDs.

The integration does not claim autonomous approval for high/critical actions,
does not automatically accept assumptions, and does not turn unverified tool
outputs into verified outcomes.

## Verification

Run from `runtime/neuro-kurisu`:

```sh
npm run test:intent-compiler
npm run test:intent-core-integration
npm run typecheck
npm run test:workpass97:planner-route
```

A passing boundary suite does not establish semantic extraction accuracy.
Extractor quality still needs independent holdout evaluation, multilingual
adversarial testing and operational telemetry before production promotion.
