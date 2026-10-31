# WorkPass629 — Aspect 12: production 3D Kurisu body and humanoid rig audit

Date: 2026-10-31  
Base: `workpass70-source` at `18d8f10aced4c554a206b2215b3b079f7cade6a7`  
Work branch: `work/nk1-aspect12-humanoid-rig-audit-2026-10-31`

## Executive decision

Aspect 12 is not complete. The current source has a real Three.js stage and local VRM/GLB import, but the fallback character is procedural geometry, not the final authored Kurisu asset. The GLTFLoader path is not a complete VRM runtime. The existing arm mapper computes/applies calibrated planar arm poses as a standalone utility, while the stage explicitly does not yet actuate IK on imported bones.

This pass therefore adds a conservative full-body humanoid rig audit and makes the 3D stage report capabilities and gaps honestly. It does not claim a finished model, complete VRM support, finger actuation, locomotion, or real-device validation.

## Verified source baseline

- `app/src/components/Avatar3DStage.tsx`: Three.js scene, procedural character-inspired fallback, local bounded VRM/GLB import, local IndexedDB persistence, animation mixer, emotion/action/gaze/speech-driven procedural motion, resource cleanup.
- `app/src/components/avatar/vrmHumanoidRigAdapter.ts`: left/right upper-arm and elbow name resolution, immutable bind-pose capture, calibrated angle mapping, bounded blend and restore. It uses a planar two-link IK result and is not a whole-body solver.
- `app/src/components/avatar/planarArmIK.ts`: renderer-independent planar 2-link solver; explicitly calculates angles and does not execute motion.
- `app/src/components/avatar/vrmRigCalibrationProfile.ts` and `vrmRigCalibrationSession.ts`: model fingerprint and coordinate-frame-bound arm calibration with measurement provenance.
- `app/scripts/avatar-3d-stage.test.mjs`: confirms 3D stage and imported model path, but explicitly asserts that IK is not yet applied to imported bones.
- `app/package.json`: Three.js 0.180.0 is pinned. No dedicated full VRM runtime dependency is currently present.
- No canonical authored Kurisu `.vrm/.glb/.gltf/.fbx/.obj` asset was present in the tracked source tree at WorkPass621 inspection. A user-supplied or externally discovered model must not be redistributed without verified rights.

## Changes in this pass

### 1. Full-body capability audit

Added `app/src/components/avatar/vrmHumanoidRigAudit.ts`.

It:
- Recognizes conservative names for torso, neck/head, bilateral shoulders/arms/hands, legs/feet/toes, eyes and 30 finger segments.
- Refuses ambiguous matches instead of silently choosing one.
- Reports missing required bones.
- Checks expected ancestor relationships (while permitting helper nodes between semantic bones).
- Distinguishes a torso, head, arms, hands, legs, feet, eyes, finger articulation, locomotion skeleton and baseline full-body mapping.
- Marks the result as `conservative-name-heuristic`; it does not misrepresent name matching as authoritative VRM metadata.
- Warns when ordinary scene nodes are not explicitly marked as bones.

### 2. 3D stage capability visibility

Updated `Avatar3DStage.tsx` to run the audit after model import and expose a concise capability report in the existing model status message. The stage now distinguishes a complete name-mapped full-body hierarchy from partial arm discovery and reports finger/leg/foot gaps.

This is an audit and reporting improvement only. It intentionally does not apply uncalibrated transforms to imported skeletons.

### 3. Regression coverage

Added `app/scripts/vrm-humanoid-rig-audit.test.mjs` and registered `test:vrm-humanoid-rig-audit`.

Cases cover:
- Complete base humanoid mapping.
- Missing and ambiguous required bones.
- Broken parent hierarchy.
- Optional eye mapping and all 30 finger segments.
- Refusal to infer a deforming skeleton from ordinary nodes.

## Current implementation boundary

| Capability | State | Evidence / limitation |
|---|---|---|
| Three.js 3D renderer | Implemented in base | Real WebGL scene in Avatar3DStage |
| Local VRM/GLB import | Implemented in base | Bounded 90 MiB local import/store |
| Procedural character fallback | Implemented in base | Not a production-quality Kurisu model |
| Full-body rig audit | Added in this pass | Conservative name/hierarchy heuristic |
| Arm name mapping | Existing | Ambiguous/missing chains fail closed |
| Arm calibration | Existing | Model fingerprint + measured fixture provenance |
| Planar arm IK calculation | Existing | Two-link planar solver only |
| Imported-bone actuation | Not complete | Existing stage test states it is not applied |
| Full 3D IK / FK | Not complete | No complete spatial solver/executor proven |
| Finger actuation | Audit only | 30 segments can be discovered; no gesture executor |
| Facial blendshape runtime | Partial | Imported morph targets are not fully standardized |
| VRM expressions / MToon | Not guaranteed | GLTFLoader path is not a complete VRM runtime |
| Spring bones / cloth | Not complete | Requires dedicated VRM/runtime integration and calibration |
| Full locomotion / balance | Not complete | No verified full-body dynamics/controller |
| Production Kurisu asset | Not present in source baseline | Requires authored or licensed model |
| Browser/device E2E | Pending | Unit tests are not rendered device evidence |

## Production target architecture

The final 3D body must be an adapter behind the existing shared embodiment coordinator, not an independent cognitive or motor controller.

```
OrganismState / affect / goals / speech / world observations
                         |
                  EmbodimentIntent
                         |
             shared MotorGoalArbiter
                         |
           shared spatial MotorController
                         |
               canonical MotorFrame
                         |
             VRM/3D Body Adapter
                         |
       humanoid bones + face + gaze + physics
                         |
       renderer receipt + observed pose/error
                         |
             verified outcome feedback
```

The 3D adapter owns only model-specific mapping, coordinate conversion, calibration, renderer lifecycle and capability negotiation. It must not create a second source of emotion, intent, personality or motor goals.

## Work plan to 100%

### 12.1 — Asset and provenance pipeline
- Produce a real authored Kurisu model or obtain an asset with explicit redistribution/modification rights.
- Preserve editable source (Blender project or equivalent), textures, materials, licenses and attribution.
- Establish neutral A-pose/T-pose, scale, forward axis, root origin and unit conventions.
- Validate mesh topology, normals, UVs, material slots, texture dimensions and polygon budgets.
- Produce LODs and mobile-safe texture variants.
- Store asset hashes and provenance; never bundle an unlicensed fan model.

Acceptance: canonical model, editable source, complete provenance and reproducible export.

### 12.2 — Authoritative VRM runtime

**Research decision (2026-10-31):** `@pixiv/three-vrm` is the leading integration candidate, not a speculative custom VRM parser. Its upstream v3.4.4 release explicitly bumped Three.js to r180, matching NK1's pinned Three.js 0.180.0; upstream currently lists stable v3.5.5 and a newer 3.6.0 beta. Prefer the stable release for the first integration spike; do not adopt the beta for production without a separate compatibility review. References: [three-vrm releases](https://github.com/pixiv/three-vrm/releases), [upstream loader-plugin usage](https://github.com/pixiv/three-vrm), [API docs](https://pixiv.github.io/three-vrm/docs/modules/three-vrm.html).

- Evaluate and integrate the stable `@pixiv/three-vrm@3.5.5` runtime against the current Three.js version and license.
- Register `VRMLoaderPlugin` on the existing `GLTFLoader`; read the parsed `gltf.userData.vrm` object and retain a generic GLB fallback.
- Use `vrm.humanoid` semantic bone nodes when present; keep the new name-based audit only as fallback for generic GLB.
- Verify VRM version support, expressions, MToon, spring bones, look-at and animation retargeting.
- Pin dependencies and update lockfile; test bundle size and mobile memory.
- Fail closed when required extension semantics are missing.

Acceptance: real VRM fixture renders with validated humanoid, expression and spring-bone support; generic GLB remains a separately labeled compatibility mode.

- Evaluate and integrate a maintained VRM runtime (e.g. `@pixiv/three-vrm`) against current Three.js version and license.
- Use VRM humanoid semantic mapping when available; keep the new name-based audit only as fallback.
- Verify VRM version support, expressions, MToon, spring bones, look-at and animation retargeting.
- Pin dependencies and update lockfile; test bundle size and mobile memory.
- Fail closed when required extension semantics are missing.

Acceptance: real VRM fixture renders with validated humanoid, expression and spring-bone support; generic GLB remains a separately labeled compatibility mode.

### 12.3 — Full skeleton and calibration
- Validate hips/spine/chest/upperChest/neck/head, shoulders, upper/lower arms, hands, upper/lower legs, feet and toes.
- Add per-model bind-pose snapshot and coordinate-frame identity.
- Capture measured calibration with immutable provenance.
- Add joint limits, preferred axes, rest pose and confidence.
- Detect mirrored, rotated, scaled and non-standard rigs.
- Separate semantic humanoid mapping from raw bone-name heuristics.

Acceptance: model-bound rig profile passes calibration and rejects model/frame/bone mismatches.

### 12.4 — Spatial motor execution
- Preserve the shared MotorGoal/MotorFrame contracts.
- Implement spatial FK and a bounded 3D IK solver (multi-chain DLS or a tested CCD/FABRIK implementation).
- Support target position and orientation for hands/feet/head.
- Add joint limits, velocity/acceleration/jerk bounds, collision checks and unreachable-target reporting.
- Add trajectory interpolation and interruption/retarget behavior.
- Apply targets after animation mixer updates with a deterministic ownership/priority policy.
- Never accumulate offsets from the previous frame; derive from bind pose or explicit controller state.
- Emit measured post-application transforms and an execution receipt.

Acceptance: deterministic arm/head/leg reach scenarios, finite transforms, no drift, no joint-limit violations and visible browser E2E proof.

### 12.5 — Hands and dexterity
- Map all 30 finger segments when available.
- Add hand pose library as reusable motor targets (open, relaxed, point, pinch, grasp, release), not canned whole-body animation.
- Derive gesture selection from intent and object affordances.
- Add contact/constraint checks and safe fallback when finger rig is absent.

Acceptance: each finger target is independently addressable on a compatible rig; capability fallback is explicit.

### 12.6 — Face, gaze and expression
- Use VRM expression semantics when present; otherwise map explicit morph-target aliases with confidence.
- Build a channel model for brows, eyelids, eyes, cheeks, jaw, mouth shapes and visemes.
- Blend affect, speech and intentional facial actions without one channel overwriting another.
- Add gaze target, saccade, blink and eye/head coordination.
- Add expression capability report; never infer unsupported morphs.

Acceptance: emotion, speech and gaze are synchronized and smoothly blended on a real imported model.

### 12.7 — Hair, cloth and accessories
- Integrate spring-bone physics with bounded timestep and deterministic reset.
- Add garment meshes/slots and compatible body variants.
- Add cloth or secondary-motion simulation only where mobile budgets permit.
- Define collision proxies and penetration checks.
- Provide reduced-cost fallback on Android.

Acceptance: no persistent clipping/unstable oscillation in the supported motion suite; measured mobile frame-time and memory budget.

### 12.8 — Locomotion and object interaction
- Add root-motion policy, foot planting, step planning and balance constraints.
- Add reach/grasp/release/point/press goals with object coordinate frames.
- Distinguish simulated contact from real-world sensor-confirmed contact.
- Observe resulting pose/object state and report failure instead of claiming success.

Acceptance: repeatable scene tests for stand, sit, walk, turn, reach, grasp and release, with postcondition evidence.

### 12.9 — Cross-body continuity
- Negotiate BodyCapabilities before switching from Live2D/2.5D to 3D.
- Transfer expression, gaze, intent, motor goal, outfit identity, speech session and a compatible pose approximation.
- Map unavailable capabilities explicitly (e.g. finger articulation unavailable in Live2D).
- Commit switch only after target renderer is ready; rollback to previous body on failure.
- Do not reset organism state when renderer changes.

Acceptance: repeated 2D→3D→2.5D→3D round trips preserve identity, intent and speech; failures rollback cleanly.

### 12.10 — Performance, safety and release
- Test desktop and real Android devices.
- Measure FPS, frame time, memory, GPU texture budget, load time, context loss and recovery.
- Dispose geometries, materials, textures, animation mixers, event handlers and render loops on model replacement/unmount.
- Run production build, typecheck, unit/integration/E2E, soak and license review.
- Publish only after all required gates pass; update the canonical Release ZIP from the exact verified source SHA.

Acceptance: clean install, repeatable startup, stable soak, documented target-device matrix, provenance-complete asset and verified Release artifact.

## Acceptance thresholds (initial targets; calibrate on hardware)

- Desktop: stable 60 FPS target; Android: stable 30 FPS minimum for the supported low-cost profile.
- 3D stage frame budget: ≤16.7 ms desktop target; ≤33.3 ms mobile target.
- No non-finite bone transforms or unbounded joint values.
- No bind-pose drift after 10,000 repeated target updates.
- Model switch: rollback on load/renderer failure; no loss of organism intent or active speech session.
- All capabilities are reported from the loaded model, never inferred from the selected mode label.
- Imported model bytes remain local unless a separately authorized upload workflow is explicitly added.

## Progress accounting

The previous broad estimate of 25% for Aspect 12 mixed a procedural renderer, import support and future production art. For strict accounting, this pass separates the layers:

- Renderer/import foundation: existing, substantial.
- Rig audit/calibration foundation: existing plus this pass.
- Real authored Kurisu model: absent in verified source baseline.
- Full spatial motor actuation: incomplete.
- Full VRM runtime/expressions/spring bones: incomplete.
- Production E2E/device validation: pending.

This pass is a meaningful engineering increment, but it does not justify claiming the whole aspect is complete. Recalculate the percentage only after checking exact-head CI and the remaining runtime/art gates.
