# Neuro-Kurisu R20 — Anti-Decoration / Simulation-Evidence Audit

Дата: 2026-09-30
Версия: 35.34.0 / R20

## Цель

Проверить не только явные `TODO/FIXME/stub/mock`, но и функциональные имитации, которые внешне выглядят рабочими, однако способны выдавать синтетический результат за реальное наблюдение или напрямую менять canonical learning state без evidence.

## Найдено и исправлено

1. `NeuralExperienceBranch.syntheticReplay()` больше не пишет напрямую в canonical `actionReadout` и не выдаёт synthetic trajectory за observed learning. Synthetic trajectories проходят через `VerifiedSyntheticTrajectoryGate` и остаются planning hypotheses до observed confirmation.

2. `CausalSelfExperimentLab` разделяет designed / synthetic / observed evidence. Simulation-only runs не меняют calibration и не получают verified status. Canonical observation появляется только через `observeOutcome()` с observed source.

3. `BoundedOperationalJournal` больше не является no-op sink. Старое имя сохранено как совместимый alias на bounded recording journal; runtime-события реально записываются и доступны через snapshot/metrics.

4. B385/B391 больше не фиксируют `verified01:1` независимо от входного evidence. В records используется фактический `verified01`.

5. Host-only RAM/CPU telemetry больше не входит в embodied cognition. На host без реального Termux source эти величины остаются runtime diagnostics; cognitive body сохраняет last-known embodied baseline. Реальная Android/Termux telemetry продолжает использоваться как embodied evidence.

6. Mobile execution profile больше не выбирает отдельную cognitive semantics ветку для B295/B2508/B2501/B2506/B451. Mobile может экономить persistence/maintenance, но canonical cognitive configuration остаётся balanced, если явно не выбран quality.

## Anti-decoration gate

`P2900_ANTI_DECORATION_AUDIT=PASS`

- active source files: 546
- suspicious markers: 0
- synthetic learning leak: false
- synthetic causal evidence: false
- bounded journal: true

## Что сознательно осталось simulation-only

Counterfactuals, dream/rehearsal, shadow-world predictions, future simulation и synthetic trajectory generation не удаляются: это реальные computational mechanisms для planning/replay. Но их outputs должны оставаться гипотезами до evidence-gated promotion.

## Остаточный риск

`P2895` long-horizon может превышать aggregate runner timeout; отдельный execution gate необходимо запускать изолированно. Это не является доказанным runtime failure.
