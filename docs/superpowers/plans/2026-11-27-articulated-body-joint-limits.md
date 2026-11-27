# Articulated Joint Flexion Limits — Implementation Plan

**Goal:** Add stable 150-degree flexion caps to the existing NK1 elbow and knee particle hinges.

**Architecture:** Use the existing 22-particle graph. A deterministic hinge projection rotates the child limb and its distal particle chain around the joint; no new semantic action owner or external dependency is introduced.

**Spec:** docs/superpowers/specs/2026-11-27-articulated-body-joint-limits-design.md

## Constraints
- Preserve workpass70-source and the merged ground-contact solver.
- Never modify main, Release or production model binaries.
- Keep the motion planner authoritative; hinge limits only constrain impossible states.
- Preserve segment lengths and four-substep frame budget.
- Fail closed for degenerate or non-finite vectors.

## Tasks

### 1. RED tests
- [x] Add over-flexed elbow and knee state tests.
- [ ] Confirm exact-head body workflow fails specifically on hinge flexion assertions.
- [ ] Record the RED evidence in this plan and PR.

### 2. Hinge projection
- [ ] Add robust 3D vector rotation between unit directions (Rodrigues, deterministic anti-parallel fallback).
- [ ] Add 150-degree elbow and knee projection after the segment constraint pass.
- [ ] Rotate all distal nodes together: wrist/hand and ankle/heel/toe.
- [ ] Report per-joint flexion and maximum correction.

### 3. Verification
- [ ] Focused body tests, TypeScript and development build.
- [ ] GLB/VRM integration plus exact-head regression/browser checks.
- [ ] Keep PR Draft until every mandatory check on the same head is green.
