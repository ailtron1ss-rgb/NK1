# B304 Architecture Decisions
Дата: 13.09.2026

1. Не добавлять новый personality learner. B299 + MultiHypothesisPersonality уже являются каноническим поведенческим контуром.
2. B304 SemanticHoldout — только evaluator. Он не участвует в action arbitration.
3. Семантическая family label скрыта от organism runtime; тест передаёт её только в evaluator metadata.
4. B304 snapshot сохраняется через обычный persistence projection и migration.
5. TemporalResolutionGovernor получает direct device-resource signals, а не косвенную surrogate pressure только из cognitive state.
6. External signal всегда имеет приоритет и требует full cognitive pulse даже при высокой resource pressure.
7. High device pressure разрешает более редкие full pulses, но micro-cycle продолжает двигать организм по temporal/metabolic state.
8. B304 не защищает себя от verification criticism: semantic coverage остаётся отдельным release metric.
