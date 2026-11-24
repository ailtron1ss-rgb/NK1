# CHANGELOG V84

Дата: 2026-09-23

## Core
- `src/neurocore/v84/core.py`
- `V84Config`
- `mobile_v84_config`
- `NeuroWeaveV84`
- `OrganismTrainerV84`
- `OrganismRuntimeV84`
- `RuntimeStateStoreV84`

## Реальные изменения
- adaptive replay interval;
- pressure spike over EMA;
- single-backward fast replay mode;
- sparse exact gradient-surgery diagnostic mode;
- bounded controller state + checkpoint persistence;
- zero new model parameters.

## Verification
- targeted V84: 6/6 PASS;
- V82+V83+V84 targeted suite: 20/20 PASS;
- compile current frontier: PASS.

## Evidence
- 2-seed short timing A/B: mean 3.330s → 1.955s;
- replay events 7 → 3 per run;
- diagnostic replay retained exact gradient coverage ~76.29%.

No continual-learning superiority claim is made.

## Post-V84 qualification hardening
- replay policy modes added: `current_only`, `fixed`, `adaptive`;
- exact external `target_latent_sequence` is now preserved in canonical replay when supplied;
- replay pressure can use the external target;
- existing V84 tests expanded to include external target integrity.
