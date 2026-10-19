# Neuro-Kurisu 35.6.85 / P2685 — Runtime Closure + Mobile Hot-Path Update

## 1. Цель прохода

P2685 закрывает следующий участок после P2684:

`RUNTIME_REACHABLE → BEHAVIOR CONTRACT → DIRECT TEST → PERSISTENCE/REPLAY → REGRESSION → VERIFIED`

Проход не пытается объявить все 2 371 runtime-достижимые функции поведенчески доказанными. Вместо этого он добавляет первый компактный runtime-level contract для критического autonomous path и одновременно убирает несколько тяжёлых полных snapshot-обходов из `OrganismRuntime`.

## 2. Реальная реализация

### RuntimeClosureLedger

Новый `src/organism/system/RuntimeClosureLedger.ts` фиксирует bounded evidence для runtime:

- соответствие `cycle.tick` и `state.tick`;
- строгую монотонность tick между autonomous steps;
- bounded homeostatic values (`energy`, `uncertainty`, `identityContinuity`, `predictionError`);
- монотонность processed-count непрерывного cognitive fabric;
- соответствие tick `ContinuousCognitiveFabric` runtime-state;
- допустимость реального `EnvironmentAction`;
- наличие replay signature на durable checkpoint;
- restore verification после process restart;
- 24 последних closure records, без неограниченного журнала в RAM;
- быстрый 32-bit fingerprint для hot-step evidence и SHA-256 для durable fingerprint.

Это не заменяет поведенческие тесты. Ledger является доказательным слоем между runtime execution и behavioural tests.

## 3. Persistence / replay closure

`OrganismCore.system` теперь сохраняет опциональный `runtimeClosure`.

Migration path принимает старые состояния без этого поля, поэтому P2684-состояния совместимы с P2685.

`OrganismRuntime.init()` восстанавливает closure evidence и выполняет restore verification.

Явный `OrganismRuntime.flush()` теперь делает durable closure checkpoint после обновления evidence, чтобы доказательство существовало в том же state file, который используется для restart.

## 4. Удаление тяжёлых hot-path snapshot-обходов

Вместо полного `core.snapshot()` в частых runtime местах теперь используются компактные представления:

- `operationalStatusSnapshot()` для tick/needs/action;
- `cognitiveBudgetOperationalSnapshot()` для budget mode;
- `cognitiveExecutionPlanSnapshot()` для camera planning;
- `consolidationInputSnapshot()` для traces/goals без полного persistence projection;
- `runtimeClosureOperationalSnapshot()` для closure verification;
- `predictionDebtSnapshot()` вместо `systemSnapshot().predictionDebt`.

Это снижает риск многомегабайтного deep-clone на телефонных hot-path вызовах.

В прямом P2685 тесте после init автономные циклы не увеличили счётчик полных `OrganismCore.snapshot()` более чем на один вызов; этот единичный вызов остаётся совместимым legacy/UI path и не является новым persistent projection внутри closure path.

## 5. Исполняемый P2685 тест

`tests/p2685-runtime-closure.mjs` проверяет:

1. direct RuntimeClosure contract;
2. 10 autonomous cycles;
3. отсутствие closure failures;
4. durable closure fingerprint;
5. persistence `ContinuousCognitiveFabric`;
6. restart/recovery;
7. продолжение tick и processed после restart;
8. изменение durable fingerprint после новых циклов;
9. отсутствие существенного возврата к full `core.snapshot()` в autonomous hot path.

Последний изолированный PASS:

- closure checks: 146;
- passed checks: 142;
- degraded checks: 2 (ожидаемая first-session evidence state);
- failures: 0;
- before restart: tick 10 / processed 10;
- after restore + 2 cycles: tick 12 / processed 12.

## 6. Mobile soak

P2684 mobile soak был повторён после P2685 и завершился с кодом 0:

- 30 cycles: PASS;
- отдельный запуск после полного набора P2685 изменений: 31.05 s внутри теста / 359.8 MB peak RSS; процесс завершился `EXIT=0`;
- ранее полученные отдельные запуски: 29.48–32.68 s / 352.9–356.2 MB RSS.

Показания runtime времени остаются заметно вариативными в текущей среде. Peak RSS при этом остаётся примерно на уровне P2684; P2685 не показал отдельного устойчивого lifecycle/memory leak в подтверждённых запусках, но peak RSS остаётся выше желаемого уровня для среднего телефона и требует следующего отдельного прохода оптимизации.

## 7. Structural proof after P2685

- Function Reality Graph: `2,388 RUNTIME_REACHABLE / 426 TEST_ONLY / 2,291 REFERENCED_NOT_RUNTIME_REACHABLE / 329 ORPHAN`; critical path `11/11`.
- Function liveness: `5,027` function-like declarations, `289` zero-reference, `882` one-or-less-reference.
- Parameterized safe probe: `1,100` attempted, `1,045` passed, `0` failed.
- Strict semantic coverage: `4,821` functions; `42 VERIFIED`, `9 INTEGRATION_ONLY`, `309 UNSAFE_TO_AUTO_RUN`, `4,461 UNVERIFIED`; evidence coverage `0.92%`.
- Regression gates: P2679 PASS, B504 PASS, P2684 memory-residency PASS, server smoke PASS.
- Architecture/integrity/forensics/hygiene/syntax/release-contract/release-source: PASS after manifest refresh.

## 8. Version / schema

- application: `35.6.85`
- organismCore: `92.3.0-runtime-closure-p2685`
- stateSchema: `193`
- phase: `Stage-68/Runtime-Closure-Mobile-HotPath/P2685`

## 9. Что реально улучшилось

### Было

`OrganismRuntime` мог проходить через полный persistence projection даже для небольших запросов состояния.

Behavioural proof continuous runtime существовала в отдельных B504/P2684 тестах, но не было одного компактного runtime-level evidence ledger, связывающего step → durable checkpoint → restart.

### Стало

Появился bounded Runtime Closure layer с direct execution evidence и restart evidence.

Частые runtime запросы получают lightweight state views.

Closure evidence не создаёт отдельный dirty-cycle pressure поверх уже изменяющегося cognitive fabric.

Durable fingerprint использует SHA-256, а hot-step fingerprint — более дешёвый deterministic fingerprint.

## 10. Ограничения

P2685 не означает, что тысячи остальных runtime-reachable функций уже VERIFIED. Strict semantic coverage P2684 остаётся отдельным доказательным показателем.

Mobile soak подтверждает bounded runtime execution на текущем host environment при V8 old-space 256 MB, но не является измерением конкретного пользовательского Android телефона.

## 11. Следующий шаг

Следующий крупный этап должен расширить closure contracts от runtime-level к критическим stateful domain contracts:

`core state → memory residency → identity continuity → world consequence → learning update → replay/restart`

с прямым causal holdout, lesion/ablation checks там, где это безопасно, и автоматической регистрацией evidence в semantic coverage.
