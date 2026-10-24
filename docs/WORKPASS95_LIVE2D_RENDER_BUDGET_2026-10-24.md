# WorkPass95 — Live2D render budget and visibility lifecycle
Date: 2026-10-24

## Scope

This pass improves the existing `app/public/live2d/viewer.html` in place. It does not introduce a second avatar runtime or alter the versioned `kurisu_embodiment_intent` protocol.

## Changes

- Pixi starts with `autoStart: false`; the model is not continuously rendered while its assets are still loading.
- The viewer now applies a real ticker `maxFPS` budget: 14 FPS at idle, 30 FPS when speaking, gesturing, or above the existing high-affect threshold. Previously the callback skipped parameter updates but the Pixi ticker/render loop itself could still run at its default rate.
- The browser `visibilitychange` lifecycle calls `app.stop()` while the viewer is hidden and resumes with `app.start()` when visible. On resume it recalculates the budget from the latest embodiment state.
- The focused Live2D test retains the expression-transition cache regression and adds deterministic checks for idle/active frame caps and hidden/visible lifecycle transitions.
- The app's normal `test` and `test:scripts` commands now include the Live2D and embodiment-timeline suites. A Node.js 24 workflow runs those checks and app typecheck on relevant changes.

## Expected effect

Idle rendering avoids unnecessary CPU/GPU work instead of only throttling custom calculations. During speech or meaningful movement, the viewer can render at 30 FPS. Hidden tabs stop the private Pixi application loop and resume without creating a second runtime or clock.

## Validation boundary

Source changes and regression cases are committed. The focused test uses a deterministic VM harness and does not render the real Cubism model or produce audio. The added workflow is intended to validate the new branch head; until a successful Actions run is observed for its exact commit SHA, CI is **pending**, not passed. Real browser/Playwright Live2D rendering, real speech and RU/EN timing measurements remain separate release gates.

## Upstream API basis

PixiJS documents `Ticker.maxFPS` as the mechanism for limiting ticker frequency and `Application.start()/stop()` as controls for resuming and pausing automatic rendering:
- https://pixijs.download/v6.3.1/docs/PIXI.Ticker.html
- https://pixijs.download/v6.3.1/docs/PIXI.Application.html
