# NK1 Aspect 15 — production garment authoring and export pipeline

Date: 2026-10-30  
Scope: real modular clothing assets for the single Kurisu identity across VRM/3D, layered 2.5D and Live2D where the model genuinely supports garment parts.

## 1. Production asset contract

Every garment is a separately versioned asset, not a full-body replacement image. It must declare:

- Stable garment ID and one wardrobe slot.
- Exact renderer, target body fingerprint and rig contract version.
- Source project file, creator, source URL, license identifier, attribution and redistribution status.
- Exported file path, MIME, byte count and SHA-256.
- For skinned 3D: required bone names, bind-pose signature, skin influence limit, material slots and garment-owned helper bones.
- For 2.5D: layer IDs, pivots, depth order, masks, hidden underdraw, deformation regions and occlusion tests.
- For Live2D: exact Cubism model ID, drawable/part IDs and parameter/expression mapping proven by Cubism inspection.

A manifest declaration is not legal proof. An asset is not distributable until the rights review is independently completed.

## 2. Blender source-of-truth workflow for VRM garments

1. Import the exact frozen target VRM into a clean authoring scene. Do not author against a visually similar skeleton.
2. Record the NK1 target body fingerprint and rig contract version in the project metadata.
3. Keep the base body and garment source collections separate. Never rename canonical bones to make an incompatible garment appear compatible.
4. Model clothing at the target avatar scale. Use garment-specific topology; do not use a flat plane or a full-body image as a skinned garment.
5. Bind to the approved Humanoid skeleton. Preserve the approved rest pose and bone transforms.
6. Normalize weights; remove invalid groups; cap influences per vertex according to the runtime policy; verify that every weighted bone exists on the target rig.
7. Check seam, collar, armpit, waist, wrist, knee, ankle and shoe transitions.
8. Create material slots with packed textures. No external texture URLs or filesystem references may remain in the exported GLB.
9. Export one GLB per independently replaceable garment. A multi-item pack may contain several GLBs, but each manifest entry still maps to one slot and one stable garment ID.
10. Re-import the exported GLB into a clean scene and run the preflight tool before runtime testing.

### Required Blender validation poses

- Neutral A-pose and T-pose.
- Arms forward, overhead, crossed and behind torso.
- Elbows bent to full safe range.
- Torso twist and side bend.
- Deep and shallow squat.
- Knee lift and seated pose.
- Wrist rotation and hand-to-face contact.
- Head turn and full supported shoulder range.

For each pose, inspect clipping, holes, weight collapse, material seams and collision with hair/accessories. Capture front, side and rear screenshots at fixed camera and lighting. A pose is accepted only when the garment is visually reviewed on the actual target body.

## 3. Reproducible preflight

From `app/`:

```bash
npm run wardrobe:preflight -- --manifest ../wardrobe-pack/manifest.json --assets ../wardrobe-pack
npm run test:wardrobe:authoring
```

The tool checks manifest structure, safe relative paths, file presence, exact byte lengths, SHA-256, MIME signatures and GLB v2 container structure. It rejects external GLB buffer/image URIs and malformed chunks.

The preflight does not prove that weights are visually correct, that the garment fits every pose, or that redistribution rights are valid. Those remain separate acceptance gates.

## 4. 2.5D production requirements

Each outfit element must have source layers and editable geometry, not only a flattened PNG. The authoring package includes:

- Layer ID, parent ID, pivot, local transform and depth.
- Front/back ordering and explicit occlusion groups.
- Mask ownership and clipping rules.
- Hidden underdraw behind sleeves, hair, collar and torso.
- Deformation mesh and weight regions for shoulder, elbow, waist and hip.
- Texture atlas coordinates and source dimensions.
- Tested neutral, arm-raised, crossed-arm and torso-turn poses.

Do not claim free limb articulation if the art only contains a static front view. Missing hidden pixels must be painted, not stretched from visible edges.

## 5. Live2D production requirements

Inspect the actual Cubism project/model with the authorized Cubism editor/SDK. Record drawable and part IDs, parameter IDs, texture atlas mapping and visibility controls. A garment switch is supported only when a true independent part/drawable or a complete compatible model variant exists.

Expressions, physics parameters, texture atlases and labels are not garment slots. If the existing Kurisu model cannot switch a garment independently, the adapter must report unsupported and keep the current outfit unchanged.

## 6. Runtime acceptance

For every garment and renderer:

- Exact body/rig identity match.
- Full payload and SHA verification.
- One garment per slot; dependencies/exclusions valid.
- Renderer preflight succeeds before visible mutation.
- New garment attaches before old garment resources are disposed.
- Failed application rolls back to the previous appearance.
- Unselected slots remain unchanged.
- Repeated replace/remove does not leak geometry, materials or textures.
- Persist/restore re-verifies bytes and exact body/rig identity.
- Emotion, speech, motor pose and body identity remain unchanged by clothing operations.

## 7. Release gate

A production pack is ready only after source project, export recipe, manifest, hashes, rights evidence, pose-suite captures, automated preflight report, browser visual E2E and Android restore test are attached to the same reviewed asset version. A passing unit test or procedural silhouette is not a substitute.
