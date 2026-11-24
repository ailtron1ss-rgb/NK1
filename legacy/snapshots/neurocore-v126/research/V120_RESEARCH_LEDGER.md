# NeuroCore V120 Research Ledger

This directory is the persistent research memory for V120.

### Integrated
- standalone causal trunk
- sparse recurrent associative spine
- preconditioned delta update
- per-sample causal fast plasticity
- explicit recurrent state carry + TBPTT detach
- causal HiPPO history state (candidate pathway)

### Candidate / not default
- adaptive_hybrid HiPPO+cascade temporal credit
- product-key sparse memory
- gated product-key sparse-delta memory
- Mamba-3 heavy-tail activation
- synergy feedback
- event-specific fast-weight bank
- QED / independent erase-address
- EFLA exact integrator
- optimizer post-update alignment

### Known limitations
- long-horizon absolute recall remains weak on synthetic delayed-cue tasks
- event-bank requires an explicit credit/routing key for true disambiguation
- sparse product-key memory has not yet demonstrated consistent full-trunk training gains
- CPU-only long sweeps are expensive; heavy qualification remains a dedicated workload

### Admission rule
No candidate is promoted solely from a finite run. Require matched baseline, multi-seed repeatability, ablation, stress/interference test, and resource accounting.
