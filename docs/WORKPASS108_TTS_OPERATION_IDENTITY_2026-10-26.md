# NK1 WorkPass108 — independent TTS operation identity

Date: 2026-10-26  
Branch: `feature/visual-embodiment`

## Defect

The default `EmbodimentRuntime.speak(text)` event ID was a content/context hash of text, action, mode, and last external-activity timestamps. This made separate same-text utterances collapse onto one operation key when the activity context did not change. The server has direct `runtime.speak(text)` call sites that omit an explicit event ID, so independent calls could be confused with idempotent retries.

## Fix

- Explicit `context.speechEventId` remains authoritative and is forwarded unchanged after existing context validation.
- When an ID is omitted, generate a fresh `speech-${randomUUID()}` ID per invocation. Independent utterances get independent ActionGateway idempotency keys; callers recovering/retrying the same logical operation must continue to supply the same explicit ID.
- Added a regression dispatching the exact same phrase twice without an explicit ID; it asserts distinct generated IDs and two completed utterances. The existing explicit-ID test still proves that caller-supplied identity is preserved.

## Commits

- Runtime source: `60ef398448f95e2320dde802a91d3fd17842d3f5`
- Regression: `b88672116d4fa63489aaef929b302967636eaeb9`

## Validation

[GitHub Actions run 40306429226](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40306429226) **passed** on exact tested head `b88672116d4fa63489aaef929b302967636eaeb9`.

- Live2D resource integrity: 24/24 manifest resources passed.
- App and standalone Chromium profiles (mobile and quality) passed.
- Speech runtime reports `AVATAR_SPEECH_IDENTITY=PASS` and `AVATAR_SPEECH_UTF16=PASS`.
- App embodiment timeline suite: 16 passed, 0 failed.
- App typecheck passed.

## Boundary

This verifies operation identity at the runtime dispatch boundary. It does not prove physical audio playback was heard or that Android TTS playback termination is confirmed by acoustic/device telemetry.
