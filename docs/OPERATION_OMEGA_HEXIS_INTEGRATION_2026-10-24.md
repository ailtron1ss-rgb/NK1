# Operation Omega — Hexis source transfer and NK1 adaptation
Date: 2026-10-24

## Source and reproducibility

Source of the imported reference files: [QuixiAI/Hexis](https://github.com/QuixiAI/Hexis), pinned upstream commit `9e718951dc2a50dfcdc6f22513a1916315840132`. Upstream identifies this code as MIT licensed; the original `LICENSE` file is preserved in the versioned archive. Imported files are stored under `legacy/input-archives/hexis-selected-2026-10-24/`. The previous `hexis-main-2026-10-08/` archive is intentionally left unchanged.

Selected upstream files:
- `core/agent_loop.py` — unified chat/heartbeat loop and action/tool orchestration.
- `core/tools/skills.py` — skill discovery, activation and author-created skill workflow.
- `core/cognitive_memory_api.py` and `core/memory_repo.py` — memory/provenance-facing API and persistence patterns.
- `db/migrations/0017_skill_improvement_proposals.sql`, `db/56_functions_skill_improvement.sql`, `db/56a_functions_learning_reviews.sql` — proposal lifecycle, opt-in recurring experience review and user-review state.
- `README.md` and `LICENSE` — upstream operating overview and license.

Git blob SHAs and file sizes are in the archive's `SOURCE_MANIFEST.md`. The archive is a pinned reference snapshot, not an active Python/PostgreSQL subsystem; its SQL files depend on Hexis-specific schema/functions and must not be run against NK1's database as-is.

## Adaptation actually added to NK1

`runtime/neuro-kurisu/src/organism/learning/HexisSkillReviewInbox.ts` ports the useful review-queue concept into NK1's existing TypeScript learning domain:
- Creates a review packet only from an authentic, accepted `VerifiedSkillPromotionProposal` and the matching shadow candidate.
- Stores content-addressed packets and evidence lineage; packets expose aggregate results and fingerprints rather than raw holdout prompts/outcomes.
- Provides a bounded, revisioned inbox with an in-memory adapter and atomic local-file persistence.
- Records a human decision and binds the review to the exact candidate version, artifact digest, source proposal and shadow-evidence fingerprint.
- Rejects stale review decisions after candidate or shadow evidence changes.

This is intentionally **not activation authority**. An approved item only makes the candidate eligible to request the existing signed promotion approval. The NK1 Ed25519 verifier, signed shadow-run evidence and existing promotion/rollback controls remain mandatory. The reviewer's identity is an audit label supplied by the host; a production UI/service must source it from an authenticated identity provider. The inbox does not claim to authenticate a reviewer or to enable an unattended activation.

## Why not copy the whole Hexis runtime into active NK1

NK1 already has a Node/TypeScript canonical P23 learning engine, evidence ledger, versioned candidate store, independent evaluation, signed shadow receipts and default-deny promotion authority. Copying Hexis's Postgres/Python agent loop as a second runtime would create two owners for cognition and memory, duplicate policy and data stores, and introduce migrations that are not compatible with NK1's schema. Operation Omega therefore preserves current Hexis sources for further porting and adapts its proposal-review workflow to the canonical NK1 runtime instead.

## Boundaries / remaining work

- The review inbox is implemented and has a focused regression test. It is a service seam; wiring an authenticated product UI / operator command into the inbox and making the signed-approval request CLI require the matching approved review remains a separate integration step.
- The imported Hexis SQL routines have not been executed against NK1 and should not be.
- This change does not claim real learning uplift, subjective consciousness, or production readiness. CI/local tests must still run on the exact PR head before merge.
