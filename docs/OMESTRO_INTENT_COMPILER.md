# Intent Compiler — NK1 integration

**Concept:** OmeStro idea 12 (Intent Compiler).

## Runtime boundary

`IntentCompiler` converts an upstream extraction into a versioned, bounded
`IntentContract`. It does not pretend that deterministic code can infer all
semantics from arbitrary natural language: the extraction is supplied by the
perception/LLM layer and treated as untrusted proposed data.

The contract records:
- goal, context, constraints and priorities;
- expected result and acceptance criteria;
- explicit tool allowlist and denylist;
- assumptions, unresolved questions and stop conditions;
- risk level, confirmation requirement and diagnostics.

## Execution policy

Only a `ready` contract may pass the Intent execution gate. Missing required
fields or unresolved questions produce `needs-clarification`; contradictory
allow/deny entries produce `blocked`. The gate denies tools not explicitly
allowlisted and tools explicitly forbidden by the contract.

This is **not** a replacement for `ActionGateway`. The gate delegates to the
canonical gateway, preserving its input contracts, durable idempotency,
permission classes, one-shot tool approvals, verification and reconciliation.
A high/critical intent requires confirmation bound to the exact contract ID;
that confirmation does not itself authorize a protected tool operation.

## Deliberate limits

- No implicit expansion of tool permissions.
- No execution when the contract is incomplete or ambiguous.
- No claim that assumptions are user-approved facts.
- No auto-merge, release or destructive action.
- Natural-language extraction quality must be evaluated separately with
  independent holdouts before production promotion.

## Verification

Run from `runtime/neuro-kurisu`:

```sh
node --experimental-strip-types tests/intent-compiler-workpass1.mjs
```
