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

## Validation

- Exact code/test/workflow head: `6b36e6aa6c8bd6a37122b60ab977e0ed4d7e3d52`. GitHub Actions run [40129428404](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40129428404) **passed**.
- Asset sync and manifest gate passed with `manifest=24 hydrated=24 qualityRefs=13 mobileRefs=13`, including all three vendor SDK files verified by byte size and SHA-256.
- App viewer Chromium smoke passed: mobile canvas `760x840` / 68,469 bright pixels; quality `760x840` / 68,520 bright pixels.
- Runtime viewer Chromium smoke passed: mobile canvas `760x840` / 68,475 bright pixels; quality `760x840` / 68,516 bright pixels. The end-to-end avatar fixture confirmed `snapshot→emotion→motion→lipsync`.
- Runtime integrity and presentation mapping passed (`LIVE2D_INTEGRITY=PASS`, `AVATAR_STATE_MAPPING=PASS`). Embodiment timeline tests: 14 passed, 0 failed. Expression/render budget check and TypeScript typecheck passed.
- Branch later advanced through report/CHANGELOG commits; the tested runtime, test and workflow source SHA remains `6b36e6a...`.
- Still not proved: physical audio output, acoustic/phoneme-level lip-sync, Android/Termux hardware TTS/STT, long-session stability, or performance on the target phone.
