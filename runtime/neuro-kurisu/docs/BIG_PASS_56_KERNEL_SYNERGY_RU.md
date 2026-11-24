<!-- Current release: 34.27.0 | schema 92 -->
# BIG PASS 56 — карта синергии ядра

## Главный принцип

Один механизм должен по возможности одновременно решать несколько задач. Предпочтительная схема для Neuro-Kurisu:

`signal → shared representation → pressure/priority → system action → evidence → learning`

## 1. System Fabric

`OrganismSystemFabric` объединяет lifecycle/ownership/restore/manifest семи систем.

Эффект:

- меньше знания Core о конкретных engines;
- единый composition root;
- переносимость на Android host;
- единая точка subsystem inventory.

## 2. Pressure + planner + metabolism

`CognitivePressureField` не должен становиться новой памятью. Он должен оставаться derived plane над:

- prediction error;
- prediction debt;
- grounding uncertainty;
- goal pressure;
- resource pressure.

Этот plane используется scheduler/planner и должен оставаться дешёвым.

## 3. Perception + World + Memory

Один observation не должен независимо превращаться в несколько несовместимых представлений.

Целевой pipeline:

`raw signal → perceptual evidence → GroundedWorldState → world update → prediction → memory`

## 4. Evidence + action

`tool OK` не считается world truth. Action result должен переходить в:

`request → receipt → postcondition → observation → verification`.

## 5. Model ecology

Модель не должна владеть identity. Identity принадлежит persistent subject substrate. Модели — заменяемые organs.

## 6. Core slimming rule

Нельзя оптимизировать Core за счёт смешивания canonical/derived state. Новый принцип:

- canonical state — минимальный и долговечный;
- derived state — пересчитываемый;
- diagnostics — bounded и не являются identity;
- experimental state — маркированный и reversible.

## 7. Неудачные направления

Не добавлять независимые:

- новые consciousness scores;
- новые identity scores;
- дублирующие memory systems;
- ещё один world model без benchmark;
- ещё один scheduler без измеренного выигрыша.

## 8. Уникальная стратегия

Развивать Neuro-Kurisu как **system-of-systems**, где каждый крупный system имеет:

`state + evidence + budget + lifecycle + learning + health + provenance`.

Тогда P-модули становятся внутренними органами системы, а не отдельными псевдомозгами.


## Итоговая синергия
`OrganismSystemFabric` теперь является физическим composition root для семи органов, а `OrganismCore` координирует их вместо непосредственного владения конструкторами. Это снижает coupling и создаёт стабильную точку для будущего Android host.

Следующая синергия: `PersistenceProjectionCoordinator` + event-oriented deltas. Это должно объединить множество повторяющихся snapshot-вызовов, но только после golden-output проверки каждого persistence-контракта.
