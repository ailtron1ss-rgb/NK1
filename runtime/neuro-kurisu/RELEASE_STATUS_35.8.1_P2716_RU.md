# Neuro/Kurisu 35.8.1 — P2716 release status

## Что изменено

P2716 объединил multi-horizon credit `1/2/4/8/16/32/64/128`, adaptive plasticity, synaptic protection, replay/consolidation, world/self coupling, experiment drive, mobile maintenance и external promotion gate. Дополнительно исправлены два runtime-дефекта: отсутствие outcome wiring в micro-path и потеря `neuralExperienceBranch` при migration/restart.

## Runtime evidence

- P2716 deep integration: PASS, 144 outcomes.
- P2716 continual battery: PASS; task-A forgetting пока не лучше control (`0.0540` vs `0.0510`), task-B в этом benchmark лучше (`0.0000` vs `0.0046`).
- P2716 mobile soak/restart: PASS; `deepOutcomes=246`, `persisted=1`, median ratio `1.444`.
- P2716 promotion gate: PASS; внешний validation обязателен.
- P2708 long horizon: PASS, 250 operational cycles, warmed median ratio `0.846`; heap growth `3.920x` в данном прогоне.

## Integrity gates

TYPECHECK, RELEASE_CONTRACT, SOURCE_TRUTH, ARCHITECTURE, INTEGRITY, HYGIENE, SYNTAX, FORENSICS, SOURCE-RELEASE и API route audit проходят.

## Что ещё нельзя считать доказанным

Этот релиз не доказывает феноменальное сознание, биологическую эквивалентность, общую автономную личность или superiority нового learner на catastrophic forgetting. Это инженерная интеграция механизмов и экспериментальная инфраструктура с честно зафиксированными отрицательными результатами.

## Следующий крупный bottleneck

Следующий проход должен атаковать не размер контроллера, а качественную обучаемость: контекстно-зависимую консолидацию, selective synaptic protection, A→B→A и interleaved continual battery, delayed sparse reward, counterfactual credit, matched ablations и 500-cycle persistence/thermal matrix.
