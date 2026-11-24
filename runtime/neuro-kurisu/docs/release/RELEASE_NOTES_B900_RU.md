# Release B900

B900 переносит Neuro-Kurisu от adaptive-mind слоя к developmental learning fabric. Новый слой не заменяет B720, а связывает его memory/world/planning/verifier/neural pathways.

Новый canonical source: `src/organism/system/B721B900DevelopmentalLearningFabric.ts`.

Новые тесты: `tests/b721-b900-developmental-learning.mjs`, `tests/b721-b900-performance.mjs`, `tests/b721-b900-organism-integration.mjs`.

Verified host-side: typecheck, standalone behavior, performance, OrganismCore integration, restart persistence.

Ограничение: contextual reversal accuracy остаётся около случайного уровня в текущем специально созданном benchmark; поэтому следующий milestone должен закрывать именно causal contextual policy learning.
