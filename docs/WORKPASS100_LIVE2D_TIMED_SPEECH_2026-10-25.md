# WorkPass100 — timed text visemes for the Live2D runtime
Date: 2026-10-25

## What changed

- Extended the canonical runtime voice snapshot with `lastSpeechEventId`, `lastSpeechText`, and `speechStartedAt`. These fields are captured immediately before the TTS gateway dispatch, while the existing voice state remains the authority for whether speech is active.
- Added a small `GET /api/organism/avatar-speech` endpoint. The avatar no longer needs to poll the heavy cognitive UI snapshot just to obtain the current phrase cursor.
- Implemented a bounded grapheme-to-pose timeline in `runtime/neuro-kurisu/public/avatar-state.mjs`: Russian/English letters produce different mouth poses, closed consonants reduce opening, vowels use different opening/form values, and punctuation produces a closed pause pose. Input text is capped at 2,000 characters and speech rate is clamped.
- Connected the timeline to the actual iframe in `runtime/neuro-kurisu/public/avatar.html`. It samples the speech cursor on a short interval and posts time-indexed `mouthOpen`, `mouthForm`, `mouthViseme` and lip-sync values with a separate animation frame loop.
- Removed the accidental dependency on the slower cognitive snapshot for starting the mouth animation. The speech cursor can animate against a neutral fallback body first; the latest emotion/gaze snapshot enriches the pose when it arrives.
- Added focused lifecycle, mapping, source-contract and Chromium regressions. The browser smoke asserts that an open-vowel viseme was actually observed during a phrase rather than checking a fragile single frame.

## Validation

GitHub Actions run [40161279179](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40161279179) **passed** on code/test/workflow SHA `2f595140da3968f7b153c03c12b36a6e62fade50`.

- App Live2D Chromium smoke: mobile 68,465 bright pixels; quality 68,514.
- Runtime Live2D Chromium smoke: mobile 68,477 bright pixels; quality 68,519.
- Runtime wiring: `snapshot → emotion → motion → lipsync` passed; the time-varying vowel pose was observed.
- `LIVE2D_INTEGRITY=PASS`, `AVATAR_STATE_MAPPING=PASS`, `AVATAR_SPEECH_RUNTIME=PASS`.
- Embodiment timeline: 14 passed, 0 failed.
- Render budget: idle 14 FPS, active 30 FPS, hidden pause and visible resume passed.
- TypeScript `tsc --noEmit` passed.
- The branch subsequently advanced through a cognitive-contract test fix and motivation-source change. Those commits do not alter the tested Live2D code path, but the Live2D pass above is explicitly tied to the SHA and run linked here.

## Limitations

This is text-timed viseme estimation anchored to the runtime TTS start time. The current Termux/Web TTS gateway does not expose a reliable phoneme timeline or the rendered PCM waveform to this avatar surface. Therefore this pass **does not claim acoustic or phoneme-accurate lip-sync**, nor does CI prove that audio physically played on an Android device. Device TTS/STT, Android power use, and long-session stability remain separate gates.
