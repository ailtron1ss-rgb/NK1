# R20 Research Notes

## All-Mem

All-Mem's current source proposes bounded visible memory, offline topology repair, non-destructive edits and typed recovery links. R20 adopts the principle, but keeps the project dependency-light and canonical-memory-owned.

Repository: https://github.com/LvCan926/All-Mem
Paper: arXiv:2603.19595

## Memory conflict / stale state

The R20 design treats provenance and evidence independence as first-class signals rather than allowing recency alone to overwrite memory. This is aligned with recent stale-memory work emphasizing that memory can remain semantically wrong after an apparently successful update.

## Neural substrate

Mamba-3 and modern selective state-space work remain an experimental candidate for a lightweight persistent recurrent substrate. No external CUDA/PyTorch dependency was added to the canonical Termux path in R20.

## Experimental status

Research material in this file is design guidance, not evidence that an external method improves Neuro-Kurisu. Any future adoption must pass project-specific ablation, replay, mobile, and evidence-gating tests.
