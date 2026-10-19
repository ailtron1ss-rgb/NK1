# Курису v21 — живость, токены, голос

## Исправлено
- Ответы только `*вздох*` / `*скрещивает руки*`: промпт + `responseHygiene` (речь обязательна, действия — гарнир)
- TTS читает только речь, не `*действия*`
- Переключатель голоса и мыслей; push-to-talk (🎤) через Web Speech API
- Счётчик токенов (оценка) + автопереключение облака → другое облако → local с уведомлением
- Чат сохраняется в localStorage (`kurisu_chat_v1`)
- Убран упор на outfit UI; без RPG-локаций в промпте

## Не встроено в ZIP (ограничение телефона)
- Полная локальная LLM в архиве = сотни МБ; по-прежнему скачивание HF по кнопке
- Полный Live2D rig 20 blendshapes без runtime — texture + Live2D best-effort
- APK: по-прежнему PWA через Termux+браузер

## Файлы
- `src/services/responseHygiene.ts`, `tokenMeter.ts`
- `src/components/TokenStatusBar.tsx`, `VoiceControls.tsx`
- промпт в `contextPacket.ts`, cloud switch в `chatService.ts`
