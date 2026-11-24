# BIG PASS 217 — Basal ganglia → consolidation → cortex

## Цель
Замкнуть reinforcement-сигнал basal ganglia с распределённой консолидацией памяти и добавить защиту от over-consolidation. Pass принят только после causal, persistence и regression tests.

## Реальный функциональный прирост
- `MemoryConsolidationController` теперь принимает `reinforcementGate01`, `redundancy01` и `semanticCompression01`.
- Для procedural-кандидатов хороший reinforcement повышает priority; слабый gate снижает её.
- Redundant/low-information memories получают повышенный `overconsolidationRisk01`, более низкий retention и чаще переходят в `defer`.
- Добавлен `applyOutcomeFeedback(...)`, связывающий prediction error, surprise и reinforcement с обучающим/retention сигналом.
- `OrganismCore` передаёт реальный basal-ganglia gate в consolidation candidates и сохраняет feedback state.
- Persistence проверена через полный `OrganismCore` restart.

## Причинное доказательство
- basal-ganglia explore gate: `0.941332`
- lesion-like gate: `0.504`
- procedural priority при хорошем reinforcement: `0.7803532`
- procedural priority при слабом reinforcement: `0.73662`
- redundant retention: `0.2083122`
- procedural retention: `0.6507565`
- redundant over-consolidation risk: `0.9806`
- procedural over-consolidation risk: `0.25`
- good-outcome retention: `0.6713066`
- bad-outcome retention: `0.224`

Это computational control result, а не утверждение биологической эквивалентности basal ganglia.

## Почему архитектура распределённая
Свежая работа Nature Neuroscience 2026 показала, что procedural replay в dorsal striatum может идти независимо от hippocampus и что reward/error влияют на приоритет replay. Поэтому проект не должен делать hippocampus обязательным посредником всей procedural consolidation.

## Regression
B208/B211/B212/B213/B214/B215/B216 tests остаются PASS.

## Ограничения
- Метрики измеряют программную динамику, не энергопотребление реального Android-устройства.
- `reinforcementGate01` — инженерный сигнал, а не буквальная нейромодуляция.
- Полный device gate требует отдельного запуска на физическом телефоне.
