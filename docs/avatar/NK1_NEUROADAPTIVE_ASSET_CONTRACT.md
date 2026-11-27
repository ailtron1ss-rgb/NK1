# NK1 Neuroadaptive Secondary Dynamics — asset contract

## Purpose

This contract extends the existing identity-locked Kurisu embodiment with bounded, deterministic secondary dynamics. It does not replace the canonical character asset, regenerate the face, change the eye geometry or color, alter hairline or body proportions, or create a competing motor/brain owner.

The runtime reads one canonical NK1 avatar frame and derives secondary motion from its existing affect, action, energy and measured body channels. Cognition does not run a neural model inside the WebGL frame loop: the organism supplies the signals; a small critically damped spring solver turns them into physical lag.

## What the runtime can drive

- Hair clumps and loose locks, with pinned roots and more responsive tips.
- Coat, skirt, mantle, cape, tie, ribbon, hem and other authored garment chains.
- Sleeve/cuff follow-through.
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
- No per-vertex cloth solve, GPU compute, external model inference or new runtime dependency is introduced.

This is a bone-driven secondary-motion layer. It is not a full vertex-level cloth or soft-body solver. A true cloth solve requires authored garment topology, pinned vertex groups, collision proxies and device profiling; it must be a separately measured addition rather than implied by this contract.

## Acceptance requirements

1. Original character identity remains fixed; no face, eye, hairline or body-proportion edits are made by the dynamics layer.
2. Primary skeleton and motor intent remain owned by the existing VRM/GLB adapters.
3. The new layer adds bounded offsets only to supported secondary chains.
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

The imported asset is therefore a valid base humanoid, but **not yet a modular secondary-physics asset**. Runtime dynamics remain fail-closed/no-op for layers absent from v5. The confirmed SHA, exact 14 unclassified limb/shoulder/hand candidates, acceptance requirements, and next asset-authoring work are recorded in [NK1_V5_SECONDARY_ASSET_AUDIT_2026-11-27_RU.md](./NK1_V5_SECONDARY_ASSET_AUDIT_2026-11-27_RU.md).

Do not repurpose primary shoulders, arms, neck, head or facial morphs as substitute hair/cloth joints. The next asset pass must add real secondary chains, skin weights, optional tissue morphs and explicitly tagged neural-fabric materials while preserving the existing character identity.
