# P2750 — Unified Causal World Loop

Дата: 2026-09-20
Версия: 35.14.0 / P2750

## Цель

P2750 переводит проект от набора отдельных predictive/continual controllers к единому циклу:

`latent state → context → online world model → uncertainty/risk → policy-vs-model planning → intervention value → causal update → multi-rate memory → synthetic model replay → neural learning → resource-aware compaction`

Это не утверждение о сознании. Слой предназначен для измеримой автономной адаптации, causal credit и sample-efficient continual learning.

## Что внедрено

- 8 contextual centroids с hysteresis/cooldown для автоматического выделения режимов.
- Три частоты memory update: fast / medium / slow.
- 8-D action-conditioned online dynamics model с reward mean, variance, confidence и model error.
- Ограниченный planner с depth 1–3; при низкой уверенности увеличивается policy fallback.
- Первичный directional causal matrix `pre latent -> latent delta` и causal strength matrix.
- Information value и intervention pressure.
- Synthetic replay из высокоуверенной world-model, ограниченный 1–3 samples за цикл.
- Adaptive replay priority, связанный с prediction residual, novelty, causal surprise и memory drift.
- Learning-rate gate от world confidence, memory consensus, mobile pressure и causal surprise.
- Replay compaction: последние 96 записей остаются горячими; старые записи переводятся в компактную форму при снижении compute budget.
- Все состояние сохраняется через snapshot/restore.

## Исследовательская база

1. Liu et al., ICML 2025 — online world models + planning для continual RL. Использована идея инкрементального shallow world model и планирования без тяжёлого переобучения.
2. Latyshev et al., 2026 — adaptive switching между model-based planning и policy execution при ошибках world model. Использовано как основание policy fallback.
3. Kim & Sreenath, 2026 — WOMBET: uncertainty-penalized world-model experience transfer и adaptive sampling. Использовано как основание для bounded synthetic replay.
4. Google Research, Nested Learning / Continuum Memory Systems — разные частоты обновления памяти. Адаптировано в lightweight fast/medium/slow memory bands.
5. Neural Networks 2026 — long-term + multiple short-term memory networks для continual learning. Использовано как архитектурный аргумент в пользу нескольких временны́х уровней памяти.
6. Eligibility-trace neuroscience literature — медленные eligibility traces как substrate delayed reward. P2750 использует тот же принцип multi-timescale accumulation, не заявляя биологической эквивалентности.
7. FAME ICLR 2026 / GitHub — fast learner + meta learner. P2734 уже содержит lightweight fast/meta controller; P2750 использует его как более высокий контур и не дублирует его.

## Решения адаптации под Termux/Android

Полные PPO/meta-RL/large-transformer implementations не переносились в runtime. Вместо этого используются bounded running statistics, массивы фиксированного размера, depth 1–3, synthetic replay с малым budget и hot/cold replay compaction.

## Ограничения

- Causal matrix пока является online directional association model, а не полноценной structural causal discovery системой.
- Synthetic replay не является ground-truth simulation; он допускается только при достаточной локальной model confidence.
- World model confidence в интегрированном branch пока остаётся умеренной; следующий этап должен измерить калибровку на held-out interventions.
- Host RSS smoke всё ещё значительно выше желаемого для medium Android; P2750 уменьшает replay residency, но не решает весь memory floor проекта.

## Фактические эксперименты

`P2750_UNIFIED_CAUSAL_WORLD_LOOP=PASS`
510 outcomes, 4 contexts, 15 switches, world confidence 0.2038, transition error 0.3667, causal credit 0.2810, memory consensus 0.7094, synthetic replay 180, restart 510.

`P2750_INTERFERENCE_MATRIX=PASS`
720 outcomes, 4 contexts, 10 switches, A visits 180, memory consensus 0.8207, world confidence 0.5830, synthetic replay 710.

`P2750_PLANNER_FALLBACK=PASS`
Cold information value 0.5491, cold learning scale 0.9490, hot world confidence 0.2353, planner agreement 1.0, synthetic replay 168.

`P2750_MOBILE_COMPACTION=PASS`
19 compaction cycles, 4428 compacted replay tokens, buffer 396.

Эти результаты подтверждают факт работы механизмов в тестовой среде; они не являются доказательством универсального performance gain.
