# Neuro-Kurisu — current implementation status — WorkPass 36

**Date:** 2026-10-13  
**Base archive line:** `Neuro_Kurisu_WORKPASS35_OPTIMIZED_2026-10-13.zip` plus verified WorkPass35 integration fixes  
**Canonical runtime:** Neuro-Kurisu 35.58.0 / state schema 224  
**WorkPass progress:** 92/100 implementation progress for this pass. This is not the weighted release-readiness score.  
**Weighted release readiness:** 72.9% (unchanged; distinct metric; not release-ready).

## Implemented in WorkPass36

1. Reconciled stale `ReleaseContract` metadata from application 35.41.0/schema 223 to the canonical runtime 35.58.0/schema 224; added a test proving that schema-223 snapshots normalize into schema 224.
2. Refactored repeated FNV/cosine logic into `src/organism/core/NumericPrimitives.ts`; behavior-specific norm floors and non-equivalent distance metrics remain explicit.
3. Centralized identical action costs in `src/organism/core/ActionCostPolicy.ts`, used by core policy learning, active inference and contextual world prediction.
4. Unified stable serialization/SHA-256 code across WILL, Letta, Lumina, Hexis and Conscio adapters while explicitly preserving the legacy fingerprint byte format for existing records.
5. Unified the overlapping Unicode token boundaries used by Lumina and Conscio in `core/UnicodeTokenizer.ts`, retaining their different underscore/hyphen behavior as explicit options.
6. Kept WILL contribution pre-arbitration and verified-outcome-only competence promotion from WorkPass35; P69 remains the sole final decision/veto owner.
7. Made `MemoryOS2` revision history bounded (64 events per memory, capped reasons) and included that metadata in memory footprint estimates; old snapshots are sanitized during restoration.
8. Preserved Legacy memory lineage (original identifiers, source event IDs and associations) through canonical migration/projection without injecting unresolved IDs into the MemoryOS2 link graph.
9. Kept MemoryOS2 as the only writable memory authority; historical memory adapters are import/export projections rather than competing stores.
10. Repaired and verified content-addressed immutable source archives so past ZIPs do not depend on mutable current-code paths.
11. Added deterministic tests for serialization contracts, action-cost parity, memory indexing equivalence, revision-history bounds, legacy lineage round-trips and existing integration surfaces.

## Architecture and source integration

- WILL: agency scoring is upstream of the canonical P69 arbiter; skill promotion requires verified outcome evidence.
- Lumina: capability/confirmation/browser-voice/channel seams remain adapters; optional browser and voice workers are not misrepresented as always available.
- Letta: governance/artifact review is a policy fabric, not a second agent memory runtime.
- Conscio: local knowledge/skill quarantine/claims/confidence/peer idempotency remain under the canonical runtime and evidence gates.
- Hexis: belief and temporal audit/proposals/outbox can project to MemoryOS2; temporal queries do not create a second owner.
- NeuroCore and Kurisu older versions: reusable ideas are adapted into maintained TypeScript implementations; old Python/model assets, Legacy UI and raw archives remain recoverable references, not executable duplicate owners.

The complete disposition map is in `docs/INTEGRATION_MATRIX_WORKPASS36_2026-10-13.md`.

## Verification evidence

Focused WorkPass36 tests and the runtime TypeScript checker pass (see the accompanying report). Archive-manifest verification confirms all 8,512 members across four compact source manifests; the historical snapshot manifest has 10,427 entries; 3,873 legacy de-duplication entries resolve without loss. Previous broader source checks reported architecture `missing=0`, `cycles=0`, `legacyLeakage=0` (1,864 source files / 578 canonical files); hygiene 3,984 files with zero errors/warnings; executable syntax 1,307 JavaScript, 6 shell and 247 JSON files passed; assets audit `errorCount=0`; app script suite 212/212 and release metadata contract 6/6 passed at the preceding checkpoint.

**Function evidence boundary:** the semantic-coverage inventory found 5,876 functions, with 31 currently marked VERIFIED; 5,467 remain UNVERIFIED, with additional functions classified as integration-only or unsafe for automatic execution. A parameterized probe exercised 1,255 candidates (1,188 passed, zero runtime errors; 57 need synthesized inputs, 10 lifecycle scenarios and 43 safe skips). This is evidence about current coverage, not proof that unverified functions are broken.

**Known environment/release limits:** The root app typecheck can fail in an uninstalled/partial dependency environment because `@types/node` and `vite/client` are absent; that is distinct from the successful runtime typecheck. Full Vite production build/browser Live2D E2E, real local-model inference, independent temporal retrieval holdout, real provider action-postcondition-reafference, clean-room rollback and soak remain open. No full-release claim is made.

## WorkPass36 next priorities

1. Connect and measure action execution → independent external postcondition → reafference, persist exactly-once receipts across all integrations.
2. Run independent labelled temporal retrieval holdout against BM25 before any automatic promotion; test real local embeddings/cross-encoder only behind bounded optional providers.
3. Complete dependency-installed app build and browser UI/Live2D E2E.
4. Exercise clean-room archive restore, rollback, restart continuity and long-duration resource soak.
5. Review remaining duplicate capability/API surfaces and make only equivalence-preserving consolidations with tests.
