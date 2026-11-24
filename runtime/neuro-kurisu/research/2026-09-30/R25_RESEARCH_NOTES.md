# R25 Research Notes

## External sources

- Mamba-3: improved recurrence, complex-valued state update and MIMO are presented as the 2026 design directions for efficient state tracking. Source: arXiv 2603.15569.
- Preconditioned DeltaNet: diagonal preconditioning is proposed as a curvature-aware improvement to delta-rule recurrences. Source: arXiv 2604.21100.
- Gated DeltaNet-2: erase and write gates are explicitly separated. Source: arXiv 2605.22791.
- HiPPO: polynomial projection is a formal approach to online compression of sequential history. Source: arXiv 2008.07669.
- MoBA: dynamic block routing is a sparse attention strategy for long contexts. Source: arXiv 2502.13189.

## R25 integration choice

The project is CPU/Termux-first. Therefore only mathematical/architectural ideas with a faithful local implementation were promoted into canonical code. GPU kernel claims, external CLIs, and distributed communication were kept outside the canonical path.

## Important distinction

The attached NeuroCore v128 architecture analysis contains useful design hypotheses, but also presents implementation-level claims and speed percentages that are not independently validated against the current Neuro-Kurisu tree. R25 therefore treats it as a source of candidate mechanisms, not as proof of performance.
