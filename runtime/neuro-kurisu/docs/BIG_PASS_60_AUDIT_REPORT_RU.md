# Neuro-Kurisu — BIG PASS 60 — Audit Report

## Цель
Перевести world cognition от набора параллельных P-модулей к единой системной петле внутри `WorldSubsystemRuntime` с реальным разделением passive и action-conditioned learning.

## Реализовано
- `WorldSubsystemRuntime.observeGroundedContext()` объединяет GroundedWorldState/P27/WorldModel2 и выполняет passive learning только при фактическом изменении семантического контекста.
- `WorldModel2.observePassiveTransition()` обучает специальную `__passive__` transition hypothesis без приписывания изменения действию агента.
- `WorldSubsystemRuntime.predictIntegrated()` объединяет P27, WorldModel2 и residual model и возвращает model agreement/reliability/uncertainty.
- `WorldSubsystemRuntime.evaluateAction()` централизует integrated prediction + rollout.
- `WorldSubsystemRuntime.observeActionOutcome()` централизует action-conditioned world learning и P27 training.
- `OrganismCore` делегирует world grounding/action evaluation/outcome learning system owner'у.
- при низком model agreement создаётся explicit contradiction pressure; disagreement не превращается в ложную уверенность.
- исправлен bug контекстного сравнения: `tick` не является причиной нового world transition.
- добавлены Core/world-fabric/performance regression tests.

## Не сделано намеренно
Это всё ещё не полноценный neural/latent world model человеческого класса. P27 использует compact hashed encodings, а WorldModel2 — bounded online transition statistics. Это доказуемо обучаемый scaffold, но не foundation-model-level world simulator.

## Truthfulness
`model-output` не трактуется как observed truth. Passive transition не получает attribution к действию агента. Ensemble disagreement повышает неопределённость/pressure вместо автоматического выбора «истины».
