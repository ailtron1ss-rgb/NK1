# Level 1 Core Upgrade (v4.0)

## Сделано

1. `memoryEngine.retrieveRanked()` — score = overlap + recency + emotion + priority + access
2. `contextPacket.ts` — единый плотный промпт на каждый ход
3. `critiqueAndFix()` — пост-обработка ответа без второго LLM
4. Удалён `@tensorflow/tfjs` (не использовался для генерации)
5. Avatar2D adaptive FPS (idle/speak)

## Зачем

Одинаковая модель + лучший контекст ≈ заметно умнее ответы.
Меньше мёртвого кода ≈ стабильнее Termux и меньше нагрев.
