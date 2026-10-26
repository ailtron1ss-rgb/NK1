# WorkPass386 — безопасное и атомарное восстановление ActionGateway ledger

**Дата:** 2026-10-26  
**Базовый HEAD:** ded48337b01921c016d9d50aaf8e7aeb1cbbf470  
**Статус:** code/test change committed; exact-head CI still required.

## Дефект

`restoreExecutionLedger()` read persisted root, ledger-row, response and approval properties directly. Accessor-backed snapshots could execute getters during restoration. It also replaced the live execution ledger before all permission data had been normalized, creating a partial-restore failure mode.

## Реализация

- Snapshot only own data descriptors for known root/ledger/approval fields. Accessor-backed roots and identity-bearing rows reject before live state changes.
- Require a supported version when present, a records array and dense data slots; bound ledger restore to 512 records and permission requests to 2,048 input rows / 128 active retained requests.
- Deep-copy JSON-like data by property descriptors, with cycle/depth/node/string/array limits. No `structuredClone()` or ordinary property reads are used on untrusted nested receipts before checks.
- Malformed nested receipts become non-replayable tombstones while preserving a validated idempotency key. Malformed root/row/permissions boundaries abort the full restore.
- Stage both the restored ledger and approval state before committing; roll back if final expiry processing fails. `undefined`/`null` snapshot is a no-op rather than an implicit ledger clear.

## Regression

Extend WorkPass95 with root accessor, row identity accessor, sparse records array, nested response accessor and proof that an existing in-memory idempotency key remains replayable after failed restore. A nested accessor receipt must not execute its getter and must return `idempotency-recovery-required` without re-running the tool.

## Acceptance

Require `test:workpass95:receipt-integrity`, `test:action-ledger-archive-workpass38`, runtime typecheck, `test:rebuild-recovered`, WorkPass71 and Repository Wiring Audit on the same exact SHA. The previous hosted Actions jobs had zero executed steps, so no pass/fail assertion about this code is inferred from those infrastructure failures.

`main` and the published Release ZIP remain untouched.
