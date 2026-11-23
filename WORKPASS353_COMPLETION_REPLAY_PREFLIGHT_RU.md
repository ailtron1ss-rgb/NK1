# NK1 WorkPass353 — идемпотентность завершения и preflight цикла

**Дата:** 2026-10-26  
**Рабочая ветка:** `workpass353-completion-replay-preflight`  
**База:** `workpass352-stale-decision-replay-guard`  
**Статус:** код и регрессии добавлены; exact-head CI ожидается до окончательного статуса.

## Найденные дефекты

### 1. Повтор завершения без timestamp сам вызывал конфликт

`CanonicalCognitiveKernel.completeCycle()` преобразовывал пропущенный `at` в `Date.now()` до проверки имеющегося завершения. Повтор того же завершения без `at` получал новое время, а timestamp входит в fingerprint стабильного события. Поэтому валидный retry мог отклоняться как изменение данных, хотя outcome, learning и self-update были прежними.

Исправление: если `at` отсутствует и outcome с тем же стабильным ID уже сохранён, для повторного запроса используется timestamp исходного outcome. Явно переданное время по-прежнему проходит проверку и является частью event identity.

### 2. Исчерпанный счётчик мог оставить частичное завершение

`UnifiedCognitiveCycle.evaluate()` отвергает состояние с `cycles >= Number.MAX_SAFE_INTEGER`. До исправления этот guard срабатывал уже после того, как kernel добавил три события: outcome, learning и self-update. Валидный, но исчерпанный persisted-счётчик поэтому мог оставить ledger с новыми completion-записями, хотя цикл не был финализирован.

Исправление: `UnifiedCognitiveCycle.assertCanAdvance(tick)` предварительно проверяет безопасный monotonic tick и наличие места в счётчике. `completeCycle()` вызывает его до первой completion-записи.

## Регрессии

- Retry завершения без `at`: повтор получает `replayed=true`, сохраняет исходный timestamp и не меняет число событий или snapshot цикла.
- Счётчик восстановлен на `Number.MAX_SAFE_INTEGER`: завершение отклоняется до записи outcome/learning/self-update; число событий, все три ID и cycle snapshot остаются неизменными.
- Добавлена команда для локального запуска контракта: `npm run test:canonical-cognitive-kernel`.
- Существующая unified cognitive kernel workflow включает `UnifiedCognitiveCycle.ts`, `CanonicalCognitiveKernel.ts` и тест; она также запускает runtime typecheck, canonical kernel, live wiring, smoke, autonomy, autonomous initiative clock и restart persistence.

## Изменённые файлы

- `runtime/neuro-kurisu/src/organism/system/UnifiedCognitiveCycle.ts` — commit `b46e290`.
- `runtime/neuro-kurisu/src/organism/core/CanonicalCognitiveKernel.ts` — commit `8bbbd76`.
- `runtime/neuro-kurisu/tests/canonical-cognitive-kernel.mjs` — commits `9af57f4` и `39fb7ef`.
- `runtime/neuro-kurisu/package.json` — commit `cbda236`.
- `CHANGELOG.md` — commit `126c75d`.

## Проверка и границы заявления

Exact-head GitHub Actions необходимо проверить на актуальном PR-head. До завершения запуска проход не считается CI-validated; локальный запуск runtime в этой среде не заявляется.

Изменения остаются в feature branch/PR: `main` не изменён, Release ZIP не пересобирался и не публиковался. Это исправление целостности replay/finalization, а не доказательство прироста интеллекта, обучения или готовности релиза.
