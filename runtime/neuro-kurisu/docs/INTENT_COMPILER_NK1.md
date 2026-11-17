# NK1 Intent Compiler — OmeStro idea 12

## Purpose

Convert a request into a versioned, inspectable execution contract *before*
planning or dispatch. The contract preserves the request, separates semantic
interpretation from user wording, captures constraints and acceptance criteria,
labels assumptions, and defines an explicit action scope.

This component is a contract compiler and enforcement adapter, not a claim that
a deterministic parser fully understands arbitrary natural language. Semantic
interpretation is provided through an upstream extractor and treated as
untrusted proposal data.

## Runtime components

- `IntentCompiler`: compiles and validates the contract, risk, incompleteness,
  approval freshness and approval attestation.
- `IntentExtractionProvider`: optional local or remote semantic extractor.
  Extraction is bounded by a 10-second default deadline (maximum 60 seconds)
  and receives an `AbortSignal`; timeout/provider failure produces an incomplete
  fail-closed contract rather than silently falling back to executable intent.
- `IntentActionGatewayBridge`: validates the approved contract and delegates
  the action through the canonical `ActionGateway.executeTool` API.
- `tests/intent-compiler-contract.mjs`: tests intent integrity, risk escalation,
  assumption acknowledgement, approval boundaries, expiry and the gateway edge.

## Contract invariants

1. The source request is retained separately from the extracted goal. Oversized
   source text is marked truncated and cannot be approved for execution.
2. A free-text request never produces a tool allow-list. Tool identifiers must
   arrive as explicit structured extraction data and match ActionGateway's
   bounded identifier syntax; wildcard and malformed IDs are rejected.
3. An action present in both allow and deny lists makes the contract incomplete;
   denial always wins at the gate.
4. Expected outcome, acceptance criteria, explicit action scope and stop
   conditions are required before approval. Truncated or malformed lists are
   explicitly reported as missing/incomplete rather than silently shortened.
5. Assumptions with material impact or confidence below 0.8 must be explicitly
   acknowledged at approval time. Unknown severity is conservatively elevated to
   high and malformed assumption severity/confidence metadata block approval; assumptions are never
   silently promoted to user-confirmed facts.
6. Risk classification is conservative. Deterministic destructive, external
   mutation and credential-exfiltration signals can raise risk; a semantic
   extractor cannot downgrade them. English and Russian high-risk terms, including credential-exfiltration
   patterns, are covered by lexical safeguards, but these are not a substitute
   for policy analysis.
7. High/critical intent, including detected credential-exfiltration language,
   requires a distinct risk acknowledgement in addition to ordinary confirmation.
8. Approval is bound to the exact contract ID and immutable content hash,
   action subset, assumption acknowledgements, risk acknowledgement, timestamp
   and evidence reference. `approve()` requires an injected host/UI
   `IntentApprovalVerifier` to validate and, where possible, consume a one-time
   user-confirmation receipt; a boolean or caller-chosen evidence string alone
   cannot mint approval. A runtime HMAC attestation detects later approval edits.
9. Approval lifetime is fixed at 15 minutes in this version. A stale or
   future-dated approval cannot pass the gate.
10. The bridge does not invoke ActionGateway when the intent gate refuses.
    ActionGateway remains responsible for its independent permission checks,
    one-shot tool approvals, input contracts, idempotency receipts, result
    verification and reconciliation.

## Approval key lifecycle

The compiler generates a random, process-local key by default. That is safe for
a single runtime lifetime but intentionally makes approvals unverifiable after
restart. Production persistence must inject a stable, secret-managed key through
`IntentCompiler({ approvalKey, clock })` and must never place that key in the
contract, logs, repository, or Release ZIP. Rotating the key invalidates prior
approval attestations. The complete source request is bound through a SHA-256
digest even when the visible contract text is truncated. The HMAC is an integrity check over the host-verified approval attestation; it does not replace authentication of the user-confirmation event or durable evidence storage. Without the host verifier, `approve()` refuses to sign.

## Integration example

```ts
// Supplied by the authenticated host/UI; verifies and consumes a one-time
// confirmation receipt bound to the exact contract and approved action subset.
declare const hostApprovalVerifier: IntentApprovalVerifier;
const compiler = new IntentCompiler({
  approvalKey: secretStore.getBytes('nk1-intent-approval-key'),
  approvalVerifier: hostApprovalVerifier,
});
const contract = await compiler.compileWith(
  { requestId, text: userRequest },
  semanticExtractor,
);

// Display the verbatim request, extracted goal, assumptions, risk,
// missing information, acceptance criteria and allowed action scope.
// Obtain an explicit user confirmation outside the compiler.
const approved = compiler.approve(contract, {
  contractId: contract.id,
  userConfirmed: true,
  allowedActions: ['organism.inspect'],
  acknowledgedAssumptions: [],
  riskAcknowledged: false,
  at: Date.now(),
  evidenceRef: confirmationReceipt.id,
});

const bridge = new IntentActionGatewayBridge(compiler);
const result = await bridge.execute(
  approved,
  { toolId: 'organism.inspect', input: {}, reason: 'intent-bound execution' },
  actionGateway,
);
```

## Current integration boundary

The compiler and bridge are reusable runtime modules. They do not transparently
intercept every legacy caller that invokes ActionGateway directly. Production
adoption must route the selected OrganismCore planning/execution entry points
through this bridge, while preserving the canonical core finalizer, planner
receipt recovery and reconciliation flow. Do not bypass ActionGateway or
replace its policy layer with intent approval.

## Verification

Run from `runtime/neuro-kurisu`:

```bash
npm run test:intent-compiler
npm run typecheck
```

A passing focused test validates the boundary behavior; it does not establish
semantic-extraction accuracy. Extractor quality needs independent holdout
evaluation, multilingual adversarial testing and operational telemetry before
the feature can be promoted from Draft.
