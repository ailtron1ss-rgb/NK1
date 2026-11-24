# WorkPass70 handover — 2026-10-19

**Canonical base:** `Neuro_Kurisu_WORKPASS69_2026-10-19.zip`
**Work tree:** WorkPass70
**Canonical runtime:** `35.90.0` · persisted schema `225`
**Release status:** `implementation-workpass; release gates remain open`

## Implemented behavior

The browser Live2D route previously sent separate control messages for lip movement, expression and embodiment. It now publishes one typed `kurisu_embodiment_intent` v1 envelope that carries speech identity, clock, lifecycle phase, mouth pose, expression, gaze, body motion, priority and cancellation token. One utterance owns one `speechEventId` and `audioClockId`. The same monotonic speech-audio clock drives both the reported `audioTimeMs` and mouth timeline. SpeechSynthesis boundary events map an observed character offset onto that clock, and browser `elapsedTime` contributes an anchor when available. The audio clock retains a high-water mark: a late lower `elapsedTime` cannot rewind the viewer state. Late callbacks from a superseded utterance are ignored. The viewer rejects stale state versions and backward updates for the same audio clock and closes the mouth for ended/cancelled/unknown states. A remounted viewer requests/retriggers publication of the latest state.

## Verified in this environment

- Embodiment timeline plus production inline viewer-handler protocol tests: 9/9 pass.
- Full app script suite after the viewer-handler tests were added: 227/227 pass.
- Strict TypeScript check for new helper: pass.
- Canonical runtime typecheck: pass.
- Live2D viewer inline JavaScript syntax: pass.
- Embodiment JSON schema parsing: pass.

## Not claimed

- No dependency-complete app production build or actual browser/Live2D audio E2E was run. App dependencies are absent; prior clean install attempts were blocked by npm registry DNS/network failure.
- No acoustic p95 offset measurement exists. Web Speech boundary events are not PCM/phoneme ground truth; the timeline remains approximate.
- No physical Android/Termux playback or cancellation is verified by this pass.
- Retrieval improvement remains zero (`recallDelta=0`) and the candidate remains `not-promoted`.

## Next critical step

On an environment where the committed app lockfile can be installed, run production build and a real browser harness. Capture audio playback clock and Live2D mouth parameters, verify start/pause/end/cancel/replacement/iframe reload, measure p95 audio-to-mouth offset, and test desktop/mobile resource use. Then connect the same intent lifecycle to physical TTS through the canonical gateway without creating a parallel action owner.
