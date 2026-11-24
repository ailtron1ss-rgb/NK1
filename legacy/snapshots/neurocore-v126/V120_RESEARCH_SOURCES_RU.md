# V120 — Research Sources

## Sparse Delta Memory
Meta/Facebook Research public reference implementation: product-key sparse memory with gated delta-rule updates. Paper: arXiv:2607.07386. Source: https://github.com/facebookresearch/sparse-delta-memory

We use the architectural idea but do not copy upstream code. Upstream README notes learned initial state M0 and long-context gains versus Mamba2/GDN in their matched 1.4B experiments. The upstream repository is CC-BY-NC 4.0, so this release contains an independent implementation rather than copied source.

## Mamba-3
Lahoti et al., 2026, “Mamba-3: Improved Sequence Modeling using State Space Principles”, arXiv:2603.15569. Official implementation exposes a heavy-tail activation for data-dependent state dynamics. Source: https://github.com/state-spaces/mamba/blob/main/mamba_ssm/modules/mamba3.py

We use only the small mathematical activation as an isolated candidate. No Mamba code or kernel is bundled.

## Gradient-Update Alignment
Xiao et al., 2026, arXiv:2609.01558; official source: https://github.com/JingXiao10/GUA. This informed the V114-V120 update-geometry audit but is not promoted as default training policy.

## Temporal Credit
The current temporal stack remains informed by eligibility traces, cascading eligibility, HiPPO/S4-style state representations, and learned-update/test-time-training research. Candidate decisions remain benchmark-gated.
