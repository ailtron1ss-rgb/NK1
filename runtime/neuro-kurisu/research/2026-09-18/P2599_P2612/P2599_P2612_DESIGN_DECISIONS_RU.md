# Design decisions — P2599–P2612

1. Добавлен `HierarchicalProceduralSkillEngine` вместо простого увеличения банка процедурных навыков.
2. Meta-skill создаётся только из нескольких совместимых процедур; единичный навык не объявляется абстракцией.
3. Поиск meta-skill ограничивается compute budget: 3 / 5 / 7 действий вместо обязательного полного перебора.
4. Реализован bounded test-time residual adapter в `EmbodiedCausalWorldBridge`; основной dynamics model не заменяется online-адаптером.
5. Online adaptation ограничена диапазоном `[-0.12, 0.12]` и маленьким learning rate.
6. Появились telemetry `calibrationError01`, `modelDrift01`, `failureEvents`, `recoveryGain01`.
7. Recovery учитывает как измеренную transition error, так и внешний verified/prediction-error сигнал.
8. Архитектура сознательно не называет эти механизмы сознанием; это функциональные substrate-механизмы.
