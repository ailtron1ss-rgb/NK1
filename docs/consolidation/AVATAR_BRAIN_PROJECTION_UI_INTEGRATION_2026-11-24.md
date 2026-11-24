# Avatar Brain Frame → UI Renderers integration (24 November 2026)

## Purpose

Close the runtime/app integration seam identified by the 23 November embodiment analysis. The canonical avatar projection existed in the runtime, while the React avatar surface independently reconstructed emotion, gaze, and motor intent from the UI snapshot. This change transports one revision-bound canonical projection to the UI and uses it as the shared semantic input for the active visual body.

## Runtime transport

`GET /api/organism/ui-snapshot` now publishes optional `avatarBrain`:

- envelope `schemaVersion: 1`;
- `stateVersion` equal to the same canonical `OrganismState.tick` included in the UI snapshot;
- `frame` produced once by `EmbodimentRuntime.avatarProjection(state, ...)`;
- aggregate affect values and up to 64 finite adaptive personality traits;
- no memory text, memory identifiers, chat contents, or private user claims are added to the frame.

Projection input uses the current cognitive-field valence/arousal/coherence, organism novelty and prediction confidence, plus adaptive trait values. The runtime's existing smoothing, affect derivation, expression selection, and renderer hints remain the source of truth.

A projection failure is non-fatal to the UI snapshot. The server returns `avatarBrain: null` and the client keeps its current renderer-local fallback behavior.

## Frontend boundary

`BackendUiSnapshot` carries the optional envelope. `toOrganismSnapshot` accepts it only when:

- the envelope and projection schema are v1;
- `stateVersion === uiSnapshot.tick`;
- source is `organism-state`;
- profile and expression are allow-listed;
- all required affect and normalized channels are finite and bounded;
- renderer hint maps contain finite values.

A stale, malformed, or missing frame becomes `null`; it is never replayed against a newer organism state. Older backend releases therefore remain compatible.

## Renderer consumption

The shared helper in `app/src/components/avatar/avatarBrainUi.ts` provides tick checking, renderer-safe Live2D expression names, bounded gaze/head controls, voice viseme gain, and a neutral body-channel projection.

- **Live2D/Cubism:** canonical expression, expression weight, gaze, head tilt, and lip-sync gain are mapped into the existing `EmbodimentIntentV1`. The viewer ACK remains explicitly partial; parameter readback is not described as a presented GPU frame.
- **Original 2D SVG:** eye aperture, brows, mouth curve, cheek raise, head placement, gaze, and breath channels use the same canonical frame. Existing local pose/outfit settings remain renderer-specific.
- **VRM/GLB 3D:** normalized motor intent and body channels remain renderer-specific, while the same frame supplies head/gaze, eye, brow, smile, affect, and viseme gain values. The 3D renderer still owns skeleton mapping, morph names, animation mixer and disposal.
- **Legacy sprites:** unchanged as a low-cost fallback; they do not claim continuous facial or skeletal channel support.
- **2.5D:** remains non-selectable as a production body until real layered artwork, overlap paint, pivots, masks and asset provenance pass their own gates. The transported frame retains shared channels so a future renderer can consume it.

## Verification

Added tests:
- app normalizer preserves a matching canonical frame;
- stale state revisions are discarded;
- missing frames remain backward compatible;
- malformed/unbounded channels are rejected;
- UI helper maps expressions, gaze, head tilt, speech gain and body channels;
- clean runtime UI smoke checks frame schema, source, tick equality and bounded channels.

The exact PR-head CI run is the evidence for source/test correctness. Browser-presented frame verification, actual hosted GLB visual acceptance, and Android/Termux device soak remain explicit follow-up acceptance gates.


## VRM head-channel ownership

The shared frame's normalized `headTilt` and `headYaw` are now explicit optional inputs to `VrmNormalizedMotorFrame`, the existing sole owner of normalized VRM head/neck proxy bones. Each offset is clamped to [-1, 1] and scaled to a bounded 0.055-radian contribution. They are no longer sent to `applyVrmFullBodyChannels`, whose documented ownership is spine and limb joints and which intentionally does not write head/neck. A focused adapter test verifies both split head/neck offsets and clamping.
