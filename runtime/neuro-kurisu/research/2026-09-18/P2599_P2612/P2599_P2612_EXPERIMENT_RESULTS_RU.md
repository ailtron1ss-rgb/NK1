# Experiment results — P2599–P2612

## Hierarchical transfer benchmark

- 28 low-level variants
- 16 meta-skills
- 64 child assignments
- compression ratio: 0.5217
- cross-context holdout: 160/160
- recovery routes: 33
- failed routes: 0

Этот benchmark синтетический; он подтверждает работоспособность механизма, а не general intelligence.

## Online world-model adaptation

- 520 adaptation updates
- onlineAdaptation01: 0.1322
- calibrationError01: 0.01145
- modelDrift01: 0.0993
- failureEvents: 1 при контролируемом shock
- recoveryGain01: 0.5159
- pre-shift running sensorimotor error: 0.0947
- post-shift running sensorimotor error: 0.0344

Показатели не являются ablation-доказательством превосходства над frozen baseline; для этого нужен отдельный A/B harness.

## Regression performance

Transferable benchmark: ~56.7k cycles/s против ~60.2k cycles/s предыдущего релиза на том же host benchmark. Иерархия стоит примерно 5–6% compute, поэтому её использование должно оставаться gated.
