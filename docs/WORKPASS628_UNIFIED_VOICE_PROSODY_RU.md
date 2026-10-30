# NK1 Aspect 9 — Unified voice, speech and body synchronization

**Date:** 2026-10-30  
**Branch:** `work/nk1-aspect9-unified-voice-prosody-2026-10-30`  
**Base:** `workpass70-source` @ `ad564d1879028f00549be41ec5172a2f72e25897`

## Scope

Unify the browser speech path with organism affect/action context and the existing versioned embodiment timeline. This pass does not claim neural/acoustic phoneme alignment: browser Web Speech still exposes imperfect boundary events and the current viseme schedule remains grapheme-derived.

## Implemented in this pass

- Removed the parallel browser-only affect-to-prosody algorithm: browser TTS now adapts the canonical `VoiceEmbodiment.buildVoicePlan` used by the organism runtime.
- The browser adapter supplies a neutral body baseline where Android thermal/circadian telemetry is unavailable; the native runtime continues to use its measured body state. Shared language inference, breath-mode detection, tone, pause budget, pitch, rate, volume and emphasis now come from one planner.
- Tightened the canonical frustration/anger profile: slower rate, longer pause budget and reduced emphasis prevent negative high-arousal states from becoming more forceful.
- The viseme timeline is built using the exact selected speech rate, keeping mouth timing consistent with the utterance configuration.
- The same prosody emphasis is published through `EmbodimentIntentV1.voiceEmphasis`, so the Live2D viewer receives the utterance's delivery intent.
- Added focused tests for language inference, parameter bounds, affect regulation and cognitive-load modulation.

## Why it matters

The previous browser path used a fixed `rate=0.96` and a tiny pitch switch for joy/anger. The runtime voice planner already had richer state-aware prosody, but browser TTS previously carried a second, divergent mapping. The browser now consumes the canonical planner directly, so future improvements land once and are shared by browser and Termux delivery. The speech clock protocol remains unchanged.

## Remaining gates

- Run the app TypeScript check and focused tests on the branch; the focused regression now compares the browser adapter field-for-field with the canonical runtime planner.
- Verify browser speech boundary behaviour in Chromium and Android WebView; Web Speech support differs by platform.
- Verify native Termux TTS consumes the same bounded prosody plan and reports outcome separately from playback certainty.
- Add acoustic/phoneme timestamps for providers that expose them; do not present grapheme-derived visemes as phoneme ground truth.
- Add real audio capture comparison and lip-sync latency measurement.
- Validate Live2D, Original 2D and VRM/3D with the same speech event and cancellation token.

## Evidence boundary

Source changes and focused unit coverage are committed on this candidate branch. No hosted CI, Android device playback, acoustic quality, or Release ZIP refresh is claimed until independently verified.


## Follow-up — speech clock edge-case regressions

The focused timeline suite now also covers provider-boundary duplicate suppression, backward audio-time rejection, malformed boundary rejection, first-boundary origin refinement, the 16-anchor history cap and preservation of the newest calibration. Monotonic-clock tests exercise invalid anchors and late/malformed elapsed-time reports. These tests strengthen deterministic clock invariants; they do not substitute for Chromium/WebView audio capture or phoneme-level alignment.
