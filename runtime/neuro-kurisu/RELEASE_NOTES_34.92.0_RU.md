# Neuro-Kurisu 34.92.0 — BIG PASS 118

## Long-Horizon Behavioral Sequences / Compound Learning / Retention-Rollback

Этот проход переводит причинный developmental loop от одиночного исхода к временным последовательностям поведения. Уже существующие P27/P30/P36, CausalExperienceStream и ProceduralSkillLibrary не дублируются: добавлен только недостающий слой доказательной консолидации поведенческих последовательностей.

### Сделано

- накопление коротких поведенческих эпизодов (2–4 действия);
- оценка последовательности по повторяемости, подтверждённым исходам и разнообразию контекстов;
- отдельное holdout-учёт при новом контексте;
- delayed retention: успех после временного разрыва учитывается отдельно;
- cross-context transfer для уже подтверждённых последовательностей;
- bounded behavioural prior в выборе следующего действия;
- автоматическая блокировка promoted sequence после устойчивой серии провалов;
- интеграция с P30 multi-step trajectory evaluation;
- persistence/migration и API диагностики;
- отдельный regression test на promotion, transfer, retention и rollback.

### Evidence boundary

Эта система измеряет поведенческое обобщение и устойчивость стратегии. Она не является доказательством сознания, субъективного опыта или общей интеллигентности.

## Current source-of-truth

Release: **34.92.0** · state schema **122** · phase **Stage-10/long-horizon/behavioral-sequences/compound-learning/retention-rollback**.
