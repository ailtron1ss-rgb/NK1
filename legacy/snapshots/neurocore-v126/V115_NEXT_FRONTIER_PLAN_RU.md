# V115 — Большой qualification pass

Цель: один reproducible evidence stack для long-horizon credit, multi-event interference, capacity/rank и current-trunk coverage.

## Applied
- parameter-free surprise-gated associative write (`surprise_write_strength`, default 0.0), inspired by test-time memorization/surprise gating but implemented independently;
- reproducible long-horizon delayed-credit sweep: 16/32/64/128/256, 3 seeds, 5 credit modes;
- multi-event interference comparison: shared fast state vs event-specific bank;
- rank/capacity profile: 8/12/16/24;
- explicit runtime continuity regression test;
- benchmark evidence written to `evidence/V115_LARGE_QUALIFICATION.json`.

## Qualification rule
Ни один candidate не продвигается в default только по одному synthetic result. Требуются matched seeds, long-horizon, interference/recovery, ablation и resource evidence.

## Research basis
- Gated DeltaNet-2: separate erase/write dynamics;
- Preconditioned DeltaNet: curvature-aware online regression;
- Kalman Delta Networks: uncertainty-aware associative memory;
- Titans / TTTLA: test-time memory and the linear-attention interpretation of KV-binding TTT;
- GUA: optimizer-update mismatch and applied-update alignment.
