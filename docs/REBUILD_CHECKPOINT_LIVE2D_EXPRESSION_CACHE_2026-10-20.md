# Rebuild checkpoint — Live2D expression transition cache

Date: 2026-10-20  
Island: embodiment  
Finding origin: WorkPass94 avatar/voice/Live2D audit  
Status: code committed; exact-head CI pending

## Change

`app/public/live2d/viewer.html` now remembers the last successfully applied Live2D expression. `applyExpression` returns when the mapped expression is unchanged, preventing each accepted mouth/gaze intent from re-triggering the same model expression during speech.

## Regression

Run from repository root:

```sh
node app/scripts/test-live2d-expression-cache.mjs
```

Expected output:

```
NK1_LIVE2D_EXPRESSION_CACHE=PASS transitions=2 duplicateResets=0
```

The test executes the extracted production expression-applier function with a controlled model double and verifies duplicate suppression, including two intents that map to the same expression.

The test is wired into `.github/workflows/workpass79-cognitive-regression.yml` on branch `rebuild`.

## Evidence boundary

This test verifies expression-call deduplication only. It does not establish actual browser rendering, audio/lip synchronization, Android speech behavior, asset hydration, or target-device performance.

## Files

- `app/public/live2d/viewer.html`
- `app/scripts/test-live2d-expression-cache.mjs`
- `.github/workflows/workpass79-cognitive-regression.yml`
- `CHANGELOG.md`

## Next embodiment gates

1. Confirm exact-head CI for this regression.
2. Make `LegacySpriteDeck` localStorage reads/writes fail-safe without changing the outfit default.
3. Trace browser TTS and Android/Termux speech cancellation/status into one correlation contract; preserve provider-specific evidence.
4. Add browser-level tests for iframe remount, visibility changes, stale messages and asset hydration before claiming avatar readiness.
