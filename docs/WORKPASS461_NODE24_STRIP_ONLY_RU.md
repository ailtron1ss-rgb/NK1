# WorkPass461 — исправление совместимости с Node.js 24

**Дата:** 2026-10-27  
**Ветка:** `fix/node24-strip-only-shadow-registry-2026-10-27`  
**Статус:** реализация и CI-подключение внесены; результаты проверки текущего PR ещё не подтверждены.

## Проблема

Запуск runtime-тестов через `node --experimental-strip-types` в Node.js 24 завершался на синтаксисе TypeScript parameter property в `TrustedSkillShadowRunRegistry.ts`. Strip-only режим удаляет типы, но не преобразует этот вид синтаксиса в обычное присваивание поля.

## Исправление

- Объявлены обычные поля `filePath` и `lockPath`.
- Конструктор принимает `filePath` и явно присваивает `this.filePath = filePath`.
- Добавлен `tests/workpass461-node24-strip-only-shadow-registry.mjs`, который импортирует реальный runtime-модуль и проверяет сохранение контракта на пустом пути.
- Тест включён в `.github/workflows/workpass71-validation.yml` до широких регрессионных проверок, чтобы обнаруживать подобную несовместимость раньше.

## Критерий приёмки

PR должен пройти новый целевой тест, обязательные проверки WorkPass71 и связанные runtime typecheck/regression jobs на точном HEAD. Изменение не доказывает улучшение retrieval или обучения и само по себе не закрывает production readiness.

`main` и опубликованный Release ZIP не изменялись.
