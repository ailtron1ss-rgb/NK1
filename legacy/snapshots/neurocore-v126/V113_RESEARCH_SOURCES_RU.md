# V113 — актуальные внешние исследования и исходники

## Основные источники

- **Gated DeltaNet-2 (2026)** — разделяет erase и write по каналам и использует channel-wise decay. Использовано как reference для текущего `erase_control` + `write` раздельно.
  https://github.com/NVlabs/GatedDeltaNet-2
- **Preconditioned DeltaNet (2026)** — curvature-aware preconditioning для линейных рекуррентностей. Использовано как reference для trainable diagonal preconditioner.
  https://github.com/ntumm120/preconditioned-deltanet
- **Kalman Delta Networks (2026)** — isotropic/diagonal uncertainty state и Kalman-derived write gain. Использовано как candidate source для uncertainty-aware write.
  https://github.com/ngocbh/kalman-delta-networks
- **Cascading Eligibility Traces (ICLR 2026)** — state-space cascade для более точного temporal credit assignment без обычного смешивания exponential traces.
  https://proceedings.iclr.cc/paper_files/paper/2026/hash/e647dad9086b5a4cc136e1d1926cc172-Abstract-Conference.html
- **EFLA (2026)** — exact continuous-time solution of the rank-1 delta update.
  https://github.com/declare-lab/EFLA
- **Selective Eligibility Traces (2026)** — selective/non-uniform credit вместо blanket trajectory credit. В NeuroCore перенесена только parameter-free per-sample gating idea как candidate, без копирования RLVR-specific assumptions.
  https://arxiv.org/abs/2605.05965
- **Raven (2026)** — sparse memory routing with selective slot updates для high-recall sequence modeling. Это наиболее близкий внешний reference к нашему top-k row routing.
  https://github.com/goombalab/raven
- **δ-mem (2026)** — compact online associative memory с delta-rule write strategies.
  https://github.com/declare-lab/delta-Mem
- **TTTLA (ICML 2026)** — показывает, что KV-binding TTT можно рассматривать как learned linear attention; поддерживает дальнейшее упрощение substrate вместо накопления optimizer-like модулей.
  https://github.com/nv-tlabs/tttla
- **Mamba-3 (ICLR 2026)** — richer recurrence, complex state tracking и MIMO как reference directions для следующего capacity/state-tracking поколения.
  https://arxiv.org/abs/2603.15569

## Правило интеграции

Источник сначала проходит source audit → минимальный mathematical adaptation → isolated benchmark → matched ablation → decision. Никакой внешний механизм не считается integrated только по наличию файла или import.
