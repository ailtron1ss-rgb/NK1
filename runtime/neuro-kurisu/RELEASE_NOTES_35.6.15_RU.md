# Release Notes — Neuro-Kurisu 35.6.15 / B363

## B363 — Five-Step Predictive Planning

B363 расширяет causal predictive planning с 3 до 5 imagined steps на том же B283 causal spine.

### Что добавлено
- единый `planHorizon(horizon=3|5)`;
- совместимый `planThreeStep()` wrapper;
- конфигурация `predictivePlanningHorizon`;
- default release horizon = 5;
- persistence полного пятишагового `plannedSequence`;
- затухающая causal planning bias после первого шага;
- 5-step Core restart verification;
- 5-seed component lesion/sham verification;
- 5-seed Core ON/OFF/SHAM causal score-field verification.

### Evidence
- Component: 5/5 PASS.
- Core 5-step persistence/restart: 5/5 PASS.
- Core 5-step causal selection field: 5/5 PASS.
- Minimum causal L1: ~0.236726.
- Minimum causal/sham ratio: ~20x.
- SHAM == OFF on all 5 seeds.
- Final argmax did not change in the five dedicated B363 Core scenarios; this is recorded as a downstream-governance result, not hidden.

### Important fix discovered during release validation
The first B363 implementation still truncated persisted plans to three actions during `restore()`. The failing restart test exposed it; restore was corrected to preserve up to five validated actions before the release was frozen.

### Regressions
- B353 causal SNN: PASS.
- B359 multi-episode plasticity: PASS 5/5.
- B360 executor trajectory ablation: PASS 5/5.
- B361 predictive planning: PASS 5/5.
- B362 Core predictive causality: PASS 5/5.
- B361 3-step Core smoke: PASS.

### Limits
Physical Android/Termux runtime is still unverified. Long-horizon device endurance (100/500/1000 cycles) remains the next mandatory gate. Phenomenal consciousness remains UNKNOWN.
