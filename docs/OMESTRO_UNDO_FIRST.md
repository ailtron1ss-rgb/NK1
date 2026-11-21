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

For rollback/compensation, the primary tool and compensator must declare atomic compare-and-set support. The gateway passes the exact expected state fingerprint in the executor context; the provider adapter must enforce it in the same write operation (ETag / If-Match / version predicate), returning a typed no-effect result when the state has drifted. The plan also names a durable, independently verifiable, reconcilable compensation tool and a read-only state verifier. The verifier must return `stateHash` and a verified external postcondition. The primary action and compensator must enforce that state fingerprint atomically with the provider write; if the provider reports the compare-and-set failed, the Gateway records no-effect and does not overwrite the changed resource. The preparation result includes a durable, non-secret `recoveryArtifactRef` (provider snapshot ID, rollback handle or compensation artifact); it is normalized, bounded to 16 KiB, bound to the original execution ID and request hash, fingerprinted, and committed inside the pending idempotency receipt **before the primary executor is entered**. The artifact itself may live in provider storage, but the handle must remain resolvable for the recovery window.

The recovery artifact has a separate lifecycle from the target mutation:

- `undoFirst.discardPrepared(recoveryArtifactRef, context)` is an optional, idempotent provider hook for releasing the auxiliary snapshot/rollback artifact.
- It is invoked only when plan validation fails or ledger admission is rejected **before** the pending-receipt persister is called (for example, an irrecoverably full hot ledger or a failed archive-room operation). The primary executor is not entered.
- If no cleanup hook is supplied, the provider-managed TTL remains the fallback. Cleanup exceptions are surfaced as `recoveryArtifactDisposition: release-failed` rather than hidden.
- A rejected/failed persister promise is **not** proof that no write happened: a store may have committed the pending receipt and lost its acknowledgement. In that case NK1 does not call `discardPrepared`, retains the recovery artifact, keeps the pending tombstone in memory, and makes one idempotent persistence retry. A same-process retry for the same key is blocked pending authoritative reconciliation.
- After a process restart, the durable ledger remains authoritative. Providers must still bound artifact lifetime with TTL because a truly unavailable ledger cannot prove whether an artifact reference was committed.

This cleanup hook releases only the auxiliary recovery artifact. It must never reverse or mutate the primary target, and should be safe to call repeatedly with the same handle.

## First concrete adapter — private workspace file creation

The first production integration is registered by `OrganismRuntime` after `OrganismCore.init()` only when its state backend is a durable `FileStateStore`. Registration goes through `OrganismCore.registerActionTool`, which routes to the same canonical `ActionGateway`; memory-only runtimes do not receive a persistent workspace mutation capability.

- `organism.files.write` creates a **new** UTF-8 file (1–16 KiB) directly under the private `organism-core.json.workspace` sidecar directory. Version one deliberately disallows nested paths; it rejects traversal, reserved recovery paths, symlinked workspace/recovery/target paths and refuses to create children beneath a symlinked recovery root. Existing workspace and recovery directories are tightened to owner-only mode `0700` through already-opened `O_NOFOLLOW` directory handles; modes are checked after the change.
- Existing files are never overwritten. The provider creates a sibling temporary file, fsyncs it, and uses same-directory hard-link creation; the filesystem atomically rejects an existing destination rather than replacing it.
- Every write requires a stable idempotency key and one-shot `filesystem` approval. The Undo-First preflight records the expected pre-action absence and the exact post-action content fingerprint in `.nk1-recovery/prepared` before the write executor is entered.
- The temporary is removed after the link operation; the file's parent directory and recovery record are fsynced. An independent readback checks the actual file bytes and content hash before the Gateway can record a verified outcome.
- `organism.files.state` is a read-only state/fingerprint tool. The write adapter's provider reconciliation returns a receipt only when the current file exists with the exact prepared content hash; missing or divergent state stays `unknown`.
- The undo plan is deliberately **manual-intervention-required**. Node's portable filesystem API does not offer an atomic “unlink this path only if its current contents still hash to X” primitive. NK1 therefore returns a durable recovery reference and SHA-256-bound steps, and does not silently delete or replace a file that may have been edited after creation.
- Admission rejection before the pending-receipt persister runs invokes `discardPrepared` and removes the uncommitted auxiliary record. An ambiguous persister acknowledgement retains it; after a successful create the recovery record is retained for review. The workspace and recovery directory are private to the NK1 state area.

This first adapter is create-only; it does not yet promise arbitrary file replacement, deletion, directory moves, or unattended cleanup of modified files. Those require a separate provider contract with an actual compare-and-set primitive and independent postcondition proof.

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
- Primary mutations and compensations receive an expected-state fingerprint that adapters must compare atomically with the write. A state fingerprint that matches neither the prepared baseline nor the expected post-action state is treated as divergence; NK1 does not overwrite concurrent external changes.
- The compensator is a normal ActionGateway tool with durable idempotency, an outcome verifier, and provider reconciliation. It gets its own idempotency receipt.

## Rollout

The gateway reports Undo-First coverage separately from the existing receipt/approval coverage. Migration of every legacy mutating tool is intentionally incremental: unconverted legacy tools remain visible as coverage gaps; a tool opts into strict enforcement by declaring `requiresUndoFirst`.

## Evidence boundary

The regressions exercise preparation ordering, durable plan restore, verified compensation, duplicate-undo prevention, state divergence, unresolved-action refusal, pre-persist cleanup, and pending-tombstone retention after an ambiguous receipt write. The filesystem integration regression drives a real FileStateStore-backed OrganismRuntime and its canonical OrganismCore through approved file creation, content-hash readback, manual recovery-plan persistence and post-restart replay. CI evidence is recorded against the exact PR head. No Release ZIP is changed by this branch.
