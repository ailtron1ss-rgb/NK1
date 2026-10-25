# WorkPass102 — unify standalone runtime on EmbodimentIntent v1
Date: 2026-10-25

## Change

The standalone runtime Live2D shell previously posted three independent control messages for the same frame: expression, body/affect, and lip-sync. React already used the versioned `kurisu_embodiment_intent` v1 contract. The runtime path has now been moved to that same envelope.

- Extended the v1 `clockSource` enum with `runtime-tts-start-anchored-monotonic` in the TypeScript contract and JSON Schema. This reports precisely that runtime timing is estimated from the TTS start clock; it is not presented as a provider phoneme clock.
- Updated the app viewer validator and runtime viewer validator to accept the runtime TTS clock.
- The runtime producer now emits one intent envelope per sampled mouth frame and on snapshot-driven affect changes. It carries speech-event/clock identity, phase, monotonic elapsed time, expression, gaze, head tilt, mouth pose/viseme, motion token, and voice emphasis.
- The runtime viewer validates protocol version, increasing state version, IDs, clock source, cancellation token, and bounded expression/mouth/gaze/body fields. It discards duplicate state versions, rejects a rewound audio clock for the active speech event, closes the mouth for terminal/unknown phases, and restarts a motion only when its motion token changes.
- Retained legacy viewer *receivers* temporarily for compatibility, but the runtime producer no longer sends the three split control messages.
- Added browser regression coverage for the runtime clock source, duplicate version rejection, audio-time rewind rejection, cancellation-bound closure, and the production avatar-to-viewer wiring. Runtime integrity now fails if the producer regresses to split messages.

## Test status

The full run for source SHA `5f3656b6f09054f26b3a336b87b8291bbfeeb652` is queued at [GitHub Actions run 40168635414](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40168635414). As of this report it has not started running its job, so the new v1 transport integration is **not yet verified by the full CI**.

The previous shared-viseme-core pass remains green at [40168305622](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40168305622), SHA `6cf8cc1970e81a350f23717719b715265afbf567`.

## Known limitation

The runtime clock is estimated from TTS start and normalized text length/rate. This aligns the avatar's timing protocol but does not establish acoustic/phoneme-accurate lip-sync or prove physical audio playback on an Android device. Device TTS/STT and energy/long-session checks remain separate acceptance gates.
