# Neuro-Kurisu 34.62.0 — BIG PASS 89

## Смысл релиза
Не расширение числа P-модулей, а слияние существующих механизмов в общий hot-path cognitive substrate.

## Ключевые изменения
1. Единственная нормализующая граница `WorldContextNormalizer` для частичных/неполных world observations.
2. P83 Persistent Reality теперь устойчив к missing arrays и не падает на частичном контексте.
3. `PersistenceProjectionCoordinator` безопасно пропускает отсутствующие optional snapshot providers.
4. `CognitiveFrame` теперь несёт `dirtyDomains`, `attentionBudget01`, `deepDemand01`.
5. `CognitiveExecutionPlanner` получил net Expected Value of Cognition и перестал автоматически форсировать дорогую работу одним фактом external input.
6. `CognitiveSpineScheduler` различает обычный wake-up и действительно urgent signal.
7. Добавлен current regression test `BIG_PASS_89_COGNITIVE_SUBSTRATE`.
8. Обновлены текущие performance/cognitive tests под новую семантику вместо возврата старой менее эффективной логики.

## Проверки
- typecheck: PASS
- architecture: PASS
- contract: PASS
- hygiene: PASS
- integrity: PASS
- syntax: PASS
- server smoke: PASS
- P26 true learning: PASS
- P26 contextual world: PASS
- mobile profile: PASS
- mobile horizon 1000: PASS
- mobile horizon 5000: PASS
- BIG PASS 39 reality boundary: PASS
- BIG PASS 41 performance spine: PASS
- BIG PASS 43 performance cache: PASS
- BIG PASS 50 cognitive execution: PASS
- BIG PASS 57 persistence coordinator: PASS
- BIG PASS 79/80/81/85/87/88 targeted checks: PASS

## Не заявляется
Этот релиз не объявляет Neuro-Kurisu сознательной или human-level AGI. Он улучшает функциональную cognitive integration, resource economics, robustness и проверяемость.
