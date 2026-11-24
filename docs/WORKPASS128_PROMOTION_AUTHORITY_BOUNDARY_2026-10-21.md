# WorkPass128 — promotion authority boundary hardening (2026-10-21)

## Scope
Close the next promotion-path weakness after WorkPass127: a caller could supply plausible `approvedBy` / timestamp fields and invoke `approveAndPromote`; those fields were audit metadata, not proof of authorization.

## Code changes
- `VersionedSkillCandidateStore` now accepts an explicit `SkillPromotionApprovalVerifier` authority adapter.
- The verifier receives cloned approval and candidate snapshots; thrown errors and all non-`true` results deny promotion.
- The default verifier denies all promotions. Production must wire a verifier to an authenticated human/session or separately trusted approval service; a string such as `approvedBy: "human-reviewer-1"` is not authorization.
- Added a regression asserting default-deny leaves the active-skill set unchanged.
- Updated the learning-engine integration test so caller-constructed proposal fields are rejected and cannot change action bias, resolver visibility, or promotion metrics.
- The candidate-store lifecycle test uses an explicit test-only verifier adapter for its successful promotion/rollback path.

## Validation status
- [x] Code and regression commits pushed to `workpass124-learning-evidence-hardening`.
- [x] Existing package scripts already expose the focused candidate-store and lifecycle tests.
- [ ] Runtime tests and TypeScript typecheck not executed in this environment.
- [ ] GitHub Actions still needs an actionable runner log; prior runs exposed jobs with no steps/logs.
- [ ] Full `OrganismCore.ts` activation call-graph audit remains open because the GitHub contents endpoint returned an empty body for that file. No claim is made that every activation route is covered.

## Security limits
This pass hardens the approval boundary at the versioned candidate store. It does not authenticate shadow observations themselves, does not establish that all runtime activation routes use this store, and does not implement an authentication provider. Those remain explicit follow-up work, not presumed complete.
