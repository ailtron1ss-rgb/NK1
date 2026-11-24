# B377 — Neural Goal Life-Course Arbitration

## Цель

Усилить B376 так, чтобы организм не только создавал successor-goal, но и мог самостоятельно выбирать между уже накопленными целями по стоимости, прогрессу, конфликту, застою и внутренним ресурсам.

## Causal path

`B365 state → goal memories → resource/identity/conflict appraisal → autonomous arbitration → active goal → action policy → verified outcome → goal state update → future arbitration`

## Новый механизм

B377 добавляет в существующий `goalEcology`:

- `resourceBudget01`;
- `stagnation01`;
- `conflict01`;
- `switchPressure01`;
- `lifeCourse01`;
- `priority01` для каждой известной цели;
- `totalSwitches`;
- `autonomousReplans`;
- `rejectedSwitches`;
- reason/timestamp последнего арбитража.

Новый механизм не создаёт второго decision-owner. B365 остаётся единственным нейронным владельцем policy.

## Правило доказательства

Автономное переключение разрешено только для уже существующей internal goal memory и только при достаточном causal margin. Неподтверждённое последствие не изменяет lifecycle counters.

## Что считается доказанным

1. Две internal goals могут существовать одновременно.
2. После деградации текущей цели организм может самостоятельно переключиться на другую известную цель.
3. Переключение не требует повторного `goalAuthorship` input.
4. OFF ablation устраняет autonomous switching.
5. Restart сохраняет ecology exactly.
6. Resource/conflict/stagnation участвуют в arbitration state.
