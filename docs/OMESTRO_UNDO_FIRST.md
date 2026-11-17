# OmeStro #04 — Undo-First Intelligence

**Branch:** `aspect/undo-first-intelligence-20261117`  
**Base:** `workpass70-source` @ `1e83a011fc677ff20f2348570322bd562181d9ff`  
**Status:** Draft implementation; merge and Release promotion are separate gates.

## Runtime contract

Undo-First extends the existing `ActionGateway`; it is not a second executor.

A tool opts in with `requiresUndoFirst: true` and a read-only `undoFirst.prepare(input, context)` function. Preparation must capture a stable pre-action fingerprint and return one of four strategies:

- `rollback` — a separately registered rollback tool restores the captured state.
- `compensate` — a separately registered compensator performs the inverse operation.
- `manual` — durable instructions explain the human recovery path.
- `irreversible` — records why no full rollback exists.

For rollback/compensation, the plan names a durable, independently verifiable, reconcilable compensation tool and a read-only state verifier. The verifier must return `stateHash` and a verified external postcondition. The preparation result is normalized, bounded to 16 KiB, bound to the original execution ID and request hash, fingerprinted, and committed inside the pending idempotency receipt **before the primary executor is entered**.

## Recovery sequence

```
validate input / policy / approval
        ↓
read-only Undo-First preparation
        ↓
durable pending receipt + plan persisted
        ↓
primary ActionGateway execution
        ↓
verified terminal receipt
        ↓
read current state independently
        ↓
compare with beforeHash / afterHash
        ↓
execute compensator through ActionGateway
        ↓
read state independently again
        ↓
report restored only when beforeHash matches
```

`executeUndoForKey(originalKey)` does not rerun the original action. It accepts only a completed, verified original receipt; refuses unresolved or ambiguous actions; checks that current state equals the prepared post-action fingerprint; executes the compensation with a deterministic idempotency key; and confirms restoration with a second independent readback. Repeated calls after successful restoration return `already-restored` without repeating the side effect.

## Fail-closed boundaries

- A tool declared `requiresUndoFirst` without a preparation function is refused before executor entry.
- Preparation exceptions, malformed plans, unknown compensators, invalid tool contracts, unsafe plan fields, oversized plans, or missing verifier/reconciliation support block execution.
- Autonomous execution is restricted to rollback/compensation plans. Manual and irreversible strategies require a protected permission class and the existing one-shot approval path.
- Secrets and credentials are not allowed in persisted compensation/verification inputs. Plans carry resource references and bounded state fingerprints, not API keys or credentials.
- Pending/ambiguous original actions cannot be automatically undone. The original provider receipt must first be reconciled; otherwise the system could compensate an action that never happened or execute a second side effect.
- A state fingerprint that matches neither the prepared baseline nor the expected post-action state is treated as divergence; NK1 does not overwrite concurrent external changes.
- The compensator is a normal ActionGateway tool with durable idempotency, an outcome verifier, and provider reconciliation. It gets its own idempotency receipt.

## Rollout

The gateway reports Undo-First coverage separately from the existing receipt/approval coverage. Migration of every legacy mutating tool is intentionally incremental: unconverted legacy tools remain visible as coverage gaps; a tool opts into strict enforcement by declaring `requiresUndoFirst`.

## Evidence boundary

The added regressions exercise preparation ordering, durable plan restore, verified compensation, duplicate-undo prevention, state divergence and refusal to compensate unresolved original effects. CI evidence is recorded against the exact PR head. No Release ZIP is changed by this branch.
