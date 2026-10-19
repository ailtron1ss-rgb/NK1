# Neuro Kurisu 35.6.70 — P2587–P2598

## Релиз

- Application: `35.6.70`
- Organism core: `81.0.0-transferable-embodied-brain-p2598`
- State schema: `176`
- Phase: `Stage-54/Transferable-Embodied-Brain/P2598`
- Status: `research-release`

## Что реально изменено

### 1. Переносимые процедурные навыки

Добавлен `TransferableEmbodiedSkillSystem` с компактной памятью процедурных навыков: контекстный прототип, action-conditioned delta, successor-feature представление, reward/success/confidence/stability, uncertainty/contradiction, usage/source count и option-length.

Слой подключён прямо в `NeuralExperienceBranch`: навык влияет на выбор действия, получает outcome, сохраняется в snapshot/restore и участвует в diagnostics/continuity.

### 2. Реальный fallback для новых состояний

`B2521LearnedGenerativeOrganismLoop` больше не зависит только от exact key. Новый порядок:

`exact key → nearest prototype → global action prior`.

В runtime-проверке B2521 покрытие поднялось примерно с прежнего `0.0037` до `0.4190`; это конкретное инженерное изменение, а не декларативная метрика.

### 3. Многошаговая модель последствий

`EmbodiedCausalWorldBridge` расширен до H1/H2/H4/H8/H16. H8/H16 включаются только при достаточном вычислительном бюджете, чтобы не превращать телефонный runtime в постоянный deep rollout.

Тест показал рабочий H16 и убывающую уверенность на дальнем горизонте: H1≈0.967, H16≈0.809. Это ожидаемый сигнал compounding uncertainty, который теперь виден системе вместо скрытого допущения.

### 4. Causal-effect focused learning

В latent dynamics добавлена лёгкая CAER-inspired переоценка градиента: сильнее обучаются измеримо action-affected компоненты. Это явно является эвристическим переносом идеи, а не точной репликацией CAER.

### 5. Intervention / recovery

Procedural-skill layer отслеживает моменты высокой неопределённости, интервенционные пробные окна и recovery при большом prediction error. Recovery bias направляет систему к `verify/explore/reflect` вместо слепого продолжения ошибочного действия.

### 6. Защитная консолидация навыков

Добавлен baseline skill consolidation: при насыщении банка близкие навыковые прототипы с одним действием могут быть объединены по context/delta/successor similarity. Текущий интеграционный benchmark пока не показывает измеримого выигрыша от этого механизма, поэтому он не засчитан как доказанный прирост.

## Проверки

- Typecheck: PASS
- Architecture: PASS, `1456` source files, `447` canonical files, `0` cycles
- Source hygiene: PASS, `3212` files, `0` errors, `0` warnings
- Contract: PASS
- Forensics: PASS, `3197` active files, `0` duplicate content, `0` duplicate names
- Full audit: PASS
- Brain audit: PASS, `447` organism files, `9` links
- Integrity: PASS, `3218` files
- Executable syntax: PASS (`1028` JS, `6` SH, `219` JSON)
- Release source: PASS
- Archive manifest: PASS after final packaging
- Mobile smoke: PASS, 30 autonomous steps; direct measurement `26.65 s`, peak RSS `354596 KB` on the current host with V8 heap cap `256 MB`

## Важное ограничение

`release:audit` как единая агрегированная команда не успела завершиться в заданном 360-секундном окне: timeout произошёл на позднем этапе после успешного прохождения предыдущих блоков. Сам `test:p2559-2566:runtime`, который был последним, отдельно повторён и прошёл за `7.74 s`. Остальные release-gate тесты после timeout также были отдельно перезапущены и прошли. Поэтому это ограничение относится к длительности агрегатора, а не к отдельному P2559 runtime test.

## Что ещё нельзя объявлять доказанным

- сознание не доказано;
- открытая general intelligence/generalization не доказана;
- holdout/generalization внутри синтетических benchmark'ов не эквивалентны реальному внешнему переносу;
- реальное thermal/RAM поведение на физическом Android-телефоне не измерялось;
- внешняя мультимодальная ground truth всё ещё слабее внутреннего моделирования.
