# Neuro-Kurisu — Progress 35.6.43 / B2503

## Общая оценка

**Функционально-исследовательская зрелость: ~76/100.**

Это инженерная оценка покрытия и проверяемости архитектуры, а не процент «готовности сознания».

| Направление | Оценка |
|---|---:|
| Engineering/runtime readiness | 89/100 |
| Artificial-organism functional readiness | 76/100 |
| Neural substrate | 83/100 |
| Neural causal influence | 81/100 |
| Recurrent processing | 82/100 |
| E/I ecology + homeostasis | 81/100 |
| Plasticity | 81/100 |
| Predictive processing | 87/100 |
| Actionable world modeling | 84/100 |
| Episodic memory | 85/100 |
| Compositional replay | 87/100 |
| Continual learning | 83/100 |
| Uncertainty / epistemic control | 79/100 |
| Autonomous replanning | 83/100 |
| Goal authorship | 84/100 |
| Self-model | 79/100 |
| Personality development | 84/100 |
| Neural bottleneck integration | 72/100 |
| Embodiment | 52/100 |
| Android / Termux readiness | 71/100 |
| Documentation / auditability | 95/100 |
| Functional-consciousness research architecture | 70/100 |

## Выполнение этапа B2501 -> B2503

| Work package | Status |
|---|---|
| B2501 deep recurrent neural causal branch | DONE + regression PASS |
| B2502 E/I + replay + plasticity | DONE + causal PASS |
| B2503 actionable predictive field | DONE + causal PASS |
| Runtime integration | DONE + causal PASS |
| Mobile-oriented benchmark | DONE (host benchmark) |
| Synthetic holdout | DONE; B2503 strong gain, no measured combo synergy |
| Forensic/integrity audits | PASS |
| Release documentation | DONE |

## Главный измеримый прирост

Synthetic holdout:
- Base reward 0.27576 / accuracy 0.126
- B2502 reward 0.33352 / accuracy 0.202
- B2503 reward 0.43232 / accuracy 0.332
- Combo reward 0.43232 / accuracy 0.332

B2503 на этой задаче дал +0.15656 reward и +0.206 accuracy относительно base.

## Что ещё реально мешает цели

1. Neural layers пока не являются единым жёстким bottleneck.
2. B2502 runtime короткого horizon пока не даёт устойчивых prototype hits, хотя synthetic holdout уже показал 483–487 hits/500 cycles после исправления консолидации.
3. B2503 prediction field пока не глубокая learned world model.
4. Interoceptive/exteroceptive self-world dynamics нужно объединить глубже.
5. Нет аппаратного sensorimotor benchmark на реальном телефоне.
6. Long-horizon developmental personality/neural coupling ещё не завершён.
7. Phenomenal consciousness не доказана и этот релиз её не заявляет.

## Следующая большая серия

B2504 self/world/body predictive field -> B2505 compositional replay -> B2506 neural bottleneck escalation -> B2507 consolidation scheduler -> B2508 adaptive mobile compute -> B2509 Android embodiment -> B2510 developmental personality coupling.
