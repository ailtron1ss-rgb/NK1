# Neuro-Kurisu SUPER — WorkPass 7: KnownEntityDossier + Memory Retrieval Benchmark

**Date:** 2026-10-09  
**Base archive:** `Neuro_Kurisu_SUPER_WILL_LUMINA_HEXIS_LETTA_CONSCIO_INTEGRATED_WORKPASS6_2026-10-09.zip`  
**Base SHA-256:** `f15f0f00436209a7dd7a82c52bba2223ed3d81065ac615f50437773a3b20e413`  
**Canonical runtime:** Neuro-Kurisu 35.40.0 / schema 223  
**WorkPass:** 7, selective implementation; no replacement of the current tree.
**Measured source diff vs WorkPass 6:** 4 new code/test files + 1 implementation report; 16 existing files modified; no deletions. The packaged change manifest is additional provenance metadata and is excluded from its own hash listing.

## Implementation (code-first)

1. Added `KnownEntityDossier.ts`, a read-only derived projection over the existing WILL integration dossier, canonical B288 social state, and MemoryOS2 records. It merges identity surfaces, retains source-linked evidence and records stale, disputed, quarantined, dormant, and expired items explicitly. It does not own persisted truth or write identity/social state.
2. Added conservative prompt projection: only fresh, non-disputed, non-dormant, non-expired facts with minimum confidence/source-authority enter a bounded entity context. The context is labeled untrusted data (not instructions), uses canonical record IDs as source references, and enters both normal and cognitive-proposal prompts through `ContextBudgetLedger`; it is not appended outside context accounting.
3. Added `MemoryRetrievalBenchmark.ts`: matched lexical baseline versus canonical MemoryOS2 retrieval on isolated snapshot clones. Human-labeled train/holdout splits are explicit; retrieved output is never used to generate ground truth. Metrics include recall@k, MRR, precision@k, coverage and safety/quality rates; retrieval time is measured separately from clone setup time. The harness returns candidate eligibility for separate review only and never auto-promotes or mutates live state.
4. Exposed bounded read-only diagnostics through `GET /api/organism/known-entities` and controlled benchmark execution via `POST /api/organism/memory-benchmark`; added typed client methods and Runtime Atlas access for dossier inspection. Request sizes and text fields are bounded.
5. Added targeted regressions for cross-source entity projection, source/authority and freshness handling, conflict quarantine, no live-state mutation, prompt injection labeling, holdout separation, insufficient-data behavior and benchmark non-promotion. Updated canonical npm scripts, linkage audits, changelog, and task list.

## Verification actually run

- `npm run audit:workpass7` — PASS.
- Known-entity dossier regression — PASS (`entities=1`, evidence links retained, conflicts and stale evidence counted).
- Memory retrieval benchmark regression — PASS on a synthetic 18-record fixture (4 train / 8 holdout). Fixture `recall@k` delta was +0.125 and returned `candidate-eligible-for-separate-review`; this is a harness test, **not a measured production MemoryOS2 uplift**.
- Language context ledger/prompt integration — PASS for normal and proposal prompt paths.
- Runtime TypeScript typecheck — PASS.
- Server relative import audit — PASS; 10 imports, zero missing.
- UI/API linkage — PASS; 124 client routes, 48 Runtime Atlas surfaces, 5 required seams, no missing handler/linkage issue.
- Server smoke — PASS, including real chat flow, known-entity GET and benchmark POST without live memory mutation.
- Quick release audit — PASS: 1,826 source files scanned, 569 canonical files, missing=0, cycles=0, legacyLeakage=0; hygiene 3,942 files / 0 errors / 0 warnings; release contract, integrity and executable syntax passed. Live2D/sprite assets retained and asset checks passed.

## Important limits

- The benchmark used a synthetic test fixture only. No real labeled project dataset, multi-seed comparison, production retrieval uplift, or scientific promotion is claimed.
- Full dependency-complete root/app typecheck and React/Vite build, browser/mobile/Live2D E2E, clean-room restore/rollback and long-duration soak remain open.
- The dossier is a derived projection, not an independent identity authority. Stored notes are untrusted data; current-user corrections must take precedence. Candidate benchmark results never modify memory, policy, identity or release state.
- Overall weighted roadmap estimate: **63.55%** (rounded display 63.6%; +3.55 percentage points from WorkPass 6). This is implementation progress, not release readiness.

## Next high-value code gates

1. Apply the benchmark to a real, explicitly labeled corpus with fixed multi-seed holdout and pre-registered metrics.
2. Add browser-backed multi-session tests for entity identity correction, source expiry, stale/conflict handling and prompt budget accounting.
3. Connect benchmark dataset provenance/reproducibility and audit record verification without creating a parallel evidence store.
4. Continue external transport/replay and release environment gates only after baseline results are fixed.
