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
- `src/organism/integration/HexisEvidenceIngest.ts`: applies independently reviewed evidence through `MemoryOS2.updateSignals` and `updateContext`; it refuses unreviewed proposals, detects exact replay, and never applies upstream confidence deltas.
- `src/organism/index.ts`: exports both the adapter and the reviewed-ingest function.
- `tests/hexis-evidence-bridge.mjs`: adapter contract checks for polarity preservation, provenance mapping, bounds, invalid inputs, and duplicate-origin grouping.
- `tests/hexis-memoryos2-ingest.mjs`: focused checks for review gating, canonical evidence-source persistence, confidence isolation, replay idempotency, and missing targets.

## Safety and ownership invariants

1. `MemoryOS2` remains the only writable memory owner.
2. Evidence polarity (`supports`, `refutes`, `neutral`) is never discarded or converted.
3. Copies from the same origin preserve the same `independenceKey`; they cannot honestly be counted as independent corroboration.
4. Upstream confidence is not treated as NK1 confidence and is never directly applied.
5. Every proposal requires independent review before any memory revision is committed.
6. This adapter does not claim PostgreSQL transactions, Hexis heartbeat parity, autonomous behavior, or full Hexis interoperability.

## Validation status

- Adapter, canonical MemoryOS2 ingest path, exports, and focused regression scripts are committed on the working branch.
- Tests are authored but have **not** been executed in a local Node runtime during this GitHub-only pass.
- Typecheck, production caller wiring, restart persistence, full E2E, and release ZIP refresh remain unverified.
- No claim is made that memory recall improved. Existing retrieval uplift must be demonstrated with the project's independent holdout and paired-seed protocol.

## Next implementation gates

1. Wire the reviewed-ingest function into the actual belief/evidence producer so it is exercised by the running organism rather than only by direct callers.
2. Extend the canonical persisted evidence schema to retain per-event stance/history, including explicit support → refute transitions, without making context metadata the long-term event log.
3. Add stale-evidence supersession and restart/persistence tests; exact replay is covered in the new authored test.
4. Add an audit view showing why confidence changed, sourced only from committed NK1 revisions.
5. Benchmark on a fixed holdout; reject the integration if it adds complexity without reducing stale-belief use or improving task-grounded recall.

## Progress accounting

- **Implemented in this pass:** typed adapter contract, provenance mapping, review-gated canonical MemoryOS2 evidence-source merge, exact replay guard, bounded latest-stance metadata, exports, and focused regression scripts.
- **Not yet integrated:** producer-side caller wiring; full per-event stance history is not yet modeled in the canonical schema.
- **Not yet validated:** runtime test execution, typecheck, restart persistence, full E2E, measured recall/behavior uplift.
