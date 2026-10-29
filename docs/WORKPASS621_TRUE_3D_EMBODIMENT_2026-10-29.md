# WorkPass621 — true 3D body and cognitive/emotional embodiment

Date: 2026-10-29

## Verified baseline

- The app has a real Cubism Live2D model (desktop 4096 texture and mobile 2048 texture) plus 32 manifest-addressed PNG sprite cells.
- The tracked source tree contained no `.vrm`, `.glb`, `.gltf`, `.fbx` or `.obj` model asset.
- `legacy/kurisu-v56/src/components/Avatar3D.tsx` is only a compatibility wrapper returning `Avatar2D`, not a 3D renderer. `NK1 Original` is an SVG concept, not a 2.5D skeletal rig.

## Implemented in this pass

- Add an actual Three.js WebGL stage with a procedural character-inspired 3D body made from lit meshes: head, auburn hair, hair clip, face/eyes, lab coat/lapels, red tie, skirt, tights, boots, arms and a lit platform.
- Add a dedicated selectable `3D` mode while preserving Live2D, legacy sprites, and the separate SVG mode.
- Permit a self-contained binary `.vrm`/`.glb` up to 90 MiB. Parsing and persistent model storage occur locally in the browser; bytes are not posted to an NK1 server. Loaded glTF animation clips, recognizable humanoid bones and named emotion/lip morph targets are used when present.
- Connect snapshot action/emotion, personality traits, energy, cognitive load, uncertainty, social need, novelty/curiosity, goal pressure, prediction error, gaze, awake/thinking and the speech timeline to the 3D body. The renderer does not invent an independent cognitive state.
- Cap device pixel ratio, handle resize, and dispose the renderer, animation loop, model geometries/materials/textures and mixer on replacement/unmount.

## Limitations stated honestly

Three.js GLTFLoader renders VRM/glTF geometry but this adapter is not a full VRM runtime. It cannot guarantee VRM spring-bone physics, MToon semantics, full humanoid retargeting or all third-party expression mappings. A dedicated VRM runtime integration and real-device rendered screenshot/E2E validation remain pending. No unauthorized fan-made model was bundled; finding an image/model preview is not evidence of redistribution rights. The procedural mesh is a newly assembled concept, not a shipped canonical Kurisu asset.

## Verification

`app/scripts/avatar-3d-stage.test.mjs` covers mode selection, local import constraints, state wiring, resource cleanup, package-lock consistency and preservation of the shipped Live2D/sprite assets. CI still must validate typecheck/build and existing runtime/test workflows. The source Release ZIP must not be described as updated unless a new asset is actually published and verified; provenance/license gates are not bypassed.
