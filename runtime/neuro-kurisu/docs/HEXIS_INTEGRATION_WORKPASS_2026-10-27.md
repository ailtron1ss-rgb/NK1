# Hexis → NK1 integration record

Date: 2026-10-27
WorkPass: Hexis evidence lineage bridge
Target branch: `nk1-hexis-evidence-lineage-v2-2026-10-27`

## Source reviewed

- Upstream: https://github.com/QuixiAI/Hexis
- Upstream README and retained source archive were inspected.
- Upstream license in the retained archive is MIT (copyright notice must be preserved when copying substantial upstream material).
- This pass does **not** vendor Hexis runtime code or add PostgreSQL/Apache AGE dependencies.

## Integration decision

Hexis has several useful patterns: evidence-backed beliefs with an auditable revision trail, explicit source lineage and independence, autonomous heartbeat bounded by energy, and a human-reviewable learning diff. NK1 already has a canonical `MemoryOS2` owner with evidence provenance, temporal validity/supersession, conflict handling, and retrieval ranking. Therefore, duplicating Hexis's database or installing its full stack would create a second authority and increase operational burden.

This pass adapts the narrowest high-value seam first: an evidence bridge that maps Hexis-style evidence events into NK1's existing `MemoryEvidenceSource` shape while retaining stance, upstream lineage, content hash, and source-independence identity. It deliberately treats upstream confidence numbers as audit metadata only; NK1 confidence must not be overwritten by an upstream score.

## Files changed

- `src/organism/integration/HexisEvidenceBridge.ts`: typed evidence record, provenance mapping, bounded authority/confidence metadata, strict required-field/timestamp checks, and review-required proposal output.
- `src/organism/index.ts`: exports the bridge from the organism surface.
- `tests/hexis-evidence-bridge.mjs`: contract checks for polarity preservation, provenance mapping, bounds, invalid inputs, and duplicate-origin grouping.

## Safety and ownership invariants

1. `MemoryOS2` remains the only writable memory owner.
2. Evidence polarity (`supports`, `refutes`, `neutral`) is never discarded or converted.
3. Copies from the same origin preserve the same `independenceKey`; they cannot honestly be counted as independent corroboration.
4. Upstream confidence is not treated as NK1 confidence and is never directly applied.
5. Every proposal requires independent review before any memory revision is committed.
6. This adapter does not claim PostgreSQL transactions, Hexis heartbeat parity, autonomous behavior, or full Hexis interoperability.

## Validation status

- Source and contract are committed on the working branch.
- The regression script is present but has **not** been executed in a local Node runtime during this GitHub-only pass.
- Typecheck, complete runtime integration, real MemoryOS2 mutation path, and release ZIP refresh remain unverified.
- No claim is made that memory recall improved. Existing retrieval uplift must be demonstrated with the project's independent holdout and paired-seed protocol.

## Next implementation gates

1. Add the proposal to the canonical MemoryOS2 evidence ingestion/revision path (not a parallel store), with deduplication by evidence ID and source independence key.
2. Persist evidence lineage and supersession through the existing state migration/persistence layer.
3. Add conflict/retraction tests: support → refute, newer evidence superseding stale evidence, duplicate evidence replay, and process restart.
4. Add an audit view showing why confidence changed, sourced only from committed NK1 revisions.
5. Benchmark on a fixed holdout; reject the integration if it adds complexity without reducing stale-belief use or improving task-grounded recall.

## Progress accounting

- **Implemented in this pass:** typed adapter contract, provenance mapping, stance retention, validation, export, focused regression script.
- **Not yet integrated:** production call path and persistent revision application.
- **Not yet validated:** runtime test execution, typecheck, full E2E, measured recall/behavior uplift.
