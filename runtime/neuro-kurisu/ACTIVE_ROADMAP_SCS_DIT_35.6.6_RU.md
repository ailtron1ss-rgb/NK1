# Active Roadmap — 35.6.6

1. Brick 0 — SPINE_ONLY: CLOSED.
2. Brick 1 — DIT: PASS with matched baseline, direct policy distribution and complete B299 identity-owner ablation.
3. Brick 2 — Cheap cycle / long horizon: CLOSED on host mobile-profile: 1000 cycles, 14.864–16.929 ms/cycle, restart at cycle 500. Physical Android remains OPEN.
4. Brick 3 — Causal SNN: REPLICATION CLOSED on host. B269 90% structural lesion changes the 7-action policy distribution across 5 independent training trajectories × 4 contexts; every trajectory passed after restart, with persistent lesion and neural-cycle continuity. Physical Android remains OPEN.
5. Brick 4 — compositional actions: NOT STARTED.

Rule: no Brick 4 implementation until Brick 3 is independently replicated across multiple contexts/seeds and the physical device gate has a first real run.

## B354 — актуальный статус
- Brick 3 causal-SNN replication: PASS / CLOSED on host.
- Метрика: 7-мерное softmax policy distribution, не частота случайных action.
- 5 независимых training trajectories: 101 / 202 / 303 / 404 / 505.
- 4 контекста в каждой траектории: epistemic / autonomy / maintenance / mixed.
- 20/20 контекстных репликаций прошли порог causal L1 >= 0.04 и causal/SHAM >= 1.5.
- Global mean causal L1: 0.11326.
- Global mean SHAM L1: 0.03366.
- Global causal/SHAM ratio: 3.36x.
- Каждая ветка прошла через реальный snapshot -> новый OrganismCore -> продолжение holdout; structural lesion сохранилась после restart.
- B269 neural cycles delta: 80 в каждом holdout-контексте.
- Это доказывает причинную функциональную роль B269 в текущем decision spine, но не утверждает, что B269 является единственным источником поведения и не доказывает сознание.
- Physical Android/Termux gate: OPEN.
- Следующий обязательный этап: Brick 4 — compositional action programs, но сначала сохранить текущую causal baseline и не разрушить B269 attribution.
