# NK1 Intent Compiler (OmeStro idea 12)

## Purpose

Turn a natural-language request into a versioned, reviewable contract before an
execution-capable subsystem is called. The contract keeps the user's wording,
structured interpretation, constraints, acceptance criteria, assumptions,
risk signals, explicit tool allow-list, explicit denials, and stop conditions
separate and inspectable.

## Runtime components

- `IntentCompiler`: deterministic contract builder and validator.
- `IntentExtractionProvider`: adapter seam for a local or remote semantic
  extractor. Provider output is treated as untrusted structured input.
- `IntentActionGatewayBridge`: checks the contract before forwarding one
  approved action to the existing canonical `ActionGateway.executeTool`.
- `tests/intent-compiler-contract.mjs`: behavioral contract and gateway-boundary
  regression suite.

## Safety invariants

1. Raw request text is preserved; if no structured goal is supplied, the goal
   is explicitly marked `verbatim-request`, not presented as a semantic parse.
2. Free text never creates an allowed-action entry. The allow-list must be
   supplied as structured extraction data.
3. A semantic extractor cannot lower a deterministic risk signal.
4. Approval requires explicit confirmation, a timestamp, an evidence reference,
   acceptance criteria, an expected outcome, and a non-empty explicit allow-list.
5. Approval can only narrow the declared allow-list. It cannot add a capability.
6. Explicit denials override approvals.
7. The bridge does not call ActionGateway when the contract gate refuses.
8. ActionGateway remains responsible for its existing policy, permission,
   idempotency, receipt, and outcome-verification controls. Intent approval
   does not bypass or replace those controls.

## Integration sketch

```ts
const compiler = new IntentCompiler();
const contract = await compiler.compileWith(
  { requestId, text: userRequest },
  semanticExtractor,
);

// Show contract, assumptions, risk, missing information, and action scope.
// Obtain explicit user confirmation outside the compiler.
const approved = compiler.approve(contract, {
  userConfirmed: true,
  allowedActions: ['organism.inspect'],
  at: Date.now(),
  evidenceRef: 'user-confirmation:<stable-reference>',
});

const bridge = new IntentActionGatewayBridge(compiler);
const result = await bridge.execute(
  approved,
  { toolId: 'organism.inspect', input: {}, reason: 'intent-bound execution' },
  actionGateway,
);
```

## Current implementation boundary

The compiler, provider seam, and ActionGateway bridge are implemented as
reusable runtime modules. Existing legacy callers that invoke ActionGateway
directly are not transparently intercepted by this first slice; new intent-bound
execution paths must use the bridge. A follow-up integration pass should route
the selected OrganismCore execution entry points through this boundary without
weakening existing finalization, approval, idempotency, or reconciliation logic.

## Verification

Run from `runtime/neuro-kurisu`:

```bash
npm run test:intent-compiler
```
