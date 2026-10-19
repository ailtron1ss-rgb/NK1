# B272 Release Notes

## Большое изменение

B272 вводит `EndogenousGoalGenesis` как интегрированный слой между neural/self/autobiographical substrate и action arbitration.

## Изменения

- непрерывный 8-D goal representation;
- self/world/need conflict → goal generation;
- learned action prototypes;
- goal/action plasticity;
- bounded endogenous action bias;
- independent hidden evaluator;
- personality evidence bridge;
- persistence + migration;
- Core API:
  - `b272EndogenousGoalStep`
  - `b272EndogenousGoalLearn`
  - `b272EndogenousGoalCurrent`
  - `b272EndogenousGoalDiagnostics`

## Evidence

Standalone policy/generalization gain: **+0.078125** against hidden-task baseline.

Full Core restart preservation: **PASS**.

## Release gates

Typecheck, full audit, architecture, integrity, hygiene, syntax, contract, forensics, lockfile, release-source, doctor, archive manifest and archive verification — PASS.
