# NK1 WorkPass352 — защита от повторного создания устаревшего решения

**Дата:** 2026-10-26  
**Рабочая ветка:** `workpass352-stale-decision-replay-guard`  
**База:** `workpass351-event-fabric-idempotency`  
**Статус:** изменения закоммичены; exact-head CI ещё не завершён.

## Причина

`CanonicalCognitiveKernel.beginDecisionCycle()` проверял стабильные ID уже имеющихся событий, но не учитывал, что монотонный `UnifiedCognitiveCycle` мог продвинуться далеко вперёд. Пока события старого тика были в ограниченном буфере `CognitiveEventFabric`, повтор возвращал их идемпотентно. Когда буфер вытеснял эти записи, тот же вызов видел отсутствующие ID и мог заново добавить восемь stage-событий завершённого тика — хотя сам реестр циклов уже его финализировал.

Это нарушает непрерывность причинного журнала: старое действие выглядит как новая запись после потери исходного evidence.

## Исправления

1. **Монотонный watermark.** Kernel читает `UnifiedCognitiveCycle.snapshot().lastTick` перед записью. Если входной тик `<= lastTick`, он может быть возвращён только как read-only replay, когда все восемь canonical stage-событий доступны и совпадают по fingerprint.
2. **Fail-closed при retention eviction.** Если хотя бы один stage старого/финализированного тика отсутствует в текущем буфере, kernel выбрасывает `canonical-cognitive-kernel-stale-decision` до первой записи. Вытесненные события не «воскрешаются».
3. **Идемпотентный timestamp.** Когда повторный `beginDecisionCycle()` не содержит `at`, kernel использует timestamp уже сохранённого observation event для того же logical tick. Это предотвращает ложный fingerprint-конфликт только из-за того, что повтор поступил позже.
4. **Регрессия с настоящим eviction.** Тест создаёт решение и завершает цикл, повторяет решение с пропущенным `at`, затем заполняет буфер 140 событиями, чтобы удалить старые stage-записи. Повтор старого решения должен получить stale-decision и не менять total/не восстанавливать прежний observation ID.

## Изменённые файлы и коммиты

- `runtime/neuro-kurisu/src/organism/core/CanonicalCognitiveKernel.ts` — [f7db812](https://github.com/ailtron1ss-rgb/NK1/commit/f7db8120dea2878725f8fa2f97fbf3d021ae2ad9): guard монотонного watermark и replay timestamp.
- `runtime/neuro-kurisu/tests/canonical-cognitive-kernel.mjs` — [f378ed1](https://github.com/ailtron1ss-rgb/NK1/commit/f378ed186e4dfadbda79c5edd3fd7e7fa65cb3ba) и [d5346fd](https://github.com/ailtron1ss-rgb/NK1/commit/d5346fd16db27ec888d7e196f2895803cd4aa8fd): retention eviction regression и monotonic test timestamp.
- `CHANGELOG.md` — [f963606](https://github.com/ailtron1ss-rgb/NK1/commit/f963606f6623135faeae66bace34f51523d5966e): checkpoint.

## Проверки

Рабочий workflow `.github/workflows/workpass331-unified-cognitive-kernel.yml` уже запускает full runtime typecheck, canonical kernel regression, live runtime wiring, smoke, автономный выбор действий, background initiative и restart persistence при изменении файлов этого прохода.

Exact-head runtime checks ещё не подтверждены. После создания Draft PR нужно проверить фактический результат workflow; наличие теста в файле не считается PASS.

```bash
cd runtime/neuro-kurisu
npm run typecheck
node --experimental-strip-types tests/canonical-cognitive-kernel.mjs
node --experimental-strip-types tests/canonical-cognitive-kernel-runtime-wiring.mjs
npm run test:smoke
npm run test:autonomy
npm run test:restart
```

## Граница выпуска

- WorkPass352 расположен поверх WorkPass351 PR #164; merge должен идти в порядке зависимостей.
- `main` не изменён.
- Release ZIP не пересобирался и не публиковался.
- Не заявляется рост общего интеллекта или обучаемости: этот проход обеспечивает согласованность идентичности решений и монотонного цикла при ограниченной истории.
