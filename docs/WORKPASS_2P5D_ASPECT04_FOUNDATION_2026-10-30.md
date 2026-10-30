# [NK1][Aspect 04][WorkPass 01] Production 2.5D depth-rig foundation

Date: 2026-10-30
Branch: `work/nk1-aspect04-depth-rig-2026-10-30`
Base: `workpass70-source` at `ad564d1879028f00549be41ec5172a2f72e25897`

## Scope

Aspect 04 is the true layered 2.5D body, not the SVG concept and not a static sprite deck. The target is an anime-styled puppet with depth-ordered artwork, independent pivots, local transforms, facial layers, articulated limbs, secondary hair/cloth motion, modular garments and a shared NK1 motor-intent input.

The latest published Release remains the 2026-10-19 WorkPass70 ZIP (136,354,713 bytes, tag `workpass70-hotfix1-2026-10-19`). The current source branch is used for code work, but the Release ZIP is the canonical deliverable baseline and is not claimed to be refreshed by this pass.

## Verified starting point

- `KurisuOriginalStage.tsx` is explicitly a stylized SVG preview, not a layered rig.
- `AVATAR_RENDERING_VISUAL_AUDIT_2026-10-29.md` rates true depth-layered 2.5D at 5/100 and confirms that no depth-aware rig, arbitrary joint system, IK or simulated garment exists in the current SVG.
- The existing sprite catalog contains complete still images; it is not an animation rig.
- `EmbodimentIntent v1` is the shared semantic input and must remain the source of organism intent.
- Three.js is already a dependency in app. The preferred runtime path is authored layered art/rig -> GLB/scene data -> a dedicated depth-rig adapter, while Live2D remains a separate renderer.

## This pass: code actually added

1. `app/src/components/avatar/depthRig.ts`
   - Versioned artist-authored rig contract.
   - Normalized Y-down coordinate system, explicit pivots, parent hierarchy, depth ordering and rest transforms.
   - Structural validator: duplicate IDs, missing parents, root cardinality, finite transforms, pivot bounds and parent cycles.
   - Stable depth ordering.
   - Bounded semantic intent-to-pose mapper for head, neck, torso, hair, garment and basic arm gestures.
   - Pose output is additive over rest transforms; it does not mutate the rig or invent artwork.

2. `app/scripts/depth-rig.test.mjs`
   - Regression coverage for valid hierarchy, deterministic layer order, invalid IDs/parents/pivots, cycles, root count, bounded intent mapping and fail-closed behavior.

## Important limitation

This is a production contract and deterministic pose foundation, **not yet a rendered 2.5D avatar**. No production PSD, layered PNG set, occlusion masks, authored pivots, Blender scene, GLB asset, garment meshes or visual E2E are present/claimed. The pose map is deliberately conservative and must be calibrated against real artist-authored geometry. Do not expose a 2.5D UI mode until the renderer and real art asset exist.

## Production architecture

### Asset pipeline
1. Create a layered master illustration (PSD/Krita) with hidden-area paint behind every moving overlap.
2. Separate face: skin, sclera, iris, pupil, highlights, upper/lower lids, brows, nose, mouth cavity, teeth/tongue and viseme shapes.
3. Separate hair into rear mass, side locks, bangs and face-framing strands; paint concealed head/face areas.
4. Separate torso, coat tails, coat fronts, lapels, sleeves, cuffs, shirt, tie and lower body.
5. Separate upper/lower arms, hands and fingers; author hand silhouettes for point, explain, think, shrug, hold and rest.
6. Define pivots in normalized artwork coordinates, parent-child relationships, z/depth order and explicit occlusion/mask groups.
7. Create alternate garment groups against the same body skeleton; garment switching must not replace the body or invalidate joint pivots.
8. Export source art and a runtime manifest with dimensions, SHA-256, license/provenance and capability declarations.

### Rig and motion
- Hierarchy: root -> pelvis/torso/chest -> neck/head; clavicle -> upper arm -> forearm -> hand/fingers; hip -> thigh -> lower leg -> foot.
- Use 2.5D depth offsets and small perspective/parallax shifts while preserving an orthographic anime appearance.
- Implement two-bone IK for arms/legs only after authored pivots and segment lengths are available.
- Keep face controls independent from head transform; gaze and head direction remain separate.
- Secondary dynamics for hair and coat tails must be damped, bounded and deterministic under a fixed timestep.
- Motion intent selects goals/constraints, not a hard-coded full-body clip for each emotion. Gestures are blended over the idle pose and can be interrupted safely.
- A renderer capability manifest must explicitly report unsupported actions; never claim an action completed if the selected rig cannot express it.

### Required deliverables
- `art/kurisu/2p5d/Kurisu_Rig_Master.psd`
- `art/kurisu/2p5d/Kurisu_2p5d.blend`
- `runtime/neuro-kurisu/public/2p5d/kurisu.glb`
- `runtime/neuro-kurisu/public/2p5d/body-profile.v1.json`
- versioned asset manifest + provenance/license record
- depth-rig renderer adapter, IK, secondary dynamics, garment slots and browser/Android E2E

## Work plan and gates

| Work package | Output | Acceptance gate |
|---|---|---|
| A. Rig contract | Versioned schema, validator, tests | Invalid graph/pivot/transform rejected |
| B. Layered artwork | Master PSD + hidden-area paint | No holes at target joint rotations |
| C. Depth puppet | Parent hierarchy, pivots, masks, z-order | Independent head/torso/limb motion |
| D. Face rig | Eye/brow/mouth layers and visemes | Look direction independent of head; speech mouth test |
| E. Limb IK | Arm/leg chains and target constraints | Reach targets without segment stretching |
| F. Secondary physics | Hair, tie, coat tails | Stable, damped, deterministic, reduced-motion aware |
| G. Modular wardrobe | Lab/casual/rest garments | Swap while preserving body identity and rig |
| H. Intent adapter | Shared EmbodimentIntent mapping | Same intent yields semantically equivalent 2D/2.5D/3D response |
| I. Runtime quality | GLB export, memory cleanup, mobile profile | Desktop + Android browser visual E2E and soak |
| J. Release | Updated Release ZIP and checksums | Exact source SHA, build/test, provenance and license gates |

## Strict acceptance metrics

- Rig graph validation: 100% invalid fixture rejection; no missing parent/cycle.
- Transform safety: all input channels finite and clamped; malformed payload fails closed.
- Visual coverage: front, 3/4 left/right, profile, raised arms, crossed arms, seated pose and garment swaps.
- No visible layer holes at the authored acceptance extremes.
- No IK segment length drift beyond 1% in deterministic fixtures.
- Secondary motion settles without unbounded oscillation.
- Renderer reports capabilities honestly; unsupported motion never silently becomes a success.
- Desktop and Android visual E2E must be recorded before marking production-ready.

## Verification commands

From `app/`:
```bash
node --experimental-strip-types --test scripts/depth-rig.test.mjs
npm run typecheck
npm run build
```

This pass only adds a pure TypeScript contract and Node tests; the commands above have not been executed in a GitHub checkout during this connector pass. CI evidence must be attached to the exact resulting commit before calling the code validated.


## Follow-up: canonical intent adapter

- Added `app/src/components/avatar/embodimentIntentAdapter.ts` as a narrow adapter from the existing `EmbodimentIntent v1` body envelope to the depth-rig pose contract.
- The adapter preserves the existing semantic owner: it translates bounded gaze/head tilt and existing motion-group intent; it does not introduce a second emotion engine or replace the runtime motor controller.
- `TapHead`, `TapBody`, and `Special` map conservatively to rig-level gesture hints. Fine-grained joint trajectories and joint-to-artwork calibration remain a separate explicit binding step.
- Added malformed-envelope and intent-to-pose regression coverage. The dedicated workflow now includes the adapter in its path filters.

## CI correction

The first exact-head run failed in two assertions, not in the transform implementation: expected world rotations omitted inherited parent rotations, and accumulated floating-point depth was compared with strict equality. Both assertions were corrected to match the documented hierarchy semantics and use a numeric tolerance. The corrected workflow run [41017134702](https://github.com/ailtron1ss-rgb/NK1/actions/runs/41017134702) passed all 13 focused tests on code/test commit `0ad1552931e244af39cb0cd01b09cd9ed26afdad`. The current PR head is a later CHANGELOG-only commit (`ca0002b261046374e6a3c7ef340ec39f58616b9a`), so the tested source and test inputs are identical; full app typecheck/build and visual E2E remain unverified.


## Motor-controller binding adapter

- Added `resolveDepthRigPoseFromMotorFrame(...)` with explicit `DepthRigJointBinding` records. Motor joint IDs are never guessed from node names; each binding specifies node ID, joint ID, rest angle and optional scale/safety envelope.
- Active motor goals can drive bound rig rotations through bounded radians-to-degrees conversion. Idle/rejected/expired frames produce no pose deltas; unavailable joints are ignored; duplicate or unsafe bindings fail closed.
- This is the intended narrow seam for PR #410's renderer-neutral `MotorFrame` output. It is not yet wired into a live 2.5D renderer, and the actual skeleton-to-art binding profile still needs authoring.
