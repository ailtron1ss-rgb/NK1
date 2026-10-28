# NK1 MemoryOS2 restore identity integrity

## Problem

A persisted snapshot can be malformed or partially corrupted. Duplicate IDs are especially dangerous because the canonical `items` list can contain multiple rows while `itemIndex` stores only one row for that ID. That makes postings, document frequencies, revision chains, and eviction bookkeeping disagree about what is actually stored. Likewise, an `encode()` call that supplies an existing ID with different content must not overwrite the index owner or append a second row.

## Behavior

- `encode()` rejects blank/whitespace-padded IDs and rejects an explicit ID that is already bound to a different `(kind, source, canonical content)` identity before mutating live state.
- `forceDistinct` bypasses content de-duplication, not ID uniqueness. When no explicit ID is supplied and the content-addressed ID is already owned, a fresh deterministic-seeded unique ID is minted.
- `restore()` bounds the considered rows, normalizes records, drops invalid rows, collapses duplicate-ID rows only when their identities agree, and drops every row in an ID group whose canonical identities conflict. The winner among same-identity rows is selected deterministically, independent of snapshot order.
- `restore()` returns a bounded `MemoryOS2RestoreIntegrityReport`; `restoreIntegrityDiagnostics()` returns a copy of the last report.
- All indexes are rebuilt from the sanitized canonical rows, including the metadata posting index. The restore report exposes source/considered/retained counts, invalid rows, duplicate-ID groups, collapsed rows, conflicting groups/rows, and truncation.

## Validation

Run from `runtime/neuro-kurisu`:

~~~bash
npm run test:memory-restore-id-integrity
npm run test:memoryos2-metadata-retrieval
npm run typecheck
~~~

The test includes live explicit-ID conflict atomicity, force-distinct unique IDs, idempotent same-ID replay, corrupt snapshots with invalid rows and both compatible/conflicting duplicate-ID groups, stable resolution under reverse ordering, and a post-restore index-integrity assertion.

This is data-integrity hardening, not evidence of improved retrieval quality. Do not claim retrieval uplift from restore sanitation; the independent immutable holdout and existing promotion gate remain authoritative.
