
## P2805 — Stability/Plasticity + Weight-Space Consolidation

P2805 закрывает следующий системный разрыв после P2774: replay и continual learning должны не только удерживать старые знания, но и сохранять способность учиться. В `NeuralExperienceBranch` добавлены context-aware stability/plasticity arbitration, sparse/protected neuron gates, slow weight references, bounded teacher pull, selective reset dormant/low-utility candidates и replay compatibility guard.

Research basis:
- ICLR 2026 Weight Space Consolidation: https://proceedings.iclr.cc/paper_files/paper/2026/hash/17fc58b1ba92abbb72c5f457e140d851-Abstract-Conference.html
- L2RL 2026 selective weight reinitialization: https://proceedings.mlr.press/v330/hernandez-garcia26a.html
- CVPR Findings 2026 Wake the Sleeping Weights: https://openaccess.thecvf.com/content/CVPR2026F/html/Ji_Wake_the_Sleeping_Weights_Sparsely-Activated_Continual_Test-Time_Adaptation_for_Medical_CVPRF_2026_paper.html
- PMLR 2026 Replay can provably increase forgetting: https://proceedings.mlr.press/v330/mahdaviyeh26a.html
- ACL 2026 FOREVER: https://aclanthology.org/2026.acl-long.1144/

Реализованные тесты: `tests/p2805-stability-plasticity.mjs`, `tests/p2805-factorial.mjs`.
