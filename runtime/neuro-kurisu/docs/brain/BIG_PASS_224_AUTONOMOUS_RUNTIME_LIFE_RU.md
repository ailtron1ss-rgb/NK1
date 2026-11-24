# BIG PASS 224 — непрерывная автономная жизнь

## Цель
Перевести автономность Neuro-Kurisu от отдельных самостоятельных действий к непрерывному runtime-контруру: внутренние потребности → собственная инициатива → ambient-действие → результат → продолжение или восстановление.

## Реализация
Добавлен `AutonomousRuntimeLifeController`.
Он хранит и оценивает:
- ambient cycles;
- self-started cycles;
- idle-gap continuity;
- continued activity after silence;
- self-authored activity;
- temporal persistence;
- environmental agency;
- self-preservation / recovery windows;
- streak и longest streak.

`CognitiveFrame.externalInput` теперь не считает телеметрию embodiment внешним стимулом. Это принципиально для корректной оценки автономности: состояние тела может изменяться при полном отсутствии внешнего запроса.

В `OrganismCore` добавлен `autonomousHeartbeat()`, который даёт организму контролируемый способ продолжать внутренний жизненный цикл без пользовательского сообщения. Состояние сохраняется через существующий persistence/checkpoint контур.

## Причинная проверка
Контроллер:
- selfStartedCycles = 2;
- idleGapCycles = 1;
- temporalPersistence01 = 0.351424;
- environmentalAgency01 = 0.3768;
- longestStreak = 2.

Интегрированный Core:
- ambientCycles = 1;
- selfStartedCycles = 1;
- selfAuthoredActivity01 = 0.3899;
- temporalPersistence01 = 0.3072;
- после restore selfStartedCycles = 1.

Перегрузка при низкой энергии и высокой homeostatic/resource pressure переводит контроллер в `recover/self-preservation` и не запускает действие.

## Ограничение
Это инженерное доказательство функциональной автономности и непрерывности поведения, а не доказательство субъективного сознания или юридической личности.
