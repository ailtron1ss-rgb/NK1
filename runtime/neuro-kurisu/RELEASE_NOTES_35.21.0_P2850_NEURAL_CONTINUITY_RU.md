# Neuro Kurisu 35.21.0 — P2850 Neural Continuity / Replay / Cross-Modal Binding

## Большой проход

P2850 продолжает P2844 без создания параллельного мозга. Изменения внесены непосредственно в существующий `NeuralExperienceBranch`.

### 1. Настоящий replay learning

Replay теперь изменяет реальные синаптические `edgeWeights` и action-readout через ограниченный signed temporal-error credit. Сохраняются gating, verified-weighting, uncertainty update и delay learning.

### 2. Cross-modal binding

Добавлен компактный 8-канальный binding layer:
- pair traces;
- адаптивные pair weights;
- устойчивый cross-modal agreement;
- fused binding vector;
- участие fused vector в live neural input и prediction.

### 3. Persistence

Новые поля сохраняются внутри `NeuralExperienceBranchState` и восстанавливаются после restart:
- replayWeightUpdates;
- replaySignedCredit01;
- crossModalAgreement01;
- crossModalUpdates;
- crossModalPairWeights;
- crossModalTraces.

## Проверка

`test:p2850:neural-continuity`:
- cross-modal updates: 12;
- aligned agreement: 0.2103;
- contradictory agreement: 0.1176;
- replay weight updates: 4032;
- persistence: PASS.

`typecheck`: PASS.
`test:p2850:core`: PASS (8 live runtime cycles; cross-modal updates=8; replay weight updates=576; persistence=PASS).

`verify:release-source`: PASS.
`audit:contract`: PASS.

## Research basis

Experience replay и continual-learning литература используются как инженерное основание для ограничения forgetting и улучшения rehearsal. См. research/2026-09-21/P2850/P2850_RESEARCH_AND_DESIGN_RU.md.
