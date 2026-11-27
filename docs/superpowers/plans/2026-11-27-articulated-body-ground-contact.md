# Articulated Body Ground Contact Implementation Plan

> **For agentic workers:** Execute each checkbox in order. Every task ends with a focused verification.

**Goal:** Add stable heel/toe support-plane contact to NK1's existing articulated particle body.

**Architecture:** Extend the renderer-neutral body graph from 18/17 to 22/21 with heel and toe points. Keep the existing fixed-step damped motor and PBD distance constraints; add a unilateral local ground projection with zero restitution and tangential friction. Return explicit contact diagnostics without introducing a second planner.

**Tech Stack:** TypeScript, Node.js 24 test runner, existing PBD solver, GitHub Actions.

**Spec:** docs/superpowers/specs/2026-11-27-articulated-body-ground-contact-design.md

## Global Constraints

- Preserve workpass70-source as the merge target; do not touch main, Release or binary avatar assets.
- Keep locomotion opt-in and the semantic motion arbiter as the only action owner.
- Reject non-finite values and bound frame delta to the existing four-substep budget.
- Do not claim full-body balance or a production asset from a support-plane constraint.

## Review Focus

- A penetrated stance heel/toe must be projected above the plane without exploding segment lengths.
- A foot with a raised target must remain ungrounded during swing.
- A downward impact must not add positive rebound velocity.
- Friction must reduce horizontal slip only while contact is active.
- Invalid floor/radius/friction inputs must fall back to finite, bounded defaults.

---

### Task 1: Foot topology and pose semantics

**Files:**
- Modify: app/src/components/avatar/articulatedBodyParticles.ts
- Test: app/scripts/articulated-body-particles.test.mjs

**Interfaces:**
- Add leftHeelPoint, leftToePoint, rightHeelPoint, rightToePoint to particle identity.
- Add ankle-to-heel and heel-to-toe constraints for each side.
- Keep ankle pitch on the heel-to-toe vector, not the knee-to-ankle vector.

- [x] Write the failing 22-particle/21-segment and foot-articulation tests.
- [x] Run the focused test and record the expected red result.
- [x] Implement the four foot particles and pose mapping.
- [x] Run focused tests and verify segment lengths remain bounded (23/23 body/GLB/VRM suite passed on HEAD 7f69baeb...).

### Task 2: Unilateral contact and friction

**Files:**
- Modify: app/src/components/avatar/articulatedBodyParticles.ts
- Test: app/scripts/articulated-body-particles.test.mjs

**Interfaces:**
- Optional step options: groundEnabled, groundY, footRadius, footFriction, groundContactMargin.
- Result diagnostics: contacts.leftFoot, contacts.rightFoot, contacts.maxCorrection, contacts.maxSlipSpeed.

- [x] Write failing penetration, no-restitution, friction and swing-clearance tests.
- [x] Run the identical focused test command and verify the new cases fail (first RED: 21/23; contact retest RED isolated the take-off penetration edge).
- [x] Implement bounded unilateral foot projection, zero-restitution contact and tangential friction.
- [x] Run the focused suite, then the full body/GLB/VRM integration command (23/23 PASS).

### Task 3: Verification and review evidence

**Files:**
- Modify: .github/workflows/nk1-articulated-body-physics.yml
- Update: PR #1219 description with exact-head evidence.

- [ ] Ensure exact PR paths invoke the body physics workflow.
- [ ] Verify Node 24 focused body tests, TypeScript and development build.
- [ ] Verify integrated target/regression and browser checks on the same exact head.
- [ ] Keep the PR Draft if any required check is red, missing or cancelled.
