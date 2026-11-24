# R26 mLSTM assimilation

Date: 2026-09-30

## What was assimilated

This release adds a portable TypeScript mLSTM recurrent substrate and a single `NeuralSubstrateBackend` composition root.

The implementation follows the public mLSTM recurrence used by NX-AI's `mlstm_kernels` project: stabilized log-sigmoid forget gating, max-state stabilization, matrix cell state `C`, normalizer state `N`, scalar max-state `M`, scaled query readout and numerically stabilized normalization.

The current organism keeps `CanonicalNeuralSubstrate` as the sole canonical learner. mLSTM is a shadow/ablation substrate until matched learning experiments demonstrate a real advantage. It is therefore not allowed to silently become a second identity, memory, policy, or provenance owner.

## External source

- NX-AI `mlstm_kernels`: https://github.com/NX-AI/mlstm_kernels
- NX-AI `xLSTM`: https://github.com/NX-AI/xlstm
- xLSTM 7B paper: https://arxiv.org/abs/2405.04517
- TFLA paper: https://arxiv.org/abs/2503.14376

The source repository uses the NXAI Community License. This archive does not vendor its Triton/PyTorch source. The TypeScript recurrence here is an independent implementation of the published recurrence for a portable local backend.

## Acceptance rule

mLSTM may enter the canonical path only after an apples-to-apples evaluation against the existing recurrent substrate covering predictive error, holdout generalization, delayed reward, memory/CPU cost, checkpoint/recovery and ablation behaviour.
