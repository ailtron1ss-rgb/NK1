# P11 — Agency & Causal World Interaction

P11 — следующий масштабный слой после P10 World Model 2.0.

## Главный цикл

`internal pressure + commitments + regret -> governance rerank -> choice -> action -> outcome -> consequence ownership -> future-self update -> next cycle`

## Новые механизмы

1. `SelfGovernanceEngine`: регулирует candidate actions перед выбором.
2. `FutureSelfModel`: прогнозирует следующий выбор и измеряет mismatch.
3. `ConsequenceRecord`: фиксирует expected/actual/counterfactual outcome.
4. `SelfGovernanceState`: persistent governance score, override dependency, ownership и regret.
5. P11 migration: state schema 12 -> 13.
6. Runtime integration test.
7. Matched research lab: baseline + governance/future-self/consequence lesions.

## Ограничение

Это operational/causal agency research, а не доказательство метафизической free will или phenomenal consciousness.
