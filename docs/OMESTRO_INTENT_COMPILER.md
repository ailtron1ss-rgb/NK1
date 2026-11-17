# Intent Compiler — NK1 integration

**Concept:** OmeStro idea 12 (Intent Compiler).

## Runtime components

- `runtime/neuro-kurisu/src/organism/cognition/IntentCompiler.ts`
  - Compiles a user request plus an upstream semantic extraction into an immutable, versioned `nk1.intent-contract`.
  - Preserves verbatim request text and distinguishes structured goal extraction from fallback-to-verbatim.
  - Records context, expected outcome, must/must-not constraints, priorities, acceptance criteria, assumptions with confidence/impact, explicit action allow/deny lists, stop conditions, risk reasons, missing information and approval evidence.
- `runtime/neuro-kurisu/src/organism/system/IntentActionGatewayBridge.ts`
  - Enforces the contract before dispatch and routes accepted actions through the canonical `ActionGateway`.
  - Binds the gateway decision lineage to the intent contract ID when the caller has not supplied a decision ID.

## Safety and trust boundaries

The semantic extraction is untrusted proposal data. Natural-language interpretation is performed upstream; the compiler validates and bounds the result. It never derives tool permissions from prose.

A contract starts as `not-approved`. Explicit approval may only narrow the declared allow-list; it cannot add an action. The gate rejects incomplete contracts, unapproved contracts, denied actions and actions not included in both the declaration and approval.

Risk classification combines lexical risk indicators with the supplied risk level using the more conservative level. A caller cannot downgrade destructive language by labelling the extraction low-risk.

The bridge is not a replacement for `ActionGateway`. Passing the intent gate does not bypass the gateway's independent tool permissions, one-shot approvals, input contracts, durable idempotency, verification or reconciliation.

## Deliberate limits

- No implicit permission expansion.
- No execution from an unapproved or incomplete contract.
- Assumptions remain labelled as assumptions, not user-approved facts.
- No auto-merge, release or destructive action.
- Extraction quality and risk classification require independent holdout evaluation before production promotion.

## Verification

Run from `runtime/neuro-kurisu`:

```sh
npm run test:intent-compiler
```
