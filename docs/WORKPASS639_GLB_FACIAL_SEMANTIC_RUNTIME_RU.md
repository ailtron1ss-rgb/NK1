# WorkPass639 — GLB facial semantic runtime

## Implemented

- Added `threeFacialSemanticRuntime.ts`, a Three.js-facing adapter over the renderer-independent facial semantic map.
- Resolves morph dictionaries independently per mesh because morph indices are mesh-local.
- Binds only recognized facial channels; malformed/out-of-range indices are rejected.
- Applies expression, blink, gaze and viseme weights to the active GLB model.
- Speech visemes explicitly override mouth-expression weights for the current frame.
- Only channels owned by the adapter are reset; custom/unrecognized morph targets remain untouched.
- Integrated the adapter into `Avatar3DStage` as the fallback after native VRM ExpressionManager and native VRM morphTargetBinds.
- Rebuilds bindings on model replacement and clears references on reset. The existing Pixiv VRMA expression path and VRM LookAt controller remain unchanged.

## Validation added

`avatar-three-facial-semantic-runtime.test.mjs` covers per-mesh binding, malformed indices, expression application, speech priority, frame reset, preservation of custom channels and safe handling of shortened/disposed influence arrays.

## Boundaries

This pass wires generic GLB morph dictionaries into the live render loop. It does not add facial animation retargeting between different source rigs, eye-bone retargeting, or a new VRMA expression compiler. Native VRM expression handling remains authoritative when present.

## Validation status

Source-level regression tests were added. A successful GitHub Actions run for the final WorkPass639 head is required before calling this pass CI-validated.
