# Avatar 3D visual quality gate — 23 November 2026

## Decision

The procedural Three.js body is a development fixture, not an acceptable canonical Kurisu avatar. It must not be displayed as the user's character when a remote or local model is missing, rejected, or still loading.

The 3D view now follows a fail-closed visual policy:

- A character mesh is visible only after a GLB/VRM has passed the existing binary preflight, fingerprint step, loader parse, and scene checks.
- The procedural body remains in source as an engineering fixture but is hidden on scene creation, load failure, and reset.
- An empty or failed 3D stage shows a recovery panel with retry of the pinned model, local VRM/GLB import, and a return to Live2D.
- If a replacement model fails while a previously loaded model is still active, the old model is retained and the status explicitly says that the new model was rejected.
- Reset disposes VRM scenes through `VRMUtils.deepDispose` rather than treating VRM and generic GLB resources identically.

## Visual evidence reviewed

The repository contains earlier embodiment screenshots under `docs/consolidation/visual-evidence/`:

- `pr-844/kurisu_3d_avatar_reference.png`
- `pr-848/kurisu_3d_avatar_render.png`
- `pr-848/kurisu_3d_avatar_screenshot.png`
- `pr-856/kurisu_3d_avatar_reference.png`

The PR #848 procedural render visibly shows a cropped, oversized head/face, simplified block-like clothing and cylindrical limbs. The reference material is materially more polished. These screenshots are historical demonstration evidence, not a visual acceptance run of the current pinned v5 or v7 GLB.

## Model selection boundary

- Runtime catalog remains pinned to `neuro-kurisu-hybrid-v5` (2,035,768 bytes; SHA-256 `4cc4c34a62f72122b34c1d896d42bf10eddcba6f10f66563e4fc5e213a37e743`).
- v7 NLA remains a non-canonical candidate (1,876,476 bytes; SHA-256 `9eb90244a35db827334c65a2101e5e4640875b9a25f53836876f1ca20972f8a0`). Its static verifier is useful, but does not prove a browser render, visual quality, expression/morph playback, animation retargeting, or Android behavior.
- No v5→v7 promotion is made by this change. The external model binaries could not be retrieved in the present execution environment for a side-by-side real renderer acceptance run; no claim is made that the external model itself was visually approved.
- Legal redistribution status remains separate from technical integrity; do not bundle or redistribute external model bytes until provenance/licensing review permits it.

## Explicitly not promoted

True 2.5D remains unavailable in the mode selector until the real layered Kurisu art pack, hidden-overlap paint, pivot and occlusion manifests, provenance, visual contact sheets, and browser/device acceptance are present. Existing depth-rig contracts and synthetic fixtures are not production art.

## Verification target

Run the existing embodiment-switch workflow on the exact PR head. It executes the 3D stage contract regression, VRM parser/preflight tests, animation/mixer tests, renderer bridge checks, and app typecheck. Browser visual review on the pinned v5 and v7 candidates, plus Android/Termux soak, remains a separate acceptance gate.
