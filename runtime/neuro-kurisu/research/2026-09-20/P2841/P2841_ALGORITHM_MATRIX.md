# P2841 — Algorithm Matrix

| Направление | Что уже есть | P2841 изменение | Следующий шаг |
|---|---|---|---|
| Shadow world | WorldEnvironment + RealityShadowBridge | pure prediction / commit only after arbitration | long-horizon holdout |
| Postcondition | raw embodied consequence verification | second-stage proof classifier | hardware effect probes |
| Grounded world | GroundedWorldState | direct external consequence commit | richer external entity/event binding |
| Active perception | B365 planner | verification gap raises demand | information-gain sensor selection |
| Learning | RealityLearningGate | holdout readiness attenuates long-lived promotion | multi-episode causal calibration |
| Neural trace | NeuralCausalTraceLedger | evidence provenance linked to external outcome | intervention/lesion matrix |
| Video world model | P41/P43/etc. | no heavyweight model added | optional JEPA-like latent branch on external video |

## Potential impact

До реальных ablation/long-horizon испытаний нельзя честно утверждать фиксированный процент прироста. Наиболее вероятный эффект:

- высокий: снижение simulator leakage и ложных external learning promotions;
- высокий: устойчивость identity/memory к единичным noisy events;
- средний/высокий: calibration of action consequences;
- средний: active-perception efficiency;
- неизвестный до hardware: physical actuator effect verification.

При объединении postcondition verification + active perception + long-horizon causal holdout ожидаемый выигрыш следует мерить не одной accuracy, а набором: intervention success, prediction error, false promotion rate, memory/identity stability, energy per verified outcome и recovery quality.
