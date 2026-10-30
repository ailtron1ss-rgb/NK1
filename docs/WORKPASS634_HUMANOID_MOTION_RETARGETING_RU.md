# WorkPass 634 — Humanoid Motion Retargeting Primitives

## Result

Added a deterministic, data-only retargeting layer in `app/src/components/avatar/humanoidRetarget.ts`. It builds a source/target semantic role profile, stores source and target rest-local rotations, derives target/source limb-length ratios, transfers local pose deltas relative to each rig's rest pose, and scales/caps root translation by avatar height.

## Safety and contracts

- A role is transferable only when both rigs expose a valid node index and a rest-local quaternion for that role.
- Rotation transfer is `targetRest * inverse(sourceRest) * sourcePose`; source rest pose therefore maps to target rest pose rather than copying raw local rotations.
- Rotation deltas can be capped (default: pi radians); root translation is height-scaled and magnitude-capped.
- Missing target roles are reported, not fabricated. Malformed/zero quaternions normalize to identity and non-finite scalar inputs are bounded.
- The module has no Three.js dependency and does not mutate source inputs.

## Explicit limitations

This is the mathematical transfer core, not yet a production animation-mixer retargeter. It assumes corresponding semantic local bone axes are compatible. It does not yet calibrate differing coordinate bases, solve IK, preserve foot contacts, prevent limb stretch through constraints, or retarget VRMA tracks inside `Avatar3DStage`. Per-role length ratios are exposed for the next constraint/IK integration step, not silently applied to rotations.

## Regression coverage

The focused Node test covers quaternion normalization/inversion, semantic role intersection, missing roles, rest-pose normalization, target-rest-relative rotation transfer, angular caps, height-scaled root displacement, and malformed inputs.

## Next integration step

Calibrate source/target local axes from world rest transforms, then integrate the profile into VRMA playback with a target-specific mixer path. Add two real rigs (different proportions), foot-contact evaluation, and browser E2E before claiming cross-model retargeting support.
