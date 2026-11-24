# WorkPass127 — promotion-proposal authenticity boundary

**Date:** 2026-10-21  
**Scope:** Stage 3 implementation — prevent caller-constructed or copied proposal objects from entering the versioned skill candidate lifecycle.  
**Branch:** `workpass124-learning-evidence-hardening` (draft PR #12, unmerged).  
**Evidence discipline:** implementation and regression assertions are committed; runtime execution, typecheck and exact-head CI remain unverified.

## Finding

`VersionedSkillCandidateStore.stageCandidate()` previously accepted a plain object when public fields looked eligible (`gate.accepted`, `authenticatedEvidenceRows`, `unauthenticatedEvidenceRows`, IDs/fingerprints). Those fields are caller-controlled. A fabricated object could therefore satisfy the store's local admission checks without being issued by `proposeVerifiedSkillPromotion()`.

## Implemented

1. `VerifiedSkillPromotion.ts` now keeps a module-private `WeakSet` of the exact proposal objects it issued and exposes a narrow authenticity predicate.
2. `VersionedSkillCandidateStore.stageCandidate()` requires that issuance predicate in addition to the existing eligibility and evidence-field checks. Reconstructed/spread/copied objects fail closed, even if their public fields are unchanged.
3. The candidate-store regression fixture now obtains successful proposals through signed fixture artifacts, manifest-bound ingestion, and the canonical proposal generator instead of fabricating success objects.
4. Added a direct regression that spreads every public field from a valid proposal into a new object and asserts that staging rejects it. Existing rejected-proposal, unauthenticated-evidence, shadow, explicit-approval, version-CAS and rollback scenarios remain in the same lifecycle test.

## Changed files

- `runtime/neuro-kurisu/src/organism/learning/VerifiedSkillPromotion.ts`
- `runtime/neuro-kurisu/src/organism/learning/VersionedSkillCandidateStore.ts`
- `runtime/neuro-kurisu/tests/p23-versioned-skill-candidate-store.mjs`
- `runtime/neuro-kurisu/package.json` — exposes `test:p23:versioned-skill-store` and `test:p23:skill-store-failure-boundaries` scripts.

Implementation commits:
- [225903c — bind proposal to in-process issuance](https://github.com/ailtron1ss-rgb/NK1/commit/225903c6eff87ebe38b83032abff55d52c7bf7a6)
- [27a267d — reject caller-forged proposal objects](https://github.com/ailtron1ss-rgb/NK1/commit/27a267d541ab8ecfd654424ae3ed368f57c9d0a1)
- [d46ad3e — signed evidence in candidate-store fixtures](https://github.com/ailtron1ss-rgb/NK1/commit/d46ad3ec016eba49513bda925a6d6ca9fcb167d3)
- [399225f — copied-object regression](https://github.com/ailtron1ss-rgb/NK1/commit/399225fa696dbd1bb0dabac9efc69cfc0d0056bc)

## Security boundary and limits

- The `WeakSet` establishes same-process object issuance, not a portable cryptographic signature. It deliberately does not authenticate a serialized proposal after restart; after restart, the system must re-ingest and re-verify signed outcome artifacts and regenerate/revalidate a proposal.
- This closes the identified public-object forgery path into `stageCandidate()`; it does not prove that every runtime activation call site is covered. The broader promotion-path/call-graph audit remains open.
- Shadow observations still use the current store's evidence-fingerprint contract; this pass does not claim those fingerprints independently prove external postconditions.
- No learning uplift or automatic activation is claimed.

## Stage 3 exit status

- [x] Identify the forged-public-object admission weakness.
- [x] Bind in-process proposals to the canonical generator.
- [x] Reject copied/fabricated objects at candidate staging.
- [x] Replace successful test fixtures with signed, manifest-bound evidence ingestion.
- [x] Add a copied-proposal regression assertion.
- [ ] Run `node --experimental-strip-types tests/p23-versioned-skill-candidate-store.mjs` from `runtime/neuro-kurisu`.
- [ ] Run `npm run typecheck` and owning promotion/lifecycle tests.
- [ ] Obtain actionable successful exact-head GitHub Actions logs. The latest commit lookup returned no associated PR workflow runs; the latest available WorkPass105/108/110 runs still report failure without actionable job steps, so this is UNKNOWN/blocked, not PASS.
- [ ] Finish call-graph audit for all activation entry points and shadow-evidence verification.

**Status:** implementation committed; behavioral execution and full promotion-path closure remain unverified.
