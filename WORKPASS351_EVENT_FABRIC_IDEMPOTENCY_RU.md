# NK1 WorkPass351 — целостность повторного использования ID причинных событий

**Дата:** 2026-10-26  
**Рабочая ветка:** `workpass351-event-fabric-idempotency`  
**База:** `workpass350-kernel-completion-integrity`  
**Статус:** исправление и регрессии сохранены; exact-head CI ожидает выполнения.

## Обнаруженный дефект

`CognitiveEventFabric.append()` считал событие повтором, если уже существовал тот же `id`, `tick`, `stage` и `source`. При этом он возвращал прежнее событие и игнорировал изменения `payload`, `parentIds`, `external`, `confidence01` и `at`. В итоге другой результат инструмента или иной причинный родитель мог быть принят как повтор уже зарегистрированного события, и конфликт свидетельств скрывался.

Это особенно опасно для единого когнитивного журнала: ID события является ключом replay-guard. Если ключ тот же, но содержание решения/результата иная, нельзя молча вернуть старую запись.

## Изменения

1. **Полный envelope fingerprint.** Повтор stable ID сравнивает нормализованные поля события: tick, timestamp, stage, source, causal parent IDs, external flag, confidence и payload. Любое различие вызывает `cognitive-event-id-conflict` до изменения состояния.
2. **Семантическая JSON-эквивалентность.** Объекты с одинаковым содержимым, но разным порядком ключей payload считаются одинаковым повтором благодаря стабильному JSON-хэшу.
3. **Сохранение идемпотентности.** Если вызывающий код не передал конечный `at`, повтор проверяется против исходного timestamp, а не против нового `Date.now()`. Явно переданный другой конечный timestamp считается конфликтом.
4. **Без мутации при конфликте.** Тесты проверяют, что конфликтующий replay не увеличивает счётчик журнала и не заменяет исходное событие.
5. **Регрессионный тест в существующем kernel-сценарии.** Проверяются другой payload, порядок/состав parent IDs, `external`, confidence, timestamp, stage, source и tick; корректный payload с другим порядком ключей должен остаться идемпотентным.

## Изменённые файлы

- `runtime/neuro-kurisu/src/organism/system/CognitiveEventFabric.ts` — [1bc46f7](https://github.com/ailtron1ss-rgb/NK1/commit/1bc46f79715d47b5215fa4d47e10ba9698ef84df): сравнение полного envelope перед возвратом существующего события.
- `runtime/neuro-kurisu/tests/canonical-cognitive-kernel.mjs` — [c476afb](https://github.com/ailtron1ss-rgb/NK1/commit/c476afb36eeaf15575b1e408059a38da5315506c): regressions на переиспользование event ID.
- `CHANGELOG.md` — [39b0f7e](https://github.com/ailtron1ss-rgb/NK1/commit/39b0f7eea9815cc278f94e56883df98e4c43066a): checkpoint и validation boundary.

## Проверки

Существующий `.github/workflows/workpass331-unified-cognitive-kernel.yml` уже запускается при изменениях `CognitiveEventFabric.ts` и `canonical-cognitive-kernel.mjs` на push и pull request. Он выполняет runtime typecheck и основной canonical-kernel тест вместе с live Core, smoke, автономностью и restart-проверками; добавлять второй workflow или новую зависимость не требуется.

После создания PR требуется дождаться exact-head workflow. До его завершения изменения не считаются validated.

## Команды локальной проверки

```bash
cd runtime/neuro-kurisu
npm run typecheck
node --experimental-strip-types tests/canonical-cognitive-kernel.mjs
node --experimental-strip-types tests/canonical-cognitive-kernel-runtime-wiring.mjs
npm run test:smoke
npm run test:restart
```

## Граница выпуска

- Изменения находятся в `workpass351-event-fabric-idempotency`, поверх отдельного WorkPass350 checkpoint.
- `main` не изменён.
- Опубликованный release ZIP не пересобирался и не публиковался.
- Не заявляется улучшение retrieval/learning metrics или production-ready статус; этот проход устраняет конкретную ошибку целостности причинного журнала.
