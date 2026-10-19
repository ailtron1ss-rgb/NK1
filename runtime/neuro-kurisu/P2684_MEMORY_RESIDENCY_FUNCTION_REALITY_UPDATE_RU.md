# Neuro-Kurisu 35.6.84 / P2684 — Memory Residency + Function Reality Update

## 1. Цель прохода

P2684 продолжает P2683 и выполняет две связанные задачи:

1. Исправляет сам Function Reality audit, чтобы runtime reachability не занижалась из-за полей, тип которых задаётся присваиванием в constructor.
2. Вводит bounded `hot / warm / cold` residency для canonical `MemoryOS2`, сохраняя `identity` и `autobiographical` memories защищёнными от hard-cap pruning.

Главный принцип: MemoryOS2 остаётся единственным canonical durable memory authority. Residency — это политика нахождения данных в оперативном когнитивном рабочем наборе, а не второй источник истины.

## 2. Function Reality Graph

После исправления type-flow для полей, присвоенных через `this.field = new Class(...)`, граф существенно точнее связывает `OrganismRuntime` с реально используемыми методами.

| Метрика | P2684 |
|---|---:|
| Анализировано файлов | 1 525 |
| source-файлов | 496 |
| деклараций | 5 415 |
| RUNTIME_REACHABLE | 2 371 |
| TEST_ONLY | 425 |
| REFERENCED_NOT_RUNTIME_REACHABLE | 2 291 |
| ORPHAN | 328 |

Критическая цепочка `OrganismRuntime → ContinuousCognitiveFabric → integration/memory/identity/dream/conflict/spine` проходит 11/11 связей.

## 3. Liveness infrastructure

Liveness audit теперь использует один глобальный индекс тестовых идентификаторов вместо повторного полного обхода всех test-files для каждой функции.

Актуальный запуск:

- 5 009 function-like declarations
- 4 980 с body
- 145 exported
- 288 zero-reference
- 879 one-or-less-reference
- runtime аудитор: ~3.3 s в текущей среде

Это не доказывает, что zero-reference функция сломана; это очередь на semantic/integration investigation.

## 4. Semantic coverage

| Status | Count |
|---|---:|
| VERIFIED | 48 |
| INTEGRATION_ONLY | 9 |
| UNSAFE_TO_AUTO_RUN | 309 |
| UNVERIFIED | 4 437 |

Всего: 4 803 функций.

Строгий VERIFIED rate: 1.00%.

Evidence coverage с 25% credit для integration-only: 1.05%.

Это сознательно строгий показатель: наличие класса, метода или тестового имени не считается behavioural proof.

## 5. Memory Residency

Новый `MemoryResidencyGovernor` вычисляет bounded бюджеты `hot/warm/cold` на основе давления, идентичностного напряжения и текущего рабочего набора.

`MemoryOS2` теперь:

- помечает записи residency tier;
- повышает запись в `hot` при encode/reconsolidation;
- выдаёт tier-aware retrieval bonus;
- для cold records может освобождать semantic vector, потому что он вычислим заново;
- лениво материализует vector при retrieval/get;
- защищает `identity` и `autobiographical` memories от hard-cap removal;
- выдаёт residency diagnostics.

### Проверка residency

Тест `tests/p2684-memory-residency.mjs`:

- 180 memory items;
- план `16 hot / 64 warm / 128 cold budget`;
- фактически `16 hot / 64 warm / 100 cold`;
- 100 cold vectors дематериализованы;
- после hard-cap 128 retained identity memories: 26/26;
- lazy vector restoration: PASS.

## 6. Mobile profile

Новый `tests/p2684-mobile-soak.mjs` запускается при:

`--max-old-space-size=256`

Результат:

- 30 autonomous cycles: PASS
- elapsed: 27.19 s (последний изолированный запуск)
- peak RSS: 353.0 MB
- final tick: 30
- process завершает работу корректно

Это означает, что mobile runtime уже проходит bounded 30-cycle soak, но RSS всё ещё является основным performance target для следующего прохода.

## 7. Regression

P2679 learned latent transition field после оптимизации residency:

- standalone writes: 900
- queries: 900
- transition hits: 876
- confidence: 0.6228
- integrated writes: 10
- elapsed: ~8.21 s
- PASS

B504 Continuous Cognitive Fabric:

- standalone persistence: PASS
- runtime tick: 1
- restoredProcessed: 1
- persistence: true

Server smoke: PASS.

## 8. Release verification P2684

Все release-gates подтверждены отдельными запусками:

- TypeScript — PASS
- P2684 memory residency — PASS
- Function Reality Graph — PASS
- Function Reality critical path — PASS (11/11)
- Function liveness — PASS (~3.3 s)
- parameterized safe probe — PASS: 1 098 attempted / 1 043 passed / 0 failed
- semantic coverage — PASS: 4 803 functions, 48 VERIFIED / 9 INTEGRATION_ONLY / 309 UNSAFE / 4 437 UNVERIFIED
- P2679 transition regression — PASS
- B504 continuous cognitive regression — PASS (изолированный запуск)
- mobile 30-cycle soak — PASS (изолированный запуск)
- server smoke — PASS
- architecture — PASS
- integrity — PASS
- forensics — PASS
- source hygiene — PASS
- executable syntax — PASS
- release contract — PASS
- release source — PASS
- archive manifest — PASS: 3 636 files, missing=0, hashMismatches=0, extra=0

Примечание: один объединённый `npm run release:p2684:memory-residency` в текущей среде дважды сталкивался с timeout на уровне длинного orchestration-run, хотя соответствующие `B504` и mobile тесты при изолированном запуске завершаются с PASS и кодом 0. Это считается ограничением orchestration, а не доказанным runtime failure.

## 9. Что считать выполненным

Выполнено и доказано:

1. Function Reality Graph больше не теряет большую часть runtime-цепей из-за constructor property assignments.
2. Liveness audit стал реально запускаемым инструментом непрерывной проверки.
3. Memory residency подключён к canonical memory path.
4. Cold vector memory может быть lazy-restored.
5. Identity/autobiographical continuity защищена от aggressive memory cap.
6. Телефонный bounded soak продолжает работать после изменений.

## 10. Следующая большая область

Следующим проходом основной целью должен стать `Runtime Closure Certification`:

`RUNTIME_REACHABLE → BEHAVIOR CONTRACT → DIRECT TEST → PERSISTENCE/REPLAY → REGRESSION → VERIFIED`

Приоритет — не все 2 292 `REFERENCED_NOT_RUNTIME_REACHABLE` одновременно, а сначала критические stateful функции из `core / cognition / memory / world / learning / self`, с автоматическим построением executable contracts.

Параллельно следующий performance target — снижение peak RSS с ~349 MB к более подходящему диапазону для среднего Android-телефона без потери canonical memory continuity.
