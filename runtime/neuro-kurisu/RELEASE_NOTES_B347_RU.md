# Release Notes B347 — Predictive Calibration

## Что изменилось
- B299 outcome predictor получил явную калибровку pre-action prediction против фактического reward.
- Для каждого action phenotype добавлены `lastPredictedReward01`, `calibrationErrorEMA01`, `calibrationBias11`, `calibrationCount`.
- `predictOutcome()` теперь возвращает calibrated confidence.
- Плохая calibration quality ограничивает confidence, а хорошая calibration постепенно восстанавливает её.
- Calibration quality участвует в evidence/stability/causal confidence dynamics.
- B346 epistemic arbitration автоматически начинает видеть calibration-aware uncertainty без отдельного нового motivational subsystem.
- Добавлены unit/Core tests B347.

## Verified
- B347 unit PASS
- B347 minimal live Core PASS
- B346 unit/Core PASS
- B345 unit/Core PASS
- B344 PASS
- typecheck PASS
- core ownership PASS
- architecture PASS
- integrity PASS
- release contract PASS
- syntax PASS

## OPEN / LIMITATIONS
- Long unified developmental holdout remains OPEN.
- 3–10 tick B347 Core harness currently hits local execution budget; this is treated as a performance limitation, not PASS.
- Android/Termux device evidence remains OPEN.
- Full consciousness claims remain unsupported.


## B348 — Final Upgrade
- Добавлен persistent developmental maturity/stage в B299.
- Learning rate теперь зависит от накопительной зрелости организма.
- Добавлены evidence/diversity metrics developmental state.
- Snapshot/restore проверен.
