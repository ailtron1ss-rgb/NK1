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
- The browser smoke on commit `e5dd65a880bfa2560208a75bcef5bcebb94479ac` loaded both profiles with a working WebGL context and nonempty model output. The logged pixel counts after an explicit synchronous WebGL render were 83,505 (mobile) and 83,468 (quality). Expression-cache, embodiment-timeline, and TypeScript typecheck steps also passed on that run, although GitHub marked the overall run cancelled during cleanup after a newer commit was pushed.
- A follow-up changes only the browser-test pixel sampling from post-presentation WebGL buffer reads to a Chromium screenshot of the rendered canvas. The exact-head CI for `ffadcfeee8ea3d400466357edd1ff313e3287602` is the authority for that refinement; do not infer a pass from the preceding commit's browser result.

## Validation boundary

A successful Chromium smoke proves the local viewer can load the model and produce rendered output in a headless software-WebGL environment. It does not prove accurate viseme-to-acoustic timing, real audio output, Android/Termux TTS/STT, long-session stability, or target-device GPU/energy performance. Those remain separate release gates.
