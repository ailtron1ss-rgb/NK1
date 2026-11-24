# P8 Genesis — отчёт внедрения идей Architecture Report

## Источник
`Neuro_Kurisu_Evolution_Mega_Architecture_Report_2026-08-26.docx` — источник требований для этой итерации. Исходный DOCX сохранён в `docs/source/`.

## Реализовано
1. Cognitive Field — общий state-space для arousal/valence/uncertainty/salience/conflict/pressure/fatigue/coherence.
2. Cognitive Pressure — attention debt, contradiction, commitment, prediction-error, social/goal/curiosity pressure.
3. Cognitive Budget — вычислительный режим зависит от battery, thermal, RAM, CPU, attention и expected information gain.
4. Cognitive Immune — provenance-aware quarantine и basic prompt-injection/source-trust guard.
5. Source Monitor — источник каждого важного входа + epistemic status.
6. Procedural Skill Library — наблюдение успехов/ошибок и promotion до habit.
7. Scientific Method Engine — persistent scientific projects/hypotheses/evidence/revisions.
8. Learned Residual World Model — online correction к deterministic planner; не заменяет World Model 2.0, но создаёт обучающий слой.
9. Planner теперь учитывает learned residual reward.
10. Budget mode влияет на action utility.

## Почему именно это первым
Эти компоненты создают внутренний «метаболизм» и provenance-контур, на которых следующий learned World Model сможет строиться причинно. Они также дёшевы для среднего Android и не требуют on-device training большой модели.

## Не заявляется
Это не biological brain simulation и не доказательство сознания/free will.

## Следующий шаг — P9
`Learned World Model 2.0`: latent state, causal transitions, residual learning, uncertainty calibration, future simulation and external evaluator.
