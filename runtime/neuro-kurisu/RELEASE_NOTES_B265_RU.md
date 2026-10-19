# RELEASE NOTES — B265

## Большое изменение

B265 добавляет независимый многошаговый evaluator для causal policy.

В отличие от B264 evaluator не принимает reward, который сама policy вычислила о себе. Он самостоятельно исполняет последовательность `state -> action -> transition -> reward`, сравнивает causal policy с non-causal baseline и random policy и проверяет unseen/holdout задачи.

## Новые файлы

- `src/organism/cognition/B265IndependentPolicyEvaluator.ts`
- `tests/big-pass-265-independent-evaluator.mjs`
- `tests/big-pass-265-core-evaluator.mjs`
- `tests/big-pass-265-migration-roundtrip.mjs`
- `B265_PROGRESS_2026-09-12_RU.md`
- `B265_RELEASE_EVIDENCE.json`

## Интеграция

B265 подключён к `OrganismCore`, `PersistedShapeCurrent` и `StateMigrations`.

## Строгое замечание

Это independent evaluator для controlled digital environments. Он не является доказательством реального внешнего мира, сознания или общей автономии.
