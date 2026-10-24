# WorkPass97 — Live2D browser smoke and viewer recovery
Date: 2026-10-24

## Implemented

- Added `app/scripts/test-live2d-browser.mjs`, a Chromium/Playwright smoke test which serves the repository's own Live2D assets, boots the real iframe viewer, waits for `live2d_ready`, checks local asset responses and browser errors, and runs both `mobile` and `quality` model profiles.
- The browser test sends versioned `kurisu_embodiment_intent` updates across expression and motion channels. A test-only in-memory transform is used by the HTTP fixture where needed; the committed production viewer source is served unchanged.
- Added the `test:live2d-browser` npm script and wired browser installation + browser smoke into `.github/workflows/live2d-runtime-validation.yml` using Node.js 24.
- Added an explicit retry path in `AvatarStage`: clicking Live2D while the viewer is not ready increments a key on the iframe, remounting the viewer without reloading the whole React application.
- Added a focused source-contract regression for the retry path to the embodiment test suite.

## Evidence observed

- Exact-head asset integrity test on commit `27d3d70b7384f487fe963ebef83957006f6222c3` passed: 21 manifest entries hydrated/verified, both model profiles had expected expression/motion/resource coverage, and the vendored runtime assets were present.
- Exact-head GitHub Actions run `40127269491` passed on code/test/workflow commit `ffadcfeee8ea3d400466357edd1ff313e3287602`: [run details](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40127269491). The run completed asset hydration, canonical asset integrity, Chromium installation, the real browser smoke, expression-cache regression, embodiment-timeline suite, and TypeScript typecheck successfully.
- The screenshot-based browser smoke reported `mobile` canvas `760x840` with 68,469 bright pixels, and `quality` canvas `760x840` with 68,513 bright pixels. Both profiles reached `live2d_ready`, produced visible canvas content, sent versioned emotion/motion intents, and completed without failed local asset responses or uncaught page errors.
- After the screenshot-based test passed at `ffadcfe`, a follow-up test-only commit `783cc2ae715467d58cc4144b67b31600945cf62a` added in-memory probes to assert that the latest versioned intent is accepted and that the model's expression and motion APIs are called. The exact-head run [40127565235](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40127565235) is still in progress at the time of this report update; no pass is claimed for those additional assertions yet.

## Validation boundary

A successful Chromium smoke proves the local viewer can load the model and produce rendered output in a headless software-WebGL environment. It does not prove accurate viseme-to-acoustic timing, real audio output, Android/Termux TTS/STT, long-session stability, or target-device GPU/energy performance. Those remain separate release gates.
