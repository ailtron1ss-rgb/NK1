# Unified avatar brain / speech / renderer projection

## Canonical ownership

The backend publishes an optional versioned `avatarBrain` envelope with `stateVersion === organism.tick`. The UI normalizer validates the envelope, profile/expression vocabulary, finite channel/affect bounds, and renderer hints. Stale or malformed frames become `null`; older snapshots remain compatible.

`buildAvatarRenderProjection` is the only frontend semantic projection owner. It combines the canonical organism snapshot, tick-matched brain frame, and confirmed browser speech lifecycle into one renderer-neutral result: one motor plan, expression, gaze, mouth pose, speech event/clock identity and shared body channels. The brain frame may add bounded physical face/head channels, but cannot create a second action or gesture planner.

## Renderer adapters

- Live2D receives the shared expression, gaze, mouth/viseme pose, head intent and existing versioned speech clock/cancellation envelope.
- Original2D receives the same `motorPlan`, mouth/gaze and canonical eye/brow/smile/cheek channels. It has no local `planAvatarMotorIntent` call.
- 3D receives the same `motorPlan`, body channels and brain frame. GLB clip selection continues to use the raw organism action. VRM normalized humanoid head yaw is routed through the existing head/neck owner.

## Speech gain invariant

The shared projection applies `lipSyncGain` once to browser-confirmed viseme mouth-open amount. Renderer adapters consume that already bounded mouth pose and must not multiply by `lipSyncGain` again. Pending, ended, cancelled, unknown, or identity-less utterances remain visually silent.

## Fallback and privacy

A brain frame is accepted only if its envelope tick exactly matches the current snapshot tick and its inner frame is schema v1 from `organism-state`. Otherwise the deterministic local fallback remains. Avatar frames contain no memory text, user conversation, memory IDs or private claims.

## Acceptance boundary

Automated tests and CI verify software contracts, normalization and build. They do not establish an actual rendered browser frame, v5/v7 model visual acceptance, model redistribution rights, a production 2.5D layered art pack, acoustic phoneme alignment, Android microphone capture, or OS-confirmed TTS playback. These remain separate acceptance gates.
