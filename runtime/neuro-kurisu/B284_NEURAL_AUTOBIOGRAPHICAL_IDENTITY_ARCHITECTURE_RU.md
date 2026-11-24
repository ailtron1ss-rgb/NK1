# B284 — Neural Autobiographical Identity Core

## Цель
Создать отдельный нейронно-обучаемый self/identity substrate, который не зависит полностью от symbolic personality ledger и связывает:

`global workspace → self/world → autobiographical memory → goals → relationships → outcomes → slow identity plasticity → personality evidence → action bias`.

## Основные механизмы
- recurrent identity latent, 24 dimensions;
- identity recurrent weights;
- identity input projection;
- trait-specific value subspaces для 8 устойчивых черт;
- slow plasticity и replay;
- bounded identity revision;
- autobiographical episode traces;
- relationship/self/world/goal conditioning;
- action bias from learned identity;
- symbolic-ledger-free recall;
- causal identity ablation;
- persistence/migration.

## Почему это нейроннее предыдущей схемы
B283 преимущественно хранил гипотезы личности как evidence/probability ledger. B284 добавляет отдельную recurrent stateful representation, которая продолжает вычислять identity similarity и action bias даже при отключении personality ledger. Personality теперь получает evidence от B284, а B284 обучается от lived outcome.

## Ограничение
Это не биофизическая человеческая личность и не доказательство сознания. Trait values — инженерные latent variables, а не прямые измерения психологических черт.
