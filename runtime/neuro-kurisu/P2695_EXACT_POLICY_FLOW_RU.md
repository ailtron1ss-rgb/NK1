# P2695 — точный policyDecisionId через реальный OrganismCore

P2695 закрывает следующий разрыв после P2694: policy decision больше не существует только внутри component-level ledger. Идентификатор решения retrieval теперь можно получить из реального `OrganismCore`, передать через replay validation и использовать для точного разрешения delayed outcome.

## Что изменено

1. `MemoryFabric.retrieve()` сохраняет последний `policyDecisionId` и публикует его через diagnostics.
2. Добавлен `retrieveWithPolicyDecision()` и API `OrganismCore.memoryRetrieveWithPolicyDecision()`.
3. `ReplayValidation` получил необязательный `policyDecisionId` с обратной совместимостью.
4. `OrganismCore.experienceContinuumReplayValidate()` передаёт ID в `MemoryPolicyOutcomeLedger.resolve()`.
5. `MemoryFabric` snapshot/restore уже сохранял ledger с P2694; P2695 дополнительно исправляет миграционный слой, чтобы `policyOutcomeLedger` не терялся при загрузке persisted state.
6. После replay validation `OrganismCore` теперь явно синхронизирует `memoryFabric` snapshot перед возвратом результата.
7. Добавлен интеграционный тест `tests/p2695-organism-policy-decision-flow.mjs`: реальный Core → retrieval → exact decision ID → replay → validation → delayed outcome → restart/restore.

## Проверка

`npm run audit:p2695:organism-policy-flow`

Проверяет typecheck, P2695 exact flow, P2694 ablation, P2693 delayed credit, P2692 adaptive holdout и P2688 long-horizon replay — все PASS.

Ключевой результат P2695:

- exact decision resolved: PASS
- causal replay credit: PASS
- delayed reward: PASS
- persisted ledger after restart: PASS
- compatibility fallback по `memoryId`: сохранён

Текущий тестовый прогон показал `reward01≈0.7603`, `delayed01≈0.5364`, `causalCredit01≈0.2705` на конкретном интеграционном сценарии. Это не является общей оценкой системы.
