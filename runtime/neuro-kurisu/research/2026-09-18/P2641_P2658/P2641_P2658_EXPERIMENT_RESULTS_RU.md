# P2641–P2658 — результаты экспериментов

## Standalone developmental loop

1800 outcome cycles.

- goals created: 1
- prototypes: 1
- goal autonomy: 0.6246
- causal credit: 0.7869
- transfer readiness: 0.7885
- recovery readiness: 0.8400
- developmental coherence: 0.7960
- external-transfer signal: 0.8225
- adaptive reward: 1074.86
- frozen baseline reward: 1056.12
- measured reward delta: +1.77%

Это **локальный синтетический benchmark**, не доказательство общего прироста интеллекта. Его назначение — показать, что новый controller действительно меняет state/action loop и обучается от outcome.

## Fault injection

При искусственной ошибке severity=0.91 и намеренно плохом action `respond` controller выбрал recovery `verify`. Avoidance signal = 0.65.

## Neural-branch integration

900 полноценных decision/outcome cycles через `NeuralExperienceBranch`.

- developmental outcomes: 900
- goals: 1
- causal credit: 0.7353
- developmental coherence: 0.7222

Persistence snapshot/restore прошёл exact equality.

## Интерпретация

P2641 не пытается заявить «+X% интеллекта». Измерен только конкретный локальный reward benchmark. Главный результат — появление связанного developmental state, который реально влияет на action bias, обучается от outcome и сохраняется через snapshot/restore.
