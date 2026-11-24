# Neuro-Kurisu 34.16.0 — BIG PASS 46

## Главные изменения

- resource-aware MultiProjectScheduler;
- starvation prevention для neglected projects;
- continuity hysteresis при близких project scores;
- wall-clock recency вместо ошибочного tick/Date смешения;
- физическая `selectProject()` boundary в SelfProjectEngine;
- event-sourced `project-switch` lineage;
- Model Olympics с медленным историческим decay;
- новый BIG PASS 46 regression test;
- исправлен false-positive absolute-path detector в forensic audit;
- current release/source/manifests синхронизированы.

## Schema

`89` — без изменения persisted schema contract.

## Validation

250/500/1000 operational long-horizon gates: PASS.

1000-cycle final:
ratio=2.231
p95=43.56ms
heap=48.31MB -> 79.59MB
memory=224

Composite audit-all не заявляется как PASS: aggregate command превысил общее execution window на server-smoke sequence. Server-smoke отдельно PASS.

Final verification: `docs/BIG_PASS_46_FINAL_VERIFICATION.txt`.
