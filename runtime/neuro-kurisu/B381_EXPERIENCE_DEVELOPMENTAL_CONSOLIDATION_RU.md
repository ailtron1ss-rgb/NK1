# B381 — Experience→Developmental Consolidation

## Цель
Преобразовать проверенный жизненный опыт B380 из telemetry-only объекта в причинно действующее долговременное развитие канонического нейронного ядра B365.

## Архитектурное решение
Не создаётся новый decision owner. B365 остаётся единственным каноническим нейронным владельцем policy. B380 создаёт temporal experience token, после чего только доказанный physical/independent experience допускается в `consolidateExperience()` B365.

## Causal path
`experience token → evidence gate → developmental memory → B365 action/forecast readout → future policy`

## Что изменяется
- action value по каждому из 7 действий;
- action confidence;
- action novelty;
- contradiction pressure;
- identity continuity;
- learning mass;
- mean reward / prediction error;
- последние 64 verified developmental experiences;
- canonical B365 action and forecast readouts.

## Защита от fake learning
Unverified experience изменяет только rejected counter и не изменяет policy/developmental state.

## Persistence
Developmental memory включён в B365 snapshot и восстанавливается после restart.

## Ограничение
Этот механизм не доказывает сознание. Phenomenal consciousness остаётся UNKNOWN.
