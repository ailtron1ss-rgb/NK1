# Neuro-Kurisu 34.64.0 — BIG PASS 91

## Цель
Преобразовать предыдущий causal-learning слой в общий Unified Learning Substrate без удаления P26/P30 и без роста вычислительной нагрузки на мобильном hot path.

## Реально внедрено
1. `UnifiedLearningSubstrate` — bounded shared representation, causal learning opportunity, representation drift, prediction agreement, cross-task transfer, consolidation priority и bounded pattern memory.
2. P26/P30 теперь получают общий learning signal, рассчитываемый через causal experience + unified substrate.
3. `CognitiveDependencyGraph` — единый dirty/wake graph для 7 доменов организма.
4. `CognitiveFrame` получил компактный `wakeMask`; hot-path routing не требует обхода больших snapshot-деревьев.
5. `CausalExperienceStream.observe()` исправлен: наблюдение больше не удаляет старый causal record до появления outcome; добавлена полная дедупликация по trace id.
6. Persistence/migration для unified learning и dependency graph.
7. Новые тесты `big-pass-91-unified-learning.mjs`.
8. Release source/manifest/package-lock синхронизированы на 34.64.0.

## Научные ограничения
UnifiedLearningSubstrate — обучаемая инженерная substrate, но не доказательство сознания и не биологический эквивалент нервной системы. Shared representation является компактным состоянием/признаковым пространством; semantic vision, богатая социальная cognition и phenomenal consciousness ещё не реализованы.

## Проверки
- TYPECHECK: PASS
- BIG PASS 91: PASS
- BIG PASS 90: PASS
- P26 true learning: PASS
- P26 contextual world: PASS
- mobile 1000: PASS
- mobile 5000: PASS
- architecture: PASS
- release contract: PASS
- project state: PASS
- component conflicts: PASS
- source truth: PASS
- legacy reintegration: PASS
- hygiene: PASS
- integrity: PASS
- syntax: PASS
- core ownership: PASS
- server smoke: PASS

`audit:all` после запуска 34.64.0 начал проходить историческую suite, но в едином запуске среда завершила его по внешнему time limit на P11. Это НЕ считается полным audit:all PASS и НЕ скрывается.

## Следующий эффективный этап
BIG PASS 92: multimodal semantic sensorium + event-driven perception, затем social mind. P-модули не должны расширяться ради количества; новый код должен усиливать причинную связность, обучение и sensorimotor grounding.
