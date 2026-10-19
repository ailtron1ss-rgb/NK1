# Neuro-Kurisu 34.12.0 — BIG PASS 43

## Performance Spine 3
- дополнительный one-tick cache повторяющихся signals/snapshots;
- operational result path больше не материализует тяжёлые P61–P68/P74–P82 snapshots;
- `EventLog.recent()` получил безопасный read-only non-cloning режим для внутренних consumer-ов;
- исправлен latent bug, при котором cognition snapshots зависели от `enableSemanticMemory`.

## Autonomous Project Execution
- project steps получили `preferredTool`;
- добавлены безопасные read-only tools `organism.project.context` и `organism.project.evidence`;
- добавлен `executeNextProjectStep()`;
- добавлен `POST /api/organism/projects/step`;
- сохранены budget/allowlist/destructive guards;
- restore/persistence проверены.

## Release hygiene
- application: **34.12.0**;
- schema: **89**;
- manifests regenerated;
- 68/68 machine-checklist checks PASS.

## Known open performance debt
250/500-cycle natural runs remain environment/GC sensitive and are not claimed as universal PASS. 1000-cycle and real-device long-horizon validation remain open.
