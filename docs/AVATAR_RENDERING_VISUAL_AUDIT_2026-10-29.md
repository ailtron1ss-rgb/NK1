# NK1 — visual embodiment audit and quality pass (2026-10-29)

## What is actually shipped in the source tree

### Live2D Cubism
- The canonical model is `runtime/neuro-kurisu/public/live2d/Kurisu`: a `Kurisu.moc3` binary (~6 MB), 4096×4096 texture (~8.2 MB), physics/CDI metadata, eight expression files and five motion clips.
- Actual registered motion capacity is small: `Idle` ×1, `TapHead` ×1, `TapBody` ×1, `Special` ×2. These are authored clips, not arbitrary whole-body control.
- The mobile profile points to a 2048×2048 downscaled texture (~1.6 MB) while sharing moc/physics/motions/expressions. That is useful, but the full desktop asset remains packaged.
- The app-served viewer is `app/public/live2d/viewer.html` and uses pinned local runtime files; `runtime/neuro-kurisu/public/live2d/viewer.html` is a distinct entry point. Both now use the same final-parameter timing approach.

### Legacy sprites
- The sprite manifest contains 32 named still PNG assets across office, lab, cinematic and full-body/trench sheets. They work well as quick reaction cards or scene changes, but a still image has no independently controllable mouth/limbs.
- The prior selection included a wall-clock two-minute bucket, so a stable emotion/outfit could jump to another pose after a reload. Selection is now deterministic and action-aware.
- The canvas previously drew a red ring on the torso during speech, visually suggesting a body actuator rather than mouth animation. It is removed; status now distinguishes a speaking state from a static sprite.
- The canvas backing resolution is now capped at DPR=2 and uses high-quality smoothing, avoiding unnecessarily blurry sprites on high-density phone screens.

### NK1 Original SVG
- The SVG contains authored paths for head, face, hair, torso, legs, outfit variants and four arm silhouettes. It scales without raster blur.
- Auto pose now maps reflective/curious/verify contexts to a thinking silhouette, exploration and positive/protective replies to an explaining silhouette, and anger/frustration to crossed arms. A manually chosen pose still takes precedence.
- The default iris tone is violet and the large neon diamond at the hair is replaced by a slim red clip; NK1 colour accents remain on clothing and scene.
- This remains a 2D illustration with preset silhouettes—not a depth-aware rig, arbitrary joint system, inverse kinematics, simulated garment or 3D skeleton.

## How the technologies differ

| Format | What is controlled | Best fit | Current NK1 limit |
|---|---|---|---|
| PNG sprites | Select/cross-fade complete frames | High-quality static reactions and poses at low runtime cost | No intermediate movement; no true lip-sync on full-frame stills |
| SVG puppet | Separate vector paths and transform pivots | Sharp preview, outfit/palette changes, basic preset limb poses | Hand-authored deformations; joints and overlap can look artificial |
| Live2D Cubism | Mesh/deformer parameters, expressions, motion curves and physics | Best current balance of anime look, face animation and mobile cost | Rig and available motions limit free whole-body control |
| Layered 2.5D puppet | Depth-ordered layers with pivots, local transforms and parallax | Best next step for selectable hair/accessory/clothing layers | Requires clean layered artwork, occlusion masks and pivot/rig metadata |
| VRM/glTF 3D | Humanoid bones, morph expressions, look-at, spring bones, constraints and IK | Spatial limbs/poses and camera freedom when correctly rigged | No production-ready 3D Kurisu rig/controller is confirmed in this source tree |

## Implementation change: final pose timing
The bundled Pixi Live2D runtime updates authored motion and expressions, then focus/natural movement and physics, and emits `beforeModelUpdate` immediately before updating Cubism model geometry. Writes from an earlier ticker can be overwritten by motion/physics. This pass binds NK1’s final head/gaze/eye/mouth overrides to `beforeModelUpdate`:
- small additive head/gaze offsets complement authored motions rather than replacing them;
- speech mouth/viseme and blink/eye values are applied at the model-update boundary;
- the app viewer validates motion group/index against the clips actually registered in the model;
- both viewer entry points use capped DPR/auto-density and the same intent override concept.

This is source-level integration evidence only. Real visual correctness still needs browser/device screenshots and a sustained phone speech run.

## Engineering readiness estimate

These are engineering estimates, not measured artistic-quality scores or benchmark results.

| Area | Estimated readiness |
|---|---:|
| Live2D model/media/physics inventory | 75/100 |
| Contextual choice among existing motion clips | 50/100 |
| Live2D state/viseme render integration before device E2E | 65/100 |
| Stable sprite pose catalogue/fade/quality | 65/100 |
| Editable SVG concept | 55/100 |
| Swappable garments inside the actual Live2D rig | 10/100 |
| True depth-layered 2.5D rig | 5/100 |
| Full 3D skeleton/IK/cloth | 0–5/100 |

## Remaining work
1. Run browser E2E on desktop and Android: face/eyes/mouth during speech, state transitions, portrait/landscape resizing, reduced motion, and low-memory profile.
2. Author a broader motion/expression library for listen/question/explain/delight/concern instead of reusing two `Special` clips for all cases.
3. For true 2.5D, prepare separated PSD/PNG layers for face, hair, hands, outfits and accessories plus pivot/occlusion metadata.
4. For 3D, provide a legally usable VRM/glTF model with humanoid rig, expression morphs, look-at, spring bones, IK and constraints, then connect it through the shared EmbodimentIntent adapter.
5. Regenerate the Release ZIP only after exact-source regressions, archive integrity/provenance and the human license/redistribution gate pass.

## Release state
This code pass does not overwrite or claim to refresh the Release ZIP. The source-release workflow must pass its exact-SHA checks, provenance and human license/redistribution gate before any new archive can be called published.
