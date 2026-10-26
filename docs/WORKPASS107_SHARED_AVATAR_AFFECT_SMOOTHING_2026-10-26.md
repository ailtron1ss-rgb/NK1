# NK1 WorkPass107 — shared Live2D affect smoothing

Date: 2026-10-26  
Branch: `feature/visual-embodiment`

## Change

- Extracted `smoothEmbodimentAffect` into browser-safe `runtime/neuro-kurisu/public/embodiment-affect-core.mjs` plus a TypeScript declaration.
- React `AvatarStage` re-exports the same implementation. The standalone runtime viewer imports it directly, removing the duplicate behavior.
- Standalone intent now eases bounded expression intensity, gaze, head tilt, and voice emphasis using the same 180ms exponential smoothing as the app.
- The idle viewer publishes during a bounded 900ms settle window after a target change; it does not add permanent high-frequency idle messaging.
- Mouth poses remain driven by the existing time-indexed speech timeline and speech clock; they are not passed through the affect smoother.
- Updated runtime integrity assertions to check the new canonical module and runtime file, and extended the app suite to keep the speech clock and affect clock separate.

## Commits

- Shared implementation: `ce0424959e691e344f44d8be26b3def02116045a`
- Type declarations: `2166d3a7ff2aa758597730c73dd46763c10efed6`
- React wrapper: `46061b78ba4752318aa4d4b47b2a600021246eb6`
- Standalone viewer: `97888f928feed9bc657e947d21f3c9f7bbbc7e93`
- Contract test: `c205b39ce2c13393d1ce2b1d7ab51a81e6ea158e`
- Test hardening: `d4e6500d7b5acb612902b58c13fc1bcdbb8e3ec2`
- Runtime integrity contract: `af1f6caa3b257153d8398024a55180596fbb7608`

## Validation

[GitHub Actions run 40305957435](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40305957435) **passed** on exact code/test head `af1f6caa3b257153d8398024a55180596fbb7608`.

Evidence:
- Live2D resource integrity: 24/24 manifest resources pass.
- App and standalone Chromium smoke: mobile and quality profiles pass.
- Standalone organism snapshot → emotion → motion → lip-sync wiring passes.
- Runtime asset/speech/UTF-16 gates pass.
- App embodiment timeline suite: 16 tests passed, 0 failed.
- App TypeScript check passed.
- Render budget remains 14 FPS idle / 30 FPS active, with hidden pause and visible resume.

## Remaining boundary

This verifies browser/runtime contracts, not acoustic phoneme-level lip-sync, physical Android/Termux audio timing, or long-session phone soak. Emotion *labels* may still switch discretely; this pass smooths scalar affect, gaze, head tilt and emphasis.
