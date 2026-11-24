# B316 Next Step Plan

## Что НЕ надо делать следующим шагом

Не добавлять ещё одну memory, ещё один policy learner или ещё один parallel personality ledger только ради роста функциональности.

B316 показал, что локальный representation bottleneck был реальным и теперь исправлен. Следующая проблема уже другого уровня.

## Следующий крупный шаг - B317

1. Closed-loop endurance: 80-120 organism ticks in controlled phases.
2. Three phases: neutral baseline -> verified positive/negative learning -> recovery/holdout.
3. Track whole-organism action distribution, B296 neural state, B299 personality, AdaptivePolicy and B285 scar in one aligned report.
4. Add resource pressure to the same trajectory instead of separate isolated benchmark.
5. Test restart in the middle and at the end of the trajectory.
6. Test an unseen semantic context after training to measure whether action-specific scar generalizes in a bounded way.
7. Keep one canonical owner per subsystem.
8. Do not call P6 closed until the behavior changes across a long trajectory rather than only internal state values.

## Hardware gate

A separate physical Android/Termux run is still required for the device evidence line. Host proxy numbers are not a substitute.

## Strategic rule

Next improvement should either:
- materially change whole-organism causal behavior;
- close a measured P6/P7 gap;
- or remove a significant verification/dependency bottleneck.

Otherwise it should not be promoted to a large pass.
