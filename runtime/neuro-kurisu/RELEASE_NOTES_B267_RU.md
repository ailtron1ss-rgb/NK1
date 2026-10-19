# Release Notes — B267 Adaptive Regime Controller

B267 добавляет первый живой слой обнаружения изменения режима среды и адаптивного переключения cognition mode.

## Основное
- Online fast/baseline residual detector.
- Surprise + uncertainty fusion.
- Bounded CUSUM-like shift accumulator.
- Modes: exploit / monitor / explore / verify / recover.
- Active information gain.
- Adaptive arbitration поверх B264 causal policy и B263 action-causality.
- Core runtime integration.
- State migration and persistence.
- Standalone/Core/migration regression.

## Доказано
- Stable regime не вызывает постоянное переключение в exploration.
- Сильный controlled shift переводит controller в verify/explore.
- Verification count и uncertainty растут после shift.
- После улучшения outcome появляется recovery signal.
- B267 state переживает snapshot/migration.

## Не заявляется
- Open-world regime understanding.
- Autonomous scientific hypothesis generation.
- Consciousness.
- AGI.
- Real-world causal agency.
