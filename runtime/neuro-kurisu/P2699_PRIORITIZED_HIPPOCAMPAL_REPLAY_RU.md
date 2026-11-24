# P2699 — Prioritized Hippocampal Replay

## Цель
Связать замкнутый цикл P2698 `действие → прогноз → исход → точное разрешение прогноза` с реальным выбором того, какие переживания повторно обучают policy learner.

## Модули
- `src/organism/learning/CausalExperienceStream.ts`
- `src/organism/learning/P26TrueLearningEngine.ts`
- `src/organism/core/OrganismCore.ts`
- `tests/p2699-prioritized-hippocampal-replay.mjs`

## До
P26 получал до 24 записей через сортировку `causalStrength + surprise + learningQuality`. Не учитывались как единая формула `prediction error`, `uncertainty`, `novelty`, `identity relevance`, `goal pressure`, возраст опыта и повторяемость replay.

## После
Добавлен `prioritizedReplayCandidates()` с приоритетом:
- surprise — 24%
- prediction error — 20%
- causal strength — 18%
- novelty — 12%
- uncertainty — 10%
- identity relevance — 8%
- goal pressure — 8%
- learning quality — 6%

Дополнительно применяется небольшой age boost и штраф за повторное воспроизведение/недавний replay.

После выбора `markReplay()` фиксирует `replayCount` и `lastReplayedAt`, поэтому replay теперь оставляет обучающий след и влияет на следующий отбор.

P26 дополнительно использует `replayPriority01` в sample weight и learning rate: более значимый опыт получает больший обучающий вклад, но остаётся ограниченным `clamp(0..1)`.

## Реальный runtime-путь
`CausalExperienceStream.prioritizedReplayCandidates()` → `P26TrueLearningEngine.replayCausalRecords()` → `CausalExperienceStream.markReplay()`.

Это не новый декоративный модуль: он вставлен в существующий цикл `OrganismCore` на каждом 48-м тике.

## Проверка
`npm run audit:p2699`:
- Typecheck — PASS
- P2699 prioritized replay — PASS
- P2698 exact world closure — PASS
- P2697 mobile residency — PASS
- P2696 contextual policy — PASS
- P2695 organism policy flow — PASS
- P2694 policy ablation — PASS

Тест P2699 подтвердил:
- high-surprise/high-causal опыт выбирается первым;
- replay действительно изменяет его следующий priority;
- выбранные записи реально доходят до P26 и вызывают обновления policy.

## Ограничение
Это инженерная реализация приоритизированного replay, а не доказательство биологического гиппокампа или сознания.
