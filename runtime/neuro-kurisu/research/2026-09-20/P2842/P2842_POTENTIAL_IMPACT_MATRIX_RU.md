# P2842 — Потенциальный эффект

| Изменение | Потенциальный эффект | Риск | Почему внедряем |
|---|---:|---:|---|
| exact prediction ticket | высокий | низкий | Устраняет ambiguity между prediction и outcome |
| repeated causal readiness | очень высокий | низкий | Защищает lifelong memory/identity от единичного ложного опыта |
| context-aware holdout | высокий | средний | Делает intervention history более причинным |
| active perception outcome gain | высокий | средний | Позволяет обучать не только action policy, но и выбор следующего наблюдения |
| query-conditioned provenance | высокий | низкий | Делает world-model claims проверяемыми |

Оценки являются инженерными гипотезами, а не измеренным приростом производительности.
Измеренный прирост должен определяться отдельным factorial/ablation экспериментом.
