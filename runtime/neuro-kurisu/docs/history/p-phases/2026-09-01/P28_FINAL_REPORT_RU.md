# P28 Final Report — Plasticity Substrate & Learning Governance

## Release

Application: 7.8.0
Organism Core: 25.0.0-p28-plasticity-substrate-learning-governance
State schema: 31

## Что изменено

P28 добавляет быстрый локальный plasticity substrate под P26/P27: bounded prototype memory, sparse eligibility traces, action binding, post-outcome credit assignment и положительные/отрицательные локальные associations.

Также добавлены trust/quarantine rules для пластического обучения и информационно-экономический bias для выбора действий.

## Почему это нужно

Сравнение P27 с внешним Brain v11 показало, что большая когнитивная архитектура выигрывает по persistence, governance и evaluation, но может выиграть от дешёвого локального слоя пластичности. P28 добавляет именно такой слой, не заменяя P26/P27.

## Научная граница

P28 не доказывает general intelligence. Он добавляет измеримый механизм fast local adaptation и credit assignment.

## Следующая контрольная точка

Систему нельзя считать fully longitudinal autonomous organism без фактического device endurance и внешнего holdout/evaluator evidence.

## Performance evidence

On the current 3-CPU Linux host, the P28 substrate processed 5000 synthetic observations/credit events in ~69.7 ms. A 100-cycle `OrganismCore` run took ~2745.77 ms without external LLM latency. These are host-side engineering numbers, not POCO benchmarks.

## P28 design rule

Fast plasticity must remain small and bounded; learned policy/world layers operate on slower timescales; replay and developmental layers operate slower still. This prevents the organism from turning every learning event into an expensive global update.
