# WorkPass644 — VRM mixer lifecycle and SpringBone update order

## What changed

The 3D stage now uses one explicit cleanup seam, `stopAndDetachMixer(rt, root)`, before a target rig is removed or disposed.

The helper:
- stops every active mixer action;
- uncaches the previous rig root so the mixer releases its property bindings;
- clears the runtime mixer/action references before resource disposal.

It is used for:
- successful replacement of an active VRM/GLB model;
- explicit reset to the procedural body;
- stage unmount.

This avoids disposing geometry, materials, textures or VRM nodes while an AnimationMixer still retains active actions and bindings to the old hierarchy.

## SpringBone frame order

The runtime continues to run the frame in this order:

1. restore bind-pose transforms;
2. update the active AnimationMixer;
3. apply NK1 motor intent and facial/gaze inputs;
4. call `vrm.update(delta)`;
5. render.

The Pixiv VRM runtime owns the VRM update pipeline; `vrm.update(delta)` is the integration point for its expression, LookAt, node-constraint and SpringBone systems. Calling it after the mixer lets runtime physics observe the final animated pose for that frame. No second custom SpringBone solver is introduced.

## Validation boundary

A source-level regression checks mixer stop/uncache before replacement/reset/unmount disposal and checks mixer-before-VRM update ordering. It does **not** establish that arbitrary VRM 0.x/1.0 assets simulate correctly on real devices.

Still required:
- execute the exact-head GitHub Actions workflow;
- load representative VRM 0.x and VRM 1.0 assets with SpringBone joints, groups and colliders;
- inspect hair/cloth stability during idle, locomotion, rapid turns, clip transitions and model replacement;
- measure Android frame time, thermal behavior and long-session resource stability.

The Release ZIP is unchanged.
