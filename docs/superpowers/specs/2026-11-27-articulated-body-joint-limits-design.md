# NK1 Articulated Joint Flexion Limits — Design

**Date:** 2026-11-27  
**Status:** implementation candidate for PR #1222  
**Base:** workpass70-source@702bedb5a038cee418f24e245d57837c72760737

## Intent

Prevent the particle-assisted skeleton from folding elbows or knees beyond a plausible hinge range when inertial particle motion and distance constraints interact. Preserve existing semantic motor intent; this is a physical constraint, not a new motion planner.

## Current state

The body has 22 particles and 21 distance constraints. Ground contact constrains heel/toe points and prevents penetration and rebound. There is no elbow/knee angle constraint, so an extreme or corrupted state may preserve segment lengths while placing a hinge into an impossible folded configuration.

## Approaches considered

1. **Clamp semantic channel inputs.** Easy, but does not constrain the simulated particle state after inertia/PBD corrections.
2. **Project hinge angles and rotate the distal sub-chain.** Enforce a maximum flexion at elbow/knee while rotating all downstream particles as a rigid local sub-chain around the hinge. This preserves the two hinge-adjacent lengths and coherent distal geometry.
3. **Full inverse kinematics / biomechanical muscle model.** Better for reachability and force distribution, but a larger separate system and unnecessary for this safety constraint.

**Chosen:** option 2.

## Behaviour contract

- Maximum flexion is 150 degrees for each elbow and knee (internal hinge angle must remain at least 30 degrees).
- Projection operates on actual particle positions after distance constraints; motor targets remain unchanged.
- The elbow correction rotates wrist and hand around the elbow. The knee correction rotates ankle, heel and toe around the knee.
- Rotation is performed around the axis that moves the actual child direction to the allowed direction, using the current bend plane where possible and the target bend plane as the deterministic fallback.
- Degenerate and collinear configurations must resolve to a finite deterministic plane.
- No segment length adjacent to the hinge may change because of the hinge correction.
- Expose bounded correction diagnostics and actual flexion angles in the step result.
- Limits apply symmetrically left/right and do not affect neutral pose or ordinary semantic motions.

## Non-goals

- Shoulder/hip ball-joint range, wrist/finger limits, full-body inverse kinematics, muscle force simulation, dynamic root/COM balance or gait.
- Full rigid-body physics, cloth/soft tissue, production artwork or device-proven locomotion.

## Acceptance

- Deliberately over-folded left/right elbow and knee test states are projected to 150 degrees or less.
- Distal subchains move coherently; lengths remain bounded.
- Collinear, zero-length and non-finite states fail closed to finite outputs.
- Existing 22-particle ground contact and GLB/VRM/app integration remain green.
