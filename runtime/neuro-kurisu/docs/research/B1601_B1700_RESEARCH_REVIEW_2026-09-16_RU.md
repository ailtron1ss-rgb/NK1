# Research Review B1601–B1700 — Continuous Identity

## Новые внешние ориентиры

### Transactional Continuity Kernel

Август 2026: работа `Beyond Memory: A Transactional Continuity Kernel for Long-Lived AI Agents` формулирует continuity как непрерывную авторизованную lineage accepted branch heads и предлагает protocol `quiesce -> checkpoint -> validate -> activate -> resume`. Это особенно близко текущему B1700 и послужило архитектурным ориентиром для durable branch head и commit validation.
Источник: https://arxiv.org/abs/2608.11632

### Runtime-independent persistent agents

Сентябрь 2026: работа о runtime-independent persistent agents разделяет continuity-bearing substrate (identity, durable memory, versioned software body) и replaceable deployment binding. Это поддерживает будущую идею B1700+: смена host/runtime не должна означать рождение нового субъекта, если continuation authority и lineage корректно переданы.
Источник: https://arxiv.org/abs/2609.00546

### APEX-MEM

ACL 2026: APEX-MEM использует temporally grounded property graph, append-only evolution и retrieval-time conflict resolution. Архитектурный урок для Neuro-Kurisu: continuity должна сохранять изменение информации во времени, а не перетирать прошлое единственным summary.
Источник: https://aclanthology.org/2026.acl-long.749/

### Hindsight

ACL 2026: Hindsight разделяет world, experience, observation и opinion networks. Для artificial personality это важное различие между тем, что субъект помнит как объективное событие, что он наблюдал, и что он считает своим мнением.
Источник: https://aclanthology.org/2026.acl-demo.27/

### LifeMem / longitudinal trajectories

Исследования 2026 года по longitudinal memory показывают пользу сочетания структурированной life-event memory с изменяемой parametric/behavioral representation. Для Neuro-Kurisu это поддерживает separation между durable autobiographical events и evolving self-model.
Источник: https://arxiv.org/abs/2608.19621

## Архитектурный вывод

Самая сильная стратегия для Neuro-Kurisu — не один giant memory file, а несколько слоёв с разными правами:

1. authoritative identity/continuation lineage;
2. append-only temporal life history;
3. episodic memory;
4. semantic/schema abstraction;
5. evolving self-model and values.

B1700 реализует пункт 1 и связывает его с уже существующими слоями P84/P78/P39/B1351-B1600.
