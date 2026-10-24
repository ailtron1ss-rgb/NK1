# Operation Omega — Hexis source transfer and NK1 adaptation
Date: 2026-10-24

## Source and reproducibility

Source of the imported reference files: [QuixiAI/Hexis](https://github.com/QuixiAI/Hexis), pinned upstream commit `9e718951dc2a50dfcdc6f22513a1916315840132`. Upstream identifies this code as MIT licensed; the original `LICENSE` file is preserved in the versioned archive. Imported files are stored under `legacy/input-archives/hexis-selected-2026-10-24/`. The previous `hexis-main-2026-10-08/` archive is intentionally left unchanged.

The archive now contains 59 selected Hexis source files in total (including the original license and README): agent API, capability maturity, autonomous life/wake, subconscious reflection, skill tooling, self-repair, trust anchors, memory/provenance and temporal-history migrations, appraisal/emotion families, heartbeat continuity, weekly reviews and deliberate forgetting. The supplemental passes added memory exchange/retrieval, node daemon, integration reliability, canonical digesting, host services, scheduling, journal, self-inspection, goals, policies, backup/restore, state and identity, and additional SQL design references for hybrid recall, defect recovery, skill selection, supersession/contradiction handling, outbound safety, heartbeat economy, deliberation, retention claims, and evidence-candidate recovery. The complete list and upstream Git blob SHAs are recorded in `SOURCE_MANIFEST.md`.

Selected upstream files:
- `core/agent_loop.py` — unified chat/heartbeat loop and action/tool orchestration.
- `core/tools/skills.py` — skill discovery, activation and author-created skill workflow.
- `core/cognitive_memory_api.py` and `core/memory_repo.py` — memory/provenance-facing API and persistence patterns.
- `db/migrations/0017_skill_improvement_proposals.sql`, `db/56_functions_skill_improvement.sql`, `db/56a_functions_learning_reviews.sql` — proposal lifecycle, opt-in recurring experience review and user-review state.
- `README.md` and `LICENSE` — upstream operating overview and license.

Git blob SHAs and file sizes are in the archive's `SOURCE_MANIFEST.md`. The archive is a pinned reference snapshot, not an active Python/PostgreSQL subsystem; its SQL files depend on Hexis-specific schema/functions and must not be run against NK1's database as-is.

## Adaptation actually added to NK1
- Adapted Hexis's provenance-by-default and temporal source-history ideas into the canonical `P65EpistemicLedger`: optional bounded provenance fields (`sourceId`, `sourceKind`, capture time, evidence class, content fingerprint and citation label), evidence-sensitive deterministic IDs, safe restoration of legacy state, and bounded parent-claim source lineage. Existing claims without provenance keep their legacy identity; malformed provenance is dropped on restore and rejected on new writes. The evidence class is descriptive metadata and does not prove cryptographic authenticity; signed evidence remains verified only by the existing trusted-key gates.


`runtime/neuro-kurisu/src/organism/learning/HexisSkillReviewInbox.ts` ports the useful review-queue concept into NK1's existing TypeScript learning domain:
- Creates a review packet only from an authentic, accepted `VerifiedSkillPromotionProposal` and the matching shadow candidate.
- Stores content-addressed packets and evidence lineage; packets expose aggregate results and fingerprints rather than raw holdout prompts/outcomes.
- Provides a bounded, revisioned inbox with an in-memory adapter and atomic local-file persistence.
- Records a human decision and binds the review to the exact candidate version, artifact digest, source proposal and shadow-evidence fingerprint.
- Rejects stale review decisions after candidate or shadow evidence changes.

This is intentionally **not activation authority**. The operator CLI `scripts/create-skill-promotion-approval-request.mjs` now requires the durable review-inbox path and exact review ID, and only returns the unsigned request when the approved review still matches the current candidate, active version, proposal lineage and shadow-evidence fingerprint. The request still requires the existing signed promotion approval. The NK1 Ed25519 verifier, signed shadow-run evidence and existing promotion/rollback controls remain mandatory. The operator can use `scripts/create-skill-review-decision-signing-request.mjs <review-inbox.json> <review-id> <trusted-key-id>` to emit the canonical unsigned payload. It never loads a private key; the independent signer must keep that key outside NK1.

The inbox's local decision label/digest alone is not considered authentication. The promotion-request CLI now requires a separate Ed25519-signed decision artifact, verifies it against `NEURO_SKILL_REVIEW_APPROVAL_KEYS_JSON`, and binds the signature to the exact review packet digest, decision digest, reviewer ID, rationale and timestamp. The private review key must remain in an independent operator/approval service. A production UI/service still needs to authenticate the human before requesting that external signature.

## Why not copy the whole Hexis runtime into active NK1

NK1 already has a Node/TypeScript canonical P23 learning engine, evidence ledger, versioned candidate store, independent evaluation, signed shadow receipts and default-deny promotion authority. Copying Hexis's Postgres/Python agent loop as a second runtime would create two owners for cognition and memory, duplicate policy and data stores, and introduce migrations that are not compatible with NK1's schema. Operation Omega therefore preserves current Hexis sources for further porting and adapts its proposal-review workflow to the canonical NK1 runtime instead.

## Boundaries / remaining work

- The review inbox, separate `.mjs` filesystem adapter and review-bound CLI gate are implemented. A focused Node 24 GitHub Actions test covers signed independent outcomes, signed shadow receipts, review persistence/approval, rejection of an invalid review signature/untrusted key, and creation of the review-bound unsigned request after Ed25519 verification. The operator UI / identity provider and custody of the review private key remain external integration responsibilities.
- The imported Hexis SQL routines have not been executed against NK1 and should not be.
- This change does not claim real learning uplift, subjective consciousness, or production readiness. CI/local tests must still run on the exact PR head before merge.
