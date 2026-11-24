# v49 — Разум и диалог

## Проверка
- 0 missing imports, 0 brace mismatch

## Улучшения диалога / разума
1. **dialogueReasoner** — intent + must-address + entities → в system prompt каждый ход
2. **critiqueAndFix** усилен: анти-«ИИ», анти-«Принято» на вопросах, анти-только-*жест*, лимит спама действий
3. **STM** −5 → **−10** реплик в контексте
4. **replyMemory** — блок «не повторяй дословно» + учёт в finalizeText
5. **pickSmartFallback** — умнее при сбое канала
6. **Offline defaults** — без «Принято», больше запроса смысла

## Связка
planDialogue → contextPacket → LLM
critiqueAndFix + replyMemory → finalizeText
