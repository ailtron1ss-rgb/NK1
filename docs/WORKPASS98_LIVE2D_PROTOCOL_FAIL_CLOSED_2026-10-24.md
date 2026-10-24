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

- Exact source/test/workflow commit: `1fde12d60b036ebb7787cf301a6cf78cd4f7f2f1`. GitHub Actions run [40128198611](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40128198611) **passed**.
- Passed steps: `npm ci --prefix app`, `assets:sync`, `test:live2d-assets`, Chromium installation, `test:live2d-browser`, `test:live2d-expression-cache`, `test:embodiment-timeline` (14 tests; 14 passed, 0 failed) and `typecheck`.
- Browser smoke completed against the real iframe in both profiles: mobile canvas `760x840`, 68,465 bright pixels; quality canvas `760x840`, 68,506 bright pixels. The malformed-NaN and missing-clock probes were rejected in both profiles; otherwise the browser step would have failed.
- The branch head subsequently advanced through report/CHANGELOG-only commits, so the tested source SHA remains `1fde12d...`; those documentation commits do not alter the tested runtime/test code.
- This pass does not establish real acoustic lip-sync, physical audio output, Android/Termux TTS/STT, long-session stability, or target-device performance.
