# P2836 — Reality-First + Neural Causal Trace + Adaptive Fast/Slow Replay

Дата: 2026-09-20
Релиз: 35.18.2
Предыдущая база: 35.18.1 / P2835 Hardened

## Главная задача

P2836 не добавляет очередную декоративную подсистему. Он перестраивает центральную часть жизненного цикла организма так, чтобы результат реального embodied-действия мог стать первичным источником обучения, а встроенная симуляция оставалась shadow-model для предсказаний и counterfactual planning.

Ключевой новый цикл:

`perception → prediction → simulated shadow → embodied action → reality grounding → feedback → neural learning → causal trace → memory/continuity`

## Что изменено в коде

1. `RealityGroundingController` определяет authoritative outcome как `external` или `simulation`, ведёт quality/provenance статистику и не разрешает unavailable device outcome притворяться реальным.
2. `NeuralCausalTraceLedger` сохраняет compact trace изменения нейросостояния до/после feedback/learning и явно ставит `ablationRequired=true`, поэтому state-change не объявляется причинным доказательством.
3. `OrganismRuntime.stepInternal()` теперь выполняет embodied action до authoritative feedback. В `external` режиме simulator outcome остаётся shadow и больше не подаётся как физическая истина.
4. `B365` получает reward/consequence/evidence из reality-grounding resolution. Simulation-only случаи продолжают обучать simulator path.
5. `B380` temporal life закрывается по grounded outcome, а не безусловно по simulator reward.
6. `ContinuousCognitiveFabric` теперь получает reality-grounded signal после embodied outcome.
7. P2820 получил лёгкий fast/slow replay thermostat: surprise memory, fast-memory mass, slow teacher drift и адаптивное распределение replay/distillation. Это локальная mobile-friendly реализация идей test-time memory, а не копия внешней архитектуры.
8. `NeuralExperienceBranch.replay()` использует новый replay allocation перед выбором replay budget.
9. Новые состояния сохраняются в `OrganismSystemState`, поэтому restart не теряет reality-grounding и neural-causal accounting.

## Чего P2836 намеренно НЕ утверждает

- Наличие феноменального сознания.
- Полную causal attribution нейросети: для этого нужны intervention/lesion/ablation эксперименты.
- Независимую проверку эффекта TTS: текущий `respond` имеет `actuation-receipt-only`, если нет отдельного наблюдателя эффекта.
- Полноценный визуальный world model уровня крупных video models: текущий проект сохраняет компактный JS/Termux-oriented world-model слой.

## Критерий качества

P2836 считается корректно интегрированным, когда typecheck + P2835 hotpath + P2835 persistence + P2836 reality-first integration проходят одновременно, а system snapshot после цикла содержит оба новых persisted ledger.
