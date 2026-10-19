# CHANGELOG V85

Дата: 2026-09-23

## Тип прохода
Qualification / benchmark pass. Архитектурная frontier остаётся V84.

## Реальные изменения
- reproducible external continual benchmark на sklearn_digits;
- four-way matched strategy protocol;
- three task domains;
- task-specific fixed parameter-free target teachers;
- learnability gate;
- forgetting / BWT / adaptation / replay-cost metrics;
- preservation test for externally supplied replay targets;
- rejection of an earlier chance-level benchmark fixture.

## Results
- compact 3-seed / 2-domain learnability gate passed;
- average adaptation positive in all four strategies;
- no robust task-level replay superiority established;
- one-seed 3-domain stress observed lower forgetting for fixed replay, but insufficient for generalization.

## Decision
V84 remains architecture frontier. V85 becomes the external qualification baseline for V86.
