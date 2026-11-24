# V114 — источники

- GUA / Gradient-Update Alignment, arXiv: 2609.01558, 2026. https://arxiv.org/abs/2609.01558 ; official code: https://github.com/JingXiao10/GUA
- PCGrad, Gradient Surgery for Multi-Task Learning: https://github.com/tianheyu927/PCGrad
- Preconditioned DeltaNet: https://arxiv.org/abs/2604.21100
- Gated DeltaNet-2: https://arxiv.org/abs/2605.22791 ; https://github.com/NVlabs/GatedDeltaNet-2
- Kalman Delta Networks: https://arxiv.org/abs/2609.07816 ; https://github.com/ngocbh/kalman-delta-networks
- TTTLA: https://arxiv.org/abs/2602.21204 ; https://github.com/nv-tlabs/tttla
- CET: https://proceedings.iclr.cc/paper_files/paper/2026/hash/e647dad9086b5a4cc136e1d1926cc172-Abstract-Conference.html
- Raven: https://github.com/goombalab/raven


## Применение GUA-подхода
В V114 реализован не копируемый вслепую optimizer, а наблюдаемая диагностика: objective gradients → AdamW transform → фактический applied update. Candidate alignment работает только на небольшом shared probe и остаётся выключенным по умолчанию, поскольку optimizer moment state ещё не синхронизируется с изменённым update.
