# WorkPass70 — code changes (2026-10-19)

## Implemented

- Added `app/src/components/avatar/embodimentTimeline.ts`: a typed `EmbodimentIntentV1`, RU/EN grapheme-level mouth pose timeline, UTF-16-compatible character offsets, monotonic audio-clock sampling, boundary-anchor validation and runtime envelope validation.
- Updated `app/src/components/AvatarStage.tsx` to create per-utterance `speechEventId` and `audioClockId`, sample visemes from the same monotonic audio clock that is published in the intent, re-anchor its character mapping to Web Speech boundary `charIndex` and `elapsedTime` when available, ignore callbacks from superseded utterances, and publish one versioned parent-to-viewer control envelope.
- Updated `app/public/live2d/viewer.html` to accept only `kurisu_embodiment_intent` v1 for parent control, reject older `stateVersion` and backward audio-time updates, validate cancellation identity and close the mouth on terminal/unknown states.
- Added `contracts/embodiment-intent.v1.schema.json`.
- Added `app/scripts/embodiment-timeline.test.mjs` and app/root test scripts. Nine regression tests cover RU/EN mouth classes, UTF-16 offsets, monotonic sampling, payload validation, single-message publishing, stale-event protection and schema alignment.

## Verification

- `node --experimental-strip-types --test app/scripts/embodiment-timeline.test.mjs`: 9/9 PASS.
- Strict TypeScript check for `embodimentTimeline.ts`: PASS.
- Runtime typecheck: PASS with available PATH TypeScript compiler.
- Extracted viewer inline JavaScript `node --check`: PASS.
- JSON schema parse: PASS.

## Limits

The browser Web Speech API does not expose rendered PCM or phoneme-level timing in this path. The implementation uses estimated grapheme visemes and boundary re-anchoring, so it is not a claim of phoneme-perfect lip sync. Actual audio output and Live2D parameter offset still require browser E2E on the target device. Production app build remains blocked until app dependencies can be installed from the committed lockfile.
