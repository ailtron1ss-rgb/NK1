# WorkPass99 — runtime Live2D wiring and local SDK ownership
Date: 2026-10-24

## Implemented

### Actual organism state reaches the avatar

- Rewired `runtime/neuro-kurisu/public/avatar.html` from the asset-only `/api/organism/avatar` endpoint to the existing `/api/organism/ui-snapshot` endpoint, whose response actually contains `awake`, `state.lastAction`, `emotion`, `voice`, and `tick`.
- Added `public/avatar-state.mjs`, a small normalization boundary between the runtime snapshot and the older iframe's message protocol. It bounds numeric channels, maps known emotions into available model expressions, maps cognitive actions into available motion groups, and derives lip-sync amplitude from the actual voice-speaking flag.
- Removed the redundant status-lite polling loop; tick and avatar presentation now come from the same UI snapshot request. Concurrent refreshes are coalesced.

### Local model runtime and viewer safety

- Made `runtime/neuro-kurisu/public/live2d/vendor/` the canonical owner of the three SDK bundles already used by the app: Pixi, Cubism Core, and the Pixi Live2D display adapter. Added byte-size and SHA-256 entries to `contracts/inventory/canonical-public-assets-workpass42.json`; the existing `app/public/live2d/vendor/` files remain manifest-verified hydrated shadows.
- Changed the runtime viewer to load those local files and removed CDN script loading from its boot path.
- Added expression transition caching, 14 FPS idle / 30 FPS active ticker budgets, pause/resume on document visibility, and parent-window/source validation.
- Legacy embodiment messages are type-checked. Numeric values must be finite, expression names and motion groups are allow-listed, and malformed payloads cannot reach the model as arbitrary coerced values.

## Regression coverage

- `runtime/neuro-kurisu/tests/avatar-state-mapping.mjs` covers action/emotion routing, speech-driven motion and lip-sync, invalid snapshots, fallback action/emotion, and bounded values.
- `runtime/neuro-kurisu/tests/live2d-integrity.mjs` now verifies local pinned scripts, no CDN boot references, visibility lifecycle, parent-only messaging, and the actual avatar-snapshot wiring.
- `app/scripts/test-live2d-runtime-browser.mjs` boots the runtime viewer in Chromium for both `mobile` and `quality` profiles, checks visible canvas output and local-resource responses, sends expression/body/lip-sync intents, then opens the real `avatar.html` against a deterministic UI-snapshot fixture and verifies snapshot → expression → motion → lip-sync.
- The focused Node.js 24 workflow now runs the runtime browser smoke and the runtime's `test:live2d` command alongside the app viewer gates.

## Validation status at report creation

The source, contract tests, workflow integration, and script registration are committed by head `6b36e6aa6c8bd6a37122b60ab977e0ed4d7e3d52`. The exact-head GitHub Actions run is [40129428404](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40129428404), queued when this report was authored. Do not infer a pass until the workflow finishes.

This pass proves runtime wiring only if the browser test passes. It does not prove physical audio output, acoustic-phoneme timing, Android/Termux hardware capability, long-session stability, or performance on the target phone.
