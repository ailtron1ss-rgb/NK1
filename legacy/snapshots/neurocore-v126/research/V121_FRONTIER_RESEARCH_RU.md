# V121 frontier research note

## Decision

V121 не продвигает `token_decay` в default trunk. Его архитектурная идея соответствует современным gated-delta/SSM направлениям, но локальная matched-проверка не показала полезного выигрыша.

## Why the candidate exists

Современный Gated DeltaNet-2 использует отдельные erase/write gates и channel-wise decay. Sparse Delta Memory и Raven усиливают другую ось — sparse addressing и выборочное редактирование состояния. Эти идеи совместимы концептуально, но не должны превращаться в независимые duplicate memory owners.

## Next experiment

Сравнивать не названия архитектур, а один общий benchmark: long-horizon recall, amplitude, cosine, interference, capacity, update sparsity, wall-clock и memory traffic.
