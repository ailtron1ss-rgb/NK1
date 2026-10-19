# Neuro-Kurisu SUPER — Pass 2 project review

Date: 2026-10-08

## What was rechecked

The active project tree was reviewed after the WILL integration work with emphasis on canonical ownership, cross-module links, persistence wiring, API exposure, source truth, deterministic/replay boundaries and server hardening.

## Current architecture status

- Canonical runtime remains `Neuro-Kurisu 35.40.0 / schema 223`.
- WILL is owned through `OrganismSystemFabric`; `OrganismCore` remains the organism-level owner rather than instantiating a second subsystem graph.
- `audit:architecture`: cycles=0 and legacy leakage=0.
- `audit:core-ownership`: direct constructors=5, no ownership errors.
- `audit:integrity`: PASS over the active runtime tree.
- `audit:source-truth`: PASS; no stale alternate runtime is promoted.

## Earlier version evidence incorporated

The prior merge audit established 35.40 as the coherent successor to 35.30, with substantially overlapping source paths and a much smaller set of genuinely new 35.40 paths. It also established that the visual v9/v56 branches should remain compatibility/reference surfaces rather than competing brain owners. NOMEGA Pass20 similarly exposes canonical/research/legacy module classes and consolidation candidates; this pass preserves that separation.

## Main defects fixed in this pass

1. WILL state ownership was consolidated into the system fabric.
2. Deterministic HNSW-style benchmark accounting now uses actual distance evaluations.
3. Replay anchoring no longer injects a new wall-clock timestamp for replay events.
4. Duplicate ACKs are idempotent without altering envelope totals.
5. PMA fingerprint checking was simplified and made explicit.
6. Server request abuse controls were extended with rate and timeout boundaries.

## Known remaining release work

The historical project checklist still has UI dependency/build, browser E2E, persistence/research final E2E, long-running stability and final clean-room/release gates. This Pass 2 does not label those as done without the corresponding environment.

## Regression fixes from full-project sweep

A broader audit caught a live self-agency test expecting direct access to the already-canonical `CanonicalSelfAgencyAuthority`, and a concurrent-save lifecycle race in test cleanup. The project now exposes the existing authority through `OrganismCore` without construction duplication, serializes `FileStateStore.save()` per store, and awaits durable runtime shutdown in the affected tests.
