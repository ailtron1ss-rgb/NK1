# WorkPass 30 — source provenance unified inside canonical MemoryOS2

**Date:** 13 October 2026  
**Base:** `Neuro_Kurisu_SUPER_WILL_LUMINA_HEXIS_LETTA_CONSCIO_INTEGRATED_WORKPASS29_2026-10-13.zip`  
**Root version:** `30.0.0-super-final16`  
**Canonical runtime:** `Neuro-Kurisu 35.53.0`  
**Schema:** 224  
**Status:** implementation pass; not release-ready.

## Main code integration

WorkPass30 connects the source-branch provenance mechanisms to the canonical memory object, rather than leaving them as research-session-only context or adding another memory owner. `MemoryOS2` now stores a bounded evidence trail per canonical memory: at most eight visible independent lineages, with a 32-key replay guard for lineages that were trimmed from the visible trail. Evidence participates in snapshot/restore normalization and the actual byte estimate.

`OrganismCore.integrateExternalResearchMemory` passes the `sourceLineageKey` computed through the external research/EvidenceFirewall lineage flow into the canonical evidence record. Publisher/host remains visible as provenance, but copies of one source story use the same independence identity. Existing canonical content absorbs a new independent lineage; same-lineage replay and mirrors do not increase the corroboration count or confidence. External research is still a capped hypothesis and is not automatically promoted to fact.

The read-only APIs (`inspectRecent`, `evidenceTrail`, `statsLight`) expose independent-lineage counts and the bounded trail through the existing Runtime Atlas memory inspector. Hexis remains an adapter/projection; MemoryOS2 stays the sole writable owner.

## Concrete changes

- Added `MemoryEvidenceSource` provenance entries with publisher/source label, provenance class, authority, independence key, observation time and evidence-freshness time.
- Added canonical evidence normalization and duplicate-lineage merging. A mirror with a new hostname but the same lineage is still one vote.
- Added replay guard keys to prevent an old lineage from being re-counted after it falls outside the visible eight-entry trail.
- Made external-source corroboration updates depend on a genuinely new retained independent lineage, rather than repeated `encode()` calls.
- Included evidence fields in memory-size accounting, restore normalization, diagnostic statistics and Runtime Atlas inspector projections.
- Connected the mechanism to the real OrganismCore research ingestion path and added regression coverage for original/mirror/independent families, snapshot/restore, byte-budget stability, bounded trail, replay and inspector visibility.
- Bumped root release metadata to `30.0.0-super-final16`, runtime to `35.53.0`, kept global schema 224, and updated the ownership/integration manifests, canonical backlog and task inventory.

## Verified results

- Runtime typecheck: **PASS**.
- WorkPass30 Core → MemoryOS2 provenance integration regression: **PASS**.
- WorkPass29 temporal/revision/source integration regression: **PASS**.
- Temporal Inspector closure, candidate coverage, numeric retrieval, R15 and R16 memory regressions: **PASS**.
- Retrieval benchmark and multi-seed experiment: **PASS; promotion stays `not-promoted`**. The corrected synthetic fixture remains at Recall@5 parity with BM25 (delta 0.00); this is not evidence of general superiority.
- Release metadata validator: **34/34 PASS**.
- Release metadata contract: **6/6 PASS**.
- App script suite: **PASS**.
- Browser-smoke verdict suite: **51/51 PASS**.
- Atomic report writer: **4/4 PASS**.
- Server import audit, static UI/API route linkage and assets/Live2D audit: **PASS**. These do not replace an actual browser E2E run.

## What remains open

This pass improves provenance integrity, not measured retrieval quality. The independent labelled temporal holdout against BM25 has not been run; real pretrained NLI inference and live-provider evidence have not been demonstrated; dependency-complete React/Vite build and real browser/Live2D E2E are not confirmed; clean-room restore/rollback, multi-hour soak, SBOM/license sign-off and final RC sign-off remain open. The root aggregate audit is only claimed if its complete command exits successfully; all component gates listed above were executed separately.

## Progress inventory

- Normalized deliverables: **80** (59 DONE, 11 PARTIAL, 10 TODO).
- Weighted roadmap scorecard: **72.90%** (+0.15 percentage points from the previous official 72.75%). This tracks implementation-plan completion, not release readiness or intelligence quality.
