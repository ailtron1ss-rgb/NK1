# Intent Compiler — NK1 integration

**Concept:** OmeStro idea 12 (Intent Compiler).

## Runtime components

- `runtime/neuro-kurisu/src/organism/cognition/IntentCompiler.ts`
  - Builds an immutable, versioned contract from the verbatim request and an optional upstream semantic extraction.
  - Hash-binds the complete interpretation, constraints, risk, stop conditions and explicit permissions into a stable contract identity.
  - Requires expected outcome, acceptance criteria, an explicit tool allow-list and stop conditions before approval.
  - Tracks incomplete/truncated requests, extractor failures, conflicting permissions and malformed/wildcard action identifiers.
  - Uses multilingual deterministic risk escalators; upstream metadata cannot downgrade detected risk.
  - Requires explicit acknowledgement of material assumptions and separate acknowledgement for high/critical intent.
  - HMAC-attests approval to the exact contract and permission subset; approvals expire after a bounded TTL.
- `runtime/neuro-kurisu/src/organism/system/IntentActionGatewayBridge.ts`
  - Refuses incomplete, expired, altered, unapproved and out-of-scope requests.
  - Forwards one approved action through canonical `ActionGateway.executeTool` and binds a default decision ID to the intent contract.

## Safety and trust boundaries

Semantic extraction is untrusted proposal data. The compiler does not claim to parse arbitrary natural language itself and never derives tool permissions from free text.

A contract is initially `not-approved`. Approval is exact-contract-bound and can only narrow the declared allow-list. Denials win over allows. Assumptions remain assumptions until acknowledged. A source request that exceeds the bounded input size is marked truncated and cannot be executed.

The approval HMAC key is generated per process by default. Production persistence must inject a stable key from a secret store; the key must never be written to the contract, repository, logs or Release ZIP. Without the same configured key after restart, persisted approval correctly fails closed.

The bridge is not a replacement for `ActionGateway`. Passing the intent gate does not bypass its independent permission checks, one-shot approvals, input contracts, durable idempotency, verification or reconciliation.

## Deliberate limits

- No implicit permission expansion or wildcard tool scope.
- No execution from an incomplete, unapproved, modified or expired contract.
- No assumption silently promoted to a user-confirmed fact.
- Legacy callers that invoke ActionGateway directly are not automatically intercepted by this first slice; selected OrganismCore planner/execution entry points still need explicit bridge integration.
- No auto-merge or Release ZIP publication.
- Extractor accuracy and risk coverage require independent holdout and adversarial evaluation before production promotion.

## Verification

Run from `runtime/neuro-kurisu`:

```sh
npm run test:intent-compiler
npm run typecheck
```
