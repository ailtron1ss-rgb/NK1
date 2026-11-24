# P2698 — Predictive World Closure

## Модуль
- `src/organism/core/WorldSubsystemRuntime.ts`
- `src/organism/developmental/WorldModel2.ts`
- `src/organism/core/OrganismCore.ts`
- `src/organism/core/types.ts`

## Что исправлено
До P2698 организм мог иметь несколько одновременно созданных prediction-ticket для одного действия/контекста, а при фактическом исходе `WorldModel2` выбирал первый подходящий ticket, если явный идентификатор не был передан.

P2698 вводит сквозной exact prediction identity:

`candidate action → predictForDecision() → predictionId → selected candidate → action outcome → WorldModel2.observeTransition(predictionId) → exact calibration/learning`

Выбранный кандидат теперь хранит `worldPredictionId`. При завершении действия этот идентификатор передается обратно в WorldSubsystem и WorldModel2. `WorldModel2.observeTransition()` возвращает подтверждение разрешенного ticket и точность прогноза.

## Практический эффект
- prediction до действия становится конкретным объектом причинного цикла, а не только числом;
- результат действия может быть привязан именно к тому прогнозу, который использовался при выборе;
- уменьшается риск смешивания нескольких прогнозов одного action/state;
- калибровка confidence получает правильный источник ошибки;
- замыкается реальная петля `prediction → action → outcome → prediction error → model update`.

## Проверка
`npm run audit:p2698`:
- TypeScript typecheck — PASS
- exact world prediction closure — PASS
- P2697 mobile residency regression — PASS
- P2696 contextual policy regression — PASS
- P2695 organism policy flow regression — PASS
- P2694 policy ablation regression — PASS

Тест P2698 создает два последовательных prediction-ticket для одного действия и проверяет, что первый исход разрешает именно первый ticket, а второй остается отдельным.

## Ограничение
Это усиливает причинно-калибровочную замкнутость software-organism. Это не является доказательством сознания или биологической эквивалентности человеческому мозгу.
