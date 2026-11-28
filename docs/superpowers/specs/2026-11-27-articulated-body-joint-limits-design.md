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


## Follow-up — Body-space capsule self-collision — 2026-11-28

The shared 22-particle articulated-body solver now applies bounded point-versus-capsule contacts after the segment-length, hinge and support-plane projections. This is part of the same renderer-neutral pose solution consumed by the 2D and 3D embodiment paths; it does not introduce a second motor or pose owner.

- Torso proxy: pelvis-to-chest capsule, radius 0.135 body units.
- Upper torso proxy: chest-to-neck capsule, radius 0.09.
- Neck/head proxy: neck-to-head capsule, radius 0.075.
- Distal elbow, wrist, hand, knee, ankle, heel and toe particles have bounded point radii and are projected only when they penetrate a body capsule. Shoulder and hip attachment points are intentionally excluded.
- Contacts are unilateral and run after the structural/hinge/ground projections in each solver iteration so the next distance pass cannot leave the limbs inside the torso. Contact diagnostics report projection count and maximum correction.
- Contact response uses zero normal restitution: positional separation does not create an artificial bounce.

This is a coarse skeletal self-collision guard, not GLB surface-to-surface collision, cloth/body contact, self-collision between garment meshes, or volumetric soft tissue. Those require authored collision geometry or a validated surface/volume mapping and remain separate work.

The regression fixture folds both forearms and hands toward the torso, verifies that their final points stay outside the torso capsule, and requires nonzero collision diagnostics. The same articulated-body workflow also reruns the existing ground, hinge, VRM/GLB integration, TypeScript and development-bundle gates.
