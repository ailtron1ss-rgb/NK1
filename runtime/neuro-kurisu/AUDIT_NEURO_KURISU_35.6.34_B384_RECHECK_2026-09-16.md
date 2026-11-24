# Neuro-Kurisu 35.6.34 — B384 Recheck

## Статус релиза
- release: B384
- application: 35.6.34
- state schema: 138
- phase: Stage-32/SCS-DIT/brick-19-autobiographical-value-goal-continuity

## Главная проверяемая способность
Проверенный жизненный опыт должен причинно изменять будущую policy и сохраняться через restart; unverified evidence не должен обучать.

## Evidence
- B384 causal: PASS — 280 verified episodes, 2240 value revisions, 272 goal-value revisions, causalDelta 0.5533758229, history knockout 0.5533758229, restart exact.
- B384 runtime: PASS — 36 verified episodes, 288 value revisions, retrieval rows 8, restart exact.
- B384 B380 auto-promotion: PASS — 64 verified episodes, 512 value revisions, 60 goal-value revisions, restart exact.
- B384 performance: PASS — 1400 cycles, p50 0.65789 ms, p95 3.63629 ms, p99 4.83228 ms, max 35.32245 ms, heap 18.63 MiB.
- B383 contextual memory: PASS after B384 history-gate correction; old B383 OFF baseline is preserved.
- B380 temporal causal/runtime: PASS.
- B379 recovery causal/runtime: PASS.
- B378 consequence gate: PASS; host evidence remains derived/unverified.

## Known unverified areas
- full heavy organism smoke / historical cascade may exceed execution limits in this environment;
- physical Android / physical Termux certification is not present in this host session.

## Architectural integrity
B365 remains sole canonical neural decision owner. B384 does not create a parallel policy network.
