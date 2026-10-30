# NK1 Aspect 02 — Original 2D character art production brief

**Branch:** `work/aspect-02-original-2d-art-system-2026-10-30`  
**Baseline:** `workpass70-source` at `ad564d1879028f00549be41ec5172a2f72e25897`  
**Scope:** the independently authored Original 2D illustration and its production artwork. This aspect does not own Live2D Cubism, the layered 2.5D rig, or the VRM/3D runtime.

## 1. Current truth

The active implementation is `app/src/components/KurisuOriginalStage.tsx`. It is an editable SVG concept with authored paths for the head, face, hair, torso, legs and four arm silhouettes. It consumes organism emotion/action/arousal/gaze/speech state and has three color-driven outfit treatments (lab, casual, night), eye/hair/accent palettes, scale, motion style and four pose choices.

It is useful as a scalable preview and an art-direction prototype. It is **not** yet a production illustration master:
- most geometry is embedded directly in one React component;
- the three outfit modes recolor/reshape a few torso paths rather than load independent garment artwork;
- only four coarse arm silhouettes exist;
- head/eye/mouth expression is parameterized but there is no complete expression sheet;
- there are no approved multi-angle turnarounds, hand/foot studies, prop sheets or layered source files;
- hidden/occluded anatomy is not prepared for arbitrary pose changes;
- current SVG paths have no named production layer/pivot manifest.

The current SVG preview uses a 420×560 viewBox. The machine-readable design contract is `app/public/kurisu-original/character-art-contract.json`.

## 2. Art direction — identity lock

The goal is a distinctive NK1 original interpretation of the Kurisu-inspired scientist, not a generic anime template. Keep the following visual anchors stable across expressions, clothes and future renderers:

1. Long copper/auburn hair; warm highlights and darker wine-brown shadows.
2. Slim red hair clip on the fringe; never replace it with a large neon ornament.
3. Large violet default eyes in the current NK1 concept; optional ice-blue and teal are controlled variants, not identity resets.
4. Intelligent, restrained facial design. The neutral face must remain neutral; do not bake a smile, blush or angry brow into the base face.
5. Recognizable hair silhouette and face proportions at thumbnail size.
6. A coherent laboratory-scientist outfit as the default visual signature.
7. NK1 cyan/rose/lime accents are secondary interface or trim colors; they must not overwhelm the character's copper/red identity.

The visual identity should remain recognizable in monochrome silhouette, at 128 px avatar height, in neutral expression, and across all required views.

## 3. Production drawing package

Create one editable master, not a folder of flattened unrelated images.

### 3.1 Character turnaround
- Front neutral, front three-quarter left/right, left/right profile and back.
- Full-body standing neutral with relaxed hands.
- Head close-up with consistent eye-line, nose, mouth and ear landmarks.
- Hand sheets: relaxed, pointing, open palm, fist, holding a cup/phone/marker.
- Foot/boot sheet: front, side and three-quarter.
- Silhouette sheet for body proportions and hair volume.

### 3.2 Expression atlas
Create independent expression artwork and reusable facial controls for neutral, curiosity, thinking, joy, embarrassment, anxiety, sadness, frustration, anger and protective concern. Each expression needs:
- brow shape/angle;
- upper/lower eyelid and iris placement;
- mouth contour and jaw opening;
- optional blush/tear/sweat accents as separate overlays;
- intensity variants (subtle / medium / strong);
- a neutral return pose that does not cause facial drift.

Expressions should be composable. For example, curiosity + mild anxiety must not require a new flattened face image.

### 3.3 Outfit collection
Each garment is an independent asset group with front/back, sleeve/collar/cuff and overlap details. First collection:
- laboratory coat + shirt + red tie;
- casual city outfit;
- night/home outfit.

For each outfit define garment silhouette, fabric folds, material palette, accessory slots and occlusion order. Keep body anatomy beneath garments so pose changes do not expose empty holes. A palette swap is a colorway, not a new outfit.

### 3.4 Props and accessories
Separate assets for hair clip, glasses (optional), lab ID/badge, phone, marker, notebook and cup/can. Props need grip anchors for left/right hand, a neutral display position and a clear ownership/visibility state. Do not embed props into a pose image.

## 4. Layer and naming contract

Use stable kebab-case layer IDs. Minimum groups:
- `hair-back`, `hair-side-left`, `hair-side-right`, `hair-front`, `hair-clip`;
- `body-base`, `neck`, `face-base`, `ear-left`, `ear-right`;
- `eye-left`, `eye-right`, `iris-left`, `iris-right`, `brow-left`, `brow-right`;
- `nose`, `mouth`, `jaw`;
- `torso-base`, `arm-upper-left`, `arm-lower-left`, `hand-left`, corresponding right-side groups;
- `leg-upper-left`, `leg-lower-left`, `foot-left`, corresponding right-side groups;
- `outfit-<name>-front/back`, `accessory-<name>`, `prop-<name>`.

Every moving group needs a documented pivot in normalized canvas coordinates, a parent ID, default transform, allowed rotation/translation bounds and overlap/mask notes. Layer IDs must remain stable across exports so the future 2.5D importer can consume them without guessing.

## 5. Technical handoff

Deliver:
- editable PSD/KRA master with named groups;
- transparent per-layer PNG exports;
- vector SVG preview for the app;
- `manifest.json` containing schema version, canvas, layer IDs, parent/pivot, bounds, z-order, asset hashes and source provenance;
- contact sheets for views, expressions, outfits and props;
- license/provenance record for every external or generated source asset.

The art package must be usable independently of the React UI. The renderer should load a manifest and assets; it must not become the sole owner of the artwork.

## 6. Quality gates

| Gate | Acceptance rule |
|---|---|
| Identity | Hair/clip/face silhouette recognizable in all six views |
| Proportion | Head, shoulder, waist and foot landmarks agree across views |
| Expression | 10 required expressions, 3 intensities, composable facial parts |
| Outfit | 3 real garment groups; no palette-only substitution |
| Anatomy | Hidden regions are drawn under sleeves, coat and hair |
| Layering | No missing layer, duplicate ID, broken parent or invalid pivot |
| Small-size | Legible at 128 px high; face remains readable at 64 px crop |
| Contrast | Face/hair/coat remain separable on light and dark backgrounds |
| Export | All assets have nonzero size, alpha where required, stable hashes |
| Provenance | Every asset has source/license/author metadata |

No visual-quality gate is passed by a source-code regex alone. Final identity and drawing quality require human review of rendered contact sheets.

## 7. Implementation sequence

1. **Foundation (this pass):** lock identity and delivery contract; make SVG resource IDs safe for multiple component instances; add regression checks.
2. Extract the SVG drawing into named, testable subcomponents or a data-driven scene graph without changing the current look.
3. Add canonical neutral front artwork and six-view turnaround; get explicit visual approval before multiplying outfits.
4. Build independent expression atlas and composable facial controls.
5. Build three real outfit groups and accessory/prop assets.
6. Add layered master and export manifest with hash/provenance validation.
7. Add renderer-side asset loader with strict schema, bounded file sizes and graceful fallback.
8. Prepare a separate 2.5D handoff from the same layered source; do not silently turn this aspect into a 2.5D implementation.

## 8. Explicit completion boundary

Aspect 02 is complete only when the editable master, all required views, expression atlas, real garment assets, props, export manifest, provenance and visual acceptance evidence exist. The current SVG concept is a useful preview and must remain available as fallback; it is not counted as completed production art.

## 9. External research and reuse policy

Useful technical references:
- SVG 2 paint servers and fragment identifiers: https://www.w3.org/TR/SVG2/pservers.html
- W3C SVG structure and reusable symbols: https://www.w3.org/TR/SVG2/struct.html
- OpenRaster layered-image interchange: https://www.openraster.org/
- Krita documentation (layer groups and export): https://docs.krita.org/
- OpenPSD specification/project: https://github.com/Agamnentzar/psd.js

Reuse principle: borrow file-format and pipeline ideas, not someone else's character art or proprietary model. All NK1-specific character artwork must have recorded authorship/provenance and a license compatible with the intended release.

## 10. Validation boundary for this pass

The source-level regression verifies unique SVG paint-server references, design-contract structure, stable identity defaults and the separation between actual outfit assets and palette controls. It does not verify artistic quality, browser screenshots, production build, Android performance or Release ZIP publication.


## 11. Future 2.5D handoff — rig-safe source requirements

This section constrains the later 2.5D aspect; it does not claim that the current SVG or any legacy sprite is rig-ready.

### 11.1 Coordinate and layer records
Use one normalized master-canvas coordinate system (top-left origin, +X right, +Y down). Every moving group must have a stable kebab-case ID, parent ID, z-index, pivot, rest transform, bounds, occlusion notes, deformation notes and source-asset ID. Pivots must be measured from the approved master, not guessed from layer centers. Reject parent cycles and undocumented mirrored geometry.

### 11.2 Hidden anatomy and overlap
Paint complete anatomy underneath hair, sleeves, coat fronts, collars and accessories. Extend hidden shapes beyond their masks by a measured overlap margin. Separate front/back garment panels, body, upper/lower limbs, hands and held props. At extreme approved poses, no background-colored holes, exposed canvas, mask gaps or accidental garment intersections may appear.

### 11.3 Depth and camera
A layer draw order is not proof of physical depth. Record authored/measured depth separately; do not derive it from flat color, filename or z-order. Keep five-view landmarks and silhouette consistent. Parallax is allowed only where the source art contains the newly revealed surface; never reveal unpainted regions by moving a camera.

### 11.4 Mesh and deformation
Meshes are optional until the dedicated rigging phase. If supplied, record topology version, vertex bounds, pinned vertices, seam constraints, UV/alpha padding and maximum displacement. Review head turns, torso yaw/lean, shoulder/elbow/wrist motion, hip/knee motion, hair swing and prop grip. Reject tearing, self-intersection, texture-edge fringing and deformation outside approved bounds.

### 11.5 Texture and platform budgets
Keep the 4096×4096 master as a source ceiling, not a requirement to ship every layer at full size. Declare per-target atlas dimensions, padding, alpha, sRGB, compression and total memory budget before export. Verify mobile texture residency and graceful fallback independently; do not conflate source resolution with runtime GPU memory.

### 11.6 Approval boundary
The manifest may use the status approved-for-2.5d-rigging only after editable source, complete layer records, hidden anatomy, deformation contact sheets, five-view consistency, hash integrity, provenance and human visual sign-off are all present. The current 24-slot art manifest remains unchanged and all 24 production slots remain not-authored.
