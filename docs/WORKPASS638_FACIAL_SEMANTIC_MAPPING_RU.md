# WorkPass638 — Cross-format facial semantics

## Implemented

- Added a renderer-independent semantic layer for VRM 0.x expression names, VRM 1.0-style names, and common GLB morph-target aliases.
- Added deterministic binding selection, malformed target-index rejection, bounded morph weights, and a speech-viseme composition rule.
- Speech visemes take precedence over expression-driven mouth shapes for the same semantic channel; eye and non-mouth expression channels remain independent.
- Added regression tests for alias resolution, deterministic duplicate handling, invalid indices, speech priority, and weight clamping.

## Integration boundary

The module returns semantic bindings and morph-index weights. A renderer adapter must apply these to the active VRM expression manager or GLB morph target dictionary. This pass does not claim automatic production wiring into every model loader, facial E2E validation, or full expression retargeting for arbitrary assets. Pixiv VRMA expression tracks remain on their existing runtime path.
