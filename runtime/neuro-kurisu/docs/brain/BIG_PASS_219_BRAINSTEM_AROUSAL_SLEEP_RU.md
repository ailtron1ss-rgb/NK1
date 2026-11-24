# BIG PASS 219 — brainstem/arousal + sleep-wake scheduling

Статус: VERIFIED

## Цель
Замкнуть состояние arousal/sleep-wake не как декоративную анатомию, а как функциональный scheduler, который может обратимо ограничивать вычисление, пластичность и одновременно открывать окно консолидации.

## Реализация
Добавлен `BrainstemArousalSleepScheduler`.

Состояния:
- `active`
- `wake`
- `recovery`
- `sleep`

Функциональные выходы:
- `computeScale01`
- `plasticityScale01`
- `consolidationQuota01`
- `memoryReplayScale01`
- `wakeInhibition01`
- `restorative01`

Входы:
- sleep pressure
- arousal demand
- body energy
- thermal state
- cognitive load
- uncertainty
- memory pressure
- circadian wake drive
- safety pressure

Есть hysteresis против дребезга состояния и persistent snapshot/restore.

## Причинные результаты
Active: compute=1.00, plasticity=0.92, consolidation=0.08.

Sleep: compute=0.18, plasticity=0.14, consolidation=0.6793768784.

Recovery under hot/low-energy stress: compute=0.52, restorative=0.2888.

Sleep-cycle state persisted for 3 scheduler ticks and restored identically.

## Integration
`CognitiveKernelCoordinator` теперь применяет brainstem frame к workspace scale и effective candidate budget. Интеграционный test подтверждает, что sleep-pressure снижает вычислительный режим coordinator относительно active режима.

## научная рамка
Это вычислительная функциональная абстракция, а не биологическая симуляция. Современные обзоры связывают sleep homeostasis с накоплением synaptic plasticity/cellular stress и показывают, что sleep/wake regulation распределена по нескольким neuromodulatory systems. Это поддерживает идею состояния организма как scheduler, но не оправдывает копирование конкретных ядер 1:1.

Источники:
- https://www.sciencedirect.com/science/article/pii/S0168010226000520
- https://www.sciencedirect.com/science/article/pii/S0166432826001762
- https://www.nature.com/articles/s42256-026-01255-3
- https://www.nature.com/articles/s44335-026-00062-8
