# Neuro-Kurisu WorkPass36 — implementation report

**Date:** 2026-10-13  
**Base line:** compact `Neuro_Kurisu_WORKPASS35_OPTIMIZED_2026-10-13.zip` plus verified WorkPass35 fixes  
**Current pass progress:** **92/100**  
**Weighted release readiness:** **72.9% (unchanged)** — this is a different metric.

## What changed in the actual project

### Version/schema contract reconciliation

The audit found that the embedded `ReleaseContract` still advertised application 35.41.0 and state schema 223, while the canonical runtime package and `contracts/integration-manifest.json` specify 35.58.0 / schema 224. Updated the runtime contract and research user-agent to 35.58.0, schema 224, and added `release-contract-alignment-workpass36.mjs`. The test asserts runtime package, integration manifest and embedded contract agree, and that persisted schema-223 data migrates into schema 224. This is a real correctness fix for persisted metadata, not just a documentation update.

## Shared runtime code instead of repeated implementations

- `organism/core/NumericPrimitives.ts` centralizes repeated FNV-1a and cosine computations. Existing norm floors and non-equivalent L1/distance functions were kept distinct where they change meaning.
- `organism/core/ActionCostPolicy.ts` owns the common seven action costs for organism policy, active inference, policy learning and contextual world prediction. The experimental B2511 cost set stays separate because it is not equivalent.
- `organism/core/StableSerialization.ts` provides shared stable serialization and hashing across WILL, Letta, Lumina, Hexis and Conscio. The legacy mode deliberately preserves historic fingerprint bytes, so persisted IDs/idempotency keys are not silently rewritten.
- `organism/core/UnicodeTokenizer.ts` consolidates Lumina and Conscio tokenization with explicit options for underscore and hyphen. NFKC and locale-lowercasing remain shared; source-specific token boundaries remain explicit.

### Memory and decision-flow integration

- WILL's bounded agency score is applied before `P69ConstitutionalArbiter`; P69 remains the one final selector/veto authority. The score delta remains bounded at ±0.04.
- WILL skill competence promotion requires verified outcomes. Unverified `success` values do not train the skill; older snapshots without a verified ledger load with neutral confidence.
- MemoryOS2 remains the single writable memory authority. Revision trails are capped at 64 events per memory and reasons at 240 characters; revision metadata is included in memory-budget accounting and old snapshots are sanitized.
- Legacy memory source/event/association IDs survive as provenance/context for old readers, but unresolved legacy IDs are not injected into the canonical MemoryOS2 link graph.
- MemorySubstrateCoordinator uses token postings and exact-content lookup to discover candidate relations rather than repeatedly comparing all pairs; a differential regression compares it to the previous Jaccard behavior.

### Source archives and recovery correctness

Historical manifests previously depended on mutable active file paths for some original members. Refactoring those files could change what a historical archive restored. The fix stores source preimages as SHA-256-addressed immutable blobs and prioritizes these blobs in restore/verification tools.

- Four compact source manifests: **8,512/8,512 members verified**.
- Historical snapshot manifest: **10,427 entries**, restored/verified without missing content.
- Legacy de-duplication manifest: **3,873 entries resolved**, with current active files allowed to differ only when an immutable matching source blob exists.
- The active UI, avatar sprites, available Live2D assets, source ZIP archives, and archived Legacy data were retained.

## Verification performed

- Runtime TypeScript typecheck: **PASS**.
- Version/schema source-of-truth alignment and schema-223-to-224 migration regression: **PASS**.
- WILL agency pre-arbitration regression suite: **17/17**.
- Shared stable serialization, Unicode tokenizer, action-cost parity, shared numeric primitives, memory indexed-search equivalence, temporal inspector, bounded revision history and legacy-lineage round-trip tests: **PASS**.
- Adapter checks for WILL, Letta, Lumina, Conscio and Hexis: **PASS**.
- App script tests: **212/212 PASS** (from latest broad run).
- Release metadata contract: **6/6 PASS**.
- Architecture audit: **missing=0, cycles=0, legacyLeakage=0**.
- Hygiene: **3,984 files, zero errors/warnings**.
- Syntax sweep at last broad run: **1,307 JavaScript, 6 shell and 247 JSON files passed**.
- Asset audit: **errorCount=0**; organism smoke: **PASS**.
- Whole-project `npm run audit:quick` was rerun after the ReleaseContract alignment and tokenizer adjustment; architecture/hygiene/integrity/syntax and assets all pass.

## Final package shape

The finished WorkPass36 source tree contains 9,369 files across 1,000 directories (the ZIP has 10,369 entries including directories). Final packaging uses UTF-8 path flags; all eight non-ASCII/Cyrillic filenames retain their original spelling, the ZIP integrity test passes, there are zero duplicate paths, and the packaged file list matches the tree 9,369/9,369. The project archive is approximately 134 MiB. Compared with the larger WorkPass34 archive (230,620,644 bytes), this WorkPass36 package is smaller by about 89.8 MB / 38.9%. It is about 3.1% larger than the compact WorkPass35 optimized archive because WorkPass36 includes immutable source preimages, additional runtime fixes, the version/schema regression and updated docs; this increase is not from restoring the removed duplicate trees.

## Known limitations, not hidden by green checks

1. Dependency-installed root app typecheck / full Vite production build remains unresolved: `app/node_modules` is absent, and the attempted `npm run install:all` exceeded the 120-second tool window without creating `app/node_modules`. The current root typecheck reports missing `@types/node` and `vite/client`; runtime typecheck succeeds. Do not treat this as a successful app build.
2. Semantic coverage inventory: **5,876 functions**, of which **31 VERIFIED**, **9 INTEGRATION_ONLY**, **369 UNSAFE_TO_AUTO_RUN**, and **5,467 UNVERIFIED**. A parameterized probe exercised **1,255 candidates**: 1,188 passed, zero runtime errors, 57 require synthesized inputs, 10 require lifecycle scenarios and 43 were safely skipped. UNVERIFIED means proof is lacking, not that a function is known broken. This requires focused behavioral evidence passes.
3. Real local model inference/latency/VRAM, independent labelled temporal retrieval holdout, live provider action → independent postcondition → reafference, production browser UI/Live2D E2E, clean-room restore/rollback and a long soak are still open.
4. The source folders/archives are fully inventoried by manifests and structural tools, but source-presence is not equivalent to every historical module being imported into the live runtime. Old Python/model assets are preserved as Legacy unless a maintained, tested bridge is appropriate.

## Progress and next work

**This implementation pass: 92/100.** The remaining 10 points are primarily full dependency-installed UI/build/E2E evidence and resolving the broad semantic coverage gap by targeting meaningful functions, rather than inflating progress with more generic test scaffolding.

**Release readiness remains 72.9%.** This was deliberately not raised by static refactors and archive cleanup alone.

Next: complete dependency installation and full UI/Live2D browser E2E; raise semantic function evidence from meaningful workflows; run independent labelled retrieval holdout; verify provider postconditions/reafference and restart/idempotency; perform clean-room restore/rollback and soak.
