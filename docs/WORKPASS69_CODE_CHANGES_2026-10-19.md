# WorkPass69 code changes — 2026-10-19

## Canonical physical speech owner

- Removed the second `android.speak` bridge registration in `OrganismRuntime`.
- Preserved backwards compatibility by resolving the legacy tool ID to `organism.device.speak` in `OrganismCore` action dispatch and reusable skills.
- Existing `speakViaTermuxWithOutcome` continues to classify process-completion evidence as command receipt only, not audible-output verification.

## Keyed interruption flow

- Added `organism.device.speech.interrupt` in `OrganismCore` with `requiresIdempotencyKey: true`.
- The operation is bound to the currently active `speechEventId`. A target mismatch cannot signal another utterance.
- `EmbodimentRuntime` dispatches interruption via its injected gateway callback; runtime routes this to `core.executeTool(...)` with deterministic interruption identity and key.
- Uncertain interruption retains the unresolved state. A late speech result cannot revert the more recent interrupt state.
- Successful termination only moves UI state to “interruption requested, playback unverified”; no authoritative audio readback exists.

## UI/API integration

- Added `POST /api/organism/voice/interrupt` with bounded/sanitized reason and explicit `playbackVerified: false`.
- Added `neuroApi.voiceInterrupt` and an operator `Interrupt speech` button.
- Extended the actual local server and UI smoke tests. Direct voice routes without an approval ticket are required to report `approvalRequired`, not treated as success.

## Added/updated tests

- `workpass69-speech-interruption-gateway.mjs`: gateway ownership, no direct bridge call, target identity, unknown preservation and late-ACK race.
- `termux-tts-concurrency-workpass69.mjs`: controlled child process, no implicit overlap, wrong-target interrupt rejection and honest `playbackVerified: false`.
- `server-smoke.mjs`: real HTTP route and response semantics.
- `ui-smoke.mjs`: interrupt endpoint plus current approval behavior for no-ticket direct speech requests.

The controlled Termux process fixture proves runtime semantics, not actual Android audio playback.
