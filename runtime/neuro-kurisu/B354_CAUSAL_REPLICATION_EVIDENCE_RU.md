# B354 Causal Replication Evidence

Источник: `tests/big-pass-354-replicated-causal-snn.mjs`.

Критерий PASS: 5/5 independent trajectories, 4/4 contexts per trajectory, mean causal L1 >= 0.05 per seed, causal/sham >= 2 per seed, all 4 contexts pass >= 0.04 and >=1.5 ratio, lesion persistent after restart, neural cycle delta >= 50; global mean causal L1 >= 0.05 and global ratio >= 2.

Фактически: 5/5 seeds; 20/20 contexts; global causal L1 0.1132610944; global sham L1 0.0336599701; ratio 3.3648602175.
