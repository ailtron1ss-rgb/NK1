# WorkPass72 handover — retrieval residency correctness and working structure

**Date:** 2026-10-19  
**Branch:** `workpass70-source`  
**Status:** implementation committed; CI validation pending for this pass. Not a production approval.

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

The new workflow run has not yet been observed at commit time. If it fails, use the failing test as the next work item rather than describing the pass as complete.

## Remaining high-priority gates

1. Confirm CI for this commit and repair every introduced regression.
2. Audit duplicated/stale Markdown using content hashes plus links/import/script references; prepare a reversible cleanup manifest before moving or deleting anything.
3. Establish and label a real independent retrieval corpus and evaluate recall@k/MRR, paired uncertainty and temporal leakage.
4. Measure p50/p95 retrieval latency, heap/RSS, allocation and thermal/battery impact on the actual target device; don't infer device behavior from desktop CI.
5. Keep real browser/Live2D E2E, Android TTS clock, production build/release contract, license audit and soak tests open until directly observed.
