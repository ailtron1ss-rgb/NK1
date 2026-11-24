# PASS 12 — Neural backend + mLSTM assimilation

Дата: 2026-09-30

## Реально изменено

- Добавлен `NeuralSubstrateBackend` как единая composition point для canonical neural substrate.
- `CanonicalNeuralSubstrate` остаётся единственным canonical learning/source-of-truth path.
- Добавлен portable CPU/Termux-safe `MLSTMNeuralSubstrate`, реализующий recurrence mLSTM без встраивания Triton/PyTorch runtime в Node.
- mLSTM запускается только как явный research shadow/ablation backend и не владеет identity, memory, policy или provenance.
- R23 `BoundedRecurrentStateSubstrate` перенесён из `OrganismCore` во владение `DevelopmentalNeuralRuntime`.
- Добавлен persistence-safe compatibility layer: существующий `system.canonicalNeuralSubstrate` формат не ломается.
- Добавлены backend/restart/determinism тесты.
- Добавлена документация ассимиляции `docs/external/MLSTM_ASSIMILATION_R26.md`.
- Старый жёсткий line-count audit Core заменён regression guard; историческая цель 3,482 строки сохранена как будущий target, а не выдана за готовый результат.

## Проверки

- Typecheck: PASS
- New neural substrate backend test: PASS
- R25 neurocore architecture: PASS
- R26 matched ablation: PASS
- R26 planning: PASS
- P2900 anti-decoration: PASS
- P2902 operation evidence: 165/165 verified
- P2904 memory budget: PASS
- P2905 long-memory battery: PASS
- P2876 mobile diagnostic hotpath: PASS
- Core ownership: PASS, 5 direct constructors
- Core physical ownership: PASS with regression guard
- Source hygiene: PASS
- Architecture audit: PASS
- Integrity audit: PASS
