# v19 — Live2D + Cloud keys + Local download (Grok)

## Root causes of "can't start"

1. **No UI to enter API keys** — providers existed in localStorage code but Settings never exposed inputs.
   - Fix: `ProviderKeysPanel` on **Settings → Плагины**.
2. **Local model only loaded on first chat** — enabling switch did not call `load()`.
   - Fix: `ensureLoaded()` + button **«Скачать / загрузить модель сейчас»** + progress via `kurisu-neural-progress`.
3. **Sprites vs Live2D** — user provided Cubism3 Kurisu; sprites removed as primary.
   - Assets: `public/live2d/Kurisu/`
   - Viewer: `public/live2d/viewer.html` (Pixi + Cubism core + pixi-live2d-display CDN)
   - Component: `Live2DAvatar` iframe host

## Still required from user

- Internet for CDN (Live2D runtime + Transformers.js + HF model weights)
- Valid Gemini/Groq/OpenRouter key **or** local model download (100–600MB+)
- Node LTS in Termux as before

## Integrity

- Do not remove ProviderKeysPanel from plugins tab
- Do not load neural without ensureLoaded on user action
- Live2D needs network first time for CDN scripts
