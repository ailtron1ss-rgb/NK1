# v20 — Gemini models + Live2D visible + download progress

## Gemini "not available for new users"
Default was `gemini-2.5-flash` — often blocked for new AI Studio keys.
- Default now: `gemini-2.0-flash`
- Model dropdown + manual id
- "Проверить ключ (автоподбор)" tries fallbacks
- "Запросить список моделей" uses listModels API
- chatService.callGemini auto-falls back 2.0 → lite → 1.5 → flash-latest

## API keys
Never hardcode user keys in the repo. Keys only in localStorage via ProviderKeysPanel.

## Live2D empty avatar
- Root: cubism2 build of pixi-live2d-display cannot load moc3
- Fix: cubism4.min.js + live2dcubismcore + **texture_00.png always shown** as fallback
- Status badge: LIVE2D / TEXTURE / LOADING

## Local download UX
- progress_callback → percent bar + file name
- ensureLoaded returns boolean; UI refreshes via getStatus()

## Maintainer
Grok (xAI) — Termux mid-range Android first.
