# P2851 — Continual Learning Utility + Functional Lesion + Developmental Plasticity

## Что реально изменено

1. **Replay стал task-sensitive.** Каждый replay-проход теперь измеряет ошибку отдельного prediction/readout probe до и после пластического обновления. Сохраняются `replayTaskErrorBefore01`, `replayTaskErrorAfter01`, число оценённых replay-сэмплов и `replayUtilityGain01`. Это отделяет «веса изменились» от «изменение дало измеримый локальный эффект на задачу».
2. **Replay обновляет prediction readout.** Помимо synaptic/action plasticity, replay теперь делает bounded update prediction readout по signed temporal error.
3. **A→B→A→C→A тест.** Добавлен многозадачный прогон с возвратами к старой задаче и проверкой, что replay не остаётся только счётчиком обновлений.
4. **Функциональный lesion probe.** `lesion()` теперь сравнивает здоровый и 50%-lesioned режимы по prediction, action-bias distance и latent distance, затем реально восстанавливает связи и измеряет recovery. Это более чувствительно, чем прежний одиночный prediction-drop.
5. **Developmental plasticity.** Добавлен bounded `developmentalPlasticityScale01`: он медленно меняет базовую скорость обучения на основе подтверждения, ошибки, novelty и stability. Это реальная модификация learning-rate, а не диагностический флаг.
6. **Persistence.** Новые поля нормализуются при restore и входят в snapshot/diagnostics.

## Проверка

- `npm run typecheck` — PASS.
- `test:p2851:utility-lesion-development` — PASS.
- `test:p2850:neural-continuity` — PASS.
- `test:p2850:core` — PASS.
- `test:p2844:neural-benchmark` — PASS, overall прежний benchmark 0.9143362458437303.
- `test:p2844:integration` — PASS.

## Важные результаты P2851

- Replay evaluated: 118.
- Replay weight updates: 11328.
- Holdout-style task error: 0.301167 → 0.300998.
- Lesion latent drop: 0.4080; measured recovery: 0.9911.
- Developmental plasticity scale: 1.0000 → 1.00642.

Малое изменение task error — намеренно не маскируется: следующий проход должен увеличить размер и независимость holdout-задач, чтобы доказать полезность replay не на синтетическом probe, а на устойчивом поведении.

## Научная опора

Работа продолжает линию experience replay и sleep-like replay. Исследования показывают, что replay может поддерживать continual learning, а sleep-like локальная пластичность может уменьшать catastrophic forgetting. При этом внутренний replay и replay без полного хранения входных данных остаются важными направлениями для brain-inspired continual learning. См. исследование van de Ven et al. (2020), Tadros et al. (2022), а также более свежую работу Wang et al. (2025) о потере пластичности и experience replay.

Это инженерная модель нейронной пластичности; она не доказывает биологическую эквивалентность мозга или наличие сознания.
