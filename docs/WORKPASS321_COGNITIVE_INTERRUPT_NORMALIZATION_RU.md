# WorkPass321 — нормализация критических прерываний когнитивного цикла

**Дата:** 2026-10-25  
**Рабочая ветка:** `fix/cognitive-interrupt-severity-normalization-2026-10-25`  
**База:** `work/node24-project-pin-rebased-20261025`  
**Кодовой checkpoint:** `84cf83ef97ebcd631cb0e6e6c19dbc62ea17b032`

## Исправленный дефект

В `CognitiveRoutingPolicy` критические типы `thermal-critical`, `resource-critical` и `memory-pressure` ранее сравнивались с исходной строкой с учётом регистра. В активном прерывании с приоритетом ниже 0.90 строка `RESOURCE-CRITICAL` могла попасть в обычную ветку `active-interrupt` и получить одну спекулятивную ветвь вместо нуля.

Теперь политика нормализует label: trim + lowercase; пустой label становится `none`. Нормализация добавлена и в `CognitiveDependencyGraph`, чтобы сохранённое/восстановленное состояние имело единый канонический формат. Существующая граница полномочий сохранена: политика только сокращает upstream-бюджет, не назначает действие и не увеличивает разрешённое число ветвей.

## Изменения

- `runtime/neuro-kurisu/src/organism/core/CognitiveRoutingPolicy.ts` — регистронезависимая fail-closed классификация критических прерываний.
- `runtime/neuro-kurisu/src/organism/core/CognitiveDependencyGraph.ts` — канонизация типа прерывания при входе/восстановлении.
- `runtime/neuro-kurisu/tests/cognitive-routing-policy.mjs` — регрессии для `THERMAL-CRITICAL`, `Resource-Critical`, `MEMORY-PRESSURE` с priority=0.84.
- `runtime/neuro-kurisu/tests/cognitive-dependency-graph-workpass320.mjs` — регрессия нормализации восстановленного `RESOURCE-CRITICAL`.
- `runtime/neuro-kurisu/package.json` — существующий тест восстановления dependency graph включён в `test:cognitive-integration-suite`; ранее этот самостоятельный тест был зарегистрирован, но композитный gate его не запускал.
- `CHANGELOG.md` и этот handover обновлены.

## Проверка

**Статус тестов в этом проходе: НЕ ЗАПУЩЕНЫ.** Код сохранён в GitHub, но из доступной среды нельзя выполнить полный clean install или считать удалённый CI завершённым. Наличие регрессий — это реализация проверок, не доказательство, что они прошли.

После доступного runner следует выполнить:

```sh
npm ci --prefix runtime/neuro-kurisu
npm --prefix runtime/neuro-kurisu run test:cognitive-routing-policy
npm --prefix runtime/neuro-kurisu run test:p320:cognitive-dependency-restore
npm --prefix runtime/neuro-kurisu run test:cognitive-integration-suite
```

Сначала проверить, что job получил runner и реально исполнил шаги; job без шагов не подтверждает ни успех, ни провал тестов.

## Release gates, которые остаются открытыми

Это точечное исправление когнитивной маршрутизации, **не завершение проекта и не production-релиз**. Нужны подтверждённые typecheck/build и интеграционные тесты, тесты реального UI/Live2D/TTS и Android/Termux, измерение retrieval/learning на независимом holdout, длительный soak и полный license review. Никаких выводов о сознании или общем интеллектуальном превосходстве по этому исправлению не делается.
