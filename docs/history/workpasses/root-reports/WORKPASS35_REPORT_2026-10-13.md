# Neuro-Kurisu WorkPass35 — implementation report

**Date:** 2026-10-13  
**Input archive:** `Neuro_Kurisu_WORKPASS34_2026-10-13.zip` (230,620,644 bytes)  
**Output archive:** `Neuro_Kurisu_WORKPASS35_2026-10-13.zip`  
**Canonical runtime:** 35.58.0 / schema 224  
**Status:** implementation pass, not release-ready.

## What changed in executable code

WILL competence update is gated by verified outcome evidence (`verifiedUses`). An unverified success is recorded as an observation only; it cannot increase learned success rate or habit confidence. Old snapshots without a verified ledger restore to neutral confidence and zero credited successes.

`OrganismCore` now invokes `WillIntegrationBridge.rankCandidates` before `P69ConstitutionalArbiter.arbitrate()`. This repairs the prior ordering defect: adjusting WILL candidate scores after P69 had chosen a candidate could not influence the decision. The WILL signal is intentionally weak and bounded to ±0.04. Candidate score, predicted utility and confidence are adjusted together. The bridge's `base01` is now the pre-adjustment baseline and `delta01` is the real applied score delta. P69 still has sole final choice and policy-veto authority; this does not create a second agent/brain.

## Archive deduplication and provenance

Removed only proven duplicates: the expanded WILL source tree (606 files, exact copy of the retained `legacy/input-archives/raw-source-archives/will-main.zip`), the expanded Neuro-Kurisu 35.30 snapshot (4,022 files, exact copy of the retained original snapshot ZIP after prefix stripping), and dated Lumina/Letta ZIPs whose full-file SHA-256 matched their canonical `raw-source-archives` copies. `tools/materialize_legacy_archive.py` checks expected archive SHA-256 before extraction and rejects unsafe paths. Both materialized trees were restored and each file payload matched SHA-256 exactly. Original source archives, Kurisu branches, NeuroCore v126 snapshot, Grok Workspace, app/runtime code, Legacy UI, sprites, and Live2D assets remain.

## Size impact

The input compressed archive measured 230,620,644 bytes. The final WorkPass35 archive is approximately 200.4 MB (about 30.3 MB / 13.1% smaller; the adjacent SHA-256 sidecar identifies the exact final bytes). Savings come from removing the two expanded duplicate trees and two duplicate archive aliases; no active UI, runtime or Live2D payload was removed.

## Local results

- WILL integration bridge: **17/17 tests passed**.
- Runtime TypeScript typecheck: **PASS**.
- WILL source restore: **606/606 payloads match**.
- Neuro-Kurisu 35.30 restore: **4,022/4,022 payloads match**.
- UI/API and Live2D paths are preserved in the package; this is not a claim that a full browser/Live2D E2E was run.
- Weighted readiness score remains **72.9%**.

## Remaining substantive work

1. Route WILL competence/outcome observations through canonical verified receipts and idempotency to eliminate replay/double credit and ignore unverified successes.
2. Make WILL retrieval a facade over canonical MemoryFabric/MemoryOS2; do not treat the synthetic deterministic hash-vector as semantic embedding.
3. Consolidate transport/outbox/idempotency ownership.
4. Run live local inference and independent temporal retrieval evaluation; close browser/Live2D E2E, clean-room restore/rollback, soak and release sign-off.

This pass materially fixes one live agency integration defect and reduces exact duplicate storage; it does not claim that all source branches are functionally merged. Unported source branches remain preserved and bounded by provenance until their useful behavior can be integrated under canonical ownership.
