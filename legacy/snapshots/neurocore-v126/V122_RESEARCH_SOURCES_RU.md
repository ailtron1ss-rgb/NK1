# V122 — Research Sources

Актуальные источники, использованные как архитектурные ориентиры, а не как готовые модули для копирования:

- Sparse Delta Memory (2026): product-key sparse memory + gated delta rule, reference implementation with Triton/CUDA kernels. https://arxiv.org/abs/2607.07386 ; https://github.com/facebookresearch/sparse-delta-memory
- Gated DeltaNet-2 (2026): channel-wise erase/write gates and channel-wise decay. https://arxiv.org/abs/2605.22791 ; https://github.com/NVlabs/GatedDeltaNet-2
- Raven (2026): sparse input-dependent state editing for reducing dense-update interference. https://arxiv.org/abs/2607.25357
- Mamba / Mamba-3 source tree: hardware-aware selective state-space implementations and current Mamba-3 source. https://github.com/state-spaces/mamba
- TTTLA (2026): analysis reducing KV-binding TTT to learned linear attention, useful as a guard against redundant optimizer-like memory subsystems. https://arxiv.org/abs/2602.21204

## Interpretation for NeuroCore

NeuroCore V122 deliberately combines only compatible principles: sparse routing, explicit runtime slots, bounded delta updates and state-contained aging. External kernels/architectures are not copied wholesale. Candidate mechanisms remain gated by local ablations.
