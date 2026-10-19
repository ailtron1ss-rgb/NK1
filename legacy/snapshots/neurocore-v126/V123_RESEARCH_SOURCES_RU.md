# V123 — Research Sources

## Sparse Delta Memory
Meta/Facebook reference implementation: https://github.com/facebookresearch/sparse-delta-memory
Paper: https://arxiv.org/abs/2607.07386

Используется как внешний benchmark/архитектурный reference для product-key sparse memory, gated delta write и hardware-aware sparse execution. NeuroCore не копирует этот код в current trunk.

## GatedDeltaNet-2
Official/primary reference family: https://github.com/NVlabs/GatedDeltaNet-2

Используется как источник идей независимого erase/write control и более выразительной memory-update dynamics.

## Mamba-3
Official repository: https://github.com/state-spaces/mamba
Paper: https://arxiv.org/abs/2603.15569

V123 проверяет, что heavy-tail activation действительно проходит в вычислительный путь и не теряется при одновременном включении adaptive linearity.

## TTTLA
Official code: https://github.com/nv-tlabs/tttla
Paper: https://arxiv.org/abs/2602.21204

Работа мотивирует не добавлять отдельный optimizer-like memory subsystem без необходимости и рассматривать KV-binding TTT через learned linear-attention perspective.
