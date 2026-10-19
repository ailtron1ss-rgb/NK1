# Level 2 — Brain Architecture

## Новые файлы
- src/brain/intentRouter.ts — классификация намерения <1ms
- src/brain/modelManager.ts — каталог локальных моделей
- src/brain/BrainOrchestrator.ts — единый такт отделов

## Маршрутизация
science → cloud_strong
emotional → cloud_fast
offline+neural → neural
command → template
fallback chain: cloud → neural → template

## Эффективность
Sparse activation: тяжёлая работа только по intent.
Одна loaded local model (не три сразу).
Ranked memory + critique из Level 1 сохранены.
