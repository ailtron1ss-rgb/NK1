# V96 — Neural Dynamics Research Pass

## Реальные изменения
- parameter-free adaptive refinement candidate с difficulty routing; default disabled;
- causal fast-synapse candidate: eligibility trace + prediction error + optional surprise modulation; fast state reset/configuration остаются explicit;
- multi-timescale decay candidate в одном recurrent state; без второго memory owner;
- current schema/engine metadata подняты до V96;
- current registry требует явного candidate/integrated/rejected статуса;
- финальный release не промотирует ни один V96 candidate автоматически.

## Completed qualification
### Adaptive compute
3 seeds × 120 steps.
Dense: cosine **0.23680**, top-1 **0.08160**, deep fraction 1.0, mean train time **1.7900 s**.
Adaptive: cosine **0.22876**, top-1 **0.05208**, mean deep fraction **0.70389**, mean train time **1.7953 s**.
Вывод: экономия refinement не сохранила качество; **NOT PROMOTED**.

### Fast synapse
5 seeds, phase switch at step 40.
Frozen phase-2 cosine **-0.03296**.
Three-factor fast synapse **0.09504**.
Two-factor fast synapse без surprise-modulator **0.24741**.
Это доказывает, что fast weights действительно адаптируются на frozen slow substrate, но текущий surprise gate ухудшает адаптацию относительно простого eligibility × error rule. **NOT PROMOTED**.

### Multiscale temporal dynamics
2 seeds × 70 steps, delay 18.
Single timescale cosine **0.20139**; multiscale **0.20167**. Top-1 одинаковый (**0.04167**).
Качество практически нейтрально, стоимость выше; **NOT PROMOTED**.

## Release verification
- `pytest tests/current`: **35/35 PASS**;
- `python scripts/verify_current.py`: **PASS**;
- `python -m compileall`: **PASS**;
- editable package build/install without external dependencies: **PASS**, package version **0.96.0**.

## Evidence status
- **PROVEN:** current code implements all three candidates;
- **PROVEN:** fast synapse can change short-term behavior without mutating slow model weights;
- **OBSERVED:** adaptive compute actually skips deep refinement;
- **OBSERVED:** multiscale route changes temporal decay prior;
- **UNPROVEN:** universal continual-learning gain;
- **UNPROVEN:** superior long-context recall;
- **UNPROVEN:** mobile advantage.

## Scientific alignment
- BrainTrace, Nature Communications 2026 — model-agnostic linear-memory online learning with eligibility traces.
- Selective weight reinitialization, PMLR 2026 — weight-level regeneration is a relevant alternative to whole-unit resets for maintaining plasticity.
- AdaLin, PMLR 2026 — adaptive linearity injection as another route to preserving gradient flow/plasticity.
- Modern linear/recurrent backends remain tracked separately in the V92/V93 source-backed registry.

## Final V96 status
V96 is a **research-release**. No candidate is promoted into the default numerical path. The release protects current stability while providing controlled experimental components for V97.
