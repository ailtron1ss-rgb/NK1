# P2693 — delayed causal credit для адаптивной политики памяти

## Что реально изменено

P2692 умел выбирать политику retrieval по контексту и обучать её на непосредственном outcome. P2693 добавляет отсутствовавший мост: решение retrieval теперь может пережить несколько циклов и получить отложенный сигнал от независимой replay-проверки.

Цепочка:

`retrieval → policy decision → bounded pending ledger → replay validation → CausalReplayCreditAssigner → delayed policy outcome → AdaptiveMemoryPolicy`

## Новые элементы

- `src/organism/system/MemoryPolicyOutcomeLedger.ts`
  - bounded ledger на 128 pending решений;
  - сохраняет policy/context/query hash/затронутые memory IDs/стоимость вычисления;
  - при поздней валидации связывает memory ID с исходным решением;
  - рассчитывает delayed signal и reward;
  - не изменяет код или содержимое памяти.
- `MemoryFabric.retrieve()` теперь регистрирует фактическое policy decision после retrieval.
- `MemoryFabric.resolveAdaptivePolicyOutcome()` передаёт полученный delayed outcome обратно в `MemoryOS2 → AdaptiveMemoryPolicy`.
- `OrganismCore.experienceContinuumReplayValidate()` автоматически пытается разрешить delayed policy outcome после создания causal replay credit.
- состояние ledger включено в `MemoryFabricSnapshot`, поэтому мост сохраняется между перезапусками.

## Проверка

`tests/p2693-delayed-policy-credit.mjs` проверяет полный механизм на уровне компонентов:

- policy decision создан;
- replay credit рассчитан с задержкой;
- delayed outcome разрешён;
- pending ledger очищен;
- context-specific policy value обновлён.

Результат текущего прохода: PASS.

Это доказательство корректности механизма и интеграционного пути, а не доказательство общего превосходства adaptive policy над фиксированными стратегиями. Для следующего этапа нужен независимый ablation: fixed policies vs adaptive vs adaptive+causal-credit на holdout-наборе.
