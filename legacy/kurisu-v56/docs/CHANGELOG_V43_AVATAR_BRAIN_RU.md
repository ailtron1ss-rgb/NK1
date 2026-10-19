# v43 — Аватар, touch, lip-sync, ответы «кто ты»

## Проблемы со скриншотов
- Лицо/голова «пустая» → текстура всегда под Live2D, object-fit contain
- Нет реакции на касания → зоны head/face/coat/hand + handleTouchBodyPart
- Губы не двигаются → postMessage kurisu_lipsync + ParamMouthOpenY pulse при TTS
- «Кто ты» / «Ты живая?» → шаблоны identity_* вместо «Принято…»
- Gemini error → cascade начинается с gemini-2.0-flash

## Файлы
- src/components/Live2DAvatar.tsx
- public/live2d/viewer.html
- src/services/localLLMEngine.ts
- src/services/chatService.ts / providerConfig.ts
- App.tsx onTouchBodyPart
