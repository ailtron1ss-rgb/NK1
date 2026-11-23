# NK1 WorkPass351 — целостность повторного использования ID причинных событий

**Дата:** 2026-10-26  
**Рабочая ветка:** `workpass351-event-fabric-idempotency`  
**База:** `workpass350-kernel-completion-integrity`  
**Статус:** исправление и регрессии сохранены; exact-head CI ещё не завершён.

## Обнаруженный дефект

`CognitiveEventFabric.append()` считал событие повтором, если уже существовали те же `id`, `tick`, `stage` и `source`. При этом он возвращал прежнее событие, даже если отличались `payload`, `parentIds`, `external`, `confidence01` или `at`. Это могло превратить новый результат инструмента или другое причинное происхождение в «успешный повтор» уже зарегистрированного свидетельства.

Дополнительно payload копировался только поверхностно. Изменение вложенного объекта у вызывающего кода могло изменить уже сохранённое событие в памяти. Ошибка клонирования/сериализации после начала записи также способна оставить частичное состояние.

## Что изменено

1. **Полный event-envelope fingerprint.** Повтор stable ID сравнивает нормализованные поля: tick, timestamp, stage, source, causal parent IDs, external flag, confidence и payload. Любое различие вызывает `cognitive-event-id-conflict` до изменения состояния.
2. **Семантическая JSON-эквивалентность.** Объекты с одинаковым содержимым, но разным порядком ключей payload считаются одинаковым replay благодаря стабильному JSON-хэшу.
3. **Корректный replay timestamp.** Если вызывающий код не передал конечный `at`, повтор проверяется против исходного timestamp, а не нового `Date.now()`. Явно переданный другой конечный timestamp считается конфликтом.
4. **Изоляция payload.** Перед проверкой replay и до первой мутации payload копируется через `structuredClone`; stable serializer заранее проверяет циклическую структуру и сериализуемость. Вложенные данные больше не разделяют изменяемую ссылку с объектом вызывающего кода или возвращённым событием.
5. **Accessors не исполняются на верхнем уровне.** Проекция payload читает только собственные data descriptors; верхнеуровневые getter-поля пропускаются без вызова.
6. **Регрессии.** В расширенный `tests/canonical-cognitive-kernel.mjs` добавлены конфликты payload, порядка/состава parent IDs, external, confidence, timestamp, stage, source и tick; успешный replay при перестановке JSON-ключей; изоляция вложенного payload; отклонение cyclic payload без мутации; тест на неисполнение top-level getter.

## Изменённые файлы

- `runtime/neuro-kurisu/src/organism/system/CognitiveEventFabric.ts` — [1bc46f7](https://github.com/ailtron1ss-rgb/NK1/commit/1bc46f79715d47b5215fa4d47e10ba9698ef84df): полный fingerprint стабильного ID; [a408782](https://github.com/ailtron1ss-rgb/NK1/commit/a4087829b24c023a6402c08bf0e4b23d204a33da): payload detachment и preflight.
- `runtime/neuro-kurisu/tests/canonical-cognitive-kernel.mjs` — [c476afb](https://github.com/ailtron1ss-rgb/NK1/commit/c476afb36eeaf15575b1e408059a38da5315506c): конфликты stable ID; [40199ef](https://github.com/ailtron1ss-rgb/NK1/commit/40199efddaf7d284fe00ae06e6ef659c64ea8440): isolation/accessor/cyclic payload regressions.
- `CHANGELOG.md` — [97774df](https://github.com/ailtron1ss-rgb/NK1/commit/97774dfac278af5c578ced2c72f006e76be6a211): checkpoint и границы проверки.

## CI и команды проверки

Существующий `.github/workflows/workpass331-unified-cognitive-kernel.yml` уже включает `CognitiveEventFabric.ts` и `canonical-cognitive-kernel.mjs` в push/PR path filters и выполняет runtime typecheck, canonical kernel contract, live Core, smoke, autonomous action selection, background initiative и restart persistence. Новая зависимость и второй тестовый framework не добавлялись.

Первый exact-head запуск обнаружил ошибку в regex-проверке event ID: в переписанном методе control-character escape оказался экранирован дважды, поэтому kernel event ID ошибочно отклонялся. Regex исправлен коммитом [d33a975](https://github.com/ailtron1ss-rgb/NK1/commit/d33a975f05e0963e60991f3e82ba5a318ce5da21). Требуется повторный exact-head workflow; до него исправление не считается validated.

```bash
cd runtime/neuro-kurisu
npm run typecheck
node --experimental-strip-types tests/canonical-cognitive-kernel.mjs
node --experimental-strip-types tests/canonical-cognitive-kernel-runtime-wiring.mjs
npm run test:smoke
npm run test:restart
```

## Граница выпуска

- Изменения находятся в `workpass351-event-fabric-idempotency`; Draft PR #164 основан на WorkPass350, который прошёл свой exact-head CI.
- `main` не изменён.
- Опубликованный Release ZIP не пересобирался и не публиковался.
- Не заявляется рост retrieval/learning metrics, общая интеллектуальная эффективность или production-ready статус; этот проход исправляет конкретные нарушения целостности причинного журнала.
