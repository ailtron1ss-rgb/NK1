# NK1 Avatar — GLB face, gaze and secondary motion handoff
**Date:** 2026-11-26
**Canonical base:** `workpass70-source@7e601680c765d6dc94e51e4c8f5e729b48a6f56e`
**Work branch:** `aspect/avatar-renderer-truth-20261126`
**PR:** [#1203 — explicit renderer identity and selection roles](https://github.com/ailtron1ss-rgb/NK1/pull/1203)
**Related hosted scene:** NK1 Kurisu Hybrid Avatar — WorkPass80, revision 20

## Implemented in source

- `glbFacialMorphAdapter.ts`: generic GLB morph projection for NK1 emotion, speaking/mouth, gaze, blink/wink, brow state and attention/affect. Known morph targets are emitted on every frame, including zero weights for inactive known channels, so stale expressions are not retained.
- `glbSecondaryMotionAdapter.ts`: deterministic, bounded additive offsets for the authored hair strands, proximal/distal fingers and toes. Hair phase is derived from bone identity and monotonic animation time; hand/toe movement is derived from normalized body channels.
- `Avatar3DStage.tsx`: generic GLB branch now consumes both adapters after semantic animation/motor projection. The VRM branch remains owned by `vrmRuntimeAdapter` and is not double-driven by the generic GLB path.
- Tests cover emotion resets, gaze, blink/wink, mouth opening, invalid dictionaries, deterministic hair sway, individual finger segments and toe flex. A stage-level assertion verifies that both adapters remain connected to the actual generic GLB runtime.

## Hosted 3D scene revision 20

The separate Higgsfield 3D Jutsu scene now contains:
- 52 armature bones, including ten proximal and ten distal finger bones, bilateral toes, and eleven hair strand/side-layer bones.
- Per-digit weights for finger roots/tips, split toe weights on both shoes, and root/tip weight groups on the relevant hair meshes.
- Expanded facial morph targets for surprise, curiosity, smirk-left/right, pout, worry and grin; expanded brows; independent winks; four gaze directions per iris/pupil/glint set.
- A named controller `CTRL_NK1_Avatar` with versioned ID-property schema and normalized controls. The control object is small, non-selectable and placed outside the delivery camera. When an external Blender script changes its custom properties, call `CTRL_NK1_Avatar.update_tag()` before dependency-graph evaluation; the project runner's Python queries do not implicitly refresh every ID-property driver source.
- GLB and Blend snapshots exported by the 3D Jutsu scene revision history. This is a separate hosted artifact; it has not been added to the source repository's canonical bundled asset or release archive.

## Evidence and boundaries

- The seven focused tests in `glb-avatar-expression-secondary-motion.test.mjs` passed during the source script-regression run before the stage syntax correction.
- The stage integration test `avatar-3d-glb-motion-integration.test.mjs` was added to guard that the runtime calls both helpers.
- Exact-head GitHub Actions for the current PR HEAD must be checked again; a syntax error was found in the first integrated stage patch and corrected in a later commit. Do not reuse evidence from the earlier PR HEAD.
- The generic GLB runtime is implemented and unit-tested, but the PR's TypeScript/build/browser verification is still the authority for integration status.
- No Android/Termux device soak, real OS-audio lipsync/interrupt latency, long-duration WebGL memory/thermal/battery test, or end-to-end pixel-presentation proof is claimed here.
- The hosted Kurisu GLB asset remains preview-only under PR #1203. No redistribution/license approval is inferred from model presence.
- No new generated 3D model was requested or billed in this pass. No Release ZIP was rebuilt or published, and `main` was not changed.

## Next acceptance slice

1. Re-run/complete exact-HEAD app typecheck, app script regression, production build and relevant avatar browser/VRM workflows.
2. Inspect the rendered hosted scene and a GLB animation sample at rest, curl, gaze and facial-expression states.
3. Bind the generic GLB controls to the existing renderer-neutral `EmbodimentIntent`/`MotorFrame` projection in the canonical runtime, keeping VRM, Live2D and Original2D capability honesty intact.
4. Keep 2.5D unavailable until the authored cutout/pivot/occlusion art pack and a real renderer are accepted.
5. Keep 3D preview-only until provenance, human asset/license review and redistribution permission are resolved.
