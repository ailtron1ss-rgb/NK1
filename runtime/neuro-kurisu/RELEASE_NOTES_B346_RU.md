# Release Notes B346 — Epistemic Arbitration

## Что изменилось
- DecisionActionPipeline получил history-dependent epistemic arbitration.
- Outcome confidence и sample coverage теперь определяют uncertainty/novelty.
- Candidate confidence и predicted cost влияют на learnability/information opportunity.
- Внешний запрос пользователя полностью блокирует autonomous epistemic adjustment.
- Добавлена диагностика `lastEpistemic` и `epistemicActiveCount`.
- Добавлены unit/Core tests B346.

## Verified
- B346 unit PASS
- B346 Core PASS
- B345 regression PASS
- B344 regression PASS
- typecheck PASS
- core ownership PASS
- architecture PASS
- integrity PASS
- release contract PASS

## OPEN
- unified long audit bundle — execution timeout
- long-horizon endogenous developmental holdout — still OPEN
- real-device Android evidence — still OPEN
