# WorkPass478 — Hexis source lineage into canonical memory

**Date:** 2026-10-27  
**Base:** `fix/hexis-belief-dedupe-contract-2026-10-27`  
**Status:** implementation prepared on `nk1-hexis-evidence-lineage-2026-10-27`; exact-head CI pending.

## What changed

- `EvidenceLineageProvenance.ts` provides one bounded contract for SourceMonitor and P65 claims. Accessor-backed, malformed, oversized and unrecognized provenance is rejected.
- `SourceMonitor` stores safe copies of declared provenance and exposes a bounded lineage lookup.
- `P65EpistemicLedger` can preserve a declared provenance envelope on an observation.
- `HexisCanonicalEvidenceBridge` adapts the earlier WorkPass376 idea to the current API: it writes through `MemoryFabric.updateSignals()`, not a nonexistent `MemoryOS2.recordEvidence()` method.
- `MemorySubsystemRuntime` owns the source monitor and bridge and includes source lineage in runtime snapshots/restores.
- SourceMonitor and P65 entries with the same source identity and content fingerprint deduplicate to one canonical lineage.
- Only explicit `direct-observation` or `corroborated` declarations from non-model/non-memory channels may be ingested. The declared fingerprint is not authentication. The bridge never changes belief confidence or authorizes actions.

## Invariants

1. MemoryFabric remains the only mutation boundary; MemoryOS2 remains the only writable canonical store.
2. Evidence lineage is append-only metadata, bounded by the existing evidence merge/tombstone logic.
3. Identical upstream lineage cannot count twice when it appears through SourceMonitor and P65.
4. Malformed or ineligible provenance fails closed without mutating canonical memory.
5. Runtime snapshot/restore must preserve provenance and canonical duplicate guards.

## Validation

Run:

```sh
npm run test:hexis-evidence-lineage
npm run audit:hexis
npm run typecheck
```

The regression test uses synthetic local fixtures only. Passing it does not establish factual source authentication, independent learning uplift, production readiness or Release publication.
