# NK1 Aspect 11 — 2.5D depth/parallax preview for Original SVG

## Implemented

The existing editable Original SVG concept now separates four visible vector groups into independent depth layers:

- rear hair;
- torso;
- head;
- front fringe.

Each layer receives a different bounded transform derived from the same gaze signal already supplied by the canonical organism snapshot. The mappings are in SVG viewBox units, with finite rounding before serialization. The softer motion profile reduces parallax amplitude. Transitions are smoothed, and `prefers-reduced-motion` disables these transforms.

The existing expression, mouth-viseme, outfit, gaze and pose paths remain intact. The work adds no second cognitive or emotion owner.

## What this means — and does not mean

This is an actual layered 2.5D-style parallax preview in the current SVG renderer. It is not a production depth-rig, skeletal 2.5D body, Cubism model or a substitute for authored hidden-area geometry. The layers are existing vector groups, not automatically segmented bitmaps.

## Acceptance tests

- Offset gains and directions are deterministic for all four layers.
- Inputs are clamped; non-finite values cannot produce invalid SVG transforms.
- Reduced-motion preference removes layer translation and transition.
- The mode remains an editable SVG tree and continues to consume organism gaze.

Command: `npm --prefix app run test:avatar-hardening`.

## Remaining work

Production 2.5D still requires layered artwork/underdraw, occlusion masks, stable artist pivots, authored depth hierarchy, a full pose rig and real browser/Android visual validation. This preview does not claim those gates are closed.
