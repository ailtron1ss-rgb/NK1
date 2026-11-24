# Neuro-Kurisu 35.6.34 — B401–B420 Research Upgrade

## Цель

B401–B420 переводит проект от простого набора developmental-компонентов к адаптивной исследовательской среде, где несколько независимых механизмов памяти, состояния, prediction и goal/value reasoning конкурируют и обучаются на одном потоке опыта.

Главное ограничение архитектуры сохранено: **B365/B299 остаются canonical decision/policy owners**. B385–B390, B391–B400 и B401–B420 поставляют только bounded residual evidence/bias.

## Реализованные механизмы

1. Surprise-gated memory — приоритет событий с высоким surprise/salience.
2. Continuum memory — fast / medium / slow update rates.
3. State-space recurrent path — лёгкое скрытое состояние для непрерывности.
4. Latent predictor — compact action-conditioned latent estimate.
5. Counterfactual rollout — короткий мног шаговый rollout по выученным transitions.
6. Goal/value expert — привязка выбора к текущему goal/self/motivation.
7. Distributed population-code expert — 24-мерное распределённое представление с action readout.
8. Adaptive ensemble — online reweighting экспертов по observed loss.
9. Retention gate — decay/consolidation прототипов через surprise/salience.
10. Restart persistence — перенос state через PersistedOrganism + StateMigrations.
11. Lesion API — раздельное отключение memory/predictor/controller/state-space/latent/population.
12. Holdout research benchmark — hidden-rule test без использования тестовых labels для изменения weights.

## Исправленный архитектурный разрыв

Во время аудита B400 было обнаружено, что часть B385–B401 реально работала только в `spineOnly`. В B420 они подключены и к обычному full `observe()`/`feedback()` пути.

Дополнительно StateMigrations теперь сохраняет B385/B391/B401 состояния. Поэтому restart-проверка выполняется не только на уровне отдельных классов, но и через полноценный PersistedOrganism.

## Adaptive compute budget

Для mobile profile дорогой исследовательский контур не выполняется на каждом такте. Он запускается:

- каждые 3 цикла;
- либо раньше при высокой novelty;
- либо при высокой uncertainty;
- либо при высоком prediction error.

Между вычислениями используется последний verified research output как bounded residual signal.

Это позволяет расширять когнитивный контур без превращения полного цикла в постоянный heavy benchmark.

## Научные идеи, от которых взяты направления

### Nested Learning / continuum memory

Идея многочастотных обновлений и continuum memory была вдохновлена работой Google Research по Nested Learning и Hope. Реализация проекта является lightweight инженерной адаптацией, а не реализацией Hope/Titans.

### Titans / MIRAS

Для surprise-aware test-time memory, retention и online associative updates использованы идеи Titans и MIRAS.

### JEPA / V-JEPA 2

Latent predictor и action-conditioned rollout вдохновлены подходом latent world model и planning через predicted consequences.

### Distributed population codes

Population-code expert использует высокоразмерное распределённое состояние. Это исследовательская гипотеза, вдохновлённая современными результатами mechanistic interpretability для video world models.

### SSM / Mamba-like direction

State-space expert сделан lightweight, чтобы сохранить телефонную совместимость; это не реализация Mamba-2.

## Ограничения

B401–B420 не является реализацией самих научных публикаций. Это собственная low-cost экспериментальная архитектура, использующая их идеи.

Synthetic benchmark не является доказательством человеческого уровня интеллекта, сознания или реального world understanding.
