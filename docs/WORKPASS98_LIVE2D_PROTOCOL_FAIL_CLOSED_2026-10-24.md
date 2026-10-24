# WorkPass98 — fail-closed Live2D intent validation
Date: 2026-10-24

## Implemented

- Hardened the app-owned viewer at `app/public/live2d/viewer.html`: the parent intent's nested `mouth`, `gaze` and `body` values must be plain records, not arrays.
- Reject non-finite mouth, gaze, expression-intensity, head-tilt and voice-emphasis values before normalization. Previously, malformed numbers could be silently converted into neutral-looking zeroes.
- Reject negative event timestamps and reject `speechPhase: "speaking"` when `clockSource` is `"none"`; the renderer must not animate speech from an envelope that declares no usable audio clock.
- Extended the real Chromium/Playwright smoke with negative probes. It sends a NaN affect value and a speaking message without a clock source and asserts neither can advance the last accepted state version.
- Added static source-contract checks to `test-live2d-assets.mjs`, so the strict validator rules remain part of the focused Live2D workflow.

## Ownership boundary

The canonical public-asset manifest owns the model, texture, motion, expression and provenance assets under `runtime/neuro-kurisu/public/live2d`; the app's renderer and vendored browser runtime under `app/public/live2d` are app-local assets and are intentionally not hydrated from that manifest. This pass changes the app-owned iframe renderer that `AvatarStage` actually mounts; it does not overwrite the separate older `runtime/neuro-kurisu/public/live2d/viewer.html`, which still uses remote CDN dependencies and is not covered by this browser workflow. Treat that older runtime viewer as a separate migration/release gate, not as synchronized with the app viewer.

## Validation

- GitHub Actions workflow was triggered by the source, browser-test and source-contract commits. The exact-head result is linked from the final WorkPass98 changelog entry when available.
- Negative-probe success is not inferred from a source diff; the report must be updated only after the exact workflow run completes.
- This pass does not establish real acoustic lip-sync, physical audio output, Android/Termux TTS/STT, long-session stability, or target-device performance.
