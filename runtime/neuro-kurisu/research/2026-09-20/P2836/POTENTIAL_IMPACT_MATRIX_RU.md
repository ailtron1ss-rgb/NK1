# Potential Impact Matrix — P2836 and Next Experiments

Важно: числа ниже — инженерные гипотезы для планирования экспериментов, а не измеренный прирост текущего проекта.

| Изменение | Гипотезируемый эффект | Уверенность | Что измерять |
|---|---|---|---|
| External-first grounding | +10–25% к reality-calibration на grounded tasks | средняя | prediction error, verified consequence, external-vs-sim gap |
| Fast/slow replay thermostat | +5–15% adaptation или -5–20% forgetting при сопоставимом бюджете | низкая-средняя | adaptation speed, forgetting, replay cost |
| Surprise-driven test-time memory | +5–15% retained information на длинных потоках | низкая-средняя | retention, recall after interruption, memory cost |
| Shadow world model + real consequence | +5–20% action prediction calibration | средняя | held-out transition error |
| Neural lesion/intervention gate | не увеличивает интеллект напрямую, но может повысить достоверность attribution | высокая | causal effect size, matched controls |
| Camera semantic grounding | потенциально большой прирост задач, связанных с окружающим миром | средняя | perception accuracy, intervention success |
| Внешний world-model adapter (V-JEPA2/Kairos/CausalWM family) | потенциально значимый прирост visual physical prediction, но с большой стоимостью | низкая на mobile target | model quality, latency, RAM, battery |

## Комбинированный эффект

Проценты нельзя честно складывать: механизмы взаимодействуют, и gains могут перекрываться.

Рациональная гипотеза для следующей экспериментальной серии — не «20% + 15% + 10%», а проверка того, превращается ли связка:

`real observation → prediction → action → real consequence → surprise → fast memory → slow consolidation → neural update → future prediction`

в устойчивый closed-loop improvement на held-out tasks.

### Что считалось бы сильным результатом

- меньше prediction error;
- меньше catastrophic forgetting;
- больше transfer при сопоставимом бюджете;
- больше verified real outcomes;
- меньший sim-to-real gap;
- causal effect от neural lesion;
- стабильнее autobiographical identity после длительного обучения.
