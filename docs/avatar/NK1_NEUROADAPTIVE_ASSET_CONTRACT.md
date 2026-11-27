# NK1 Neuroadaptive Secondary Dynamics — asset contract

## Purpose

This contract extends the existing identity-locked Kurisu embodiment with bounded, deterministic secondary dynamics. It does not replace the canonical character asset, regenerate the face, change the eye geometry or color, alter hairline or body proportions, or create a competing motor/brain owner.

The runtime reads one canonical NK1 avatar frame and derives secondary motion from its existing affect, action, energy and measured body channels. Cognition does not run a neural model inside the WebGL frame loop: the organism supplies the signals; a small critically damped spring solver turns them into physical lag.

## What the runtime can drive

- Hair clumps and loose locks, with pinned roots and more responsive tips.
- Coat, skirt, mantle, cape, tie, ribbon, hem and other authored garment chains.
- Sleeve/cuff follow-through on explicitly authored bone chains.
- A separate, bounded GPU vertex-shader sway pass for a strict allowlist of existing skinned hair locks, skirt, tie blade and lower coat geometry. It is not enabled for face, crown, fringe, eyes, lapels or sleeves.
- Explicitly authored secondary morphs for cloth, hair, soft-tissue breath and a neural-fabric pulse.
- Emissive garment materials explicitly tagged for the NK1 neural layer.

The solver never infers that a bone is cloth from its mere position. A chain must use a supported semantic name. Unknown bones remain untouched.

## Bone naming and hierarchy

Use stable, explicit names. Keep the root or attachment fixed; author one or more mid-chain bones and a distal tip.

| Layer | Recommended names | Notes |
|---|---|---|
| Hair | HairLockL_Root, HairLockL_Mid, HairLockL_Tip | Roots stay pinned; tips receive the most lag |
| Fringe | HairFringeR_Root, HairFringeR_Tip | Preserve the authored fringe/face silhouette |
| Coat | CoatPanelL_Root, CoatPanelL_Mid, CoatPanelL_Hem | Follow torso yaw/pitch and locomotion |
| Skirt | SkirtBackPanel_Root, SkirtBackPanel_Tip | Keep deformation inside the garment silhouette |
| Mantle/ribbon | MantleTailL_Root, MantleTailL_Tip, RibbonR_Tip | Distal movement is intentionally small |
| Sleeves | SleeveFollowL, SleeveCuffR | Adds only a small follow-through to primary arm motion |
| Neural details | NK1_NeuralFiber_01, NK1_SynapseLink_02 | Optional and subtle; no skin/face attachments |

Root, anchor, base and attachment nodes are excluded from simulation. Keep semantic names unique where possible. When duplicated mesh skeletons reuse a name, the runtime uses the bone array index as a separate state key.

## Explicit glTF node metadata (preferred over name heuristics)

Name-based detection remains a compatibility fallback. For newly authored rigs, put an explicit `nk1Secondary` object in each relevant glTF node's `extras`; GLTFLoader exposes this as `node.userData.nk1Secondary`.

Example for a loose left hair chain:

```json
{
  "name": "Bone.001",
  "extras": {
    "nk1Secondary": {
      "role": "hair",
      "chainId": "fringe-left",
      "side": "left",
      "distalWeight": 0.58,
      "maxAngle": 0.045,
      "pinned": false
    }
  }
}
```

Supported roles: `hair`, `garment`, `sleeve`, `neural-fiber`. Supported sides: `left`, `right`, `center` (or `-1`, `1`, `0`). Optional fields are `chainId`, `pinned`, `enabled`, `distalWeight` and `maxAngle`.

- Root/attachment bones should be explicitly marked `pinned: true`; they are kept out of the solver. They remain marked as secondary-chain candidates so the legacy GLB hair adapter cannot accidentally animate a pinned root.
- `chainId` groups authored bones for authoring/debugging; per-bone runtime state remains independently keyed.
- A supplied angle is clamped to the role hard ceiling: hair 0.06 rad, garment 0.09 rad, sleeve 0.055 rad, neural fiber 0.035 rad. Metadata cannot raise those limits.
- Unknown roles, invalid side values, malformed bounds and invalid chain IDs fail closed. The runtime does not fall back to a guessed name when an explicit role is invalid.
- Audit, raw hosted-GLB CI and live Three.js runtime all read the same metadata contract.

## Optional morph channels

The runtime recognizes only these exact semantic aliases and only when the model actually exports them:

- NK1_Cloth_Sway / ClothSway
- NK1_Hair_Sway / HairSway
- NK1_Tissue_Breath / SoftTissueBreath
- NK1_Neural_Pulse / NeuralPulse

Facial targets such as happy, blink, visemes, jaw and brow are not part of this adapter.

## Neural garment material tag

Tag only fabric details whose emissive response is designed to reflect the character's cognitive state:

- Preferred: material.userData.nk1DynamicLayer = "neural".
- Alternative: a material name beginning with NK1_NEURAL_ or an explicit NK1_Synapse... name.

The runtime modulates the existing emissiveIntensity within a narrow range. It does not recolor, replace, create or brighten arbitrary materials. Keep the base color, emissive color, maps, roughness and metalness authored.

Recommended visual treatment for the character: a restrained neural-vascular weave embedded in the graphite/plum garment seams, with tiny luminous junctions at garment construction points. It should read as engineered fabric, not as a second skin, large neon circuitry, a helmet or a generic cyberpunk overlay. Preserve the original face, eye color, facial proportions and hair silhouette.

## Physics and device budget

- Fixed integration step: 1/60 s.
- Maximum substeps per rendered frame: 4.
- At most 256 authored secondary bones are tracked.
- Per-role angular limits: hair 0.06 rad, garment 0.09 rad, sleeves 0.055 rad, neural fibers 0.035 rad.
- Low/balanced/high render tiers scale secondary motion to 0.35/0.70/1.0.
- Sleep fades secondary motion toward rest.
- State is reset when a model is replaced or cleared.
- The CPU XPBD surface solver is bounded to 768 vertices and 4,096 triangle-edge constraints per mesh, with at most four 1/60-second substeps and 2/3/5 constraint iterations for low/balanced/high quality. It uses typed-array buffers and adds no runtime dependency. There is no GPU compute-shader pass or external model inference in the render loop.

The avatar now has three bounded secondary layers: a fixed-step bone spring solver for authored secondary chains; a CPU XPBD surface-particle solver on the exact modular hair/garment allowlist; and a small post-skinning GPU sway fallback for meshes that cannot safely create a particle state. XPBD treats real mesh vertices as particles and unique triangle edges as distance constraints. It is a genuine vertex-level constrained deformation, but it is not yet a complete cloth/soft-body system: self-collision, body collision proxies, bending constraints, wind fields and device soak still require separate implementation and acceptance.


## XPBD surface particles and GPU sway fallback on existing v5 geometry

The runtime attaches dynamics only to exact allowlisted `SkinnedMesh` nodes with valid position attributes, finite bounds and cloneable supported materials. It clones geometry, preserves the original asset, and adds a private `nk1SecondaryOffset` vertex attribute for the XPBD path.

| Role | Exact allowed names | Maximum world-space amplitude |
|---|---|---:|
| Hair | `HAIR_long_lock_L/R`, `HAIR_front_strand_L/R`, `HAIR_layer_L1/L2/R1/R2` | 0.012 model units |
| Garment | `CLOTH_skirt`, `CLOTH_labcoat_main` | 0.007 model units |
| Tie | `CLOTH_tie_blade` | 0.0045 model units |

For XPBD-enabled meshes, each real vertex is integrated as a particle using Verlet motion and XPBD distance constraints derived from the triangle edges. Every two-face manifold interior edge also contributes a weaker opposite-vertex distance link; boundary and non-manifold edges are deliberately skipped rather than guessed. This is a bounded distance-based bend/shear approximation, not a dihedral-angle or full cloth-shell solver. The inferred upper attachment band keeps its distal row hard-pinned and blends its lower edge through a smooth partial-pin gradient; an exported `nk1SecondaryPin` attribute overrides this inferred band with a normalized per-vertex weight (`0` free, `1` fully fixed, intermediate values partially pinned). The offset attribute is injected before Three.js `skinning_vertex`, so existing skin weights and bone motion continue transforming the solved surface. Motion follows canonical body sway, gait, breath and yaw, then scales down in sleep and low device-quality modes. The previous bounded post-skinning GPU wave is retained as a fallback for unsupported topology/materials. Geometry clones and material clones are restored/disposed on model replacement or reset.

The allowlist deliberately excludes `HAIR_back_mass`, `HAIR_crown`, all fringe meshes, face/eye meshes, lapels, collars, pockets, buttons and sleeves. XPBD now solves particle motion, edge-length constraints and bounded opposite-vertex bend/shear links across two-face manifold edges. It still does not implement self-collision, body collision proxies, dihedral-angle bending, wind fields or cloth self-contact. The GPU fallback remains visual sway only. Full cloth/soft-body acceptance still requires collision proxies and browser/device profiling.

## Acceptance requirements

1. Original character identity remains fixed; no face, eye, hairline or body-proportion edits are made by the dynamics layer.
2. Primary skeleton and motor intent remain owned by the existing VRM/GLB adapters.
3. The new layer adds bounded offsets only to supported secondary chains and the exact modular vertex-particle allowlist.
4. Missing morphs/material tags/bones produce no-op behavior, not fallback geometry.
5. Determinism, sleep settling, reset, duplicate-name handling and mobile quality scaling remain covered by regression tests.
6. Browser/Android visual acceptance must use the real canonical model and report only what the imported asset actually contains.


## Verified canonical v5 audit — 2026-11-27

The canonical catalog-pinned `NeuroKurisu_3D_v5.glb` was downloaded by the GitHub Actions runner and checked against its byte count and SHA-256. The audited asset has 124 glTF nodes, 101 meshes, 19 skin-joint nodes, 10 raw morph-target records (9 named through available glTF extras), and 4 animation clips.

The secondary-role audit detected:
- hair secondary bones: 0
- garment secondary bones: 0
- sleeve secondary bones: 0
- neural-fiber bones: 0
- supported secondary morph aliases: 0
- explicitly tagged emissive neural-fabric materials: 0

The imported asset remains a valid base humanoid, but is not yet a fully authored secondary-rig asset: it exports no secondary bone chains, supported cloth morph aliases or tagged neural-fabric layer. Bone-spring/morph motion therefore remains no-op for those missing channels. The runtime now creates bounded XPBD surface particles on supported detached hair/garment meshes using the existing vertex topology; it does not add bones or rewrite source skin weights. The confirmed SHA, exact 14 unclassified limb/shoulder/hand candidates, acceptance requirements and next authoring work are recorded in [NK1_V5_SECONDARY_ASSET_AUDIT_2026-11-27_RU.md](./NK1_V5_SECONDARY_ASSET_AUDIT_2026-11-27_RU.md).

Do not repurpose primary shoulders, arms, neck, head or facial morphs as substitute hair/cloth joints. The next asset pass must add real secondary chains, skin weights, optional tissue morphs and explicitly tagged neural-fabric materials while preserving the existing character identity.


## Verified modular mesh inventory in v5

The actual hosted v5 also contains separately named meshes for hair, clothing and sleeves, even though every hair mesh is currently weighted 100% to the head and no secondary bones are exported. The hosted raw-GLB audit confirmed **15 hair meshes, 19 garment meshes and 4 sleeve meshes**; all 38 are currently skinned to the shared v5 skin. The scene audit reports these mesh roles independently from the secondary-rig status:

All sampled vertices in the candidate hair/garment/sleeve meshes have normalized skin weights summing to approximately 1.0. This is a sound starting point for targeted reweighting, but it does not itself provide secondary motion.

- Hair mesh candidates: back mass, crown, center/left/right fringe, front left/right strands, six side layers, and left/right long locks.
- Garment candidates: main coat, skirt, tie blade/knot, left/right lapels and seams, collar, pockets/flaps, buttons and hem stitch.
- Sleeve candidates: upper and lower left/right sleeve meshes.

The 3D capability panel reports secondary bones, mesh inventory, total attached secondary meshes and active XPBD particle meshes separately. Allowlisted independent hair/garment meshes receive real constrained vertex-particle dynamics without altering shared source skin weights; unsupported meshes remain on the GPU-sway fallback or their original skin.
