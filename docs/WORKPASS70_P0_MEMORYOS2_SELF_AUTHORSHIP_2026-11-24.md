# Workpass70 P0 — MemoryOS2 and verified self-authorship

Base: workpass70-source @ 54f9ec7c1ea81b71d0f0cf6d8c3e6395c4f96441
Branch: aspect/p0-memoryos2-selfauthorship-execution-20261124

## MemoryOS2
- Explicit caller-provided IDs that collide with a different canonical record are deterministically re-keyed. Exact content replay still resolves to the existing canonical row.
- Byte estimation treats absent revision-integrity findings as an empty array, matching restored-row normalization.
- New canonical rows initialize a bounded revision-integrity list.
- Re-observation of a revision-chain tip updates observation freshness without moving its established valid-time start.
- Both implicit contradiction reconciliation and encode-time reciprocal contradiction linking recalculate the changed rows' byte estimates.

## SelfAuthorship
- Decision selection creates only a bounded pending record; it does not increase authorship, action counts or commitments.
- OrganismCore links each pending decision to the actual decision ID and resolves it from the same feedback trace.
- Credit is awarded only when the matching decision has an executed/verified outcome and is internally autonomous (not externally requested).
- Pending decisions survive snapshot/restore, expire after 24 hours, are bounded to 32, and duplicate/unmatched outcomes are ignored.
- Legacy snapshots without the pending ledger restore as an empty ledger.

## Verification
The branch adds four focused regressions and retains the existing workpass31 temporal/provenance tests. Exact-head Actions results must be reviewed before this branch is merged. This change does not publish a Release.