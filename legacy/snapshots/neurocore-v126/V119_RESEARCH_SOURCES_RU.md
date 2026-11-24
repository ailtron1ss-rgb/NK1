# V119 — RESEARCH SOURCES

1. **HiPPO / S4** — официальный `state-spaces/s4`, включая HiPPO construction, LegS matrices и S4 standalone implementation.
   - https://github.com/state-spaces/s4
   - https://github.com/state-spaces/s4/blob/main/models/s4/s4.py
   - HiPPO: arXiv:2008.07669
2. **Sparse Delta Memory** — официальный Meta/Facebook Research implementation; combines product-key sparse memory with gated delta-rule updates and discusses learned initial memory state.
   - https://github.com/facebookresearch/sparse-delta-memory
   - arXiv:2607.07386
3. **Gated DeltaNet-2** — official NVIDIA PyTorch implementation; independent channel-wise erase/write gates.
   - https://github.com/NVlabs/GatedDeltaNet-2
   - arXiv:2605.22791
4. **Kalman Delta Networks** — uncertainty-aware associative-memory formulation.
   - arXiv:2609.07816

Only mathematical/state-transition ideas relevant to the current experiments were adapted; no upstream repository is copied wholesale.
