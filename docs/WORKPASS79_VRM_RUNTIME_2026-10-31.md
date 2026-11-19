# WorkPass79 — Official VRM runtime integration

Date: 2026-10-31

## Scope

Replace generic glTF-only loading for VRM avatars with the official MIT-licensed Pixiv runtime while retaining generic GLB support, the existing procedural 3D fallback, and independent Live2D modes.

## Runtime decisions

- @pixiv/three-vrm is pinned to 3.5.5. Upstream package metadata confirms compatibility with the project's Three.js 0.180.0 line and an MIT license.
- VRMLoaderPlugin is registered on the existing GLTFLoader. .vrm imports must produce gltf.userData.vrm; generic .glb files continue through gltf.scene.
- VRM humanoid normalized bones receive head/neck gaze and action-derived arm gestures from the current NeuroCore snapshot. Baseline rotations are captured per loaded model to avoid cumulative drift.
- VRM expression presets map NK1 emotion labels and speech timeline mouth pose into happy/sad/angry/relaxed/surprised, aa/ih/ee/ou/oh and blink channels.
- vrm.update(dt) advances the VRM runtime, including spring-bone behavior.

## Preserved behavior

- Generic GLB import and existing morph-target fallback.
- Local-only IndexedDB model storage and 90 MiB upload limit.
- Procedural 3D fallback and Live2D/legacy/original renderer modes.
- Existing resource cleanup and bounded frame timing.

## Not yet delivered

- No canonical Kurisu VRM/GLB asset is bundled. The user approved a 25-credit Meshy 6 generation, but Higgsfield returned `Out of credits on free (null) plan in Private workspace`; no job was submitted and no credits were charged.
- Real-device visual verification, model-specific calibration, detailed clothing/hair physics tuning, and lip-sync drift measurements remain pending until a real model is available.

## Verification

The PR includes source-contract tests for official plugin registration, VRM parsing, normalized humanoid controls, expression management, spring-bone updates, generic GLB fallback, and exact package-lock pinning. CI results must be checked on the PR head SHA before merge.
