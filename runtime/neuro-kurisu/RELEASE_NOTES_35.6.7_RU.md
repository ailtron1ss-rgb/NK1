# Neuro-Kurisu 35.6.7 / B354 — Release Notes

## Цель
Закрыть обязательную повторяемость Brick 3 из SCS-DIT и не переходить к Brick 4 на основании одной траектории.

## B354
- Добавлен независимый replication gate для causal B269.
- 5 независимых training trajectories × 4 contexts = 20 matched context replications.
- ON/OFF использует 90% persistent structural lesion; SHAM является контрольной perturbation без structural deletion.
- Holdout проходит через реальный serialization/restart: snapshot → новый `OrganismCore` → продолжение.
- Policy metric: 7-action softmax distribution L1.

## Evidence
- Replicated trajectories: 5/5.
- Context replications: 20/20.
- Global causal L1: 0.11326.
- Global sham L1: 0.03366.
- Causal/sham ratio: 3.36x.
- Persistent lesion after restart: 20/20.
- B269 cycles continue after restart: 20/20.

## Gate
Brick 3 replication is CLOSED on host. Brick 4 may start only while preserving this B354 baseline and its attribution tests. Physical Android/Termux gate remains OPEN.

## Honesty boundary
This is functional causal evidence for the current software organism. It is not evidence of phenomenal consciousness.
