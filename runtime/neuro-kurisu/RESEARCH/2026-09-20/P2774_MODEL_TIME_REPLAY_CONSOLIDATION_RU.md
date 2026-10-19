# P2774 — Model-Time Replay & Episodic→Semantic Consolidation

Дата: 2026-09-20

## Идея
Replay переводится с фиксированного tick-time на bounded model-time: внутренние изменения world model, prediction error, novelty, verification и causal delta накапливаются как величина model-time. Когда накопленное изменение пересекает adaptive interval, replay становится due. При росте forgetting-risk или novelty интервал сокращается.

## Архитектура
- model-time accumulator;
- forgetting-risk estimator;
- replay debt и adaptive replay interval;
- bounded episodic trace store на 64 записи;
- compact старых traces с агрегацией близких context/action traces;
- recurrence counters по context/action;
- медленная semantic memory по контекстам;
- episodic→semantic consolidation только при доказанной recurrence/importance;
- snapshot/restore;
- resource-aware replay budget;
- replay scoring по model-time forgetting pressure.

## Почему это принято
FOREVER привязывает replay к model-centric time, вычисляемому через изменение модели, а не к одинаковому числу шагов. RecMem мотивирует отсрочку дорогой консолидации до устойчивой recurrence. Работа о hippocampo-neocortical interaction поддерживает функциональное разделение fast episodic storage и slow semantic integration. Эти идеи адаптированы в лёгкую статистическую форму без тяжёлой LLM/PPO зависимости, чтобы сохранить mobile/Termux constraint.

## Ограничения
Это инженерная continual-memory модель, не биологическая копия hippocampus/neocortex и не доказательство сознания. Semantic consolidation bounded и намеренно слабая, чтобы избежать разрушения существующей neural branch.

## Реальная интеграция
`NeuralExperienceBranch` использует P2774 для replay budget/order, learning-scale modulation и controlled semantic bridge обратно в slow-memory. Состояние сохраняется вместе с NeuralExperienceBranch state version 25.
