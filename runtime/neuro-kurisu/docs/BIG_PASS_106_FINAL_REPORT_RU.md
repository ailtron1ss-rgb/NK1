# BIG PASS 106 — Longitudinal Replay Evidence

## Цель
Усилить существующую цепочку Memory → Replay → Causal Learning → Unified Learning → Retention → Transfer, не создавая второго memory store или planner.

## Реализовано
- LongitudinalReplayTrial с фазами acquisition/delay/test/holdout.
- Pair matching по experiment/task/pair/context/delay.
- Confirmatory eligibility требует randomized + balanced protocol, минимум требуемых matched pairs, holdout и несколько задержек.
- Дедупликация replay validation по memory/evidence/task/context/delay предотвращает искусственное увеличение доказательной выборки.
- Longitudinal evidence bounded до 192 записей.
- Core API для записи и анализа longitudinal trials.
- State schema 114 → 115.
- Regression + migration + release audits.

## Что не утверждается
Тестовый harness подтверждает корректность механики эксперимента, но не доказывает биологическую консолидацию, человеческую память или сознание. Synthetic fixtures не считаются empirical evidence организма.

## Проверки
Typecheck, Pass 103–106 regression, migration, evidence-gating, architecture, source-truth, release contract, project state, mobile 1000, operational 500/1000 и server smoke — PASS.

## Следующий научный шаг
Следующим этапом заполнять harness реальными longitudinal observations Neuro-Kurisu и отдельно анализировать delayed retention, positive/negative transfer и interference на независимых holdout-наборах.
