# NK1 Personality / SelfModel — engineering pass 01

**Date:** 2026-10-30  
**Base:** `workpass70-source` at `d8bdf7a14f30d540c1503a436ad993c8d7be8400`  
**Work branch:** `work/personality-selfmodel-evidence-closure-2026-10-30`

## Implemented

### P78 autobiographical evidence boundary

Updated `src/organism/developmental/P78AutobiographicalSelfContinuity.ts` so the autobiographical narrative no longer treats any numeric outcome as verified experience.

- Added optional provenance fields to events: `evidenceStatus`, `evidenceRef`, `authorship`, `episodeId`.
- Legacy event payloads remain accepted, but are conservatively classified as unverified/unknown.
- Only `verified-independent` events with a syntactically bound evidence reference contribute to verified-outcome continuity and turning-point creation.
- Self-authorship changes only when an explicit authorship classification is supplied; `self-initiated` and `self-selected` are distinguished from user-directed/system/unknown episodes.
- Added counters for verified outcomes, unverified outcomes and episodes with known authorship.
- Expanded the idempotency key to include mode, evidence status/reference, authorship and episode ID. This closes the prior case where a mode-only change was invisible to deduplication.
- Added bounded text normalization and finite input filtering at the autobiographical ingress.
- Changed initial continuity/narrative confidence to neutral priors rather than pre-asserting strong continuity before evidence exists.

## Why this matters

The autobiographical self should be a traceable narrative over episodes, not a confidence generator. Previously, arbitrary numeric outcomes could affect continuity and turning points without a provenance link; unknown authorship could be interpreted as agency. This pass makes those assumptions explicit and conservative while retaining backward compatibility for old snapshots and event producers.

## New regression test

`tests/p78-autobiographical-provenance.mjs` covers:
- legacy/unverified outcome handling;
- explicit verified evidence and authorship;
- turning-point admission;
- idempotent replay;
- mode-sensitive deduplication;
- snapshot restore and counter sanitization.

Run from `runtime/neuro-kurisu`:

```bash
node --experimental-strip-types tests/p78-autobiographical-provenance.mjs
npm run typecheck
```

These commands are documented as required checks; they have **not** been executed by this GitHub-only editing pass.

## Not yet claimed

- Runtime producers have not yet been migrated to supply the new provenance fields.
- P78 has not yet been proven wired to the canonical MemoryOS2 / CEF evidence lineage.
- No real-model, browser, Android or long-horizon identity test has been run.
- No Release ZIP has been rebuilt or updated.

## Next implementation slice

1. Trace every P78 producer and map its actual evidence origin.
2. Bind episode IDs to canonical CEF causal IDs and verified outcome receipts.
3. Connect SelfModel prediction/calibration and P2702 trait adaptation to the same evidence identity without introducing a second identity owner.
4. Add restart + contradictory-evidence + self-correction integration tests.
5. Run typecheck and targeted tests on the exact branch SHA before opening a promotion PR.
