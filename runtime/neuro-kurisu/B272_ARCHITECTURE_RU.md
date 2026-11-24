# B272 — Эндогенная генерация целей / единый self-neural-goal контур

Дата: 2026-09-12
База: B271 Neural Autobiographical Core
Статус: research-release

## Цель

B272 закрывает главный искусственный разрыв B271: цель больше не выбирается из заранее заданного словаря вроде `seek-novel-evidence`/`repair-model`. Вместо этого система формирует непрерывный 8-мерный goal-vector из:

- prediction error;
- uncertainty;
- novelty;
- energy/homeostasis;
- social pressure;
- autobiographical continuity;
- identity continuity;
- текущих learned traits.

Цель оценивается по внутреннему конфликту, потребности, согласованности с self/world-контекстом и прогнозируемой ценности будущего состояния.

## Механизм

`B269 spikes`
→ `B270 germinal self/traits`
→ `B271 autobiographical sequence/self prediction`
→ `B272 endogenous goal vector`
→ `learned action prototypes`
→ `action arbitration`
→ `real outcome`
→ `goal/action plasticity`
→ `personality evidence`
→ `persistent self/goal continuity`

B272 не создаёт новый hard-coded список целей. Он создаёт непрерывные внутренние goal representations; названия/семантические ярлыки не нужны для работы контура.

## Что обучается

1. `actionPrototypeWeights[7][8]` — связь внутренних goal-векторов с действиями.
2. `goalWeights[8][8]` — внутреннее взаимодействие goal dimensions.
3. `currentGoal` — текущее эндогенное состояние цели.
4. `goalHistory/outcomeHistory` — causal history для обучения и restart.

## Стабилизационные механизмы

- bounded weights;
- self-conflict penalty;
- internal coherence score;
- confidence gating;
- independent evaluator gain signal;
- persistence/migration;
- bounded action bias (не способен единолично переписать policy).

## Что B272 НЕ утверждает

- это не сознание;
- это не биологический brain simulation;
- это не доказанная субъективность;
- 8 dimensions остаются инженерным latent space, а не готовой теорией человеческих целей;
- action set (`respond/explore/verify/...`) всё ещё задан архитектурой организма.
