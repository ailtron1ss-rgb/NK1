# WorkPass42 — tasks and remaining gates (2026-10-14)

## Completed in this pass
- [x] Exact-hash deduplicate 21 app-public Live2D shadows; canonical owner and safe Vite hydration/cleanup are tested.
- [x] Remove two duplicate Lumina/Letta ZIP aliases while preserving the canonical raw-source archives.
- [x] Remove 27 identical same-relative-path Kurisu v9/v56 source copies; add reversible restoration index.
- [x] Remove 27 identical historical report copies, retain canonical bytes, and make every omitted path restorable.
- [x] Move 68 old root reports into `docs/history` without content modifications and record every move in the relocation manifest.
- [x] Repair seven compacted source manifest entries that pointed to evolved active files, extracting immutable preimages from WorkPass34.
- [x] Repair ten 2026-10-06 snapshot references with eight immutable old-version blobs.
- [x] Verify 8,512/8,512 compacted source archive entries and 10,427/10,427 historical snapshot entries.
- [x] Add safe generic duplicate-path materializer and tests for idempotence, conflicts, hash drift and symlink paths.
- [x] Set the WorkPass42 canonical metadata and organize navigation under `docs/PROJECT_FILE_MAP_WORKPASS42.md`.
- [x] Reconcile embedded runtime ReleaseContract from stale 35.62.0 to canonical 35.63.0 and require version/phase equality in its regression test.
- [x] Consolidate five duplicate historical payload blobs into one immutable SHA-256 source while preserving source-archive and snapshot reconstruction (31,893 raw bytes saved).
- [x] Run final whole-tree classification: every missing baseline path maps to a relocation, exact-duplicate restoration manifest, generated Live2D shadow, or superseded blob; no unclassified source path was found.

## Open P0 release blockers
1. **UI release:** install locked app dependencies, complete full app typecheck and Vite production build; then run real browser E2E with Live2D. The build could not be run here because `vite` is absent and npm registry access was unavailable.
2. **External execution:** authoritative real provider/device receipts, reconnect/replay, ambiguous-outcome reconciliation and no-double-credit end to end.
3. **Recovery:** clean-room install/upgrade/fault-injected partial commit and rollback with verified file/state invariants.

## Open P1
4. Run `llama.cpp` on target GPU/CPU, measure latency/RAM/VRAM/cancellation/fallback; the current adapter test uses mocks only.
5. Produce an independent labelled temporal retrieval holdout; current recall uplift is zero and the candidate remains not promoted.
6. Complete critical-function capability evidence, long soak and manual nested upstream-license review.

## Honest status
- Cleanup pass progress: **94/100**.
- Weighted release roadmap: **78.0%** (unchanged because this pass is cleanup/provenance, not proof of new runtime capabilities).
- Do not claim consciousness or release readiness from archive checks.


## Final measured gates
- [x] Release metadata 34/34; release metadata contract 6/6; SBOM/provenance 1/1.
- [x] App scripts 218/218; browser-smoke verdict 51/51; runtime TypeScript, release-contract and integrity audits PASS.
- [x] Source archives 8,512/8,512; snapshot 10,427/10,427; path restoration 56/56 canonical sources; legacy manifest 3,873 with no missing/changed sources or conflicts.
- [ ] Vite production build and interactive Live2D E2E require an environment with locked app dependencies installed.
