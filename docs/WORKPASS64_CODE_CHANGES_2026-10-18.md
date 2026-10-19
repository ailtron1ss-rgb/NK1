# WorkPass64 — code changes (2026-10-18)

## 1. Hot-ledger capacity cannot evict unresolved external state

`ActionGateway.makeLedgerRoom` now spills only completed receipts with a verified result, explicit `failed-no-effect`, or authoritative `reconciled-not-executed` status. Completed `executed-unverified`, `executed-contradicted`, partial, and legacy ambiguous outcomes remain eligible for reconciliation in the hot ledger. If capacity is exhausted and no safely archivable receipt exists, the new operation fails with `idempotency-ledger-full` before its executor is entered.

## 2. Append-only archived receipt revisions

`FileActionExecutionLedgerArchive` now supports `appendRevision` for a narrow case: the previous archived entry is unresolved; `requestHash`, `toolId`, and `executionId` remain unchanged; the new response has `reconciled=true`; and its timestamp does not move backwards. The new JSONL record gets a new SHA-256 digest and is fsynced; the original archived line is never mutated. Invalid request identity changes and attempts to revise a verified terminal receipt are rejected.

When archive JSONL is loaded, it validates every revision edge in sequence and indexes the latest permitted line. A malformed checksum, conflicting request identity, or unauthorized revision still fails closed.

## 3. Recovery queue includes the archive

`ActionGateway.unresolvedExecutionCount()` and `unresolvedExecutionSnapshot()` merge hot-ledger state and archive metadata by key identity. The latest archived metadata overrides a stale hot shadow. Archived unresolved entries therefore remain visible in diagnostics and the UI queue; response/input contents and key hashes remain redacted.

## 4. Regression coverage

`tests/workpass64-archived-receipt-reconciliation.mjs` covers:

- 16 unresolved entries filling the hot ledger; the 17th mutation is blocked before executor entry and all 16 remain visible;
- a legacy archived unresolved entry, recovery queue visibility, persisted one-shot reconciliation approval, read-only provider receipt lookup, same `executionId`, and no repeated side effect;
- append-only revision and archive reload after restart;
- rejection of request-identity conflicts and attempts to revise an already verified receipt.

The legacy `action-ledger-archive-workpass38.mjs` fixture was adjusted to declare its completed test receipts verified; otherwise it would conflict with the stronger rule that unverified entries must not be evicted merely to satisfy an old test's capacity assumption. The WorkPass62/63 child-process regression harnesses now use a bounded deadline, kill their full process group on timeout, close pipes, and fail distinctly when a test child hangs, preventing fault-injection scenarios from indefinitely blocking CI.

## Commands

```sh
npm --prefix runtime/neuro-kurisu run test:workpass64
npm --prefix runtime/neuro-kurisu run test:workpass63
npm --prefix runtime/neuro-kurisu run audit:workpass64
```

Runtime typecheck, WorkPass64 archive/recovery test, legacy archive suite and WorkPass61 receipt revision tests pass in the WorkPass64 acceptance chain. WorkPass63/62 fault-injection regressions were also run separately and pass; they are a separate command rather than nested in `audit:workpass64` to keep SIGKILL/process tests independently bounded. The focused WorkPass64 runtime audit also passes WorkPass58 preflight/HTTP status and WorkPass57 outcome/idempotency suites. Production app build and real browser/Live2D journeys remain unverified; this pass does not claim live provider/device E2E.
