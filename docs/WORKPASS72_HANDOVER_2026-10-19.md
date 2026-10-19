# WorkPass72 handover — retrieval residency correctness and working structure

**Date:** 2026-10-19  
**Branch:** `workpass70-source`  
**Status:** implementation committed; initial expanded CI found a test-fixture time-mode error (corrective commit pending validation). Not a production approval.

## Behavioral defect found

In `MemoryOS2.retrieve()`, the candidate loop rebuilt each missing 48-dimensional hashed lexical vector and changed the item's residency to `warm`. Later cleanup only cleared non-retained items whose tier was still `cold`. As a result, the cleanup could not undo the warming caused by retrieval. The vector similarity was explicitly excluded from final ranking and was only used to increment the legacy `semanticHits` counter. This spent CPU/RAM and changed residency for a signal that did not affect ranking.

## Implementation in this pass

- Removed query-time vector materialization and hashed-cosine calculation from retrieval.
- Kept `semanticHits` in the persisted state shape for compatibility, but stopped incrementing it from a non-semantic hash projection. Explicit `get()`, encoding/consolidation and residency planning retain ownership of vector materialization.
- Tightened `p2697-mobile-residency.mjs`: after retrieval, materialized-vector count must remain unchanged and hot/warm/cold counts must remain unchanged.
- Expanded the active GitHub Actions regression suite to run candidate coverage, numeric and fuzzy retrieval, bilingual concept recall, query-intent ranking, the two residency regressions, background semantic-index maintenance and embedding privacy.
- Added root `AGENTS.md` with a canonical file map, working procedure, evidence terminology and conservative cleanup policy.

## Why this is not a retrieval-quality claim

This is a resource/residency correctness fix. No recall uplift is claimed. The multi-seed benchmark still uses its existing synthetic fixture; independent, provenance-backed, temporally separated holdout data is still required before claiming real quality gains.

## First CI feedback and test-fixture correction

The first expanded CI failed at `memory-retrieval-numeric-terms.mjs`: records were seeded with 2033 timestamps but the test called `temporalMode: 'current'`. Current mode deliberately uses wall-clock time and ignores `asOfAt`; use explicit `temporalMode: 'at'` for deterministic point-in-time fixtures. This is a test-fixture correction, not a change to the production temporal contract. The fixture now uses explicit point-in-time mode and the expanded CI must be re-run before claiming validation success.

## Repository organization audit

The recursive Git tree on the parent revision contained 9,350 tracked blobs, including 2,888 Markdown files and 370 paths matching roadmap/handover/workpass-report naming. This is enough to justify better navigation, but **not** enough to prove which files are garbage or safe to delete. Older pass documents, `research/`, `legacy/`, licenses, manifests, archives and source provenance remain untouched pending import/reference/manifest audits. `AGENTS.md` is the working entry point; the README and current handover are the status sources.

## Validation

This pass expands `.github/workflows/workpass71-validation.yml` to run:
- runtime TypeScript check and organism smoke;
- speech/continuum/persistence regressions;
- retrieval experiment, candidate coverage, numeric and fuzzy retrieval;
- bilingual concept recall and typed query intent;
- memory residency and background embedding-index behavior;
- embedding request privacy sanitization.

The expanded CI first found a numeric-retrieval fixture seeded with 2033 timestamps but run under `temporalMode: 'current'`. That mode intentionally ignores `asOfAt`; switching this deterministic fixture to explicit `temporalMode: 'at'` made the numeric checks pass. The following run exposed the same mismatch in the fuzzy-retrieval fixture; it is now also corrected to use point-in-time mode. These are test-fixture corrections, not changes to production temporal semantics. Re-run CI before counting WorkPass72 as validation-complete.

## Remaining high-priority gates

1. Confirm CI for this commit and repair every introduced regression.
2. Audit duplicated/stale Markdown using content hashes plus links/import/script references; prepare a reversible cleanup manifest before moving or deleting anything.
3. Establish and label a real independent retrieval corpus and evaluate recall@k/MRR, paired uncertainty and temporal leakage.
4. Measure p50/p95 retrieval latency, heap/RSS, allocation and thermal/battery impact on the actual target device; don't infer device behavior from desktop CI.
5. Keep real browser/Live2D E2E, Android TTS clock, production build/release contract, license audit and soak tests open until directly observed.
